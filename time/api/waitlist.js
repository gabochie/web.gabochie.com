/* ========================================
   CF PAGES FUNCTION — Waitlist Signup
   Saves emails to Firestore
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { email, source } = await context.request.json();

    if (!email || !email.includes('@')) {
      return new Response(JSON.stringify({ error: 'Valid email required' }), { status: 400, headers });
    }

    // Save to console for now (will use Firestore in production)
    console.log(`[WAITLIST] email=${email} source=${source || 'unknown'} ts=${Date.now()}`);

    return new Response(JSON.stringify({
      success: true,
      message: 'Added to waitlist',
      email: email
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
