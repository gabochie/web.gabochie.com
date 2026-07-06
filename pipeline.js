/* ========================================
   AUTOMATED LEAD PIPELINE
   Scout → Audit → Prioritize → Segment → Outreach
   ======================================== */
window.Pipeline = (function () {
  'use strict';

  /* ----------------------------------------
     INDUSTRY PAY-LIKELIHOOD SCORES
     Based on avg deal size + willingness to invest
     ---------------------------------------- */
  var INDUSTRY_SCORES = {
    'medical': { payScore: 92, avgDeal: 8000, label: 'Medical/Dental' },
    'dental': { payScore: 90, avgDeal: 7500, label: 'Dental' },
    'legal': { payScore: 88, avgDeal: 9000, label: 'Legal/Law' },
    'financial': { payScore: 85, avgDeal: 10000, label: 'Financial Services' },
    'home services': { payScore: 80, avgDeal: 5000, label: 'Home Services' },
    'real estate': { payScore: 78, avgDeal: 6000, label: 'Real Estate' },
    'automotive': { payScore: 75, avgDeal: 5500, label: 'Automotive' },
    'manufacturing': { payScore: 70, avgDeal: 12000, label: 'Manufacturing' },
    'retail': { payScore: 65, avgDeal: 4000, label: 'Retail' },
    'restaurant': { payScore: 60, avgDeal: 3500, label: 'Restaurant/Food' },
    'education': { payScore: 55, avgDeal: 4500, label: 'Education' },
    'nonprofit': { payScore: 40, avgDeal: 2500, label: 'Nonprofit' },
    'unknown': { payScore: 50, avgDeal: 5000, label: 'Unknown' }
  };

  /* ----------------------------------------
     PIPELINE SCORING ENGINE
     Scores 0-100 based on likelihood to pay
     ---------------------------------------- */
  function scoreLead(lead) {
    var score = 0;
    var breakdown = {};

    // 1. Industry pay score (0-30 points)
    var industryKey = (lead.industry || 'unknown').toLowerCase();
    var industryInfo = INDUSTRY_SCORES[industryKey] || INDUSTRY_SCORES['unknown'];
    var industryScore = Math.round((industryInfo.payScore / 100) * 30);
    score += industryScore;
    breakdown.industry = industryScore;

    // 2. Website quality penalty (0-25 points — worse site = higher score)
    var siteScore = lead.score || 0;
    if (siteScore > 0) {
      // Invert: bad site (low score) = high priority
      var websitePriority = Math.round(((100 - siteScore) / 100) * 25);
      score += websitePriority;
      breakdown.websiteQuality = websitePriority;
    } else {
      // No audit yet — assume medium priority
      score += 12;
      breakdown.websiteQuality = 12;
    }

    // 3. Business signals (0-20 points)
    var signalScore = 0;
    if (lead.totalRatings && lead.totalRatings > 50) signalScore += 8; // Popular business
    else if (lead.totalRatings && lead.totalRatings > 10) signalScore += 5;
    if (lead.rating && lead.rating >= 4.0) signalScore += 4; // Good reputation
    if (lead.phone) signalScore += 3; // Has phone = real business
    if (lead.address) signalScore += 3; // Has physical address
    if (lead.url && lead.url.includes('http')) signalScore += 2; // Has website
    signalScore = Math.min(signalScore, 20);
    score += signalScore;
    breakdown.signals = signalScore;

    // 4. Size indicators (0-15 points)
    var sizeScore = 0;
    if (lead.totalRatings && lead.totalRatings > 100) sizeScore = 15; // Large business
    else if (lead.totalRatings && lead.totalRatings > 25) sizeScore = 10; // Medium
    else if (lead.totalRatings && lead.totalRatings > 5) sizeScore = 7; // Small
    else sizeScore = 3; // Tiny/unknown
    score += sizeScore;
    breakdown.size = sizeScore;

    // 5. Re-engagement signal (0-10 points)
    var engageScore = 0;
    if (lead.source === 'Scout/Google Places') engageScore = 5; // Fresh from Scout
    if (lead.source === 'Website') engageScore = 8; // They came to us
    if (lead.source === 'Score Tool') engageScore = 10; // Used our tool = high intent
    score += engageScore;
    breakdown.engagement = engageScore;

    // Clamp to 0-100
    score = Math.min(Math.max(score, 0), 100);

    return {
      total: score,
      breakdown: breakdown,
      segment: score >= 70 ? 'hot' : score >= 45 ? 'warm' : 'cold',
      priority: score >= 70 ? 'high' : score >= 45 ? 'medium' : 'low',
      estimatedDeal: industryInfo.avgDeal,
      industryLabel: industryInfo.label
    };
  }

  /* ----------------------------------------
     COLD LEAD SEGMENTATION
     Groups cold leads for targeted campaigns
     ---------------------------------------- */
  function segmentColdLeads(leads) {
    var segments = {};

    leads.forEach(function (lead) {
      var scoring = scoreLead(lead);
      if (scoring.segment !== 'cold') return;

      var industry = (lead.industry || 'unknown').toLowerCase();
      var region = extractRegion(lead);
      var size = categorizeSize(lead);

      // Segment by industry × region × size
      var segKey = industry + '|' + region + '|' + size;
      if (!segments[segKey]) {
        segments[segKey] = {
          industry: industry,
          industryLabel: scoring.industryLabel,
          region: region,
          size: size,
          leads: [],
          avgScore: 0,
          totalValue: 0
        };
      }
      segments[segKey].leads.push(lead);
    });

    // Calculate averages
    Object.keys(segments).forEach(function (key) {
      var seg = segments[key];
      var totalScore = seg.leads.reduce(function (sum, l) { return sum + (scoreLead(l).total || 0); }, 0);
      seg.avgScore = seg.leads.length ? Math.round(totalScore / seg.leads.length) : 0;
      seg.totalValue = seg.leads.reduce(function (sum, l) { return sum + scoreLead(l).estimatedDeal; }, 0);
    });

    // Sort by avg score descending
    var sorted = Object.values(segments).sort(function (a, b) { return b.avgScore - a.avgScore; });
    return sorted;
  }

  function extractRegion(lead) {
    var addr = (lead.address || '').toLowerCase();
    var regions = {
      'northeast': ['ny', 'nj', 'ct', 'ma', 'pa', 'ri', 'vt', 'nh', 'me', 'new york', 'boston', 'philadelphia'],
      'southeast': ['fl', 'ga', 'nc', 'sc', 'va', 'tn', 'al', 'ms', 'miami', 'atlanta', 'charlotte'],
      'midwest': ['oh', 'il', 'mi', 'in', 'wi', 'mn', 'ia', 'mo', 'chicago', 'detroit', 'minneapolis'],
      'southwest': ['tx', 'az', 'nm', 'ok', 'houston', 'dallas', 'phoenix', 'austin'],
      'west': ['ca', 'wa', 'or', 'nv', 'co', 'los angeles', 'san francisco', 'seattle', 'denver'],
      'other': []
    };

    for (var region in regions) {
      if (regions[region].some(function (term) { return addr.indexOf(term) !== -1; })) {
        return region;
      }
    }
    return 'other';
  }

  function categorizeSize(lead) {
    var ratings = lead.totalRatings || 0;
    if (ratings > 100) return 'enterprise';
    if (ratings > 25) return 'mid-market';
    if (ratings > 5) return 'small';
    return 'micro';
  }

  /* ----------------------------------------
     PRIORITY QUEUE
     Returns leads sorted by pay-likelihood
     ---------------------------------------- */
  function getPriorityQueue(leads) {
    var scored = leads.map(function (l) {
      var s = scoreLead(l);
      return {
        lead: l,
        score: s.total,
        segment: s.segment,
        priority: s.priority,
        estimatedDeal: s.estimatedDeal,
        breakdown: s.breakdown,
        industryLabel: s.industryLabel
      };
    });

    scored.sort(function (a, b) { return b.score - a.score; });

    return {
      all: scored,
      hot: scored.filter(function (s) { return s.segment === 'hot'; }),
      warm: scored.filter(function (s) { return s.segment === 'warm'; }),
      cold: scored.filter(function (s) { return s.segment === 'cold'; }),
      coldSegments: segmentColdLeads(leads)
    };
  }

  /* ----------------------------------------
     OUTREACH TEMPLATES BY SEGMENT
     ---------------------------------------- */
  function getOutreachTemplate(lead, scoring) {
    var templates = {
      hot: {
        subject: 'Quick fix for ' + (lead.company || lead.name || 'your website'),
        body: 'Hi ' + (lead.name || 'there') + ',\n\nI ran a quick audit on ' + (lead.url || 'your site') + ' and found a few things that are likely costing you customers.\n\nYour site scores ' + (lead.score || 'low') + '/100 on mobile performance — that means roughly ' + Math.round((100 - (lead.score || 50)) / 2) + '% of visitors leave before it loads.\n\nI specialize in fixing exactly this for ' + (scoring.industryLabel || 'businesses') + ' like yours. Would a 15-minute walkthrough of the fixes be useful?\n\nBest,\nGideon'
      },
      warm: {
        subject: (lead.company || 'Your website') + ' — quick question',
        body: 'Hi ' + (lead.name || 'there') + ',\n\nI noticed ' + (lead.company || 'your business') + ' has great reviews (' + (lead.rating || '4+') + '★, ' + (lead.totalRatings || 'many') + ' ratings) but the website doesn\'t quite match the quality of your service.\n\nI help ' + (scoring.industryLabel || 'businesses') + ' turn their website into a lead-generating machine. Interested in seeing what a redesign could look like for you?\n\nBest,\nGideon'
      },
      cold: {
        subject: 'Re: ' + (lead.company || 'your website'),
        body: 'Hi ' + (lead.name || 'there') + ',\n\nI came across ' + (lead.company || 'your business') and wanted to reach out. I work with ' + (scoring.industryLabel || 'businesses') + ' on improving their online presence.\n\nWould you be open to a quick chat about how your website could be working harder for you?\n\nBest,\nGideon'
      }
    };

    return templates[scoring.segment] || templates.cold;
  }

  /* ----------------------------------------
     AUTOMATED PIPELINE RUNNER
     ---------------------------------------- */
  function runPipeline(options) {
    options = options || {};
    var dryRun = options.dryRun !== false;
    var maxLeads = options.maxLeads || 20;

    if (!window.Agents) return Promise.resolve({ error: 'Agents not loaded' });

    return new Promise(function (resolve) {
      // Step 1: Run Scout to find businesses
      log('pipeline', 'scout-start', '🔍 Scanning for businesses...', 'info');

      Agents.start('scout').then(function () {
        // Step 2: Get all leads
        var leads = Agents.getAllLeads ? Agents.getAllLeads() : [];
        if (leads.length === 0) {
          // Fallback: get from localStorage
          try {
            var raw = localStorage.getItem('ga_leads');
            if (raw) leads = Object.values(JSON.parse(raw));
          } catch (e) {}
        }

        log('pipeline', 'leads-found', 'Found ' + leads.length + ' total leads', 'info');

        // Step 3: Score and prioritize
        var queue = getPriorityQueue(leads);

        log('pipeline', 'scored', 'Scored: ' + queue.hot.length + ' hot, ' + queue.warm.length + ' warm, ' + queue.cold.length + ' cold', 'success');

        // Step 4: Auto-audit hot leads (ones without scores)
        var needsAudit = queue.hot.filter(function (s) { return !s.lead.score || s.lead.score === 0; });
        if (needsAudit.length > 0) {
          log('pipeline', 'audit', 'Auto-auditing ' + needsAudit.length + ' hot leads...', 'info');
          needsAudit.slice(0, 5).forEach(function (s) {
            if (s.lead.url) {
              fetch('/api/site-audit', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url: s.lead.url })
              }).then(function (r) { return r.json(); }).then(function (data) {
                if (data.score) {
                  s.lead.score = data.score;
                  s.lead.audit = data;
                  // Re-score with audit data
                  var rescored = scoreLead(s.lead);
                  s.score = rescored.total;
                  s.segment = rescored.segment;
                  // Update in storage
                  if (window.FirebaseService) {
                    FirebaseService.leads.update(s.lead.id, { score: data.score, audit: data }).catch(function () {});
                  }
                }
              }).catch(function () {});
            }
          });
        }

        // Step 5: Auto-outreach for hot leads (if not dry run)
        var outreachCount = 0;
        if (!dryRun && queue.hot.length > 0) {
          log('pipeline', 'outreach', 'Sending outreach to ' + Math.min(queue.hot.length, maxLeads) + ' hot leads...', 'info');

          queue.hot.slice(0, maxLeads).forEach(function (s) {
            var template = getOutreachTemplate(s.lead, s);
            // Save outreach record
            s.lead.outreachStatus = 'sent';
            s.lead.outreachDate = new Date().toISOString();
            s.lead.outreachSubject = template.subject;
            outreachCount++;

            if (window.FirebaseService) {
              FirebaseService.leads.update(s.lead.id, {
                outreachStatus: 'sent',
                outreachDate: new Date().toISOString(),
                pipelineStage: 'contacted'
              }).catch(function () {});
            }

            // Send via Brevo if configured
            if (s.lead.email) {
              FirebaseService.settings.get().then(function (settings) {
                if (settings && settings.brevoApiKey) {
                  fetch('/api/send-email', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                      recipients: [{ email: s.lead.email, name: s.lead.name }],
                      subject: template.subject,
                      htmlContent: template.body.replace(/\n/g, '<br>'),
                      apiKey: settings.brevoApiKey,
                      tags: ['pipeline', 'auto-outreach']
                    })
                  }).catch(function () {});
                }
              });
            }
          });
        }

        resolve({
          total: leads.length,
          hot: queue.hot.length,
          warm: queue.warm.length,
          cold: queue.cold.length,
          coldSegments: queue.coldSegments.length,
          audited: needsAudit.length,
          outreachSent: outreachCount,
          queue: queue
        });

      }).catch(function (err) {
        log('pipeline', 'error', 'Pipeline error: ' + err.message, 'error');
        resolve({ error: err.message });
      });
    });
  }

  return {
    scoreLead: scoreLead,
    segmentColdLeads: segmentColdLeads,
    getPriorityQueue: getPriorityQueue,
    getOutreachTemplate: getOutreachTemplate,
    runPipeline: runPipeline,
    INDUSTRY_SCORES: INDUSTRY_SCORES
  };
})();
