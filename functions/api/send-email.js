/* ========================================
   CF PAGES FUNCTION — Brevo Email Sender
   Sends emails via Brevo (Sendinblue) API

   Hardened:
   - Same-origin only (Origin/Referer allowlist)
   - No caller-supplied API keys accepted
   - Per-IP rate limiting + batch cap
   ======================================== */
const ALLOWED_ORIGINS = [
  'https://web.gabochie.com',
  'http://localhost:8788',
  'http://127.0.0.1:8788'
];
const MAX_BATCH = 50;
const RATE_LIMIT = 20;
const RATE_WINDOW_MS = 60 * 60 * 1000;

// Per-isolate sliding window (best-effort across isolates)
const hits = new Map();

function json(data, status) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
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

export async function onRequestPost(context) {
  try {
    if (!originAllowed(context.request)) {
      return json({ error: 'Forbidden' }, 403);
    }

    const ip = context.request.headers.get('CF-Connecting-IP') || 'unknown';
    if (rateLimited(ip)) {
      return json({ error: 'Rate limit exceeded. Try again later.' }, 429);
    }

    const { recipients, subject, htmlContent, textContent, replyTo, tags, senderName, senderEmail } =
      await context.request.json();

    const API_KEY = context.env.BREVO_API_KEY;
    if (!API_KEY) {
      return json({ error: 'BREVO_API_KEY not configured in Cloudflare Pages environment variables.' }, 500);
    }

    if (!Array.isArray(recipients) || !recipients.length) {
      return json({ error: 'recipients array required' }, 400);
    }
    if (recipients.length > MAX_BATCH) {
      return json({ error: `Max ${MAX_BATCH} recipients per request` }, 400);
    }
    if (!subject || !htmlContent || String(htmlContent).length > 200000) {
      return json({ error: 'subject and htmlContent (<=200KB) required' }, 400);
    }

    const sender = {
      name: senderName || 'Web Gabochie',
      email: senderEmail || 'web@gabochie.com'
    };

    const payload = {
      sender,
      to: recipients.slice(0, MAX_BATCH).map(r => ({ email: String(r.email || '').slice(0, 200), name: String(r.name || r.email || '').slice(0, 100) })),
      subject: String(subject).slice(0, 300),
      htmlContent,
      textContent: textContent || htmlContent.replace(/<[^>]+>/g, ''),
      replyTo: replyTo ? { email: String(replyTo).slice(0, 200) } : { email: 'web@gabochie.com' },
      tags: Array.isArray(tags) ? tags.slice(0, 5).map(t => String(t).slice(0, 40)) : ['outreach']
    };

    const response = await fetch('https://api.brevo.com/v3/smtp/email', {
      method: 'POST',
      headers: {
        'accept': 'application/json',
        'api-key': API_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json().catch(() => ({}));

    return json({
      success: response.ok,
      totalSent: response.ok ? payload.to.length : 0,
      totalFailed: response.ok ? 0 : payload.to.length,
      messageId: data.messageId || null,
      error: response.ok ? null : (data.message || `Brevo HTTP ${response.status}`)
    }, response.ok ? 200 : 422);

  } catch (err) {
    return json({ error: err.message }, 500);
  }
}
