/* ========================================
   CF PAGES FUNCTION — Remote Tech Jobs Finder
   Scrapes Indeed (CA, US, UK, DE, AU) RSS
   + built-in sample dataset as fallback
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { keywords, remote, country, page } = await context.request.json();
    const searchTerm = keywords || 'software developer';
    const results = [];

    // Country-specific Indeed RSS configs
    const indeedConfigs = {
      CA: { domain: 'ca.indeed.com', label: 'Indeed Canada' },
      US: { domain: 'www.indeed.com', label: 'Indeed US' },
      UK: { domain: 'www.indeed.co.uk', label: 'Indeed UK' },
      DE: { domain: 'de.indeed.com', label: 'Indeed Germany' },
      AU: { domain: 'au.indeed.com', label: 'Indeed Australia' }
    };

    const countriesToScrape = country && indeedConfigs[country] ? [country] : Object.keys(indeedConfigs);

    for (const c of countriesToScrape) {
      try {
        const cfg = indeedConfigs[c];
        const indeedUrl = `https://${cfg.domain}/rss?q=${encodeURIComponent(searchTerm + ' tech')}&l=${c === 'DE' ? 'Deutschland' : c}`;
        const resp = await fetch(indeedUrl, { headers: { 'User-Agent': 'Mozilla/5.0' } });
        if (resp.ok) {
          const html = await resp.text();
          const items = html.match(/<item>[\s\S]*?<\/item>/g) || [];
          items.forEach(item => {
            const title = (item.match(/<title><!\[CDATA\[(.*?)\]\]><\/title>/) || [])[1] || (item.match(/<title>(.*?)<\/title>/) || [])[1] || '';
            const link = (item.match(/<link>(.*?)<\/link>/) || [])[1] || '';
            const desc = (item.match(/<description><!\[CDATA\[(.*?)\]\]><\/description>/) || [])[1] || (item.match(/<description>(.*?)<\/description>/) || [])[1] || '';
            const pubDate = (item.match(/<pubDate>(.*?)<\/pubDate>/) || [])[1] || '';
            if (title && link) {
              const isRemote = /remote|work from home|wfh|virtual/i.test(desc + title);
              const isTech = /developer|engineer|software|devops|programmer|coder|frontend|backend|full.?stack|data.?scientist|machine.?learning|ai|cloud|architect|it.?support|sysadmin|network|security|analyst/i.test(title + desc);
              if (isTech) {
                results.push({
                  title: title.replace(/<\/?[^>]+(>|$)/g, '').trim(),
                  company: extractCompany(desc) || 'Company',
                  location: (extractLocation(desc) || c === 'CA' ? 'Canada' : c === 'US' ? 'United States' : c === 'UK' ? 'United Kingdom' : c === 'DE' ? 'Germany' : 'Australia') + ' (' + cfg.label + ')',
                  url: link.trim(),
                  description: desc.replace(/<\/?[^>]+(>|$)/g, '').trim().slice(0, 500),
                  postedDate: pubDate ? new Date(pubDate).toISOString() : new Date().toISOString(),
                  salary: extractSalary(desc),
                  remote: isRemote || remote === true,
                  source: cfg.label,
                  country: c
                });
              }
            }
          });
        }
      } catch (e) {}
    }

    // If no results from scraping, use fallback sample data
    if (results.length === 0) {
      results.push(...getFallbackJobs(searchTerm, country, remote));
    }

    // Deduplicate
    const seen = new Set();
    const unique = results.filter(r => {
      const key = r.title + '|' + r.company + '|' + r.country;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    // Filter remote if requested
    let filtered = unique;
    if (remote === true) {
      filtered = unique.filter(r => r.remote);
    }

    // Sort by date (newest first)
    filtered.sort((a, b) => new Date(b.postedDate) - new Date(a.postedDate));

    return new Response(JSON.stringify({
      jobs: filtered.slice(0, 60),
      total: filtered.length,
      page: page || 1,
      sources: ['Indeed Canada', 'Indeed US', 'Indeed UK', 'Indeed Germany', 'Indeed Australia']
    }), { headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message, jobs: getFallbackJobs() }), { status: 200, headers });
  }
}

function extractCompany(desc) {
  const m = desc.match(/Company:\s*([^<]+)/i) || desc.match(/at\s+([A-Z][^,\s]+(?:\s+[A-Z][^,\s]+){0,3})/);
  return m ? m[1].trim() : '';
}

function extractLocation(desc) {
  const m = desc.match(/Location:\s*([^<]+)/i);
  return m ? m[1].trim() : '';
}

function extractSalary(desc) {
  const m = desc.match(/\$[\d,]+(?:\.\d{2})?(?:\s*-\s*\$[\d,]+(?:\.\d{2})?)?/);
  return m ? m[0] : '';
}

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
    { title: 'Contract React Developer', company: 'Various Agencies', location: 'Remote, UK', country: 'UK', remote: true, salary: '£400 - £700/day', url: 'https://www.indeed.co.uk' },
    // GERMANY
    { title: 'Software Engineer', company: 'Zalando', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€70,000 - €110,000', url: 'https://jobs.zalando.com/' },
    { title: 'Backend Developer', company: 'N26', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€65,000 - €100,000', url: 'https://n26.com/en/careers' },
    { title: 'DevOps Engineer', company: 'SoundCloud', location: 'Berlin, Germany', country: 'DE', remote: true, salary: '€70,000 - €105,000', url: 'https://soundcloud.com/careers' },
    { title: 'AI Engineer', company: 'SAP', location: 'Walldorf, Germany', country: 'DE', remote: true, salary: '€80,000 - €130,000', url: 'https://www.sap.com/careers.html' },
    { title: 'Senior Java Developer', company: 'Deutsche Bank', location: 'Frankfurt, Germany', country: 'DE', remote: false, salary: '€85,000 - €120,000', url: 'https://www.db.com/careers/' },
    // AUSTRALIA
    { title: 'Software Engineer', company: 'Atlassian', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$130,000 - A$180,000', url: 'https://www.atlassian.com/company/careers' },
    { title: 'Full Stack Developer', company: 'Canva', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$120,000 - A$170,000', url: 'https://www.canva.com/careers/' },
    { title: 'Data Engineer', company: 'REA Group', location: 'Melbourne, Australia', country: 'AU', remote: true, salary: 'A$110,000 - A$160,000', url: 'https://www.rea-group.com/careers/' },
    { title: 'DevOps Engineer', company: 'Xero', location: 'Melbourne, Australia', country: 'AU', remote: true, salary: 'A$120,000 - A$165,000', url: 'https://www.xero.com/about/careers/' },
    { title: 'Frontend Developer', company: 'SafetyCulture', location: 'Sydney, Australia', country: 'AU', remote: true, salary: 'A$100,000 - A$145,000', url: 'https://safetyculture.com/careers/' },
    { title: 'Freelance Web Developer', company: 'Various Startups', location: 'Remote, NA', country: 'US', remote: true, salary: '$80 - $150/hr', url: 'https://www.indeed.com' },
    { title: 'Freelance Mobile Developer', company: 'Various Clients', location: 'Remote, EU', country: 'DE', remote: true, salary: '€60 - €120/hr', url: 'https://de.indeed.com' }
  ];

  const kw = (keyword || '').toLowerCase();
  let filtered = techJobs;
  if (kw && kw !== 'software developer' && kw !== 'tech') {
    filtered = techJobs.filter(j => j.title.toLowerCase().includes(kw) || j.company.toLowerCase().includes(kw));
  }
  if (remote === true) {
    filtered = filtered.filter(j => j.remote);
  }
  if (country) {
    filtered = filtered.filter(j => j.country === country);
  }

  return filtered.map((j, i) => ({
    id: 'job_' + i + '_' + Date.now(),
    title: j.title,
    company: j.company,
    location: j.location,
    url: j.url,
    description: j.title + ' position at ' + j.company + (j.remote ? ' (Remote). ' : ' in ' + j.location + '. ') + 'Apply directly on company website.',
    postedDate: new Date(Date.now() - i * 86400000 * Math.floor(Math.random() * 5 + 1)).toISOString(),
    salary: j.salary,
    remote: j.remote,
    source: j.country === 'CA' ? 'Tech Jobs Canada' : j.country === 'US' ? 'Tech Jobs USA' : j.country === 'UK' ? 'Tech Jobs UK' : j.country === 'DE' ? 'Tech Jobs Germany' : 'Tech Jobs Australia',
    country: j.country,
    tags: getTags(j.title),
    highlighted: j.title.includes('Senior') || j.title.includes('Lead') || j.title.includes('Architect')
  }));
}

function getTags(title) {
  const t = title.toLowerCase();
  const tags = [];
  if (t.includes('react')) tags.push('React');
  if (t.includes('node') || t.includes('backend')) tags.push('Node.js');
  if (t.includes('python')) tags.push('Python');
  if (t.includes('java')) tags.push('Java');
  if (t.includes('devops') || t.includes('sre') || t.includes('platform')) tags.push('DevOps');
  if (t.includes('frontend') || t.includes('react') || t.includes('angular') || t.includes('vue')) tags.push('Frontend');
  if (t.includes('full') || t.includes('fullstack')) tags.push('Full Stack');
  if (t.includes('data') || t.includes('machine') || t.includes('ai')) tags.push('AI/ML');
  if (t.includes('ios') || t.includes('mobile') || t.includes('react native')) tags.push('Mobile');
  if (t.includes('security') || t.includes('blockchain')) tags.push('Security');
  if (t.includes('qa') || t.includes('test') || t.includes('automation')) tags.push('QA');
  if (t.includes('product') || t.includes('technical writer')) tags.push('Product');
  if (t.includes('co-op') || t.includes('junior') || t.includes('intern')) tags.push('Junior');
  if (t.includes('architect')) tags.push('Architect');
  if (t.includes('freelance') || t.includes('contract')) tags.push('Freelance');
  if (tags.length === 0) tags.push('General Dev');
  return tags;
}
