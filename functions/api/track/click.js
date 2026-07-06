/* Track email clicks — redirect to target URL */
export async function onRequest(context) {
  const params = new URL(context.request.url).searchParams;
  const leadId = params.get('lid') || 'unknown';
  const campaignId = params.get('cid') || 'unknown';
  const targetUrl = params.get('url') || 'https://gideonabochie.com';

  console.log(`[CLICK] lead=${leadId} campaign=${campaignId} url=${targetUrl} ts=${Date.now()}`);

  return Response.redirect(targetUrl, 302);
}
