/* ========================================
   CF PAGES FUNCTION — Google Places Search
   Discovers real businesses by keyword + location
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { keyword, location, type, radius } = await context.request.json();

    const API_KEY = context.env.GOOGLE_PLACES_API_KEY;
    if (!API_KEY) {
      return new Response(JSON.stringify({
        error: 'GOOGLE_PLACES_API_KEY not configured. Add it in Cloudflare Pages → Settings → Environment Variables.',
        fallback: true
      }), { status: 500, headers });
    }

    if (!keyword) {
      return new Response(JSON.stringify({ error: 'keyword required' }), { status: 400, headers });
    }

    const searchLocation = location || 'United States';
    const searchRadius = radius || 50000;
    const searchType = type || '';

    // Step 1: Geocode the location
    const geoUrl = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(searchLocation)}&key=${API_KEY}`;
    const geoRes = await fetch(geoUrl);
    const geoData = await geoRes.json();

    if (!geoData.results || !geoData.results.length) {
      return new Response(JSON.stringify({ error: 'Location not found', results: [] }), { status: 404, headers });
    }

    const { lat, lng } = geoData.results[0].geometry.location;

    // Step 2: Text search nearby
    let placesUrl = `https://maps.googleapis.com/maps/api/place/textsearch/json?query=${encodeURIComponent(keyword)}&location=${lat},${lng}&radius=${searchRadius}&key=${API_KEY}`;
    if (searchType) {
      placesUrl += `&type=${encodeURIComponent(searchType)}`;
    }

    const placesRes = await fetch(placesUrl);
    const placesData = await placesRes.json();

    if (placesData.status !== 'OK' && placesData.status !== 'ZERO_RESULTS') {
      return new Response(JSON.stringify({
        error: 'Places API error: ' + placesData.status,
        results: []
      }), { status: 502, headers });
    }

    // Step 3: Format results
    const results = (placesData.results || []).slice(0, 20).map(function (place) {
      return {
        placeId: place.place_id,
        name: place.name,
        address: place.formatted_address,
        rating: place.rating || null,
        totalRatings: place.user_ratings_total || 0,
        types: place.types || [],
        openNow: place.opening_hours ? place.opening_hours.open_now : null,
        phone: place.formatted_phone_number || null,
        website: null, // Details endpoint needed
        lat: place.geometry.location.lat,
        lng: place.geometry.location.lng
      };
    });

    // Step 4: Get details for top 5 (phone + website)
    const detailed = [];
    for (let i = 0; i < Math.min(results.length, 5); i++) {
      try {
        const detailUrl = `https://maps.googleapis.com/maps/api/place/details/json?place_id=${results[i].placeId}&fields=formatted_phone_number,website&key=${API_KEY}`;
        const detailRes = await fetch(detailUrl);
        const detailData = await detailRes.json();
        if (detailData.result) {
          results[i].phone = detailData.result.formatted_phone_number || results[i].phone;
          results[i].website = detailData.result.website || null;
        }
      } catch (e) {}
      detailed.push(results[i]);
    }

    // Add remaining without details
    for (let i = 5; i < results.length; i++) {
      detailed.push(results[i]);
    }

    return new Response(JSON.stringify({
      success: true,
      query: keyword,
      location: searchLocation,
      center: { lat, lng },
      count: detailed.length,
      results: detailed
    }), { status: 200, headers });

  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
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
