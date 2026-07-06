/* ========================================
   GA ADMIN — OUTREACH MODULE
   Performance-focused templates
   ======================================== */
window.Outreach = (function () {
  'use strict';

  var TEMPLATES = [
    {
      name: 'Ad Spend + Low Conversion',
      category: 'Cold — High Intent',
      subject: 'You\'re leaving money on the table, [Company]',
      body: 'Hi [Name],\n\nI noticed [Company] is running paid ads — smart move. But here\'s the thing: your landing pages are converting at [CVR]%, while the industry benchmark is 3.5%.\n\nThat means for every $1,000 you spend on ads, roughly $400 is going to waste.\n\nWe specialize in closing that gap. Our clients typically see 40-60% improvement in conversion rates within 90 days.\n\nWant me to run a quick conversion audit on your current funnel? No cost, no obligation.\n\nBest,\nGideon'
    },
    {
      name: 'Competitor Automation Gap',
      category: 'Cold — Competitive',
      subject: '[Competitor] is automating. Are you?',
      body: 'Hi [Name],\n\nI was looking at how [Competitor] handles their lead follow-up — they\'ve automated their email sequences, lead scoring, and appointment booking.\n\nMost [Industry] companies are still doing this manually, which means leads slip through the cracks.\n\nWe build automation systems that nurture leads 24/7 without your team lifting a finger. Interested in seeing what this would look like for [Company]?\n\nBest,\nGideon'
    },
    {
      name: 'Revenue Opportunity Math',
      category: 'Cold — Value-First',
      subject: 'Quick math for [Company]',
      body: 'Hi [Name],\n\nQuick math:\n\n• Your estimated monthly traffic: [Traffic] visitors\n• Your current conversion rate: [CVR]%\n• That\'s roughly [Leads] leads/month\n\nIf we lift your conversion to 3.5% (our average), you\'d get [PotentialLeads] leads/month — an extra [AdditionalLeads] leads.\n\nAt your average deal value, that\'s approximately $[MonthlyRevenue]/month in additional pipeline.\n\nWorth a 15-minute call to explore?\n\nBest,\nGideon'
    },
    {
      name: 'Follow-Up — Audit Results',
      category: 'Follow-Up',
      subject: 'Re: [Company] conversion audit',
      body: 'Hi [Name],\n\nJust following up on the conversion audit I ran for [Company]. Here\'s what I found:\n\n• Conversion score: [Score]/100\n• Key issues: [Issue Count]\n• Estimated monthly lost revenue: $[LostRevenue]\n\nThe good news — these are all fixable. Our clients typically see 40-60% improvement within 90 days.\n\nCan I walk you through the findings? No obligation.\n\nBest,\nGideon'
    },
    {
      name: 'Follow-Up — 1 Week',
      category: 'Follow-Up',
      subject: 'Checking in — [Company] growth',
      body: 'Hi [Name],\n\nJust circling back. I know timing is everything.\n\nIf now isn\'t right, I\'m happy to reconnect next quarter. In the meantime, I put together a quick projection of what a 1% conversion lift would mean for [Company]\'s revenue.\n\nWant me to send it over?\n\nBest,\nGideon'
    },
    {
      name: 'Proposal Send',
      category: 'Proposal',
      subject: '[Company] — Conversion System Proposal',
      body: 'Hi [Name],\n\nAs promised, here\'s the conversion system proposal for [Company]. It includes:\n\n• Current funnel analysis\n• Revenue opportunity projection\n• Redesign + CRO + Automation system\n• ROI timeline (month 1-12)\n• Pricing: setup + monthly retainer\n\nThe short version: for a $[Setup] setup + $[Monthly]/mo, we project $[Revenue]/mo in additional pipeline within 6 months.\n\nTake a look and let me know if you have questions.\n\nBest,\nGideon'
    },
    {
      name: 'Post-Proposal Follow-Up',
      category: 'Proposal',
      subject: 'Re: [Company] proposal — thoughts?',
      body: 'Hi [Name],\n\nJust checking in on the proposal. Any questions on the ROI projections or the approach?\n\nHappy to hop on a call to walk through it together.\n\nBest,\nGideon'
    },
    {
      name: 'Referral Request',
      category: 'Relationship',
      subject: 'Quick favor',
      body: 'Hi [Name],\n\nHope you\'re doing well. I\'m expanding my work with [Industry] companies that are spending on paid ads but need better conversion systems.\n\nAnyone come to mind? I\'d really appreciate the introduction.\n\nBest,\nGideon'
    }
  ];

  function formatTemplate(template, lead) {
    var text = template.body;
    var opp = null;
    if (window.Scoring && window.Scoring.calculateOpportunity) {
      opp = window.Scoring.calculateOpportunity(lead);
    }
    text = text.replace(/\[Company\]/g, lead.name || '');
    text = text.replace(/\[Name\]/g, '[Contact Name]');
    text = text.replace(/\[Industry\]/g, lead.industry || '');
    text = text.replace(/\[CVR\]/g, String(lead.conversionRate || 2.1));
    text = text.replace(/\[Traffic\]/g, (lead.monthlyTraffic || 10000).toLocaleString());
    text = text.replace(/\[Score\]/g, String(lead.qualScore || 75));
    text = text.replace(/\[Competitor\]/g, '[Competitor]');
    if (opp) {
      text = text.replace(/\[Leads\]/g, String(opp.currentLeads));
      text = text.replace(/\[PotentialLeads\]/g, String(opp.potentialLeads));
      text = text.replace(/\[AdditionalLeads\]/g, String(opp.additionalLeads));
      text = text.replace(/\[MonthlyRevenue\]/g, opp.monthlyOpportunity.toLocaleString());
      text = text.replace(/\[LostRevenue\]/g, opp.monthlyOpportunity.toLocaleString());
    }
    text = text.replace(/\[IssueCount\]/g, String(lead.redFlags ? lead.redFlags * 2 : 3));
    text = text.replace(/\[Setup\]/g, '5,000');
    text = text.replace(/\[Monthly\]/g, '3,000');
    text = text.replace(/\[Revenue\]/g, opp ? opp.monthlyOpportunity.toLocaleString() : '15,000');
    return text;
  }

  function getTrackerLeads(allLeads) {
    return allLeads.filter(function (l) {
      return l.status === 'Contacted' || l.status === 'Meeting' || l.status === 'Proposal';
    });
  }

  function renderTemplates(containerId) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var categories = {};
    TEMPLATES.forEach(function (t) {
      if (!categories[t.category]) categories[t.category] = [];
      categories[t.category].push(t);
    });
    var html = '';
    Object.keys(categories).forEach(function (cat) {
      html += '<div style="margin-bottom:16px">';
      html += '<div style="font-size:12px;font-weight:600;color:var(--text2);text-transform:uppercase;letter-spacing:0.5px;margin-bottom:8px">' + esc(cat) + '</div>';
      categories[cat].forEach(function (t) {
        var globalIdx = TEMPLATES.indexOf(t);
        html += '<div class="template-card" style="background:var(--surface);border:1px solid var(--border);border-radius:8px;padding:14px;margin-bottom:8px;cursor:pointer" data-idx="' + globalIdx + '">';
        html += '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">';
        html += '<div style="font-size:13px;font-weight:600">' + esc(t.name) + '</div>';
        html += '<button class="btn btn-xs btn-outline" data-action="copy-template" data-idx="' + globalIdx + '">Copy</button>';
        html += '</div>';
        html += '<div style="font-size:11px;color:var(--text3)">Subject: ' + esc(t.subject) + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });
    container.innerHTML = html;
    container.querySelectorAll('[data-action="copy-template"]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var idx = parseInt(btn.dataset.idx);
        var t = TEMPLATES[idx];
        if (t) {
          navigator.clipboard.writeText('Subject: ' + t.subject + '\n\n' + t.body).then(function () {
            btn.textContent = 'Copied!';
            setTimeout(function () { btn.textContent = 'Copy'; }, 2000);
          });
        }
      });
    });
    container.querySelectorAll('.template-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var existing = card.querySelector('.template-body');
        if (existing) { existing.remove(); return; }
        var idx = parseInt(card.dataset.idx);
        var t = TEMPLATES[idx];
        if (!t) return;
        var body = document.createElement('div');
        body.className = 'template-body';
        body.style.cssText = 'margin-top:10px;padding:12px;background:var(--surface2);border:1px solid var(--border);border-radius:6px;font-size:12px;white-space:pre-wrap;color:var(--text2);line-height:1.6;max-height:200px;overflow-y:auto';
        body.textContent = t.body;
        card.appendChild(body);
      });
    });
  }

  function renderTracker(containerId, allLeads) {
    var container = document.getElementById(containerId);
    if (!container) return;
    var tracked = getTrackerLeads(allLeads);
    if (!tracked.length) {
      container.innerHTML = '<div style="padding:20px;text-align:center;color:var(--text3);font-size:13px">No outreach activity yet. Change lead statuses to "Contacted", "Meeting", or "Proposal" to track them here.</div>';
      return;
    }
    var html = '<table style="width:100%;border-collapse:collapse;font-size:12px">';
    html += '<thead><tr style="border-bottom:1px solid var(--border)">';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">Company</th>';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">Status</th>';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">Traffic</th>';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">CVR</th>';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">Ad Spend</th>';
    html += '<th style="padding:8px;text-align:left;font-size:10px;text-transform:uppercase;color:var(--text2)">Actions</th>';
    html += '</tr></thead><tbody>';
    tracked.forEach(function (l) {
      var statusClass = l.status.toLowerCase();
      html += '<tr style="border-bottom:1px solid var(--border)">';
      html += '<td style="padding:8px;font-weight:600">' + esc(l.name) + '</td>';
      html += '<td style="padding:8px"><span class="status ' + statusClass + '">' + l.status + '</span></td>';
      html += '<td style="padding:8px;color:var(--text2)">' + (l.monthlyTraffic || '—').toLocaleString() + '</td>';
      html += '<td style="padding:8px;color:' + (l.conversionRate < 3 ? 'var(--accent)' : 'var(--green)') + ';font-weight:600">' + (l.conversionRate || '—') + '%</td>';
      html += '<td style="padding:8px;color:var(--yellow)">$' + (l.adSpend || 0).toLocaleString() + '</td>';
      html += '<td style="padding:8px">';
      html += '<button class="btn btn-xs btn-accent" data-action="proposal" data-id="' + l.id + '">Proposal</button> ';
      html += '<button class="btn btn-xs btn-outline" data-action="notes" data-id="' + l.id + '">Notes</button>';
      html += '</td></tr>';
    });
    html += '</tbody></table>';
    container.innerHTML = html;
    container.querySelectorAll('[data-action="proposal"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.GAAdmin && window.GAAdmin.generateProposal) window.GAAdmin.generateProposal(parseInt(btn.dataset.id));
      });
    });
    container.querySelectorAll('[data-action="notes"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        if (window.GAAdmin && window.GAAdmin.openNotes) window.GAAdmin.openNotes(parseInt(btn.dataset.id));
      });
    });
  }

  function esc(str) { if (!str) return ''; var d = document.createElement('div'); d.textContent = str; return d.innerHTML; }

  return {
    TEMPLATES: TEMPLATES,
    formatTemplate: formatTemplate,
    getTrackerLeads: getTrackerLeads,
    renderTemplates: renderTemplates,
    renderTracker: renderTracker
  };
})();
