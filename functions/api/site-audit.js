/* ========================================
   CLOUDFLARE PAGES FUNCTION — Site Audit Engine
   Production-grade website quality auditor
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const body = await context.request.json();
    const { url } = body;
    if (!url || !url.includes('.')) {
      return new Response(JSON.stringify({ error: 'Invalid URL' }), { status: 400, headers });
    }

    const targetUrl = /^https?:\/\//.test(url) ? url : `https://${url}`;
    const startTime = Date.now();

    const response = await fetch(targetUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (compatible; GASiteAuditor/1.0)',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8'
      },
      redirect: 'follow'
    });

    const ttfb = Date.now() - startTime;
    const html = await response.text();

    const securityAudit = auditSecurity(html, targetUrl, response);
    const seoAudit = auditSEO(html, targetUrl);
    const performanceAudit = auditPerformance(html, ttfb);
    const accessibilityAudit = auditAccessibility(html);
    const codeAudit = auditCodeQuality(html);
    const linkAudit = auditLinks(html, targetUrl);
    const formAudit = auditForms(html);
    const sslAudit = await auditSSL(targetUrl);

    const categories = {
      performance: performanceAudit,
      security: securityAudit,
      accessibility: accessibilityAudit,
      seo: seoAudit,
      codeQuality: codeAudit,
      mobile: auditMobile(html),
      errorHandling: auditErrorHandling(html),
      analytics: auditAnalytics(html),
      forms: formAudit,
      links: linkAudit
    };

    const weights = {
      performance: 0.15, security: 0.15, accessibility: 0.12,
      seo: 0.12, codeQuality: 0.1, mobile: 0.1,
      errorHandling: 0.08, analytics: 0.08, forms: 0.05, links: 0.05
    };
    let overall = 0;
    Object.keys(categories).forEach(k => {
      overall += (categories[k].score || 0) * (weights[k] || 0.1);
    });
    overall = Math.round(overall * 10) / 10;

    const allIssues = [];
    Object.keys(categories).forEach(k => {
      if (categories[k].issues) {
        categories[k].issues.forEach(i => allIssues.push({ ...i, category: k }));
      }
    });
    allIssues.sort((a, b) => {
      const sev = { critical: 0, high: 1, medium: 2, low: 3 };
      return (sev[a.severity] || 4) - (sev[b.severity] || 4);
    });

    const allStrengths = [];
    Object.keys(categories).forEach(k => {
      if (categories[k].strengths) {
        categories[k].strengths.forEach(s => allStrengths.push({ text: s, category: k }));
      }
    });

    const result = {
      url: targetUrl,
      timestamp: Date.now(),
      overall,
      categories,
      ssl: sslAudit,
      headers: securityAudit.headers || {},
      metrics: {
        ttfb,
        htmlSize: Math.round(html.length / 1024) + 'KB',
        statusCode: response.status,
        finalUrl: response.url,
        redirectCount: response.redirected ? 1 : 0
      },
      criticalIssues: allIssues.filter(i => i.severity === 'critical'),
      allIssues,
      strengths: allStrengths,
      quickWins: generateQuickWins(categories, allIssues)
    };

    return new Response(JSON.stringify(result), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({
      error: err.message,
      overall: 0,
      categories: {},
      ssl: { valid: false },
      metrics: { ttfb: 0 },
      criticalIssues: [],
      allIssues: [],
      strengths: [],
      quickWins: []
    }), { status: 200, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Allow-Methods': 'POST, OPTIONS'
    }
  });
}

/* ========================================
   SECURITY AUDIT
   ======================================== */
