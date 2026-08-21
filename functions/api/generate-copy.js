/* ========================================
   CF PAGES FUNCTION — OpenAI Copywriter
   Generates personalized outreach messages
   ======================================== */
export async function onRequestPost(context) {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  try {
    const { lead, messageType, tone, apiKey } = await context.request.json();

    const API_KEY = context.env.OPENAI_API_KEY || apiKey;
    if (!API_KEY) {
      return new Response(JSON.stringify({
        error: 'OPENAI_API_KEY not configured. Add it in admin Settings or Cloudflare Pages env vars.',
        fallback: true
      }), { status: 500, headers });
    }

    if (!lead) {
      return new Response(JSON.stringify({ error: 'lead object required' }), { status: 400, headers });
    }

    const systemPrompt = `You are a B2B outreach copywriter for Web Gabochie, a website conversion specialist. You write personalized cold outreach emails that get responses.

Rules:
- Subject line: 4-8 words, curiosity-driven, no spam triggers
- Body: 3-5 sentences, personal, references their specific business
- Tone: ${tone || 'professional but warm'}
- Focus on THEIR pain points, not your features
- Include one specific observation about their website
- End with a soft CTA (question, not demand)
- No "Dear Sir/Madam" — use their name if available
- No "I hope this finds you well"`;

    const userPrompt = `Write a ${messageType || 'cold outreach'} email for this lead:

Company: ${lead.company || lead.name || 'Unknown'}
Industry: ${lead.industry || 'Unknown'}
Website: ${lead.url || 'N/A'}
Rating: ${lead.rating || 'N/A'} stars (${lead.totalRatings || 0} reviews)
Address: ${lead.address || 'N/A'}

Generate:
1. Subject line
2. Email body
3. Follow-up subject (for day 3)
4. Follow-up body (for day 3)

Return as JSON: { "subject": "...", "body": "...", "followUpSubject": "...", "followUpBody": "..." }`;

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ],
        temperature: 0.7,
        max_tokens: 800
      })
    });

    const data = await response.json();

    if (!response.ok) {
      return new Response(JSON.stringify({
        error: data.error?.message || 'OpenAI API error',
        status: response.status
      }), { status: response.status, headers });
    }

    const content = data.choices?.[0]?.message?.content || '';

    // Parse JSON from response
    let parsed;
    try {
      // Try to extract JSON from the response
      const jsonMatch = content.match(/\{[\s\S]*\}/);
      if (jsonMatch) {
        parsed = JSON.parse(jsonMatch[0]);
      }
    } catch (e) {}

    if (!parsed || !parsed.subject) {
      // Fallback: treat entire response as body
      parsed = {
        subject: 'Quick question about ' + (lead.company || lead.name || 'your website'),
        body: content,
        followUpSubject: 'Following up — ' + (lead.company || lead.name || 'your website'),
        followUpBody: content
      };
    }

    return new Response(JSON.stringify({
      success: true,
      message: parsed,
      model: 'gpt-4o-mini',
      tokens: data.usage?.total_tokens || 0
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
