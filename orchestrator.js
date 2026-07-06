/* ========================================
   PIPELINE ORCHESTRATOR
   Stage-by-stage approval gates
   Scout → Approve → Audit → Approve → Score → Approve → Outreach
   ======================================== */
window.Orchestrator = (function () {
  'use strict';

  var STAGES = [
    { id: 'scout', label: '🔍 Scout', description: 'Find businesses from web directories' },
    { id: 'audit', label: '📊 Audit', description: 'Audit websites for mobile/performance/SEO' },
    { id: 'score', label: '🎯 Score', description: 'Score by likelihood to pay & segment' },
    { id: 'approve', label: '✅ Approve', description: 'Review & approve leads for outreach' },
    { id: 'outreach', label: '📧 Outreach', description: 'Send personalized emails via Brevo' }
  ];

  var state = {
    currentStage: null,
    isRunning: false,
    leads: [],
    approvedLeads: [],
    rejectedLeads: [],
    results: {},
    history: []
  };

  function getState() {
    return {
      currentStage: state.currentStage,
      isRunning: state.isRunning,
      leadsCount: state.leads.length,
      approvedCount: state.approvedLeads.length,
      rejectedCount: state.rejectedLeads.length,
      results: state.results,
      history: state.history,
      stages: STAGES
    };
  }

  /* ----------------------------------------
     STAGE 1: SCOUT
     Find businesses, then pause for approval
     ---------------------------------------- */
  function runScout(options) {
    options = options || {};
    state.currentStage = 'scout';
    state.isRunning = true;
    state.leads = [];
    state.approvedLeads = [];
    state.rejectedLeads = [];
    state.results = {};

    logHistory('scout', 'started', 'Scanning for businesses...');

    var keywords = options.keywords || ['outdated website', 'needs website redesign', 'old website design', 'website redesign service'];
    var industries = options.industries || ['medical', 'dental', 'legal', 'financial', 'home services'];
    var searches = [];

    keywords.forEach(function (kw) {
      industries.forEach(function (ind) {
        searches.push({ keyword: kw + ' ' + ind, industry: ind });
      });
    });

    var completed = 0;
    var allFound = [];

    // Try web scraping first (no API key needed)
    function runNextSearch() {
      if (completed >= searches.length) {
        finishScout(allFound);
        return;
      }

      var search = searches[completed];
      fetch('/api/web-search', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ keyword: search.keyword, location: 'United States' })
      }).then(function (r) { return r.json(); }).then(function (data) {
        var results = (data.results || []).filter(function (r) { return r.website; });
        results.forEach(function (r) {
          allFound.push({
            id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
            name: r.name,
            company: r.name,
            url: r.website,
            phone: r.phone || '',
            industry: search.industry,
            address: r.address || '',
            source: 'Scout/Directory',
            status: 'New',
            score: 0,
            pipelineStage: 'prospect',
            segment: 'unclassified',
            createdAt: new Date().toISOString()
          });
        });
        completed++;
        state.results.scoutFound = allFound.length;
        logHistory('scout', 'progress', 'Found ' + allFound.length + ' businesses (' + completed + '/' + searches.length + ' searches)');
        setTimeout(runNextSearch, 300 + Math.random() * 500);
      }).catch(function () {
        completed++;
        setTimeout(runNextSearch, 300);
      });
    }

    runNextSearch();
  }

  function finishScout(leads) {
    state.leads = leads;
    state.currentStage = 'scout-done';
    state.isRunning = false;
    state.results.scoutFound = leads.length;
    logHistory('scout', 'completed', leads.length + ' businesses found — waiting for approval');
    notify('Scout found ' + leads.length + ' businesses. Review and approve to continue.');
  }

  /* ----------------------------------------
     APPROVAL: User reviews Scout results
     ---------------------------------------- */
  function approveScout(approvedIds, rejectedIds) {
    approvedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) state.approvedLeads.push(lead);
    });
    rejectedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) state.rejectedLeads.push(lead);
    });

    logHistory('scout-approval', 'completed', approvedIds.length + ' approved, ' + rejectedIds.length + ' rejected');
    state.currentStage = 'scout-approved';
    state.leads = state.approvedLeads.slice();

    // Auto-continue to audit
    if (state.leads.length > 0) {
      runAudit();
    } else {
      logHistory('audit', 'skipped', 'No leads approved');
    }
  }

  /* ----------------------------------------
     STAGE 2: AUDIT
     Audit each website, then pause
     ---------------------------------------- */
  function runAudit() {
    state.currentStage = 'audit';
    state.isRunning = true;
    logHistory('audit', 'started', 'Auditing ' + state.leads.length + ' websites...');

    var audited = 0;
    state.leads.forEach(function (lead, idx) {
      setTimeout(function () {
        if (!lead.url) {
          audited++;
          if (audited >= state.leads.length) finishAudit();
          return;
        }

        fetch('/api/site-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: lead.url })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (data.score) {
            lead.score = data.score;
            lead.audit = data;
          }
          audited++;
          state.results.auditedCount = audited;
          if (audited % 5 === 0) {
            logHistory('audit', 'progress', 'Audited ' + audited + '/' + state.leads.length);
          }
          if (audited >= state.leads.length) finishAudit();
        }).catch(function () {
          audited++;
          if (audited >= state.leads.length) finishAudit();
        });
      }, idx * 500);
    });
  }

  function finishAudit() {
    state.currentStage = 'audit-done';
    state.isRunning = false;
    logHistory('audit', 'completed', state.leads.length + ' websites audited — waiting for approval');
    notify('Audit complete. Review scores and approve to continue.');
  }

  /* ----------------------------------------
     APPROVAL: User reviews Audit results
     ---------------------------------------- */
  function approveAudit(approvedIds, rejectedIds) {
    var approved = [];
    var rejected = [];
    approvedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) approved.push(lead);
    });
    rejectedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) rejected.push(lead);
    });

    state.approvedLeads = approved;
    state.rejectedLeads = state.rejectedLeads.concat(rejected);
    state.leads = approved.slice();
    state.currentStage = 'audit-approved';
    logHistory('audit-approval', 'completed', approved.length + ' approved, ' + rejected.length + ' rejected');

    if (state.leads.length > 0) {
      runScore();
    } else {
      logHistory('score', 'skipped', 'No leads approved');
    }
  }

  /* ----------------------------------------
     STAGE 3: SCORE
     Score by pay-likelihood & segment
     ---------------------------------------- */
  function runScore() {
    state.currentStage = 'score';
    state.isRunning = true;
    logHistory('score', 'started', 'Scoring ' + state.leads.length + ' leads...');

    state.leads.forEach(function (lead) {
      if (window.Pipeline) {
        var scoring = Pipeline.scoreLead(lead);
        lead.segment = scoring.segment;
        lead.priority = scoring.priority;
        lead.payScore = scoring.total;
        lead.estimatedDeal = scoring.estimatedDeal;
        lead.industryLabel = scoring.industryLabel;
        lead.breakdown = scoring.breakdown;
      }
    });

    // Sort by score
    state.leads.sort(function (a, b) { return (b.payScore || 0) - (a.payScore || 0); });

    state.results.scoredCount = state.leads.length;
    state.results.hotCount = state.leads.filter(function (l) { return l.segment === 'hot'; }).length;
    state.results.warmCount = state.leads.filter(function (l) { return l.segment === 'warm'; }).length;
    state.results.coldCount = state.leads.filter(function (l) { return l.segment === 'cold'; }).length;

    state.currentStage = 'score-done';
    state.isRunning = false;
    logHistory('score', 'completed', state.leads.length + ' scored — ' + state.results.hotCount + ' hot, ' + state.results.warmCount + ' warm, ' + state.results.coldCount + ' cold — waiting for approval');
    notify('Scoring complete. Review segments and approve leads for outreach.');
  }

  /* ----------------------------------------
     APPROVAL: User reviews Score results
     ---------------------------------------- */
  function approveScore(approvedIds, rejectedIds) {
    var approved = [];
    var rejected = [];
    approvedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) approved.push(lead);
    });
    rejectedIds.forEach(function (id) {
      var lead = state.leads.find(function (l) { return l.id === id; });
      if (lead) rejected.push(lead);
    });

    state.approvedLeads = approved;
    state.rejectedLeads = state.rejectedLeads.concat(rejected);
    state.leads = approved.slice();
    state.currentStage = 'score-approved';
    state.results.finalApproved = approved.length;
    logHistory('score-approval', 'completed', approved.length + ' leads approved for outreach');

    // Save approved leads to Firestore
    if (window.FirebaseService) {
      state.leads.forEach(function (l) {
        l.pipelineStage = 'qualified';
        FirebaseService.leads.update(l.id, l).catch(function () {});
      });
    }

    notify('Pipeline complete! ' + approved.length + ' leads ready. Go to Outreach tab to send emails.');
  }

  /* ----------------------------------------
     STAGE 4: OUTREACH
     Send emails to approved leads
     ---------------------------------------- */
  function runOutreach(options) {
    options = options || {};
    state.currentStage = 'outreach';
    state.isRunning = true;
    logHistory('outreach', 'started', 'Sending emails to ' + state.leads.length + ' leads...');

    var sent = 0;
    var failed = 0;

    state.leads.forEach(function (lead, idx) {
      setTimeout(function () {
        if (!lead.email) {
          sent++;
          if (sent + failed >= state.leads.length) finishOutreach(sent, failed);
          return;
        }

        var template = window.Pipeline ? Pipeline.getOutreachTemplate(lead, lead) : {
          subject: 'Quick question about your website',
          body: 'Hi ' + (lead.name || 'there') + ', I noticed your website could use some improvement...'
        };

        // Get settings for Brevo key
        FirebaseService.settings.get().then(function (settings) {
          if (!settings || !settings.brevoApiKey) {
            failed++;
            logHistory('outreach', 'error', 'No Brevo API key configured');
            if (sent + failed >= state.leads.length) finishOutreach(sent, failed);
            return;
          }

          fetch('/api/send-email', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              recipients: [{ email: lead.email, name: lead.name }],
              subject: template.subject,
              htmlContent: template.body.replace(/\n/g, '<br>'),
              apiKey: settings.brevoApiKey,
              tags: ['pipeline', 'orchestrator']
            })
          }).then(function (r) { return r.json(); }).then(function (result) {
            if (result.success) {
              sent++;
              lead.pipelineStage = 'contacted';
              logHistory('outreach', 'sent', 'Email sent to ' + lead.email);
            } else {
              failed++;
              logHistory('outreach', 'error', 'Failed to send to ' + lead.email + ': ' + (result.error || 'unknown'));
            }
            if (sent + failed >= state.leads.length) finishOutreach(sent, failed);
          }).catch(function () {
            failed++;
            if (sent + failed >= state.leads.length) finishOutreach(sent, failed);
          });
        });
      }, idx * 1000);
    });
  }

  function finishOutreach(sent, failed) {
    state.currentStage = 'outreach-done';
    state.isRunning = false;
    state.results.sentCount = sent;
    state.results.failedCount = failed;
    logHistory('outreach', 'completed', sent + ' emails sent, ' + failed + ' failed');
    notify('Outreach complete! ' + sent + ' emails sent.');
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function logHistory(stage, action, detail) {
    state.history.push({
      ts: Date.now(),
      stage: stage,
      action: action,
      detail: detail
    });
    // Keep last 50 entries
    if (state.history.length > 50) state.history = state.history.slice(-50);
  }

  function notify(message) {
    if (window.GAAdmin && GAAdmin.showToast) {
      GAAdmin.showToast(message);
    }
  }

  function reset() {
    state.currentStage = null;
    state.isRunning = false;
    state.leads = [];
    state.approvedLeads = [];
    state.rejectedLeads = [];
    state.results = {};
    state.history = [];
    logHistory('system', 'reset', 'Pipeline reset');
  }

  return {
    STAGES: STAGES,
    getState: getState,
    runScout: runScout,
    approveScout: approveScout,
    approveAudit: approveAudit,
    approveScore: approveScore,
    runOutreach: runOutreach,
    reset: reset
  };
})();