function auditSecurity(html, url, response) {
  const issues = [];
  const strengths = [];
  const headers = {};

  const hdr = response.headers;
  headers.csp = !!hdr.get('content-security-policy');
  headers.hsts = !!hdr.get('strict-transport-security');
  headers.xFrame = !!hdr.get('x-frame-options');
  headers.xContentType = !!hdr.get('x-content-type-options');
  headers.referrerPolicy = !!hdr.get('referrer-policy');
  headers.permissionsPolicy = !!hdr.get('permissions-policy');

  if (!headers.csp) issues.push({ severity: 'critical', text: 'No Content-Security-Policy header', detail: 'Allows unrestricted script execution. XSS vulnerability.' });
  else strengths.push('Content-Security-Policy header present');

  if (!headers.hsts) issues.push({ severity: 'high', text: 'No Strict-Transport-Security header', detail: 'HSTS not enforced. Users could be downgraded to HTTP.' });
  else strengths.push('HSTS header enabled');

  if (!headers.xFrame) issues.push({ severity: 'high', text: 'No X-Frame-Options header', detail: 'Site can be embedded in iframes. Clickjacking risk.' });
  else strengths.push('X-Frame-Options protection enabled');

  if (!headers.xContentType) issues.push({ severity: 'medium', text: 'No X-Content-Type-Options header', detail: 'MIME type sniffing possible.' });
  if (!headers.referrerPolicy) issues.push({ severity: 'low', text: 'No Referrer-Policy header', detail: 'Referrer information may leak.' });
  if (!headers.permissionsPolicy) issues.push({ severity: 'low', text: 'No Permissions-Policy header', detail: 'Browser features (camera, mic) unrestricted.' });

  const inlineScripts = (html.match(/<script[^>]*>[^<]+<\/script>/g) || []).length;
  if (inlineScripts > 3 && !headers.csp) {
    issues.push({ severity: 'high', text: `${inlineScripts} inline scripts without CSP`, detail: 'Inline scripts execute without restriction.' });
  }

  const extScripts = (html.match(/<script[^>]+src=/g) || []).length;
  if (extScripts > 10) {
    issues.push({ severity: 'medium', text: `${extScripts} external scripts loaded`, detail: 'High script count increases attack surface.' });
  }

  const sriScripts = (html.match(/integrity=/g) || []).length;
  if (extScripts > 3 && sriScripts === 0) {
    issues.push({ severity: 'medium', text: 'No Subresource Integrity (SRI) on scripts', detail: 'External scripts not verified for tampering.' });
  } else if (sriScripts > 0) {
    strengths.push(`${sriScripts} script(s) have SRI hashes`);
  }

  if (html.includes('http://') && url.startsWith('https://')) {
    const httpRefs = (html.match(/http:\/\/[^\s"'<>]+/g) || []).length;
    if (httpRefs > 0) {
      issues.push({ severity: 'medium', text: `${httpRefs} HTTP references on HTTPS site`, detail: 'Potential mixed content issues.' });
    }
  }

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 2;
    else if (i.severity === 'high') score -= 1.5;
    else if (i.severity === 'medium') score -= 0.5;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths, headers };
}

/* ========================================
   SEO AUDIT
   ======================================== */
function auditSEO(html, url) {
  const issues = [];
  const strengths = [];

  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  if (!titleMatch) issues.push({ severity: 'critical', text: 'No <title> tag', detail: 'Search engines cannot display the page title.' });
  else if (titleMatch[1].length < 10) issues.push({ severity: 'medium', text: 'Title too short (<10 chars)', detail: `"${titleMatch[1]}" may not be descriptive enough.` });
  else if (titleMatch[1].length > 60) issues.push({ severity: 'low', text: 'Title may be too long (>60 chars)', detail: 'May be truncated in search results.' });
  else strengths.push(`Title tag present: "${titleMatch[1].substring(0, 40)}..."`);

  const descMatch = html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i);
  if (!descMatch) issues.push({ severity: 'critical', text: 'No meta description', detail: 'Missed SERP click-through rate.' });
  else if (descMatch[1].length < 50) issues.push({ severity: 'medium', text: 'Meta description too short (<50 chars)', detail: 'May not be compelling enough.' });
  else strengths.push('Meta description present');

  if (!html.includes('rel="canonical"') && !html.includes("rel='canonical'")) {
    issues.push({ severity: 'high', text: 'No canonical tag', detail: 'Risk of duplicate content.' });
  } else strengths.push('Canonical tag present');

  const ogTitle = html.includes('og:title');
  const ogDesc = html.includes('og:description');
  const ogImage = html.includes('og:image');
  if (!ogTitle && !ogDesc) issues.push({ severity: 'high', text: 'No Open Graph tags', detail: 'Social shares show no preview.' });
  else {
    if (!ogTitle) issues.push({ severity: 'medium', text: 'Missing og:title', detail: '' });
    if (!ogDesc) issues.push({ severity: 'medium', text: 'Missing og:description', detail: '' });
    if (!ogImage) issues.push({ severity: 'medium', text: 'Missing og:image', detail: 'Social shares show no image.' });
    if (ogTitle && ogDesc) strengths.push('Open Graph tags present');
  }

  if (!html.includes('twitter:card')) issues.push({ severity: 'medium', text: 'No Twitter Card tags', detail: '' });
  else strengths.push('Twitter Card present');

  if (!html.includes('application/ld+json')) issues.push({ severity: 'medium', text: 'No structured data (JSON-LD)', detail: 'Missing rich snippet opportunities.' });
  else strengths.push('JSON-LD structured data present');

  if (!html.includes('sitemap.xml')) issues.push({ severity: 'medium', text: 'No sitemap.xml reference', detail: 'Search engines may not discover all pages.' });

  const h1Count = (html.match(/<h1[\s>]/gi) || []).length;
  if (h1Count === 0) issues.push({ severity: 'high', text: 'No H1 tag', detail: 'Page has no main heading.' });
  else if (h1Count > 1) issues.push({ severity: 'medium', text: `${h1Count} H1 tags found`, detail: 'Should have exactly one H1 per page.' });
  else strengths.push('Single H1 tag present');

  if (html.includes('noindex')) issues.push({ severity: 'medium', text: 'Page has noindex directive', detail: "Page won't appear in search results." });

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 2;
    else if (i.severity === 'high') score -= 1.5;
    else if (i.severity === 'medium') score -= 0.75;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths };
}

