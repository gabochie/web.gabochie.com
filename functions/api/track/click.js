/* Track email clicks — redirect to target URL (validated) */
export async function onRequest(context) {
  const params = new URL(context.request.url).searchParams;
  const leadId = params.get('lid') || 'unknown';
  const campaignId = params.get('cid') || 'unknown';
  const rawUrl = params.get('url') || 'https://gideonabochie.com';

  // Validate URL — only allow same-site or explicit http/https
  let targetUrl = rawUrl;
  const ALLOWED_HOSTS = ['gideonabochie.com', 'www.gideonabochie.com', 'e1363afb.gideonabochie-com.pages.dev'];

  try {
    // Relative paths are safe
    if (rawUrl.startsWith('/')) {
      targetUrl = rawUrl;
    } else {
      const parsed = new URL(rawUrl.startsWith('http') ? rawUrl : 'https://' + rawUrl);
      if (!ALLOWED_HOSTS.includes(parsed.hostname)) {
        targetUrl = 'https://gideonabochie.com';
      } else {
        targetUrl = parsed.origin + parsed.pathname + parsed.search;
      }
    }
  } catch (e) {
    targetUrl = 'https://gideonabochie.com';
  }

  console.log(`[CLICK] lead=${leadId} campaign=${campaignId} url=${targetUrl} ts=${Date.now()}`);

  return Response.redirect(targetUrl, 302);
}
