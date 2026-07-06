/* ========================================
   NETLIFY FUNCTION — Email Open/Click Tracker
   1x1 pixel for opens, redirect for clicks
   ======================================== */
exports.handler = async (event) => {
  const path = event.path || '';
  const params = event.queryStringParameters || {};

  // Track open — return 1x1 transparent pixel
  if (path.includes('/track/open')) {
    const leadId = params.lid || 'unknown';
    const campaignId = params.cid || 'unknown';

    // Log the open event
    console.log(`[OPEN] lead=${leadId} campaign=${campaignId} ts=${Date.now()}`);

    // Return tracking pixel
    const pixel = Buffer.from('R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', 'base64');
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'image/gif',
        'Cache-Control': 'no-store, no-cache, must-revalidate',
        'Pragma': 'no-cache'
      },
      body: pixel.toString('base64'),
      isBase64Encoded: true
    };
  }

  // Track click — redirect to target URL
  if (path.includes('/track/click')) {
    const leadId = params.lid || 'unknown';
    const campaignId = params.cid || 'unknown';
    const url = params.url || 'https://gideonabochie.com';

    console.log(`[CLICK] lead=${leadId} campaign=${campaignId} url=${url} ts=${Date.now()}`);

    return {
      statusCode: 302,
      headers: { 'Location': url },
      body: ''
    };
  }

  return { statusCode: 404, headers: {}, body: 'Not found' };
};
