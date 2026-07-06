/* ========================================
   NETLIFY FUNCTION — PDF Proposal Generator
   Server-side PDF generation from proposal data
   ======================================== */
exports.handler = async (event) => {
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json'
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { company, industry, revenue, score, issues, opportunity } = JSON.parse(event.body || '{}');

    if (!company) {
      return { statusCode: 400, headers, body: JSON.stringify({ error: 'Company name required' }) };
    }

    // Generate HTML proposal (client converts to PDF via print)
    const proposalHTML = generateProposalHTML({
      company: company || 'Unknown',
      industry: industry || 'Business',
      revenue: revenue || 0,
      score: score || 0,
      issues: issues || [],
      opportunity: opportunity || {}
    });

    return {
      statusCode: 200,
      headers: { ...headers, 'Content-Type': 'text/html' },
      body: proposalHTML
    };

  } catch (err) {
    return { statusCode: 500, headers, body: JSON.stringify({ error: err.message }) };
  }
};

function generateProposalHTML(data) {
  const rev = (data.revenue || 0).toFixed(1);
  const opp = data.opportunity;
  const monthlyOpp = opp.monthlyOpportunity ? `$${(opp.monthlyOpportunity / 1000).toFixed(1)}K` : 'TBD';
  const annualOpp = opp.annualOpportunity ? `$${(opp.annualOpportunity / 1000).toFixed(0)}K` : 'TBD';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>Proposal — ${data.company}</title>
  <style>
    * { margin:0; padding:0; box-sizing:border-box; }
    body { font-family: 'Inter', -apple-system, sans-serif; color: #1a1a2e; line-height:1.6; padding:40px; max-width:800px; margin:0 auto; }
    h1 { font-size:28px; font-weight:800; margin-bottom:4px; }
    h2 { font-size:20px; font-weight:700; margin:28px 0 8px; padding-bottom:6px; border-bottom:2px solid #e63946; }
    h3 { font-size:16px; font-weight:600; margin:16px 0 6px; }
    p { margin-bottom:12px; color:#444; }
    .meta { color:#888; font-size:13px; margin-bottom:24px; }
    .tier { background:#f8f9fa; border:1px solid #e0e0e0; border-radius:8px; padding:16px; margin-bottom:12px; }
    .tier h4 { color:#e63946; font-size:14px; font-weight:700; margin-bottom:4px; }
    .tier .price { font-size:24px; font-weight:800; }
    .tier ul { margin:8px 0 0 16px; color:#555; }
    .tier li { margin-bottom:3px; font-size:14px; }
    .highlight { background:#fff3cd; padding:16px; border-radius:8px; margin:16px 0; border-left:4px solid #f59e0b; }
    .cta { background:#e63946; color:#fff; padding:16px 32px; border-radius:8px; text-decoration:none; font-weight:600; display:inline-block; margin-top:16px; }
    table { width:100%; border-collapse:collapse; margin:12px 0; }
    th, td { padding:10px 12px; border:1px solid #e0e0e0; text-align:left; font-size:13px; }
    th { background:#f0f0f0; font-weight:600; }
    .footer { margin-top:40px; padding-top:16px; border-top:1px solid #e0e0e0; font-size:12px; color:#888; text-align:center; }
    @media print { body { padding:20px; } .cta { display:none; } }
  </style>
</head>
<body>
  <h1>Conversion System Proposal</h1>
  <div class="meta">Prepared for <strong>${data.company}</strong> — ${data.industry} — ${new Date().toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' })}</div>

  <h2>Current Situation</h2>
  <p>${data.company} is a ${data.industry} business generating approximately $${rev}M in annual revenue. Our analysis identified conversion gaps that represent significant revenue opportunity.</p>

  <div class="highlight">
    <strong>Growth Opportunity Score:</strong> ${data.score}/100<br>
    <strong>Estimated Monthly Revenue Gap:</strong> ${monthlyOpp}<br>
    <strong>Annual Opportunity:</strong> ${annualOpp}
  </div>

  ${data.issues.length ? `<h2>Conversion Gaps Identified</h2><ul>${data.issues.map(i => `<li>${i}</li>`).join('')}</ul>` : ''}

  <h2>Our Solution</h2>
  <p>We propose a complete website redesign focused on conversion optimization — turning your traffic into revenue.</p>

  <div class="tier">
    <h4>Essentials</h4>
    <div class="price">$5,000</div>
    <p>5-page responsive site · Mobile optimized · Contact form · Basic SEO · SSL · 1 month support</p>
  </div>

  <div class="tier" style="border-color:#e63946;position:relative">
    <h4>Professional ★ Recommended</h4>
    <div class="price">$10,000</div>
    <p>10-page responsive site · CMS · Advanced SEO · Analytics · Blog · 3 months support · Content migration</p>
  </div>

  <div class="tier">
    <h4>Enterprise</h4>
    <div class="price">$20,000+</div>
    <p>20+ custom pages · Custom functionality · E-commerce · API integrations · Performance optimization · 6 months support</p>
  </div>

  <h2>Timeline</h2>
  <table>
    <tr><th>Phase</th><th>Duration</th><th>Deliverable</th></tr>
    <tr><td>Discovery & Strategy</td><td>Week 1</td><td>Strategy doc, sitemap, wireframes</td></tr>
    <tr><td>Design</td><td>Week 2-3</td><td>Visual concepts, final mockups</td></tr>
    <tr><td>Development</td><td>Week 4-6</td><td>Build, forms, CMS, SEO</td></tr>
    <tr><td>QA & Launch</td><td>Week 7-8</td><td>Testing, deploy, handoff</td></tr>
  </table>

  <h2>Next Steps</h2>
  <ol>
    <li>Schedule a 30-minute discovery call</li>
    <li>Select your tier</li>
    <li>We begin within 48 hours of signed agreement</li>
  </ol>

  <a href="mailto:gideon@gideonabochie.com?subject=Re:${data.company} Proposal" class="cta">Accept Proposal →</a>

  <div class="footer">
    Gideon Abochie · gideon@gideonabochie.com · +233 243 262 019<br>
    This proposal is valid for 30 days from the date above.
  </div>
</body>
</html>`;
}