/* ========================================
   PERFORMANCE AUDIT
   ======================================== */
function auditPerformance(html, ttfb) {
  const issues = [];
  const strengths = [];

  if (ttfb > 2000) issues.push({ severity: 'critical', text: `TTFB: ${ttfb}ms (>2s)`, detail: 'Server response is very slow.' });
  else if (ttfb > 1000) issues.push({ severity: 'high', text: `TTFB: ${ttfb}ms (>1s)`, detail: 'Server response could be faster.' });
  else if (ttfb > 500) issues.push({ severity: 'medium', text: `TTFB: ${ttfb}ms (>500ms)`, detail: 'Acceptable but could improve.' });
  else strengths.push(`Fast TTFB: ${ttfb}ms`);

  const htmlKB = Math.round(html.length / 1024);
  if (htmlKB > 200) issues.push({ severity: 'high', text: `HTML size: ${htmlKB}KB (>200KB)`, detail: 'Page is very heavy.' });
  else if (htmlKB > 100) issues.push({ severity: 'medium', text: `HTML size: ${htmlKB}KB (>100KB)`, detail: 'Could be lighter.' });
  else strengths.push(`Lean HTML: ${htmlKB}KB`);

  const jsCount = (html.match(/<script[^>]+src=/g) || []).length;
  if (jsCount > 15) issues.push({ severity: 'high', text: `${jsCount} JS files loaded (>15)`, detail: 'Excessive HTTP round-trips.' });
  else if (jsCount > 8) issues.push({ severity: 'medium', text: `${jsCount} JS files loaded (>8)`, detail: 'Could reduce script count.' });
  else strengths.push(`Good script count: ${jsCount} files`);

  const cssCount = (html.match(/<link[^>]+stylesheet/gi) || []).length;
  if (cssCount > 5) issues.push({ severity: 'medium', text: `${cssCount} CSS files loaded`, detail: 'Could consolidate stylesheets.' });

  const inlineStyles = (html.match(/style="/g) || []).length;
  if (inlineStyles > 20) issues.push({ severity: 'low', text: `${inlineStyles} inline style attributes`, detail: 'Should use CSS classes.' });

  const renderBlocking = (html.match(/<link[^>]+rel="stylesheet"(?!.*media)/g) || []).length;
  if (renderBlocking > 2) issues.push({ severity: 'medium', text: `${renderBlocking} render-blocking stylesheets`, detail: 'Add media attributes for non-critical CSS.' });

  const images = (html.match(/<img/gi) || []).length;
  const lazyImages = (html.match(/loading="lazy"/gi) || []).length;
  if (images > 3 && lazyImages === 0) {
    issues.push({ severity: 'medium', text: 'No lazy loading on images', detail: `${images} images loaded eagerly.` });
  } else if (lazyImages > 0) {
    strengths.push(`${lazyImages} image(s) use lazy loading`);
  }

  if (html.includes('fonts.googleapis.com') && !html.includes('display=swap')) {
    issues.push({ severity: 'medium', text: 'Google Fonts without display=swap', detail: 'May cause FOIT (flash of invisible text).' });
  }
  if (html.includes('rel="preload"') && html.includes('font')) {
    strengths.push('Font preloading detected');
  }

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 2;
    else if (i.severity === 'high') score -= 1.5;
    else if (i.severity === 'medium') score -= 0.75;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths, metrics: { ttfb, htmlSize: htmlKB, jsCount, cssCount } };
}

/* ========================================
   ACCESSIBILITY AUDIT
   ======================================== */
function auditAccessibility(html) {
  const issues = [];
  const strengths = [];

  if (!html.includes('lang=')) issues.push({ severity: 'high', text: 'No lang attribute on <html>', detail: 'Screen readers cannot determine page language.' });
  else strengths.push('lang attribute present');

  if (!html.includes('skip') && !html.includes('Skip')) {
    issues.push({ severity: 'medium', text: 'No skip-to-content link', detail: 'Keyboard users must tab through entire nav.' });
  } else strengths.push('Skip navigation link present');

  const imgs = html.match(/<img[^>]*>/gi) || [];
  const imgsWithAlt = imgs.filter(i => i.includes('alt=') && !i.includes('alt=""'));
  const imgsWithoutAlt = imgs.filter(i => !i.includes('alt='));
  if (imgsWithoutAlt.length > 0) {
    issues.push({ severity: 'critical', text: `${imgsWithoutAlt.length} image(s) missing alt text`, detail: 'Completely inaccessible to screen readers.' });
  } else if (imgs.length > 0) {
    strengths.push(`All ${imgs.length} images have alt text`);
  }

  const inputs = html.match(/<input[^>]*>/gi) || [];
  const labels = html.match(/<label[^>]*>/gi) || [];
  if (inputs.length > 0 && labels.length === 0) {
    issues.push({ severity: 'critical', text: 'No <label> elements for form inputs', detail: 'Screen readers cannot identify form fields.' });
  } else if (inputs.length > labels.length) {
    issues.push({ severity: 'high', text: `${inputs.length} inputs but only ${labels.length} labels`, detail: 'Some form fields are unlabeled.' });
  } else if (inputs.length > 0) {
    strengths.push('Form labels present');
  }

  const ariaCount = (html.match(/aria-/g) || []).length;
  if (ariaCount > 5) strengths.push(`${ariaCount} ARIA attributes found`);
  else if (inputs.length > 3) issues.push({ severity: 'medium', text: 'Few ARIA attributes', detail: 'Consider adding more ARIA for complex UI.' });

  const headings = [];
  for (let i = 1; i <= 6; i++) {
    const count = (html.match(new RegExp(`<h${i}[\\s>]`, 'gi')) || []).length;
    if (count > 0) headings.push({ level: i, count });
  }
  if (headings.length > 0 && headings[0].level !== 1) {
    issues.push({ severity: 'high', text: 'First heading is not H1', detail: `Starts with H${headings[0].level}.` });
  } else if (headings.length > 0) {
    strengths.push('Heading hierarchy starts with H1');
  }

  if (html.includes('color:') && html.includes('opacity:0.')) {
    issues.push({ severity: 'medium', text: 'Low opacity text detected', detail: 'May fail WCAG contrast ratios.' });
  }

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 2.5;
    else if (i.severity === 'high') score -= 1.5;
    else if (i.severity === 'medium') score -= 0.75;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths };
}

