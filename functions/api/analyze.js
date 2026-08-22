/* ========================================
   CF PAGES FUNCTION — Website Analyzer
   Real HTML fetch + conversion signal analysis

   Hardened:
   - URL validation (no private/internal hosts, no credentials)
   - Per-IP rate limiting + global concurrency guard
   - Streaming body read with size cap
   - External stylesheet fetch for accurate responsive checks
   - Honest HTTP status codes (400 / 502 / 200)
   ======================================== */
const MAX_HTML_BYTES = 800 * 1024;
const MAX_CSS_BYTES = 300 * 1024;
const MAX_CSS_FILES = 5;
const FETCH_TIMEOUT_MS = 12000;
const CSS_TIMEOUT_MS = 6000;
const RATE_LIMIT = 15;
const RATE_WINDOW_MS = 60 * 1000;
const MAX_CONCURRENT = 8;

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

// ---------- rate limiting (per-isolate, best effort) ----------
const hits = new Map();
let active = 0;

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(ts => now - ts < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) { hits.set(ip, list); return true; }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear();
  return false;
}

// ---------- URL validation ----------
function validateUrl(input) {
  let raw = String(input || '').trim();
  if (!raw) return null;
  if (!/^https?:\/\//i.test(raw)) raw = 'https://' + raw;
  let parsed;
  try { parsed = new URL(raw); } catch (e) { return null; }
  if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
  if (parsed.username || parsed.password) return null;
  const host = parsed.hostname.toLowerCase();
  if (!host.includes('.')) return null;
  if (/^(localhost|127\.|10\.|192\.168\.|169\.254\.|0\.0\.0\.0$)/.test(host)) return null;
  if (/^172\.(1[6-9]|2\d|3[01])\./.test(host)) return null;
  if (host === '::1' || host.endsWith('.local') || host.endsWith('.internal')) return null;
  return parsed.href;
}

// ---------- capped body reader ----------
async function readBodyCapped(response, maxBytes) {
  const reader = response.body.getReader();
  const decoder = new TextDecoder('utf-8', { stream: true });
  let text = '';
  let total = 0;
  try {
    while (total < maxBytes) {
      const { done, value } = await reader.read();
      if (done) break;
      total += value.byteLength;
      text += decoder.decode(value, { stream: true });
      if (total >= maxBytes) {
        text += decoder.decode();
        try { await reader.cancel(); } catch (e) { /* already done */ }
      }
    }
  } finally {
    try { reader.releaseLock(); } catch (e) { /* noop */ }
  }
  return { text, truncated: total >= maxBytes };
}

async function fetchTextCapped(url, timeoutMs, maxBytes, acceptHeader) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GAWebsiteAnalyzer/1.0)',
        'Accept': acceptHeader || 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      }
    });
    if (!res.ok) return null;
    const { text } = await readBodyCapped(res, maxBytes);
    return text;
  } catch (e) {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

function extractStylesheetUrls(html, baseUrl) {
  const urls = [];
  const linkTags = html.match(/<link[^>]*>/gi) || [];
  for (const tag of linkTags) {
    if (!/rel\s*=\s*["']?[^"'>]*stylesheet/i.test(tag)) continue;
    const hrefMatch = tag.match(/href\s*=\s*["']([^"' ]+)["']/i);
    if (!hrefMatch) continue;
    try {
      const abs = new URL(hrefMatch[1], baseUrl);
      if (abs.protocol === 'http:' || abs.protocol === 'https:') urls.push(abs.href);
    } catch (e) { /* skip malformed */ }
    if (urls.length >= MAX_CSS_FILES) break;
  }
  return urls;
}

function sanitizeError(err) {
  const msg = String(err && err.message || err);
  if (/abort/i.test(msg)) return 'Website took too long to respond';
  if (/ENOTFOUND|getaddrinfo|dns/i.test(msg)) return 'Domain not found — check the address';
  if (/SSL|certificate|TLS/i.test(msg)) return 'SSL/TLS certificate problem';
  return 'Could not reach website';
}

// Pre-check DNS via DoH: an unresolvable subrequest can terminate at the CF
// edge with a raw error before our handler can respond, so resolve first.
async function domainResolves(hostname) {
  const query = async (type) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 5000);
    try {
      const res = await fetch(
        'https://cloudflare-dns.com/dns-query?name=' + encodeURIComponent(hostname) + '&type=' + type,
        { headers: { 'accept': 'application/dns-json' }, signal: controller.signal }
      );
      return res.ok ? await res.json() : null;
    } catch (e) {
      return null;
    } finally {
      clearTimeout(timer);
    }
  };

  try {
    const a = await query('A');
    if (a === null) return true; // DoH unavailable — fail open, let fetch decide
    if (a.Answer && a.Answer.length) return true;
    const aaaa = await query('AAAA');
    if (aaaa === null) return true;
    if (aaaa.Answer && aaaa.Answer.length) return true;
    // Status 3 = NXDOMAIN; anything else unexpected -> don't block
    if (aaaa.Status !== 3 && a.Status !== 3) return true;
    return false;
  } catch (e) {
    return true;
  }
}

export async function onRequestPost(context) {
  const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';

  if (rateLimited(ip)) {
    return json({ error: 'Too many requests — please wait a minute.' }, 429);
  }

  let body;
  try {
    body = await context.request.json();
  } catch (e) {
    return json({ error: 'Invalid request body' }, 400);
  }

  const targetUrl = validateUrl(body && body.url);
  if (!targetUrl) {
    return json({ error: 'Invalid URL' }, 400);
  }

  if (!(await domainResolves(new URL(targetUrl).hostname))) {
    return json({ error: 'Domain not found — check the address', offline: true }, 422);
  }

  if (active >= MAX_CONCURRENT) {
    return json({ error: 'Analyzer is busy — please retry in a moment.' }, 503);
  }

  active++;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    let response;
    try {
      response = await fetch(targetUrl, {
        signal: controller.signal,
        redirect: 'follow',
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; GAWebsiteAnalyzer/1.0)',
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
        }
      });
    } catch (err) {
      return json({ error: sanitizeError(err), offline: true }, 422);
    } finally {
      clearTimeout(timer);
    }

    if (!response.ok) {
      return json({ error: `Site returned HTTP ${response.status}`, offline: true }, 422);
    }

    const contentType = (response.headers.get('Content-Type') || '').toLowerCase();
    if (contentType && !contentType.includes('html') && !contentType.includes('xml') && !contentType.includes('text/plain')) {
      return json({ error: 'URL did not return an HTML page', offline: true }, 422);
    }

    const { text: html } = await readBodyCapped(response, MAX_HTML_BYTES);
    const finalUrl = response.url || targetUrl;

    // Fetch external stylesheets so responsive checks are accurate
    const cssUrls = extractStylesheetUrls(html, finalUrl);
    const cssResults = await Promise.allSettled(
      cssUrls.map(u => fetchTextCapped(u, CSS_TIMEOUT_MS, MAX_CSS_BYTES, 'text/css,*/*;q=0.5'))
    );
    const cssText = cssResults.map(r => (r.status === 'fulfilled' && r.value) ? r.value : '').join('\n');

    return json(analyzeHTML(html, cssText, finalUrl), 200);

  } catch (err) {
    return json({ error: sanitizeError(err), offline: true }, 422);
  } finally {
    active--;
  }
}

