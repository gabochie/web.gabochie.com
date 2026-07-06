/* ========================================
   CF PAGES FUNCTION — Visitor Geolocation
   Returns city/country from IP via CF headers
   ======================================== */
export async function onRequest(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Content-Type': 'application/json'
  };

  // Cloudflare adds geo headers automatically
  const geo = {
    city: context.request.cf?.city || '',
    region: context.request.cf?.region || '',
    country: context.request.cf?.country || '',
    countryName: context.request.cf?.countryName || '',
    continent: context.request.cf?.continent || '',
    latitude: context.request.cf?.latitude || null,
    longitude: context.request.cf?.longitude || null,
    timezone: context.request.cf?.timezone || '',
    postalCode: context.request.cf?.postalCode || '',
    metroCode: context.request.cf?.metroCode || '',
    asn: context.request.cf?.asn || '',
    asOrganization: context.request.cf?.asOrganization || ''
  };

  return new Response(JSON.stringify(geo), { status: 200, headers });
}
