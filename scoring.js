/* ========================================
   GA ADMIN — SCORING ENGINE
   Growth-intent scoring (not outdated design)
   ======================================== */
window.Scoring = (function () {
  'use strict';

  var INDUSTRY_ISSUES = {
    'Technology': ['No conversion funnel','Missing analytics','Poor landing pages','No email sequences','Weak CTAs'],
    'Medical': ['No patient portal','Missing appointment booking','No lead capture','Poor mobile UX','No follow-up automation'],
    'Dental': ['No online booking','Missing smile gallery','No lead magnet','Poor Google Business integration','No review requests'],
    'Home Services': ['No quote request flow','Missing click-to-call','No service area pages','Poor local SEO','No estimate automation'],
    'Manufacturing': ['No RFQ form','Missing spec sheets','No lead scoring','Poor B2B funnels','No CRM integration'],
    'Legal': ['No intake forms','Missing case evaluations','No client portal','Poor trust signals','No appointment scheduling'],
    'Financial': ['No lead magnets','Missing calculators','No nurture sequences','Poor compliance UX','No client dashboard'],
    'Automotive': ['No inventory search','Missing financing tools','No service scheduling','Poor lead capture','No follow-up sequences'],
    'Retail': ['No abandoned cart recovery','Missing email flows','Poor product pages','No loyalty program','No upsell system'],
    'Food': ['No online ordering','Missing delivery integration','No loyalty program','Poor mobile ordering','No catering funnel'],
    'Grocery': ['No delivery scheduling','Missing weekly deals flow','No loyalty integration','Poor pickup UX','No recipe funnels'],
    'Insurance': ['No quote engine','Missing comparison tools','No nurture sequences','Poor agent matching','No claims portal'],
    'Telecom': ['No self-service portal','Missing plan comparison','No upgrade funnel','Poor onboarding flow','No retention automation'],
    'Media': ['No subscription funnel','Missing paywall logic','No audience segmentation','Poor content gating','No newsletter automation'],
    'Nonprofit': ['No donation flow','Missing recurring giving','No volunteer signup','Poor impact reporting','No event funnels'],
    'Education': ['No enrollment funnel','Missing course catalog','No student portal','Poor application flow','No alumni automation'],
    'Construction': ['No estimate request','Missing project gallery','No lead qualification','Poor local targeting','No follow-up system'],
    'Hospitality': ['No booking engine','Missing loyalty program','No upsell flow','Poor review management','No package builder'],
    'Real Estate': ['No property search','Missing lead capture','No mortgage calculator','Poor listing alerts','No showing scheduler'],
    'Default': ['No conversion funnel','Missing analytics','Poor landing pages','No email sequences','Weak CTAs']
  };

  var TARGET_INDUSTRIES = [
    'Medical','Dental','Home Services','Manufacturing','Legal','Financial',
    'Automotive','Retail','Technology','Healthcare','Real Estate','Insurance'
  ];

  /**
   * Growth-intent score (0-100)
   * Scores based on opportunity, not outdated design
   */
  function calculateQualScore(lead) {
    var score = 20; // base

    // Running paid ads (high intent signal) — +20
    if (lead.adSpend && lead.adSpend > 0) {
      if (lead.adSpend > 10000) score += 20;
      else if (lead.adSpend > 5000) score += 15;
      else if (lead.adSpend > 1000) score += 10;
      else score += 5;
    }

    // High traffic + low conversion (biggest CRO opportunity) — +25
    if (lead.monthlyTraffic && lead.conversionRate) {
      if (lead.monthlyTraffic > 10000 && lead.conversionRate < 2) score += 25;
      else if (lead.monthlyTraffic > 5000 && lead.conversionRate < 2.5) score += 20;
      else if (lead.monthlyTraffic > 1000 && lead.conversionRate < 3) score += 15;
      else if (lead.conversionRate < 3.5) score += 10;
    }

    // No automation (upsell opportunity) — +15
    if (!lead.hasAutomation) score += 15;

    // Revenue factor (budget available) — +10
    var val = lead.value || 0;
    if (val >= 100) score += 10;
    else if (val >= 10) score += 8;
    else if (val >= 2) score += 5;
    else if (val >= 0.5) score += 3;

    // Target industry — +10
    if (TARGET_INDUSTRIES.indexOf(lead.industry) !== -1) score += 10;

    // Has email list (engaged audience) — +5
    if (lead.emailListSize && lead.emailListSize > 1000) score += 5;

    // Priority alignment
    if (lead.priority === 'High') score += 5;
    else if (lead.priority === 'Low') score -= 3;

    // Red flags penalty
    score -= (lead.redFlags || 0) * 5;

    return Math.max(0, Math.min(100, Math.round(score)));
  }

  /**
   * Detect red flags (wrong buyer signals)
   */
  function detectRedFlags(lead) {
    var flags = [];

    // Very low traffic (can't run meaningful tests)
    if (lead.monthlyTraffic && lead.monthlyTraffic < 5000) {
      flags.push('Low traffic — insufficient for A/B testing');
    }

    // No ad spend + no automation (may not be growth-focused)
    if ((!lead.adSpend || lead.adSpend === 0) && lead.hasAutomation) {
      flags.push('No paid acquisition — may lack growth budget');
    }

    // Outside target vertical
    if (TARGET_INDUSTRIES.indexOf(lead.industry) === -1) {
      flags.push('Outside core industry vertical');
    }

    // Very small company
    if (lead.value && lead.value < 0.5) {
      flags.push('Revenue under $500K — limited budget');
    }

    // High conversion already (less opportunity)
    if (lead.conversionRate && lead.conversionRate > 4) {
      flags.push('Already high conversion rate — limited upside');
    }

    return flags;
  }

  /**
   * Get industry-specific issues
   */
  function getIssues(industry, score) {
    var issues = INDUSTRY_ISSUES[industry] || INDUSTRY_ISSUES['Default'];
    var count = score > 70 ? 2 : score > 40 ? 3 : 4;
    var start = Math.abs(score) % issues.length;
    var result = [];
    for (var i = 0; i < count; i++) {
      result.push(issues[(start + i) % issues.length]);
    }
    return result;
  }

  /**
   * Analyze website — REAL analysis via Netlify Function
   * Falls back to client-side CORS proxy if function unavailable.
   */
  function analyzeWebsite(url) {
    return new Promise(function (resolve) {
      function fail(msg) {
        resolve({ error: true, offline: true, design: 0, mobile: 0, performance: 0, total: 0, issues: [msg], wins: [] });
      }

      if (!url || url.indexOf('.') === -1) { fail('Invalid URL'); return; }

      if (!/^https?:\/\//.test(url)) url = 'https://' + url;

      fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      })
        .then(function (r) {
          return r.json().then(function (data) {
            if (!r.ok) {
              fail((data && data.error) ? data.error : 'Analysis failed (HTTP ' + r.status + ')');
              return;
            }
            resolve(data);
          });
        })
        .catch(function () { fail('Could not reach analysis service — try again'); });
    });
  }

  /**

  /**
   * Pre-qualification checklist
   */
  var QUAL_CHECKLIST = [
    { id: 'ads', label: 'Running paid ads ($1K+/mo)', weight: 25 },
    { id: 'traffic', label: '5,000+ monthly visitors', weight: 20 },
    { id: 'conversion', label: 'Conversion rate below 3%', weight: 20 },
    { id: 'automation', label: 'No email automation', weight: 15 },
    { id: 'revenue', label: '$2M+ annual revenue', weight: 20 }
  ];

  function evaluateChecklist(answers) {
    var total = 0;
    QUAL_CHECKLIST.forEach(function (item) {
      if (answers[item.id]) total += item.weight;
    });
    return total;
  }

  /**
   * Calculate lost revenue opportunity
   */
  function calculateOpportunity(lead) {
    if (!lead.monthlyTraffic || !lead.conversionRate) return null;
    var currentLeads = Math.round(lead.monthlyTraffic * (lead.conversionRate / 100));
    var benchmarkCVR = 3.5;
    var potentialLeads = Math.round(lead.monthlyTraffic * (benchmarkCVR / 100));
    var additionalLeads = potentialLeads - currentLeads;
    var avgDealValue = (lead.value || 1) * 1000000 / 12; // rough monthly revenue / deals
    var monthlyOpportunity = additionalLeads * avgDealValue * 0.1; // 10% close rate
    return {
      currentLeads: currentLeads,
      potentialLeads: potentialLeads,
      additionalLeads: additionalLeads,
      monthlyOpportunity: Math.round(monthlyOpportunity),
      annualOpportunity: Math.round(monthlyOpportunity * 12)
    };
  }

  return {
    calculateQualScore: calculateQualScore,
    detectRedFlags: detectRedFlags,
    getIssues: getIssues,
    analyzeWebsite: analyzeWebsite,
    QUAL_CHECKLIST: QUAL_CHECKLIST,
    evaluateChecklist: evaluateChecklist,
    calculateOpportunity: calculateOpportunity,
    INDUSTRY_ISSUES: INDUSTRY_ISSUES,
    TARGET_INDUSTRIES: TARGET_INDUSTRIES
  };
})();
