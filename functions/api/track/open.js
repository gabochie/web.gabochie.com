/* Track email opens — return 1x1 transparent pixel */
export async function onRequest(context) {
  const params = new URL(context.request.url).searchParams;
  const leadId = params.get('lid') || 'unknown';
  const campaignId = params.get('cid') || 'unknown';

  console.log(`[OPEN] lead=${leadId} campaign=${campaignId} ts=${Date.now()}`);

  const pixel = Uint8Array.from(atob('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7'), c => c.charCodeAt(0));
  return new Response(pixel, {
    status: 200,
    headers: {
      'Content-Type': 'image/gif',
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      'Pragma': 'no-cache'
    }
  });
}
