/* ========================================
   NETLIFY FUNCTION — Brevo Email Sender
   Sends emails via Brevo (Sendinblue) API
   Free tier: 300 emails/day, no credit card
   ======================================== */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') return { statusCode: 204, headers, body: '' };
  if (event.httpMethod !== 'POST') return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };

  try {
    const { recipients, subject, htmlContent, textContent, replyTo, tags } = JSON.parse(event.body || '{}');

    // Brevo API key — set in Netlify Environment Variables
    const API_KEY = process.env.BREVO_API_KEY;
    if (!API_KEY) {
      return { statusCode: 500, headers, body: JSON.stringify({ error: 'BREVO_API_KEY not configured. Add it in Netlify → Site → Environment Variables.' }) };
    }

    if (!recipients || !recipients.length) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'recipients array required' }) };
    }

    if (!subject || !htmlContent) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'subject and htmlContent required' }) };
    }

    // Brevo batch send — up to 1000 recipients per request
    const batchSize = 1000;
    const results = [];

    for (let i = 0; i < recipients.length; i += batchSize) {
      const batch = recipients.slice(i, i + batchSize);
      const payload = {
        sender: { name: 'Gideon Abochie', email: 'gideon@gideonabochie.com' },
        to: batch.map(r => ({ email: r.email, name: r.name || r.email })),
        subject: subject,
        htmlContent: htmlContent,
        textContent: textContent || htmlContent.replace(/<[^>]+>/g, ''),
        replyTo: replyTo ? { email: replyTo } : { email: 'gideon@gideonabochie.com' },
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

    return {
      statusCode: 200,
      headers,
      body: JSON.stringify({
        success: totalSent > 0,
        totalSent,
        totalFailed,
        batches: results
      })
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};
