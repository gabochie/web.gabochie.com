/* ========================================
   NETLIFY FUNCTION — Bulk Website Analyzer
   Analyzes multiple URLs, extracts contacts, generates outreach
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
    const { urls, keyword, industry } = JSON.parse(event.body || '{}');

    if (!urls && !keyword) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Provide urls array or keyword' }) };
    }

    let targets = urls || [];

    // If keyword provided, generate search results (simulated — in production use search API)
    if (keyword && targets.length === 0) {
      targets = generateSearchResults(keyword, industry);
    }

    const results = [];
    for (const url of targets.slice(0, 20)) {
      try {
        const analysis = await analyzeUrl(url);
        results.push(analysis);
      } catch (err) {
        results.push({ url, error: err.message, score: 0 });
      }
    }

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({ results, total: results.length })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function generateSearchResults(keyword, industry) {
  // In production, call Google Custom Search API or SerpAPI
  // For now, return realistic demo URLs
  const templates = {
    medical: ['citymedical.com', 'premierhealth.com', 'familypractice.com'],
    dental: ['smiledental.com', 'brightteeth.com', 'precisiondental.com'],
    legal: ['smithlaw.com', 'justicelegal.com', 'metrolaw.com'],
    financial: ['pinnaclefinancial.com', 'summitwealth.com', 'capitalgrowth.com'],
    'home services': ['prohome.com', 'experthvac.com', 'eliteplumbing.com'],
    manufacturing: ['precisionmfg.com', 'industrialsolutions.com', 'advancedmaterials.com']
  };

  const ind = (industry || 'medical').toLowerCase();
  return templates[ind] || templates.medical;
}

async function analyzeUrl(url) {
  if (!/^https?:\/\//.test(url)) url = 'https://' + url;

  // Fetch HTML
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: { 'User-Agent': 'GA-Analytics/1.0' }
    });
    clearTimeout(timeout);

    if (!response.ok) throw new Error('HTTP ' + response.status);
    const html = await response.text();

    const analysis = analyzeHTML(html, url);
    const contact = extractContact(html);
    const outreach = generateOutreach(analysis, contact, url);

    return { ...analysis, contact, outreach, url };
  } catch (err) {
    clearTimeout(timeout);
    // Fallback: analyze from URL structure
    return analyzeFromUrl(url);
  }
}

function analyzeHTML(html, url) {
  const lower = html.toLowerCase();
  let scoreDesign = 70, scoreMobile = 60, scorePerf = 65;
  const issues = [], wins = [];

  // Title
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!titleMatch || !titleMatch[1].trim()) { issues.push('Missing <title>'); scoreDesign -= 8; }
  else wins.push('Title present');

  // Meta description
  if (lower.indexOf('meta name="description"') === -1) { issues.push('Missing meta description'); scoreDesign -= 5; }
  else wins.push('Meta description present');

  // OG tags
  if (lower.indexOf('og:title') === -1) { issues.push('Missing OG tags'); scoreDesign -= 3; }

  // HTTPS
  if (url.startsWith('https://')) { wins.push('HTTPS'); scoreDesign += 5; }
  else { issues.push('No HTTPS'); scoreDesign -= 10; }

  // Viewport
  if (lower.indexOf('viewport') === -1) { issues.push('No mobile viewport'); scoreMobile -= 25; }
  else { wins.push('Mobile viewport'); scoreMobile += 15; }

  // Responsive CSS
  if (lower.indexOf('@media') !== -1 || lower.indexOf('display:flex') !== -1) { wins.push('Responsive CSS'); scoreMobile += 10; }
  else { issues.push('No responsive CSS'); scoreMobile -= 15; }

  // Forms
  const formCount = (html.match(/<form[\s>]/gi) || []).length;
  if (formCount === 0) { issues.push('No forms'); scoreDesign -= 12; }
  else wins.push(formCount + ' form(s)');

  // CTA
  const ctaKw = ['get started', 'sign up', 'contact us', 'get a quote', 'request', 'book', 'schedule'];
  if (ctaKw.some(kw => lower.indexOf(kw) !== -1)) { wins.push('CTA detected'); scoreDesign += 5; }
  else { issues.push('No CTA text'); scoreDesign -= 8; }

  // Analytics
  if (lower.indexOf('gtag') !== -1 || lower.indexOf('google-analytics') !== -1) wins.push('Analytics');
  else { issues.push('No analytics'); scorePerf -= 5; }

  // Images
  const imgCount = (html.match(/<img[\s>]/gi) || []).length;
  const lazyCount = (lower.match(/loading="lazy"/g) || []).length;
  if (imgCount > 0 && lazyCount === 0) { issues.push(imgCount + ' images no lazy load'); scorePerf -= 10; }

  // jQuery
  if (lower.indexOf('jquery') !== -1) { issues.push('Uses jQuery'); scorePerf -= 3; }

  // Copyright
  const copyMatch = lower.match(/©|&copy;|copyright.*?(\d{4})/);
  if (copyMatch) {
    const year = parseInt(copyMatch[1]);
    if (year < 2024) { issues.push('Copyright year ' + year + ' outdated'); scoreDesign -= 5; }
  }

  // Clamp
  scoreDesign = Math.max(0, Math.min(100, scoreDesign));
  scoreMobile = Math.max(0, Math.min(100, scoreMobile));
  scorePerf = Math.max(0, Math.min(100, scorePerf));
  const total = Math.round((scoreDesign + scoreMobile + scorePerf) / 3);

  return {
    scores: { design: scoreDesign, mobile: scoreMobile, performance: scorePerf, total },
    issues, wins,
    title: titleMatch ? titleMatch[1].trim().substring(0, 60) : '',
    formCount,
    hasAnalytics: lower.indexOf('gtag') !== -1
  };
}

function analyzeFromUrl(url) {
  let score = 40;
  const issues = [];
  if (!url.startsWith('https')) { score -= 10; issues.push('No HTTPS'); }
  try {
    const hostname = new URL(url).hostname;
    if (hostname.split('.').length > 2) issues.push('Subdomain detected');
    if (hostname.indexOf('wix') !== -1 || hostname.indexOf('weebly') !== -1 || hostname.indexOf('squarespace') !== -1) {
      issues.push('Website builder detected — likely outdated');
      score += 15;
    }
  } catch (e) {}

  return {
    url,
    scores: { design: score, mobile: score, performance: score, total: score },
    issues, wins: [], title: '', formCount: 0, hasAnalytics: false,
    contact: extractContact(''),
    outreach: { subject: '', body: '' }
  };
}

function extractContact(html) {
  const lower = html.toLowerCase();
  const result = { name: '', title: '', email: '', phone: '' };

  // Extract name from team/about pages
  const namePatterns = [
    /(?:CEO|Founder|President|Owner|Director|Manager|Lead)[:\s]+([A-Z][a-z]+ [A-Z][a-z]+)/i,
    /<h[2-4][^>]*>([A-Z][a-z]+ [A-Z][a-z]+)<\/h[2-4]>/i,
    /class="[^"]*(?:team|staff|about|member)[^"]*"[^>]*>[^<]*<[^>]*>([A-Z][a-z]+ [A-Z][a-z]+)/i
  ];
  for (const pattern of namePatterns) {
    const match = html.match(pattern);
    if (match) { result.name = match[1]; break; }
  }

  // Extract title
  const titlePatterns = [
    /(?:CEO|Founder|President|Owner|Director|Manager|VP|Chief)/i
  ];
  const titleMatch = html.match(/(CEO|Founder|President|Owner|Director|Manager|VP of [A-Za-z]+|Chief [A-Za-z]+)/i);
  if (titleMatch) result.title = titleMatch[1];

  // Extract email
  const emailMatch = html.match(/([a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/);
  if (emailMatch) result.email = emailMatch[1];

  // Extract phone
  const phoneMatch = html.match(/(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/);
  if (phoneMatch) result.phone = phoneMatch[1];

  return result;
}

function generateOutreach(analysis, contact, url) {
  const score = analysis.scores ? analysis.scores.total : 0;
  const issues = (analysis.issues || []).slice(0, 3);
  const contactName = contact.name || 'there';
  const topIssues = issues.length ? issues.map(i => '• ' + i).join('\n') : '• Opportunities for improvement';

  return {
    subject: `Quick question about your website`,
    body: `Hi ${contactName},\n\nI analyzed your website and found some conversion opportunities:\n${topIssues}\n• Score: ${score}/100\n\nOur clients typically see 40-60% more leads after a redesign.\n\nWould you be open to a 15-minute call?\n\nBest,\nGideon\n+233 243 262 019`
  };
}