/* ========================================
   CODE QUALITY AUDIT
   ======================================== */
function auditCodeQuality(html) {
  const issues = [];
  const strengths = [];

  const hasMinified = html.includes('.min.') || html.includes('chunk') || html.includes('bundle');
  if (hasMinified) strengths.push('Minified/bundled assets detected');
  else issues.push({ severity: 'medium', text: 'No minified assets detected', detail: 'Raw source may be served to production.' });

  const htmlComments = (html.match(/<!--[\s\S]*?-->/g) || []).length;
  if (htmlComments > 10) issues.push({ severity: 'low', text: `${htmlComments} HTML comments`, detail: 'Comments should be removed in production.' });

  const inlineScripts = (html.match(/<script[^>]*>[^<]+<\/script>/g) || []).length;
  if (inlineScripts > 5) issues.push({ severity: 'medium', text: `${inlineScripts} inline script blocks`, detail: 'Should extract to external files.' });
  else if (inlineScripts === 0) strengths.push('No inline scripts');

  if (html.includes('type="module"')) strengths.push('ES modules detected');

  const asyncScripts = (html.match(/async/g) || []).length;
  const deferScripts = (html.match(/defer/g) || []).length;
  if (asyncScripts + deferScripts > 0) {
    strengths.push(`${asyncScripts} async + ${deferScripts} defer scripts`);
  }

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 2;
    else if (i.severity === 'high') score -= 1.5;
    else if (i.severity === 'medium') score -= 1;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths };
}

