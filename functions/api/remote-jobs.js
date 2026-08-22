/* ========================================
   CF PAGES FUNCTION — Remote Tech Jobs Finder
   Live source: Remotive public API (free, no key)
   Fallback: built-in sample dataset (flagged live:false)

   Hardened:
   - Same-origin only (Origin/Referer allowlist)
   - Per-IP rate limiting
   - Edge cache (5 min) per query
   ======================================== */
const ALLOWED_ORIGINS = [
  'https://web.gabochie.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788'
];
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 1000;
const CACHE_TTL = 300;
const MAX_JOBS = 60;

const hits = new Map();

function json(data, status) {
  const res = new Response(JSON.stringify(data), {
    status,
    headers: {
      'Content-Type': 'application/json',
      'Cache-Control': 'no-store',
      'Access-Control-Allow-Origin': 'https://web.gabochie.com'
    }
  });
  return res;
}

function originAllowed(request) {
  const origin = request.headers.get('Origin');
  const referer = request.headers.get('Referer');
  if (origin) return ALLOWED_ORIGINS.includes(origin);
  if (referer) {
    try {
      const ref = new URL(referer).origin;
      return ALLOWED_ORIGINS.includes(ref);
    } catch (e) { return false; }
  }
  // No Origin and no Referer: non-browser client -> reject
  return false;
}

function rateLimited(ip) {
  const now = Date.now();
  const list = (hits.get(ip) || []).filter(ts => now - ts < RATE_WINDOW_MS);
  if (list.length >= RATE_LIMIT) {
    hits.set(ip, list);
    return true;
  }
  list.push(now);
  hits.set(ip, list);
  if (hits.size > 5000) hits.clear(); // crude memory guard
  return false;
}

function fetchWithTimeout(url, ms) {
  const controller = new AbortController();
  const t = setTimeout(() => controller.abort(), ms);
  return fetch(url, {
    signal: controller.signal,
    headers: { 'User-Agent': 'web-gabochie-job-board' }
  }).finally(() => clearTimeout(t));
}

function detectCountry(location) {
  const l = (location || '').toLowerCase();
  if (/uae|u\.a\.e|dubai|abu dhabi|emirates/.test(l)) return 'AE';
  if (/\buk\b|\bu\.k\.|united kingdom|britain|england|scotland|wales|london\b/.test(l)) return 'UK';
  if (/united states|\busa\b|\bu\.s\.a|united states of america|america|\bny\b|\bsf\b/.test(l)) return 'US';
  if (/canada|canadian|\btoronto\b|\bvancouver\b|montreal|\bontario\b/.test(l)) return 'CA';
  if (/germany|german|deutschland|berlin|munich|hamburg/.test(l)) return 'DE';
  if (/australia|australian|sydney|melbourne|brisbane|new south wales/.test(l)) return 'AU';
  return '';
}

