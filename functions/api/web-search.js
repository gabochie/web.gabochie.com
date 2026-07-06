/* ========================================
   CF PAGES FUNCTION — Web Directory Scraper
   Discovers businesses from public directories
   No API key required
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { keyword, location, source } = await context.request.json();

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'keyword required' }), { status: 400, headers });
    }

    const searchLocation = location || 'United States';
    const results = [];

    // Try multiple sources
    const sources = source ? [source] : ['google', 'yellowpages', 'yelp'];

    for (const src of sources) {
      try {
        if (src === 'yellowpages') {
          const ypResults = await scrapeYellowPages(keyword, searchLocation);
          results.push(...ypResults);
        } else if (src === 'yelp') {
          const yelpResults = await scrapeYelp(keyword, searchLocation);
          results.push(...yelpResults);
        } else if (src === 'google') {
          const googleResults = await scrapeGoogle(keyword, searchLocation);
          results.push(...googleResults);
        }
      } catch (e) {
        // Continue to next source
      }
    }

    // Deduplicate by website URL
    const seen = new Set();
    const unique = results.filter(r => {
      if (!r.website || seen.has(r.website)) return false;
      seen.add(r.website);
      return true;
    });

    return new Response(JSON.stringify({
      success: true,
      keyword: keyword,
      location: searchLocation,
      results: unique,
      total: unique.length,
      sources: sources
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

/* ----------------------------------------
   YELLOW PAGES SCRAPER
   ---------------------------------------- */
async function scrapeYellowPages(keyword, location) {
  const query = encodeURIComponent(keyword + ' ' + location);
  const url = `https://www.yellowpages.com/search?search_terms=${query}&geo_location_terms=${encodeURIComponent(location)}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results = [];

  // Parse business listings
  const listingRegex = /<div class="result[^"]*"[^>]*>[\s\S]*?<a[^>]*class="business-name"[^>]*href="([^"]*)"[^>]*>([\s\S]*?)<\/a>[\s\S]*?<span class="phones[^"]*">([\s\S]*?)<\/span>[\s\S]*?<div class="adr">([\s\S]*?)<\/div>/g;

  let match;
  while ((match = listingRegex.exec(html)) !== null) {
    const listingUrl = match[1];
    const name = match[2].replace(/<[^>]+>/g, '').trim();
    const phone = match[3].replace(/<[^>]+>/g, '').trim();
    const address = match[4].replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

    // Try to extract website from listing page
    let website = '';
    if (listingUrl.startsWith('http')) {
      try {
        const detailResp = await fetch(listingUrl.startsWith('http') ? listingUrl : 'https://www.yellowpages.com' + listingUrl, {
          headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
        });
        if (detailResp.ok) {
          const detailHtml = await detailResp.text();
          const websiteMatch = detailHtml.match(/class="website-link"[^>]*href="([^"]*)"/);
          if (websiteMatch) website = websiteMatch[1];
        }
      } catch (e) {}
    }

    results.push({
      name: name,
      phone: phone,
      address: address,
      website: website,
      source: 'Yellow Pages',
      rating: null,
      totalRatings: null
    });
  }

  return results;
}

/* ----------------------------------------
   YELP SCRAPER
   ---------------------------------------- */
async function scrapeYelp(keyword, location) {
  const query = encodeURIComponent(keyword);
  const loc = encodeURIComponent(location);
  const url = `https://www.yelp.com/search?find_desc=${query}&find_loc=${loc}`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results = [];

  // Parse Yelp listings
  const nameRegex = /<a[^>]*class="[^"]*css-[a-z0-9]+"[^>]*href="(\/biz\/[^"]*)"[^>]*>([^<]*)<\/a>/g;
  let match;

  while ((match = nameRegex.exec(html)) !== null) {
    const bizPath = match[1];
    const name = match[2].trim();

    if (!name || name.length < 2) continue;

    // Try to get website from business page
    let website = '';
    try {
      const bizResp = await fetch('https://www.yelp.com' + bizPath, {
        headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' }
      });
      if (bizResp.ok) {
        const bizHtml = await bizResp.text();
        const webMatch = bizHtml.match(/"externalUrl":"([^"]*)"/);
        if (webMatch) website = webMatch[1].replace(/\\u002F/g, '/');
        const phoneMatch = bizHtml.match(/"phone":"([^"]*)"/);
        const addrMatch = bizHtml.match(/"address":[^}]*"streetAddress":"([^"]*)"/);
        results.push({
          name: name,
          phone: phoneMatch ? phoneMatch[1] : '',
          address: addrMatch ? addrMatch[1] : '',
          website: website,
          source: 'Yelp',
          rating: null,
          totalRatings: null
        });
      }
    } catch (e) {
      results.push({
        name: name,
        phone: '',
        address: '',
        website: '',
        source: 'Yelp',
        rating: null,
        totalRatings: null
      });
    }
  }

  return results;
}

/* ----------------------------------------
   GOOGLE SEARCH SCRAPER
   ---------------------------------------- */
async function scrapeGoogle(keyword, location) {
  const query = encodeURIComponent(keyword + ' near ' + location);
  const url = `https://www.google.com/search?q=${query}&num=20`;

  const response = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml',
      'Accept-Language': 'en-US,en;q=0.9'
    }
  });

  if (!response.ok) return [];

  const html = await response.text();
  const results = [];

  // Extract organic results with websites
  const linkRegex = /<a[^>]*href="\/url\?q=([^&"]*)/g;
  let match;

  while ((match = linkRegex.exec(html)) !== null) {
    const website = decodeURIComponent(match[1]);
    if (!website.startsWith('http')) continue;
    if (website.includes('google.com') || website.includes('youtube.com') || website.includes('facebook.com')) continue;

    const domain = new URL(website).hostname.replace('www.', '');
    results.push({
      name: domain.split('.')[0].charAt(0).toUpperCase() + domain.split('.')[0].slice(1),
      phone: '',
      address: '',
      website: website,
      source: 'Google Search',
      rating: null,
      totalRatings: null
    });
  }

  return results.slice(0, 10);
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
