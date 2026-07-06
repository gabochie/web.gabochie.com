/* ========================================
   NETLIFY FUNCTION — Website Analyzer
   Real HTML fetch + conversion signal analysis
   ======================================== */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { url } = JSON.parse(event.body || '{}');
    if (!url || !url.includes('.')) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Invalid URL' }) };
    }

    const targetUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(targetUrl, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GAWebsiteAnalyzer/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });
    clearTimeout(timeout);

    if (!response.ok) {
      return {
        statusCode: 200,
        headers,
        body: JSON.stringify({
          error: `HTTP ${response.status}`,
          design: 30, mobile: 30, performance: 30, total: 30,
          issues: [`Website returned HTTP ${response.status}`],
          wins: [], offline: true
        })
      };
    }

    const html = await response.text();
    const result = analyzeHTML(html, targetUrl);
    return { statusCode: 200, headers, body: JSON.stringify(result) };

  } catch (err) {
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        error: err.message,
        design: 30, mobile: 30, performance: 30, total: 30,
        issues: ['Could not fetch website — ' + err.message],
        wins: [], offline: true
      })
    };
  }
};

function analyzeHTML(html, url) {
  const lower = html.toLowerCase();
  const issues = [];
  const wins = [];
  let scoreDesign = 70;
  let scoreMobile = 60;
  let scorePerf = 65;

  // Title tag
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) {
    issues.push('Missing or empty <title> tag');
    scoreDesign -= 8;
  } else if (titleMatch[1].trim().length < 10) {
    issues.push('Title tag too short — poor SEO signal');
    scoreDesign -= 4;
  } else {
    wins.push('Title tag present');
  }

  // Meta description
  if (!lower.includes('meta name="description"') && !lower.includes("meta name='description'")) {
    issues.push('Missing meta description — hurts CTR from search');
    scoreDesign -= 5;
  } else {
    wins.push('Meta description present');
  }

  // Open Graph
  if (!lower.includes('og:title')) {
    issues.push('Missing Open Graph tags — poor social sharing preview');
    scoreDesign -= 3;
  } else {
    wins.push('Open Graph tags present');
  }

  // Favicon
  if (!lower.includes('rel="icon"') && !lower.includes('rel="shortcut icon"') && !lower.includes('.ico')) {
    issues.push('Missing favicon');
    scoreDesign -= 2;
  }

  // HTTPS
  if (url.startsWith('https://')) {
    wins.push('HTTPS enabled');
    scoreDesign += 5;
  } else {
    issues.push('Not using HTTPS — browsers show "Not Secure" warning');
    scoreDesign -= 10;
    scorePerf -= 5;
  }

  // H1
  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) {
    issues.push('No <h1> tag — poor SEO and accessibility');
    scoreDesign -= 5;
  } else if (h1Count > 1) {
    issues.push('Multiple <h1> tags — confusing page hierarchy');
    scoreDesign -= 3;
  } else {
    wins.push('Single <h1> tag present');
  }

  // Viewport
  if (!lower.includes('viewport') || !lower.includes('width=device-width')) {
    issues.push('Missing mobile viewport meta tag — site not mobile-optimized');
    scoreMobile -= 25;
  } else {
    wins.push('Mobile viewport tag present');
    scoreMobile += 15;
  }

  // Responsive CSS
  const hasMediaQueries = lower.includes('@media');
  const hasFlexbox = lower.includes('display:flex') || lower.includes('display: flex');
  const hasGrid = lower.includes('display:grid') || lower.includes('display: grid');
  if (hasMediaQueries || hasFlexbox || hasGrid) {
    wins.push('Responsive CSS detected');
    scoreMobile += 10;
  } else {
    issues.push('No responsive CSS detected — likely not mobile-friendly');
    scoreMobile -= 15;
  }

  // Images
  const imgCount = (html.match(/<img[\s>]/gi) || []).length;
  const lazyImages = (lower.match(/loading="lazy"/g) || []).length;
  if (imgCount > 0) {
    if (lazyImages === 0) {
      issues.push(`${imgCount} images without lazy loading — slow initial load`);
      scorePerf -= 10;
    } else {
      wins.push(`${lazyImages} images with lazy loading`);
      scorePerf += 5;
    }
  }

  // Image dimensions
  const imgNoDimensions = (html.match(/<img(?![^>]*(width|height))[^>]*>/gi) || []).length;
  if (imgNoDimensions > 3) {
    issues.push(`${imgNoDimensions} images missing width/height — causes layout shift (CLS)`);
    scorePerf -= 5;
  }

  // Inline CSS/JS
  const inlineStyleCount = (lower.match(/<style[\s>]/g) || []).length;
  const inlineScriptCount = (lower.match(/<script[\s>]/g) || []).length;
  if (inlineStyleCount > 5 || inlineScriptCount > 8) {
    issues.push('Excessive inline CSS/JS — consider bundling');
    scorePerf -= 5;
  }

  // Analytics
  const hasGA = lower.includes('google-analytics') || lower.includes('gtag') || lower.includes('googletagmanager');
  const hasFBPixel = lower.includes('fbq(') || lower.includes('facebook.net');
  const hasHotjar = lower.includes('hotjar');
  if (hasGA || hasFBPixel || hasHotjar) {
    wins.push('Analytics/tracking detected');
  } else {
    issues.push('No analytics or conversion tracking detected');
    scorePerf -= 5;
  }

  // Forms
  const formCount = (html.match(/<form[\s>]/gi) || []).length;
  const hasEmailInput = lower.includes('type="email"') || lower.includes("type='email'");
  const hasPhoneInput = lower.includes('type="tel"') || lower.includes("type='tel'");
  if (formCount === 0) {
    issues.push('No contact forms found — no way for visitors to convert');
    scoreDesign -= 12;
  } else {
    wins.push(`${formCount} form(s) found`);
    if (hasEmailInput) wins.push('Email input detected');
    if (hasPhoneInput) wins.push('Phone input detected');
  }

  // CTA
  const ctaKeywords = ['get started', 'sign up', 'contact us', 'get a quote', 'request', 'book', 'schedule', 'buy', 'order', 'subscribe', 'download', 'free', 'audit', 'consultation'];
  const hasCTA = ctaKeywords.some(kw => lower.includes(kw));
  if (hasCTA) {
    wins.push('Call-to-action text detected');
    scoreDesign += 5;
  } else {
    issues.push('No clear call-to-action text found');
    scoreDesign -= 8;
  }

  // Social proof
  const proofKeywords = ['testimonial', 'review', 'client', 'customer', 'trust', 'rating', 'star', 'feedback', 'case study', 'portfolio'];
  const hasProof = proofKeywords.some(kw => lower.includes(kw));
  if (hasProof) {
    wins.push('Social proof elements detected');
    scoreDesign += 5;
  } else {
    issues.push('No social proof elements — testimonials, reviews, or case studies');
    scoreDesign -= 5;
  }

  // Contact info
  const hasPhone = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/.test(html) || lower.includes('tel:');
  const hasEmail = lower.includes('mailto:');
  if (hasPhone || hasEmail) {
    wins.push('Contact information present');
  } else {
    issues.push('No visible phone number or email — trust and conversion barrier');
    scoreDesign -= 5;
  }

  // Copyright
  const copyrightMatch = lower.match(/©|&copy;|copyright.*?(\d{4})/);
  if (copyrightMatch) {
    const year = parseInt(copyrightMatch[1]);
    const currentYear = new Date().getFullYear();
    if (year < currentYear - 1) {
      issues.push(`Copyright year outdated (${year}) — signals neglected site`);
      scoreDesign -= 5;
    } else {
      wins.push('Copyright year current');
    }
  }

  // Flash
  if (lower.includes('.swf') || lower.includes('flash')) {
    issues.push('Uses Adobe Flash — obsolete technology');
    scoreDesign -= 15;
    scoreMobile -= 20;
  }

  // jQuery
  if (lower.includes('jquery')) {
    issues.push('Uses jQuery — consider modern lightweight alternatives');
    scorePerf -= 3;
  }

  // Schema
  if (lower.includes('application/ld+json') || lower.includes('itemtype')) {
    wins.push('Structured data (Schema.org) detected');
    scoreDesign += 3;
  } else {
    issues.push('No structured data — missed rich snippet opportunity');
    scoreDesign -= 2;
  }

  // Clamp
  scoreDesign = Math.max(10, Math.min(95, scoreDesign));
  scoreMobile = Math.max(10, Math.min(95, scoreMobile));
  scorePerf = Math.max(10, Math.min(95, scorePerf));
  const total = Math.round((scoreDesign + scoreMobile + scorePerf) / 3);

  return {
    design: scoreDesign,
    mobile: scoreMobile,
    performance: scorePerf,
    total,
    issues,
    wins,
    htmlSize: Math.round(html.length / 1024),
    imageCount: imgCount,
    formCount,
    hasAnalytics: hasGA || hasFBPixel,
    https: url.startsWith('https://')
  };
}