function stripHtml(html) {
  return String(html || '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&#\d+;/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

async function fetchRemotive(keywords, country) {
  const url = 'https://remotive.com/api/remote-jobs?limit=100' +
    (keywords ? '&search=' + encodeURIComponent(keywords) : '');
  const resp = await fetchWithTimeout(url, 8000);
  if (!resp.ok) throw new Error('Remotive responded ' + resp.status);
  const data = await resp.json();
  const jobs = Array.isArray(data.jobs) ? data.jobs : [];

  let mapped = jobs.map(j => {
    const location = j.candidate_required_location || 'Worldwide';
    return {
      id: String(j.id || ''),
      title: stripHtml(j.title),
      company: stripHtml(j.company_name) || 'Company',
      location: location,
      url: j.url,
      description: stripHtml(j.description).slice(0, 500),
      postedDate: j.publication_date ? new Date(j.publication_date).toISOString() : new Date().toISOString(),
      salary: j.salary || '',
      remote: true,
      source: 'Remotive',
      country: detectCountry(location),
      tags: getTags(j.title),
      highlighted: false
    };
  });

  mapped = mapped.filter(j => j.title && j.url);
  if (country) {
    const byCountry = mapped.filter(j => j.country === country);
    // Country selected but board is global-remote: keep global matches rather than empty
    if (byCountry.length > 0) mapped = byCountry;
  }
  return mapped;
}

export async function onRequestPost(context) {
  try {
    if (!originAllowed(context.request)) {
      return json({ error: 'Forbidden' }, 403);
    }
    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return json({ error: 'Too many searches — try again shortly' }, 429);
    }

    let body;
    try {
      body = await context.request.json();
    } catch (e) {
      return json({ error: 'Invalid JSON body' }, 400);
    }

    const keywords = typeof body.keywords === 'string' ? body.keywords.trim().slice(0, 120) : '';
    const searchTerm = keywords || 'software developer';
    const country = typeof body.country === 'string' && ['CA', 'US', 'UK', 'DE', 'AU', 'AE'].includes(body.country)
      ? body.country : '';
    const remoteOnly = body.remote === true;

    // Edge cache keyed on normalized query (skip cache on errors below)
    const cache = caches.default;
    const cacheKey = new Request(
      'https://cache.web-gabochie.internal/remote-jobs?kw=' + encodeURIComponent(searchTerm.toLowerCase()) +
      '&c=' + country + '&r=' + (remoteOnly ? 1 : 0)
    );
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    let jobs = [];
    let live = false;
    try {
      jobs = await fetchRemotive(searchTerm, country);
      live = jobs.length > 0;
    } catch (e) { /* fall through to sample data */ }

    if (!live) {
      jobs = getFallbackJobs(searchTerm, country, remoteOnly);
    } else if (remoteOnly) {
      // All live results are remote by definition; sample path already filters
    }

    // Dedupe by URL
    const seen = new Set();
    jobs = jobs.filter(j => {
      const key = j.url;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Newest first
    jobs.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));
    jobs = jobs.slice(0, MAX_JOBS);

    const payload = {
      jobs,
      total: jobs.length,
      page: 1,
      live,
      sources: live ? ['Remotive'] : ['Sample Data']
    };

    const res = new Response(JSON.stringify(payload), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': 'https://web.gabochie.com',
        'Cache-Control': 'public, max-age=' + CACHE_TTL
      }
    });
    context.waitUntil(cache.put(cacheKey, res.clone()));
    return res;

  } catch (err) {
    // 502 bodies are stripped by the CF edge on Pages Functions — use 422
    return json({ error: err.message, jobs: getFallbackJobs(), total: 0, live: false, sources: ['Sample Data'] }, 422);
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': 'https://web.gabochie.com',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    }
  });
}