/* ========================================
   MOBILE AUDIT
   ======================================== */
function auditMobile(html) {
  const issues = [];
  const strengths = [];

  if (html.includes('viewport')) strengths.push('Viewport meta tag present');
  else issues.push({ severity: 'critical', text: 'No viewport meta tag', detail: 'Site is not mobile-responsive.' });

  if (html.includes('@media')) strengths.push('CSS media queries detected');
  else issues.push({ severity: 'medium', text: 'No CSS media queries', detail: 'Site may not be responsive.' });

  if (html.includes('apple-touch-icon')) strengths.push('Apple touch icon present');

  if (html.includes('user-scalable=no') || html.includes('maximum-scale=1')) {
    issues.push({ severity: 'high', text: 'Zoom is disabled', detail: 'Users cannot zoom. WCAG failure.' });
  }

  let score = 10;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 3;
    else if (i.severity === 'high') score -= 2;
    else if (i.severity === 'medium') score -= 1;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, Math.round(score * 10) / 10));

  return { score, issues, strengths };
}

/* ========================================
   ERROR HANDLING AUDIT
   ======================================== */
function auditErrorHandling(html) {
  const issues = [];
  const strengths = [];

  if (html.includes('error') || html.includes('Error')) {
    strengths.push('Error handling code detected');
  }

  if (html.includes('404') || html.includes('not-found')) {
    strengths.push('Custom 404 page detected');
  } else {
    issues.push({ severity: 'medium', text: 'No custom 404 page detected', detail: '' });
  }

  if (html.includes('try') && html.includes('catch')) {
    strengths.push('Try-catch error handling present');
  }

  if (html.includes('onerror') || html.includes('addEventListener("error"') || html.includes("addEventListener('error'")) {
    strengths.push('Global error handler present');
  }

  let score = 7;
  issues.forEach(i => { if (i.severity === 'medium') score -= 1; });
  score = Math.max(1, Math.min(10, score));
  if (strengths.length > 2) score = Math.min(10, score + 1);

  return { score, issues, strengths };
}

/* ========================================
   ANALYTICS AUDIT
   ======================================== */
function auditAnalytics(html) {
  const issues = [];
  const strengths = [];

  if (html.includes('gtag') || html.includes('google-analytics') || html.includes('googletagmanager')) {
    strengths.push('Google Analytics detected');
  } else {
    issues.push({ severity: 'medium', text: 'No Google Analytics', detail: 'No visibility into traffic or conversions.' });
  }

  if (html.includes('gtm.js') || html.includes('googletagmanager')) {
    strengths.push('Google Tag Manager detected');
  }

  if (html.includes('hotjar') || html.includes('clarity') || html.includes('heap')) {
    strengths.push('Heatmap/session recording detected');
  }

  if (html.includes('facebook') && html.includes('pixel')) {
    strengths.push('Facebook Pixel detected');
  }

  if (html.includes('cloudflareinsights') || html.includes('beacon.min.js')) {
    strengths.push('Cloudflare Analytics detected');
  }

  let score = 4;
  if (strengths.length > 0) score += strengths.length * 1.5;
  score = Math.min(10, score);

  if (strengths.length === 0) {
    issues.push({ severity: 'high', text: 'No analytics detected', detail: 'Zero visibility into user behavior.' });
  }

  return { score, issues, strengths };
}