export async function onRequestOptions() {
  return new Response(null, { status: 204 });
}

function analyzeHTML(html, cssText, url) {
  const lower = html.toLowerCase();
  const styleText = (cssText || '').toLowerCase() + ' ' + lower;
  const issues = [];
  const wins = [];
  let scoreDesign = 70;
  let scoreMobile = 60;
  let scorePerf = 65;

  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) { issues.push('Missing or empty <title> tag'); scoreDesign -= 8; }
  else if (titleMatch[1].trim().length < 10) { issues.push('Title tag too short — poor SEO signal'); scoreDesign -= 4; }
  else { wins.push('Title tag present'); }

  if (!lower.includes('meta name="description"') && !lower.includes("meta name='description'")) { issues.push('Missing meta description — hurts CTR from search'); scoreDesign -= 5; }
  else { wins.push('Meta description present'); }

  if (!lower.includes('og:title')) { issues.push('Missing Open Graph tags — poor social sharing preview'); scoreDesign -= 3; }
  else { wins.push('Open Graph tags present'); }

  if (!lower.includes('rel="icon"') && !lower.includes('rel="shortcut icon"') && !lower.includes('.ico')) { issues.push('Missing favicon'); scoreDesign -= 2; }

  if (url.startsWith('https://')) { wins.push('HTTPS enabled'); scoreDesign += 5; }
  else { issues.push('Not using HTTPS — browsers show "Not Secure" warning'); scoreDesign -= 10; scorePerf -= 5; }

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) { issues.push('No <h1> tag — poor SEO and accessibility'); scoreDesign -= 5; }
  else if (h1Count > 1) { issues.push('Multiple <h1> tags — confusing page hierarchy'); scoreDesign -= 3; }
  else { wins.push('Single <h1> tag present'); }

  if (!lower.includes('viewport') || !lower.includes('width=device-width')) { issues.push('Missing mobile viewport meta tag — site not mobile-optimized'); scoreMobile -= 25; }
  else { wins.push('Mobile viewport tag present'); scoreMobile += 15; }

  const hasMediaQueries = styleText.includes('@media');
  const hasFlexbox = styleText.includes('display:flex') || styleText.includes('display: flex');
  const hasGrid = styleText.includes('display:grid') || styleText.includes('display: grid');
  if (hasMediaQueries || hasFlexbox || hasGrid) { wins.push('Responsive CSS detected'); scoreMobile += 10; }
  else { issues.push('No responsive CSS detected — likely not mobile-friendly'); scoreMobile -= 15; }

  const imgCount = (html.match(/<img[\s>]/gi) || []).length;
  const lazyImages = (lower.match(/loading="lazy"/g) || []).length;
  if (imgCount > 0) {
    if (lazyImages === 0) { issues.push(`${imgCount} images without lazy loading — slow initial load`); scorePerf -= 10; }
    else { wins.push(`${lazyImages} images with lazy loading`); scorePerf += 5; }
  }

  const imgNoDimensions = (html.match(/<img(?![^>]*(width|height))[^>]*>/gi) || []).length;
  if (imgNoDimensions > 3) { issues.push(`${imgNoDimensions} images missing width/height — causes layout shift (CLS)`); scorePerf -= 5; }

  const inlineStyleCount = (lower.match(/<style[\s>]/g) || []).length;
  const inlineScriptCount = (lower.match(/<script[\s>]/g) || []).length;
  if (inlineStyleCount > 5 || inlineScriptCount > 8) { issues.push('Excessive inline CSS/JS — consider bundling'); scorePerf -= 5; }

  const hasGA = lower.includes('google-analytics') || lower.includes('gtag') || lower.includes('googletagmanager');
  const hasFBPixel = lower.includes('fbq(') || lower.includes('facebook.net');
  const hasHotjar = lower.includes('hotjar');
  if (hasGA || hasFBPixel || hasHotjar) { wins.push('Analytics/tracking detected'); }
  else { issues.push('No analytics or conversion tracking detected'); scorePerf -= 5; }

  const formCount = (html.match(/<form[\s>]/gi) || []).length;
  const hasEmailInput = lower.includes('type="email"') || lower.includes("type='email'");
  const hasPhoneInput = lower.includes('type="tel"') || lower.includes("type='tel'");
  if (formCount === 0) { issues.push('No contact forms found — no way for visitors to convert'); scoreDesign -= 12; }
  else { wins.push(`${formCount} form(s) found`); if (hasEmailInput) wins.push('Email input detected'); if (hasPhoneInput) wins.push('Phone input detected'); }

  const ctaKeywords = ['get started', 'sign up', 'contact us', 'get a quote', 'request', 'book', 'schedule', 'buy', 'order', 'subscribe', 'download', 'free', 'audit', 'consultation'];
  if (ctaKeywords.some(kw => lower.includes(kw))) { wins.push('Call-to-action text detected'); scoreDesign += 5; }
  else { issues.push('No clear call-to-action text found'); scoreDesign -= 8; }

  const proofKeywords = ['testimonial', 'review', 'client', 'customer', 'trust', 'rating', 'star', 'feedback', 'case study', 'portfolio'];
  if (proofKeywords.some(kw => lower.includes(kw))) { wins.push('Social proof elements detected'); scoreDesign += 5; }
  else { issues.push('No social proof elements — testimonials, reviews, or case studies'); scoreDesign -= 5; }

  const hasPhone = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(html) || lower.includes('tel:');
  const hasEmail = lower.includes('mailto:');
  if (hasPhone || hasEmail) { wins.push('Contact information present'); }
  else { issues.push('No visible phone number or email — trust and conversion barrier'); scoreDesign -= 5; }

  const copyrightMatch = lower.match(/©|&copy;|copyright.*?(\d{4})/);
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1]);
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1) { issues.push(`Copyright year outdated (${year}) — signals neglected site`); scoreDesign -= 5; }
    else { wins.push('Copyright year current'); }
  }

  if (lower.includes('.swf') || /\bflash\b/.test(lower)) { issues.push('Uses Adobe Flash — obsolete technology'); scoreDesign -= 15; scoreMobile -= 20; }
  if (lower.includes('jquery')) { issues.push('Uses jQuery — consider modern lightweight alternatives'); scorePerf -= 3; }

  if (lower.includes('application/ld+json') || lower.includes('itemtype')) { wins.push('Structured data (Schema.org) detected'); scoreDesign += 3; }
  else { issues.push('No structured data — missed rich snippet opportunity'); scoreDesign -= 2; }

  scoreDesign = Math.max(10, Math.min(95, scoreDesign));
  scoreMobile = Math.max(10, Math.min(95, scoreMobile));
  scorePerf = Math.max(10, Math.min(95, scorePerf));
  const total = Math.round((scoreDesign + scoreMobile + scorePerf) / 3);

  return {
    design: scoreDesign, mobile: scoreMobile, performance: scorePerf, total,
    issues, wins,
    htmlSize: Math.round(html.length / 1024),
    imageCount: imgCount, formCount,
    hasAnalytics: hasGA || hasFBPixel,
    https: url.startsWith('https://')
  };
}