// ---------- sample dataset (used when live source unavailable) ----------
function getFallbackJobs(keyword, country, remote) {
  const techJobs = [
    // CANADA
    { title: 'Senior Software Engineer', company: 'Shopify', location: 'Ottawa, ON, Canada', country: 'CA', remote: true, salary: '$150,000 - $200,000', url: 'https://www.shopify.com/careers' },
    { title: 'Full Stack Developer', company: 'Wealthsimple', location: 'Toronto, ON, Canada', country: 'CA', remote: true, salary: '$120,000 - $160,000', url: 'https://www.wealthsimple.com/en-ca/careers' },
    { title: 'DevOps Engineer', company: 'Lightspeed', location: 'Montreal, QC, Canada', country: 'CA', remote: true, salary: '$110,000 - $150,000', url: 'https://www.lightspeedhq.com/careers/' },
    { title: 'Machine Learning Engineer', company: 'Hootsuite', location: 'Vancouver, BC, Canada', country: 'CA', remote: false, salary: '$140,000 - $180,000', url: 'https://careers.hootsuite.com' },
    { title: 'Data Scientist', company: 'Sun Life Financial', location: 'Waterloo, ON, Canada', country: 'CA', remote: true, salary: '$100,000 - $140,000', url: 'https://www.sunlife.com/en/careers/' },
    { title: 'Cloud Architect', company: 'Telus', location: 'Vancouver, BC, Canada', country: 'CA', remote: true, salary: '$140,000 - $190,000', url: 'https://telus.com/careers' },
    { title: 'Software Developer Co-op', company: 'AMD', location: 'Markham, ON, Canada', country: 'CA', remote: false, salary: '$55,000 - $75,000', url: 'https://www.amd.com/en/corporate/careers' },
    // USA
    { title: 'Software Engineer', company: 'Google', location: 'Mountain View, CA, USA', country: 'US', remote: true, salary: '$180,000 - $250,000', url: 'https://careers.google.com/' },
    { title: 'Frontend Engineer', company: 'Meta', location: 'Menlo Park, CA, USA', country: 'US', remote: true, salary: '$170,000 - $240,000', url: 'https://www.metacareers.com/' },
    { title: 'Backend Developer', company: 'Stripe', location: 'San Francisco, CA, USA', country: 'US', remote: true, salary: '$160,000 - $230,000', url: 'https://stripe.com/jobs' },
    { title: 'DevOps Engineer', company: 'Netflix', location: 'Los Gatos, CA, USA', country: 'US', remote: false, salary: '$200,000 - $350,000', url: 'https://jobs.netflix.com/' },
    { title: 'Data Engineer', company: 'Airbnb', location: 'San Francisco, CA, USA', country: 'US', remote: true, salary: '$150,000 - $210,000', url: 'https://careers.airbnb.com/' },
    { title: 'iOS Developer', company: 'Apple', location: 'Cupertino, CA, USA', country: 'US', remote: false, salary: '$160,000 - $230,000', url: 'https://www.apple.com/careers/us/' },
    { title: 'AI Research Scientist', company: 'OpenAI', location: 'San Francisco, CA, USA', country: 'US', remote: false, salary: '$200,000 - $370,000', url: 'https://openai.com/careers/' },
    { title: 'Security Engineer', company: 'CrowdStrike', location: 'Austin, TX, USA', country: 'US', remote: true, salary: '$140,000 - $200,000', url: 'https://www.crowdstrike.com/careers/' },
    { title: 'Solutions Architect', company: 'AWS', location: 'Seattle, WA, USA', country: 'US', remote: true, salary: '$150,000 - $220,000', url: 'https://www.amazon.jobs/' },
    { title: 'Junior Developer', company: 'GitHub', location: 'San Francisco, CA, USA', country: 'US', remote: true, salary: '$90,000 - $130,000', url: 'https://github.com/about/careers' },
    // UK
    { title: 'Software Developer', company: 'Revolut', location: 'London, UK', country: 'UK', remote: true, salary: '£70,000 - £110,000', url: 'https://www.revolut.com/careers/' },
    { title: 'Full Stack Engineer', company: 'Monzo', location: 'London, UK', country: 'UK', remote: true, salary: '£75,000 - £120,000', url: 'https://monzo.com/careers/' },
    { title: 'Data Scientist', company: 'DeepMind', location: 'London, UK', country: 'UK', remote: false, salary: '£100,000 - £180,000', url: 'https://www.deepmind.com/careers' },
    { title: 'Platform Engineer', company: 'Deliveroo', location: 'London, UK', country: 'UK', remote: true, salary: '£80,000 - £130,000', url: 'https://deliveroo.co.uk/careers' },
    { title: 'Frontend Developer', company: 'Spotify', location: 'London, UK', country: 'UK', remote: true, salary: '£70,000 - £110,000', url: 'https://www.spotifyjobs.com/' },
    { title: 'Contract React Developer', company: 'Various Agencies', location: 'Remote, UK', country: 'UK', remote: true, salary: '£400 - £700/day', url: 'https://uk.indeed.com' },
    // GERMANY
    { title: 'Software Engineer', company: 'Zalando', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€70,000 - €110,000', url: 'https://jobs.zalando.com/' },
    { title: 'Backend Developer', company: 'N26', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€65,000 - €100,000', url: 'https://n26.com/en/careers' },
    { title: 'DevOps Engineer', company: 'SoundCloud', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€70,000 - €105,000', url: 'https://www.soundcloud.com/jobs' },
    { title: 'AI Engineer', company: 'SAP', location: 'Walldorf, Germany', country: 'DE', remote: true, salary: '€80,000 - €130,000', url: 'https://jobs.sap.com/' },
    { title: 'Senior Java Developer', company: 'Deutsche Bank', location: 'Frankfurt, Germany', country: 'DE', remote: false, salary: '€85,000 - €120,000', url: 'https://careers.db.com/' },
    // AUSTRALIA
    { title: 'Software Engineer', company: 'Atlassian', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$130,000 - A$180,000', url: 'https://www.atlassian.com/company/careers' },
    { title: 'Full Stack Developer', company: 'Canva', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$120,000 - A$170,000', url: 'https://www.canva.com/careers/' },
    { title: 'Data Engineer', company: 'REA Group', location: 'Melbourne, Australia', country: 'AU', remote: true, salary: 'A$110,000 - A$160,000', url: 'https://www.rea-group.com/careers/' },
    { title: 'DevOps Engineer', company: 'Xero', location: 'Melbourne, Australia', country: 'AU', remote: true, salary: 'A$120,000 - A$165,000', url: 'https://www.xero.com/cares/careers/' },
    { title: 'Frontend Developer', company: 'SafetyCulture', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$100,000 - A$145,000', url: 'https://safetyculture.com/careers/' },
    { title: 'Freelance Web Developer', company: 'Various Startups', location: 'Remote, NA', country: 'US', remote: true, salary: '$80 - $150/hr', url: 'https://www.indeed.com' },
    { title: 'Freelance Mobile Developer', company: 'Various Clients', location: 'Remote, EU', country: 'DE', remote: true, salary: '€60 - €120/hr', url: 'https://de.indeed.com' },
    // UAE
    { title: 'Software Engineer', company: 'Careem', location: 'Dubai, UAE', country: 'AE', remote: false, salary: 'AED 240,000 - 360,000', url: 'https://www.careem.com/en-ae/careers/' },
    { title: 'Full Stack Developer', company: 'Talabat', location: 'Dubai, UAE', country: 'AE', remote: true, salary: 'AED 200,000 - 320,000', url: 'https://www.talabat.com/careers' },
    { title: 'Data Scientist', company: 'Etisalat', location: 'Abu Dhabi, UAE', country: 'AE', remote: false, salary: 'AED 220,000 - 350,000', url: 'https://www.etisalat.ae/careers' },
    { title: 'DevOps Engineer', company: 'Dubai Holding', location: 'Dubai, UAE', country: 'AE', remote: true, salary: 'AED 180,000 - 300,000', url: 'https://www.dubaiholding.com/en/careers' },
    { title: 'Frontend Developer', company: 'Property Finder', location: 'Dubai, UAE', country: 'AE', remote: true, salary: 'AED 160,000 - 280,000', url: 'https://www.propertyfinder.ae/careers' }
  ];

  const kw = (keyword || '').toLowerCase();
  let filtered = techJobs;
  if (kw && kw !== 'software developer' && kw !== 'tech') {
    filtered = techJobs.filter(j =>
      j.title.toLowerCase().includes(kw.split(' ')[0]) ||
      j.company.toLowerCase().includes(kw)
    );
  }
  if (remote === true) {
    filtered = filtered.filter(j => j.remote);
  }
  if (country) {
    const byCountry = filtered.filter(j => j.country === country);
    if (byCountry.length > 0) filtered = byCountry;
  }

  return filtered.map((j, i) => ({
    id: 'job_' + i + '_' + Date.now(),
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    description: j.title + ' position at ' + j.company + (j.remote ? ' (Remote). ' : ' in ' + j.location + '. ') + 'Apply directly on company website.',
    postedDate: new Date(Date.now() - (i % 7) * 86400000).toISOString(),
    salary: j.salary,
    remote: j.remote,
    source: 'Sample Data',
    country: j.country,
    tags: getTags(j.title),
    highlighted: j.title.includes('Senior') || j.title.includes('Lead') || j.title.includes('Architect')
  }));
}

function getTags(title) {
  const t = String(title || '').toLowerCase();
  const tags = [];
  if (t.includes('react')) tags.push('React');
  if (t.includes('node') || t.includes('backend')) tags.push('Node.js');
  if (t.includes('python')) tags.push('Python');
  if (/\bjava\b/.test(t)) tags.push('Java');
  if (t.includes('devops') || t.includes('sre') || t.includes('platform')) tags.push('DevOps');
  if (t.includes('frontend') || t.includes('angular') || t.includes('vue')) tags.push('Frontend');
  if (t.includes('full stack') || t.includes('fullstack')) tags.push('Full Stack');
  if (t.includes('data') || t.includes('machine learning')) tags.push('AI/ML');
  if (/\bai\b/.test(t)) tags.push('AI/ML');
  if (t.includes('ios') || t.includes('android') || t.includes('mobile')) tags.push('Mobile');
  if (t.includes('security')) tags.push('Security');
  if (t.includes('qa') || t.includes('test')) tags.push('QA');
  if (t.includes('product manager') || t.includes('technical writer')) tags.push('Product');
  if (t.includes('co-op') || t.includes('junior') || t.includes('intern') || t.includes('graduate')) tags.push('Junior');
  if (t.includes('architect')) tags.push('Architect');
  if (t.includes('freelance') || t.includes('contract')) tags.push('Freelance');
  if (tags.length === 0) tags.push('General Dev');
  return tags;
}
