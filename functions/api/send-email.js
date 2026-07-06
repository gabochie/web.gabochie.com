/* ========================================
   CF PAGES FUNCTION — Brevo Email Sender
   Sends emails via Brevo (Sendinblue) API
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { recipients, subject, htmlContent, textContent, replyTo, tags, apiKey, senderName, senderEmail } = await context.request.json();

    const API_KEY = context.env.BREVO_API_KEY || apiKey;
    if (!API_KEY) {
      return new Response(JSON.stringify({ error: 'BREVO_API_KEY not configured. Add it in admin Settings → Email Settings, or set it in Cloudflare Pages → Settings → Environment Variables.' }), { status: 500, headers });
    }

    if (!recipients || !recipients.length) {
      return new Response(JSON.stringify({ error: 'recipients array required' }), { status: 400, headers });
    }

    if (!subject || !htmlContent) {
      return new Response(JSON.stringify({ error: 'subject and htmlContent required' }), { status: 400, headers });
    }

    const batchSize = 1000;
    const results = [];
    const sender = {
      name: senderName || 'Gideon Abochie',
      email: senderEmail || 'info@gideonabochie.com'
    };

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const payload = {
        sender: sender,
        to: batch.map(r => ({ email: r.email, name: r.name || r.email })),
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent || htmlContent.replace(/<[^>]+>/g, ''),
        replyTo: replyTo ? { email: replyTo } : { email: 'info@gideonabochie.com' },
        tags: tags || ['outreach']
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

      const data = await response.json();
      results.push({
        batch: Math.floor(i / batchSize) + 1,
        status: response.ok ? 'sent' : 'failed',
        recipients: batch.length,
        messageId: data.messageId || null,
        error: data.message || null
      });
    }

    const totalSent = results.filter(r => r.status === 'sent').reduce((sum, r) => sum + r.recipients, 0);
    const totalFailed = results.filter(r => r.status === 'failed').reduce((sum, r) => sum + r.recipients, 0);

    return new Response(JSON.stringify({
      success: totalSent > 0,
      totalSent,
      totalFailed,
      batches: results
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