/* ========================================
   FORMS AUDIT
   ======================================== */
function auditForms(html) {
  const issues = [];
  const strengths = [];

  const forms = (html.match(/<form/gi) || []).length;
  const inputs = (html.match(/<input/gi) || []).length;
  const labels = (html.match(/<label/gi) || []).length;
  const required = (html.match(/required/gi) || []).length;

  if (forms > 0) {
    strengths.push(`${forms} form(s) found`);

    if (labels > 0) strengths.push('Form labels present');
    else issues.push({ severity: 'critical', text: 'Forms missing labels', detail: 'Screen readers cannot identify fields.' });

    if (required > 0) strengths.push('Required field validation present');
    else issues.push({ severity: 'low', text: 'No required field validation', detail: '' });

    if (html.includes('captcha') || html.includes('recaptcha') || html.includes('turnstile')) {
      strengths.push('Bot protection (CAPTCHA) present');
    } else {
      issues.push({ severity: 'medium', text: 'No CAPTCHA on forms', detail: 'Vulnerable to spam/bots.' });
    }
  }

  let score = 7;
  issues.forEach(i => {
    if (i.severity === 'critical') score -= 3;
    else if (i.severity === 'high') score -= 2;
    else if (i.severity === 'medium') score -= 1;
    else score -= 0.25;
  });
  score = Math.max(1, Math.min(10, score));

  return { score, issues, strengths };
}

/* ========================================
   LINKS AUDIT
   ======================================== */
function auditLinks(html, baseUrl) {
  const issues = [];
  const strengths = [];

  const links = html.match(/href=["']([^"']+)["']/g) || [];
  const broken = links.filter(l => l.includes('href="#"') || l.includes("href='#'") || l.includes('href="javascript:'));
  const internal = links.filter(l => !l.startsWith('href="http'));
  const external = links.filter(l => l.startsWith('href="http'));

  if (broken.length > 0) {
    issues.push({ severity: 'high', text: `${broken.length} broken/placeholder links`, detail: 'Links point to # or javascript:.' });
  }

  if (external.length > 0) {
    const hasNoOpener = html.includes('rel="noopener"') || html.includes("rel='noopener'");
    if (!hasNoOpener && external.length > 3) {
      issues.push({ severity: 'low', text: 'External links missing rel="noopener"', detail: '' });
    } else if (hasNoOpener) {
      strengths.push('External links have rel="noopener"');
    }
  }

  if (links.length > 0 && broken.length === 0) {
    strengths.push(`${links.length} links, none broken`);
  }

  let score = 8;
  if (broken.length > 5) score -= 3;
  else if (broken.length > 0) score -= broken.length * 0.5;
  score = Math.max(1, Math.min(10, score));

  return { score, issues, strengths, metrics: { total: links.length, broken: broken.length, internal: internal.length, external: external.length } };
}

/* ========================================
   SSL AUDIT
   ======================================== */
async function auditSSL(url) {
  try {
    const httpsUrl = url.replace('http://', 'https://');
    const response = await fetch(httpsUrl, {
      method: 'HEAD',
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; GASiteAuditor/1.0)' }
    });

    return {
      valid: response.ok,
      statusCode: response.status,
      finalUrl: response.url,
      server: response.headers.get('server') || 'unknown'
    };
  } catch (e) {
    return { valid: false, error: e.message };
  }
}

/* ========================================
   QUICK WINS GENERATOR
   ======================================== */
function generateQuickWins(categories, issues) {
  const wins = [];
  const critical = issues.filter(i => i.severity === 'critical');
  const high = issues.filter(i => i.severity === 'high');

  critical.slice(0, 3).forEach(i => {
    wins.push({ priority: 'critical', text: i.text, category: i.category, detail: i.detail });
  });

  high.slice(0, 3).forEach(i => {
    wins.push({ priority: 'high', text: i.text, category: i.category, detail: i.detail });
  });

  return wins.slice(0, 6);
}
