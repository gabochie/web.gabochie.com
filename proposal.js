/* ========================================
   GA ADMIN — PROPOSAL GENERATOR
   ROI-focused, not design-focused
   ======================================== */
window.Proposal = (function () {
  'use strict';

  function generate(lead) {
    var html = generateHTML(lead);
    var container = document.getElementById('proposal-content');
    var modal = document.getElementById('proposal-modal');
    if (container) container.innerHTML = html;
    if (modal) modal.classList.add('show');
    var printBtn = document.getElementById('print-proposal-btn');
    if (printBtn) printBtn.onclick = function () { window.print(); };
  }

  function generateHTML(lead) {
    var isEnterprise = lead.type === 'enterprise';
    var stateName = (window.Data && window.Data.STATE_NAMES && window.Data.STATE_NAMES[lead.state]) || lead.state;

    // Calculate opportunity
    var opp = null;
    if (window.Scoring && window.Scoring.calculateOpportunity) {
      opp = window.Scoring.calculateOpportunity(lead);
    }

    var issues = [];
    if (window.Scoring && window.Scoring.getIssues) {
      issues = window.Scoring.getIssues(lead.industry, lead.qualScore || 50);
    }

    var flags = [];
    if (window.Scoring && window.Scoring.detectRedFlags) {
      flags = window.Scoring.detectRedFlags(lead);
    }

    // Pricing
    var setupPrice = isEnterprise ? '$10,000 – $20,000' : '$3,000 – $8,000';
    var monthlyPrice = isEnterprise ? '$5,000 – $10,000' : '$1,500 – $3,500';
    var yearlyValue = isEnterprise ? '$60,000 – $120,000' : '$18,000 – $42,000';

    // ROI projections
    var m1 = opp ? Math.round(opp.monthlyOpportunity * 0.15) : '—';
    var m3 = opp ? Math.round(opp.monthlyOpportunity * 0.35) : '—';
    var m6 = opp ? Math.round(opp.monthlyOpportunity * 0.65) : '—';
    var m12 = opp ? opp.monthlyOpportunity : '—';

    return '' +
      '<div class="meta-line">Prepared for <strong>' + esc(lead.name) + '</strong> | ' +
      esc(lead.city || '') + ', ' + esc(stateName) + ' | ' + esc(lead.industry) +
      ' | Est. Revenue: $' + (lead.value >= 1 ? lead.value.toFixed(1) + 'B' : (lead.value * 1000).toFixed(0) + 'M') + '</div>' +

      '<h2>The Opportunity</h2>' +
      (opp ?
        '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:16px;margin-bottom:16px">' +
        '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:16px;text-align:center">' +
        '<div><div style="font-size:24px;font-weight:800;color:var(--accent)">' + opp.currentLeads + '</div><div style="font-size:11px;color:var(--text2)">Current Leads/Mo</div></div>' +
        '<div><div style="font-size:24px;font-weight:800;color:var(--green)">' + opp.potentialLeads + '</div><div style="font-size:11px;color:var(--text2)">Potential Leads/Mo</div></div>' +
        '<div><div style="font-size:24px;font-weight:800;color:var(--yellow)">+' + opp.additionalLeads + '</div><div style="font-size:11px;color:var(--text2)">Additional Leads/Mo</div></div>' +
        '</div>' +
        '<div style="text-align:center;margin-top:12px;padding-top:12px;border-top:1px solid var(--border)">' +
        '<span style="font-size:13px;color:var(--text2)">Estimated monthly revenue opportunity: </span>' +
        '<strong style="font-size:18px;color:var(--green)">$' + opp.monthlyOpportunity.toLocaleString() + '/mo</strong>' +
        '</div></div>' :
        '<p>' + esc(lead.name) + ' has significant untapped potential in their digital conversion funnel. Our analysis identifies key areas where strategic optimization can drive measurable revenue growth.</p>') +

      '<h2>Current State Analysis</h2>' +
      '<p>' + esc(lead.name) + '\'s digital presence has the following conversion optimization opportunities:</p>' +
      '<ul style="margin:8px 0 0 20px;color:var(--text2)">' +
      issues.map(function (i) { return '<li>' + esc(i) + '</li>'; }).join('') +
      '</ul>' +
      (lead.adSpend ?
        '<p style="margin-top:8px"><strong>Current ad spend:</strong> $' + lead.adSpend.toLocaleString() + '/mo — ' +
        (lead.conversionRate < 3 ? 'converting below industry average. Optimizing landing pages could double your ROI.' : 'with room for conversion improvement.') + '</p>' : '') +
      (flags.length ?
        '<div style="margin-top:12px;padding:12px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:8px">' +
        '<strong style="color:var(--red)">⚠ Risk Factors:</strong>' +
        '<ul style="margin:6px 0 0 16px;color:var(--text2)">' +
        flags.map(function (f) { return '<li>' + esc(f) + '</li>'; }).join('') +
        '</ul></div>' : '') +

      '<h2>Proposed Solution: Conversion System</h2>' +
      '<p>We don\'t just redesign — we build a conversion engine. Our approach combines redesign with CRO and automation:</p>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0">' +
      '<div style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">' +
      '<strong style="color:var(--accent)">Phase 1: Redesign + CRO Foundation</strong>' +
      '<ul style="margin:6px 0 0 16px;color:var(--text2);font-size:12px">' +
      '<li>Conversion-focused UI/UX redesign</li><li>Landing page optimization</li>' +
      '<li>Lead capture system</li><li>A/B testing framework</li></ul></div>' +
      '<div style="padding:14px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">' +
      '<strong style="color:var(--green)">Phase 2: Automation + Optimization</strong>' +
      '<ul style="margin:6px 0 0 16px;color:var(--text2);font-size:12px">' +
      '<li>Email nurture sequences</li><li>Lead scoring & routing</li>' +
      '<li>Analytics dashboard</li><li>Ongoing A/B testing</li></ul></div>' +
      '</div>' +

      '<h2>ROI Projections</h2>' +
      '<div style="background:var(--surface2);border:1px solid var(--border);border-radius:8px;padding:16px;margin:12px 0">' +
      '<table style="width:100%;border-collapse:collapse;font-size:13px">' +
      '<thead><tr style="border-bottom:1px solid var(--border)">' +
      '<th style="padding:8px;text-align:left;color:var(--text2)">Timeline</th>' +
      '<th style="padding:8px;text-align:right;color:var(--text2)">Expected Revenue Impact</th>' +
      '<th style="padding:8px;text-align:right;color:var(--text2)">Cumulative ROI</th>' +
      '</tr></thead><tbody>' +
      '<tr><td style="padding:8px">Month 1</td><td style="padding:8px;text-align:right;color:var(--green)">$' + (typeof m1 === 'number' ? m1.toLocaleString() : m1) + '</td><td style="padding:8px;text-align:right">15%</td></tr>' +
      '<tr style="border-top:1px solid var(--border)"><td style="padding:8px">Month 3</td><td style="padding:8px;text-align:right;color:var(--green)">$' + (typeof m3 === 'number' ? m3.toLocaleString() : m3) + '</td><td style="padding:8px;text-align:right">35%</td></tr>' +
      '<tr style="border-top:1px solid var(--border)"><td style="padding:8px">Month 6</td><td style="padding:8px;text-align:right;color:var(--green)">$' + (typeof m6 === 'number' ? m6.toLocaleString() : m6) + '</td><td style="padding:8px;text-align:right">65%</td></tr>' +
      '<tr style="border-top:1px solid var(--border)"><td style="padding:8px;font-weight:700">Month 12</td><td style="padding:8px;text-align:right;color:var(--green);font-weight:700">$' + (typeof m12 === 'number' ? m12.toLocaleString() : m12) + '/mo</td><td style="padding:8px;text-align:right;font-weight:700">100%+</td></tr>' +
      '</tbody></table></div>' +

      '<h2>Investment</h2>' +
      '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin:12px 0">' +
      '<div style="padding:16px;background:var(--surface2);border:1px solid var(--border);border-radius:8px">' +
      '<div style="font-size:12px;color:var(--text2);text-transform:uppercase;letter-spacing:.5px">Setup Fee</div>' +
      '<div style="font-size:20px;font-weight:800;margin:4px 0">' + setupPrice + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">One-time · Redesign + CRO foundation</div></div>' +
      '<div style="padding:16px;background:var(--surface2);border:1px solid var(--accent);border-radius:8px">' +
      '<div style="font-size:12px;color:var(--accent);text-transform:uppercase;letter-spacing:.5px;font-weight:600">Monthly Retainer</div>' +
      '<div style="font-size:20px;font-weight:800;margin:4px 0">' + monthlyPrice + '</div>' +
      '<div style="font-size:11px;color:var(--text2)">Ongoing optimization · CRO · Automation</div></div>' +
      '</div>' +
      '<p style="font-size:12px;color:var(--text2);margin-top:8px">Annual value: <strong>' + yearlyValue + '</strong> · Minimum 6-month commitment</p>' +

      '<h2>Why Us</h2>' +
      '<ul style="margin:8px 0 0 20px;color:var(--text2)">' +
      '<li>15+ years UI/UX + conversion optimization experience</li>' +
      '<li>Data-driven approach — every decision backed by analytics</li>' +
      '<li>Specialized in ' + esc(lead.industry) + ' industry funnels</li>' +
      '<li>Proven track record: 40-60% conversion lifts in 90 days</li>' +
      '<li>Transparent reporting — you see exactly what\'s working</li></ul>' +

      '<h2>Next Steps</h2>' +
      '<ol style="margin:8px 0 0 20px;color:var(--text2)">' +
      '<li>Book a 30-minute strategy call to review this proposal</li>' +
      '<li>We audit your current funnel and confirm the opportunity</li>' +
      '<li>Finalize scope and start within 2 weeks</li>' +
      '<li>See measurable results within 60-90 days</li></ol>' +
      '<br>' +
      '<p style="color:var(--text2);font-size:12px">This proposal is valid for 30 days. ' +
      'Prepared by <strong>Gideon Abochie</strong> | gideonabochie.com</p>';
  }

  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  return { generate: generate, generateHTML: generateHTML };
})();
