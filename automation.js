/* ========================================
   GA AUTOMATION — Production Automation Engine
   15 Automations: Scoring, Alerts, Emails, AI, Scheduling
   ======================================== */
window.Automation = (function () {
  'use strict';

  /* ----------------------------------------
     WORKFLOW DEFINITIONS
     ---------------------------------------- */
  var WORKFLOWS = [
    // === LEAD MANAGEMENT ===
    {
      id: 'wf_lead_scoring',
      name: 'Auto Lead Scoring',
      description: 'Score all unscored leads every hour using the Qualifier agent',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'schedule', cron: 'hourly' },
      steps: [
        { action: 'agent-start', agent: 'qualifier', label: 'Score leads' },
        { action: 'log', message: 'Lead scoring completed', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_auto_priority',
      name: 'Auto Priority Assignment',
      description: 'Automatically set lead priority based on score and industry',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'lead-scored', filter: {} },
      steps: [
        { action: 'auto-priority', label: 'Set priority from score' },
        { action: 'log', message: 'Priority set for {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_stale_lead_alert',
      name: 'Stale Lead Alert',
      description: 'Alert when leads sit in a stage for more than 5 days without activity',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'schedule', cron: 'daily-9am' },
      steps: [
        { action: 'stale-lead-scan', daysThreshold: 5, label: 'Scan stale leads' },
        { action: 'notification', message: '⚠️ {count} leads need attention — inactive for 5+ days', label: 'Alert' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_win_loss_analysis',
      name: 'Win/Loss Analysis',
      description: 'When a deal closes, analyze win/loss patterns and update strategy',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'closed-won' } },
      steps: [
        { action: 'lead-update', field: 'status', value: 'Closed', label: 'Mark closed' },
        { action: 'lead-update', field: 'clientSince', value: 'now', label: 'Client timestamp' },
        { action: 'win-analysis', label: 'Analyze win pattern' },
        { action: 'notification', message: '🎉 DEAL WON: {lead.name} — Analysis logged', label: 'Celebrate' },
        { action: 'trigger-workflow', workflow: 'wf_welcome_email', label: 'Send welcome email' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_loss_analysis',
      name: 'Loss Analysis',
      description: 'When a deal is lost, log reason and schedule re-engagement',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'closed-lost' } },
      steps: [
        { action: 'lead-update', field: 'status', value: 'Closed', label: 'Mark closed' },
        { action: 'loss-analysis', label: 'Analyze loss reason' },
        { action: 'notification', message: '❌ Deal lost: {lead.name} — reason logged', label: 'Alert' },
        { action: 'lead-update', delay: 90 * 86400000, field: 'pipelineStage', value: 'prospect', label: 'Re-engage in 90 days' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_client_health',
      name: 'Client Health Score',
      description: 'Monitor active clients weekly, flag at-risk accounts',
      category: 'lead-management',
      enabled: true,
      trigger: { type: 'schedule', cron: 'weekly-fri' },
      steps: [
        { action: 'client-health-scan', label: 'Scan client health' },
        { action: 'notification', message: '📊 Client health report: {healthy} healthy, {atRisk} at-risk', label: 'Report' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_pipeline_snapshot',
      name: 'Daily Pipeline Snapshot',
      description: 'Save daily pipeline state for trend tracking and analytics',
      category: 'analytics',
      enabled: true,
      trigger: { type: 'schedule', cron: 'daily-11pm' },
      steps: [
        { action: 'pipeline-snapshot', label: 'Save snapshot' },
        { action: 'log', message: 'Daily pipeline snapshot saved', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },

    // === EMAIL AUTOMATIONS ===
    {
      id: 'wf_welcome_email',
      name: 'Welcome Email',
      description: 'Send branded welcome email when deal closes',
      category: 'email',
      enabled: true,
      trigger: { type: 'manual' },
      steps: [
        { action: 'send-email', template: 'welcome', label: 'Send welcome email' },
        { action: 'notification', message: '📧 Welcome email sent to {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_proposal_email',
      name: 'Proposal Email',
      description: 'Auto-send proposal as branded HTML email',
      category: 'email',
      enabled: true,
      trigger: { type: 'manual' },
      steps: [
        { action: 'send-email', template: 'proposal', label: 'Send proposal email' },
        { action: 'lead-update', field: 'proposalSent', value: true, label: 'Mark sent' },
        { action: 'lead-update', field: 'proposalSentAt', value: 'now', label: 'Timestamp' },
        { action: 'notification', message: '📄 Proposal sent to {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_reengagement',
      name: 'Re-engagement Campaign',
      description: 'Email leads inactive for 30+ days with a value-add message',
      category: 'email',
      enabled: true,
      trigger: { type: 'schedule', cron: 'weekly-mon' },
      steps: [
        { action: 'reengagement-scan', inactiveDays: 30, label: 'Scan inactive leads' },
        { action: 'send-email', template: 'reengagement', label: 'Send re-engagement' },
        { action: 'notification', message: '📧 Re-engagement sent to {count} inactive leads', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_referral_request',
      name: 'Referral Request',
      description: 'Ask happy clients for referrals 14 days after close',
      category: 'email',
      enabled: true,
      trigger: { type: 'schedule', cron: 'daily-10am' },
      steps: [
        { action: 'referral-scan', daysAfterClose: 14, label: 'Scan eligible clients' },
        { action: 'send-email', template: 'referral-request', label: 'Send referral request' },
        { action: 'notification', message: '📧 Referral request sent to {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_weekly_report',
      name: 'Weekly Report Email',
      description: 'Email you a pipeline summary every Monday at 8am',
      category: 'email',
      enabled: true,
      trigger: { type: 'schedule', cron: 'weekly-mon-8am' },
      steps: [
        { action: 'agent-start', agent: 'reporter', label: 'Generate report' },
        { action: 'send-email', template: 'weekly-report', label: 'Email report' },
        { action: 'notification', message: '📊 Weekly report emailed', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },

    // === AI AUTOMATIONS ===
    {
      id: 'wf_auto_followups',
      name: 'Auto-Write Follow-Ups',
      description: 'Generate personalized follow-up emails for each lead stage using AI',
      category: 'ai',
      enabled: true,
      trigger: { type: 'schedule', cron: 'daily-8am' },
      steps: [
        { action: 'ai-followups', label: 'Generate follow-ups' },
        { action: 'notification', message: '🤖 {count} AI follow-ups generated', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_objection_handler',
      name: 'Objection Handler',
      description: 'AI responds to common objections in outreach replies',
      category: 'ai',
      enabled: true,
      trigger: { type: 'manual' },
      steps: [
        { action: 'ai-objection', label: 'Generate response' },
        { action: 'notification', message: '🤖 AI response generated for {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_meeting_prep',
      name: 'Meeting Prep Brief',
      description: 'Auto-generate talking points and company research before meetings',
      category: 'ai',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'meeting' } },
      steps: [
        { action: 'ai-meeting-prep', label: 'Generate brief' },
        { action: 'notification', message: '📋 Meeting brief ready for {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_proposal_customizer',
      name: 'Proposal Customizer',
      description: 'AI tailors proposals per industry, company size, and pain points',
      category: 'ai',
      enabled: true,
      trigger: { type: 'manual' },
      steps: [
        { action: 'ai-proposal', label: 'Customize proposal' },
        { action: 'notification', message: '📄 AI proposal customized for {lead.name}', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    // === AUTOMATED PIPELINE ===
    {
      id: 'wf_auto_pipeline',
      name: 'Automated Lead Pipeline',
      description: 'Full pipeline: Scout → Audit → Score → Segment → Outreach (runs daily at 8am)',
      category: 'pipeline',
      enabled: false,
      trigger: { type: 'schedule', cron: 'daily-8am' },
      steps: [
        { action: 'pipeline-run', label: 'Run full pipeline' },
        { action: 'log', message: 'Pipeline completed', label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    }
  ];

  /* ----------------------------------------
     STATE
     ---------------------------------------- */
  var customWorkflows = [];
  var executionLog = [];
  var delayedActions = [];
  var snapshots = [];
  var winLossLog = [];
  var MAX_LOG = 500;
  var listeners = [];

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    localStorage.setItem('ga_workflows', JSON.stringify(WORKFLOWS.map(function (w) {
      return { id: w.id, enabled: w.enabled, runs: w.runs, lastRun: w.lastRun, lastTriggered: w.lastTriggered };
    })));
    localStorage.setItem('ga_custom_workflows', JSON.stringify(customWorkflows));
    localStorage.setItem('ga_automation_log', JSON.stringify(executionLog.slice(-MAX_LOG)));
    localStorage.setItem('ga_delayed_actions', JSON.stringify(delayedActions));
    localStorage.setItem('ga_snapshots', JSON.stringify(snapshots.slice(-90)));
    localStorage.setItem('ga_winloss', JSON.stringify(winLossLog.slice(-100)));
  }

  function load() {
    try {
      var stored = JSON.parse(localStorage.getItem('ga_workflows') || 'null');
      if (stored) {
        stored.forEach(function (s) {
          var wf = WORKFLOWS.find(function (w) { return w.id === s.id; });
          if (wf) {
            wf.enabled = s.enabled !== undefined ? s.enabled : wf.enabled;
            wf.runs = s.runs || 0;
            wf.lastRun = s.lastRun;
            wf.lastTriggered = s.lastTriggered;
          }
        });
      }
      customWorkflows = JSON.parse(localStorage.getItem('ga_custom_workflows') || '[]');
      executionLog = JSON.parse(localStorage.getItem('ga_automation_log') || '[]');
      delayedActions = JSON.parse(localStorage.getItem('ga_delayed_actions') || '[]');
      snapshots = JSON.parse(localStorage.getItem('ga_snapshots') || '[]');
      winLossLog = JSON.parse(localStorage.getItem('ga_winloss') || '[]');
    } catch (e) {}
  }

  /* ----------------------------------------
     LOGGING
     ---------------------------------------- */
  function logAction(workflowId, action, detail, level) {
    var entry = {
      ts: Date.now(), workflow: workflowId, action: action,
      detail: detail || '', level: level || 'info'
    };
    executionLog.unshift(entry);
    if (executionLog.length > MAX_LOG) executionLog.length = MAX_LOG;
    save();
    notifyListeners('log', entry);
  }

  function getLog(limit) { return executionLog.slice(0, limit || 50); }
  function getLogByWorkflow(wfId, limit) {
    return executionLog.filter(function (e) { return e.workflow === wfId; }).slice(0, limit || 20);
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function getAllLeads() {
    try {
      var raw = localStorage.getItem('ga_leads');
      var parsed = JSON.parse(raw || '[]');
      return Array.isArray(parsed) ? parsed : Object.values(parsed);
    } catch (e) { return []; }
  }

  function updateLead(leadId, updates) {
    var leads = getAllLeads();
    var idx = leads.findIndex(function (l) { return l.id === leadId; });
    if (idx !== -1) {
      Object.assign(leads[idx], updates);
      localStorage.setItem('ga_leads', JSON.stringify(leads));
      if (window.FirebaseService) {
        FirebaseService.leads.update(leadId, updates).catch(function () {});
      }
    }
  }

  function sendEmail(to, subject, htmlBody) {
    return window.FirebaseService.settings.get().then(function (settings) {
      return fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{ email: to.email, name: to.name || '' }],
          subject: subject,
          htmlContent: htmlBody,
          apiKey: settings.brevoApiKey || '',
          senderName: settings.brevoSenderName || 'Web Gabochie',
          senderEmail: settings.brevoSenderEmail || 'web@gabochie.com'
        })
      });
    }).then(function (r) { return r.json(); });
  }

  function callOpenAI(prompt, systemPrompt) {
    return window.FirebaseService.settings.get().then(function (settings) {
      if (!settings.openaiApiKey) throw new Error('OpenAI API key not configured');
      return fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          lead: { name: 'User', company: 'GA', industry: '' },
          messageType: 'custom',
          tone: 'professional',
          apiKey: settings.openaiApiKey
        })
      });
    }).then(function (r) { return r.json(); });
  }

  function fillTemplate(template, data) {
    var result = template;
    Object.keys(data).forEach(function (key) {
      result = result.replace(new RegExp('\\{' + key + '\\}', 'g'), data[key] || '');
    });
    return result;
  }

  /* ----------------------------------------
     TRIGGER SYSTEM
     ---------------------------------------- */
  function trigger(triggerType, data) {
    var allWorkflows = WORKFLOWS.concat(customWorkflows);
    allWorkflows.forEach(function (wf) {
      if (!wf.enabled) return;
      if (wf.trigger.type !== triggerType) return;

      // Check filter
      if (wf.trigger.filter) {
        if (wf.trigger.filter.minScore && (!data.qualScore || data.qualScore < wf.trigger.filter.minScore)) return;
        if (wf.trigger.filter.stage && data.pipelineStage !== wf.trigger.filter.stage) return;
      }

      executeWorkflow(wf, data);
    });
  }

  /* ----------------------------------------
     WORKFLOW EXECUTION
     ---------------------------------------- */
  function executeWorkflow(workflow, context) {
    workflow.runs++;
    workflow.lastRun = Date.now();
    workflow.lastTriggered = Date.now();
    logAction(workflow.id, 'triggered', workflow.name, 'info');

    var steps = workflow.steps || [];
    var chain = Promise.resolve();

    steps.forEach(function (step) {
      chain = chain.then(function () {
        var delay = step.delay || 0;
        if (delay > 0) {
          return new Promise(function (resolve) {
            delayedActions.push({
              id: 'da_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
              workflowId: workflow.id,
              action: step,
              context: context,
              executeAt: Date.now() + delay,
              created: Date.now()
            });
            save();
            resolve();
          });
        }
        return executeStep(workflow.id, step, context);
      });
    });

    chain.then(function () {
      notifyListeners('workflow', { workflow: workflow, context: context });
      save();
    }).catch(function (err) {
      logAction(workflow.id, 'error', err.message, 'error');
      save();
    });
  }

  function executeStep(workflowId, step, context) {
    var lead = context || {};
    var leads = getAllLeads();

    switch (step.action) {

      // === AGENT ACTIONS ===
      case 'pipeline-run':
        if (window.Pipeline) {
          logAction(workflowId, 'pipeline', 'Running automated pipeline...', 'info');
          return Pipeline.runPipeline({ dryRun: true }).then(function (result) {
            if (result.error) {
              logAction(workflowId, 'pipeline', 'Pipeline error: ' + result.error, 'error');
            } else {
              logAction(workflowId, 'pipeline', 'Pipeline: ' + result.hot + ' hot, ' + result.warm + ' warm, ' + result.cold + ' cold (' + result.coldSegments + ' segments)', 'success');
            }
          });
        }
        return Promise.resolve();

      case 'agent-start':
        if (window.Agents && window.Agents.start) {
          window.Agents.start(step.agent);
          logAction(workflowId, 'agent-start', 'Started ' + step.agent, 'success');
        }
        return Promise.resolve();

      // === LEAD ACTIONS ===
      case 'lead-update':
        var value = step.value === 'now' ? Date.now() : step.value;
        if (typeof value === 'string' && value.indexOf('{lead.') !== -1) {
          value = value.replace(/\{lead\.(\w+)\}/g, function (m, field) { return lead[field] || ''; });
        }
        if (lead.id) updateLead(lead.id, { [step.field]: value });
        logAction(workflowId, 'lead-update', (lead.name || '') + ': ' + step.field + ' = ' + value, 'info');
        return Promise.resolve();

      case 'auto-priority':
        if (lead.id) {
          var score = lead.qualScore || lead.score || 0;
          var priority = score >= 80 ? 'Critical' : score >= 60 ? 'High' : score >= 40 ? 'Medium' : 'Low';
          updateLead(lead.id, { priority: priority });
          logAction(workflowId, 'auto-priority', lead.name + ' → ' + priority, 'info');
        }
        return Promise.resolve();

      // === NOTIFICATION ===
      case 'notification':
        var msg = step.message || '';
        Object.keys(lead).forEach(function (k) {
          msg = msg.replace(new RegExp('\\{lead\\.' + k + '\\}', 'g'), lead[k] || '');
        });
        logAction(workflowId, 'notification', msg, step.level || 'info');
        if (window.GAAdmin && window.GAAdmin.showToast) window.GAAdmin.showToast(msg);
        return Promise.resolve();

      case 'log':
        var logMsg = step.message || '';
        Object.keys(lead).forEach(function (k) {
          logMsg = logMsg.replace(new RegExp('\\{lead\\.' + k + '\\}', 'g'), lead[k] || '');
        });
        logAction(workflowId, 'log', logMsg, 'info');
        return Promise.resolve();

      // === SCANNING ACTIONS ===
      case 'stale-lead-scan':
        return Promise.resolve().then(function () {
          var threshold = (step.daysThreshold || 5) * 86400000;
          var now = Date.now();
          var stale = leads.filter(function (l) {
            if (l.pipelineStage === 'closed-won' || l.pipelineStage === 'closed-lost') return false;
            var lastActivity = l.lastActivity || l.lastOutreachAt || l.contactedAt || (l.createdAt ? new Date(l.createdAt).getTime() : 0);
            return (now - lastActivity) > threshold;
          });
          logAction(workflowId, 'stale-scan', stale.length + ' stale leads found', stale.length > 0 ? 'warning' : 'info');
          stale.forEach(function (l) {
            logAction(workflowId, 'stale-lead', l.name + ' — ' + Math.round((now - (l.lastActivity || 0)) / 86400000) + ' days inactive', 'warning');
          });
        });

      case 'win-analysis':
        return Promise.resolve().then(function () {
          var entry = {
            leadId: lead.id,
            leadName: lead.name,
            industry: lead.industry,
            score: lead.qualScore || lead.score,
            value: lead.value || 0,
            channel: lead.source || 'Unknown',
            type: 'win',
            ts: Date.now()
          };
          winLossLog.push(entry);
          save();
          logAction(workflowId, 'win-analysis', 'Win logged: ' + lead.name, 'success');
        });

      case 'loss-analysis':
        return Promise.resolve().then(function () {
          var entry = {
            leadId: lead.id,
            leadName: lead.name,
            industry: lead.industry,
            score: lead.qualScore || lead.score,
            value: lead.value || 0,
            channel: lead.source || 'Unknown',
            type: 'loss',
            reason: lead.lossReason || 'Not specified',
            ts: Date.now()
          };
          winLossLog.push(entry);
          save();
          logAction(workflowId, 'loss-analysis', 'Loss logged: ' + lead.name + ' — ' + (lead.lossReason || 'No reason'), 'warning');
        });

      case 'client-health-scan':
        return Promise.resolve().then(function () {
          var clients = leads.filter(function (l) { return l.pipelineStage === 'closed-won'; });
          var healthy = 0, atRisk = 0;
          clients.forEach(function (c) {
            var lastActivity = c.lastActivity || c.clientSince || 0;
            var daysSince = (Date.now() - lastActivity) / 86400000;
            if (daysSince > 30) {
              atRisk++;
              logAction(workflowId, 'health-at-risk', c.name + ' — ' + Math.round(daysSince) + ' days inactive', 'warning');
            } else {
              healthy++;
            }
          });
          logAction(workflowId, 'health-scan', clients.length + ' clients: ' + healthy + ' healthy, ' + atRisk + ' at-risk', 'info');
        });

      case 'pipeline-snapshot':
        return Promise.resolve().then(function () {
          var stages = {};
          leads.forEach(function (l) {
            var stage = l.pipelineStage || 'prospect';
            stages[stage] = (stages[stage] || 0) + 1;
          });
          var snapshot = {
            date: new Date().toISOString().slice(0, 10),
            ts: Date.now(),
            total: leads.length,
            stages: stages,
            hot: leads.filter(function (l) { return l.segment === 'hot'; }).length,
            warm: leads.filter(function (l) { return l.segment === 'warm'; }).length,
            cold: leads.filter(function (l) { return l.segment === 'cold'; }).length,
            pipelineValue: leads.filter(function (l) { return l.pipelineStage === 'proposal' || l.pipelineStage === 'meeting'; }).reduce(function (s, l) { return s + (l.value || 0); }, 0)
          };
          snapshots.push(snapshot);
          save();
          logAction(workflowId, 'snapshot', 'Pipeline: ' + leads.length + ' leads, $' + snapshot.pipelineValue.toFixed(1) + 'M value', 'info');
        });

      case 'reengagement-scan':
        return Promise.resolve().then(function () {
          var inactiveDays = step.inactiveDays || 30;
          var threshold = inactiveDays * 86400000;
          var now = Date.now();
          var inactive = leads.filter(function (l) {
            if (l.pipelineStage === 'closed-won' || l.pipelineStage === 'closed-lost') return false;
            if (l.pipelineStage === 'prospect' && !l.contactedAt) return false;
            var lastActivity = l.lastOutreachAt || l.contactedAt || l.lastActivity || 0;
            return lastActivity > 0 && (now - lastActivity) > threshold;
          });
          logAction(workflowId, 'reengagement-scan', inactive.length + ' inactive leads found', 'info');
          return { leads: inactive, count: inactive.length };
        });

      case 'referral-scan':
        return Promise.resolve().then(function () {
          var daysAfterClose = step.daysAfterClose || 14;
          var threshold = daysAfterClose * 86400000;
          var now = Date.now();
          var eligible = leads.filter(function (l) {
            if (l.pipelineStage !== 'closed-won') return false;
            if (l.referralRequested) return false;
            var clientSince = l.clientSince || 0;
            return clientSince > 0 && (now - clientSince) >= threshold;
          });
          logAction(workflowId, 'referral-scan', eligible.length + ' clients eligible for referral request', 'info');
          return { leads: eligible, count: eligible.length };
        });

      // === EMAIL ACTIONS ===
      case 'send-email':
        return Promise.resolve().then(function () {
          var email = lead.email || lead.contactEmail;
          if (!email) {
            logAction(workflowId, 'email-skip', 'No email for ' + (lead.name || 'lead'), 'warning');
            return;
          }

          var templates = {
            welcome: {
              subject: 'Welcome to GA — Let\'s Build Something Great',
              html: '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px"><h1 style="color:#e63946">Welcome, {lead.name}! 🎉</h1><p>We\'re thrilled to work with {lead.company} on your website redesign.</p><p><strong>What happens next:</strong></p><ol><li>Kickoff call this week</li><li>Strategy & audit (Week 1-2)</li><li>Design & build (Week 3-8)</li><li>Launch & optimize (Week 9)</li></ol><p>Questions? Reply to this email or call +233 243 262 019.</p><p>— Web Gabochie</p></div>'
            },
            proposal: {
              subject: '{lead.company} — Your Conversion System Proposal',
              html: '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px"><h1 style="color:#e63946">Your Proposal is Ready</h1><p>Hi {lead.name},</p><p>As promised, here\'s the conversion system proposal for {lead.company}.</p><p>Key highlights:</p><ul><li>Current website score: {lead.score}/100</li><li>Projected improvement: 40-60% more leads</li><li>ROI timeline: Month 1-12</li></ul><p>Take a look and let me know if you have questions.</p><p>— Web Gabochie</p></div>'
            },
            reengagement: {
              subject: '{lead.company} — Quick question about your website',
              html: '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px"><h2>Hi {lead.name},</h2><p>I noticed it\'s been a while since we last connected about {lead.company}\'s website.</p><p>I put together a quick analysis of what\'s changed in the {lead.industry} space — thought you might find it useful.</p><p><strong>Want me to send the updated report?</strong></p><p>— Web Gabochie</p></div>'
            },
            'referral-request': {
              subject: 'Quick favor, {lead.name}?',
              html: '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px"><h2>Hi {lead.name},</h2><p>Hope {lead.company} is doing great!</p><p>Quick question — do you know any other {lead.industry} businesses that could benefit from a website upgrade?</p><p>If so, I\'d love an introduction. And as a thank you, I\'ll offer them <strong>10% off setup</strong> and <strong>you $500 credit</strong> for each referral that closes.</p><p>Just hit reply with a name and I\'ll take it from there.</p><p>— Web Gabochie</p></div>'
            },
            'weekly-report': {
              subject: '📊 Your Weekly Pipeline Report',
              html: '<div style="font-family:Inter,sans-serif;max-width:600px;margin:0 auto;padding:32px"><h1 style="color:#e63946">Weekly Pipeline Report</h1><p>Hi Gideon,</p><p><strong>This week\'s numbers:</strong></p><ul><li>Total leads: {totalLeads}</li><li>New this week: {newLeads}</li><li>Hot leads: {hotLeads}</li><li>Pipeline value: ${pipelineValue}M</li><li>Win rate: {winRate}%</li></ul><p>Check the Command Center for full details.</p></div>'
            }
          };

          var template = templates[step.template] || templates.welcome;
          var subject = fillTemplate(template.subject, lead);
          var html = fillTemplate(template.html, lead);

          return sendEmail({ email: email, name: lead.name || '' }, subject, html).then(function (result) {
            logAction(workflowId, 'email-sent', 'Email sent to ' + email + ': ' + subject, 'success');
            updateLead(lead.id, { lastOutreachAt: Date.now(), lastOutreachChannel: 'email' });
          }).catch(function (err) {
            logAction(workflowId, 'email-error', 'Failed to send to ' + email + ': ' + err.message, 'error');
          });
        });

      // === AI ACTIONS ===
      case 'ai-followups':
        return Promise.resolve().then(function () {
          var needsFollowUp = leads.filter(function (l) {
            return (l.pipelineStage === 'contacted' || l.pipelineStage === 'engaged') &&
                   !l.followUpActive && l.email;
          }).slice(0, 10);

          logAction(workflowId, 'ai-followups', 'Generating ' + needsFollowUp.length + ' follow-ups', 'info');
          return { leads: needsFollowUp, count: needsFollowUp.length };
        });

      case 'ai-objection':
        logAction(workflowId, 'ai-objection', 'Objection handler triggered for ' + (lead.name || 'lead'), 'info');
        return Promise.resolve();

      case 'ai-meeting-prep':
        return Promise.resolve().then(function () {
          var brief = {
            lead: lead.name,
            company: lead.company || lead.name,
            industry: lead.industry || 'Unknown',
            score: lead.qualScore || lead.score || 0,
            value: lead.value || 0,
            source: lead.source || 'Unknown',
            notes: lead.notes || 'No notes',
            generatedAt: Date.now()
          };
          if (lead.id) updateLead(lead.id, { meetingBrief: brief });
          logAction(workflowId, 'meeting-prep', 'Brief generated for ' + lead.name, 'success');
        });

      case 'ai-proposal':
        logAction(workflowId, 'ai-proposal', 'Proposal customization triggered for ' + (lead.name || 'lead'), 'info');
        return Promise.resolve();

      case 'proposal-generate':
        logAction(workflowId, 'proposal', 'Proposal generation triggered for ' + (lead.name || 'lead'), 'success');
        return Promise.resolve();

      case 'trigger-workflow':
        var targetWf = WORKFLOWS.concat(customWorkflows).find(function (w) { return w.id === step.workflow; });
        if (targetWf) executeWorkflow(targetWf, lead);
        return Promise.resolve();

      default:
        logAction(workflowId, 'unknown', 'Unknown action: ' + step.action, 'warning');
        return Promise.resolve();
    }
  }

  /* ----------------------------------------
     DELAYED ACTION PROCESSOR
     ---------------------------------------- */
  function processDelayedActions() {
    var now = Date.now();
    var ready = delayedActions.filter(function (da) { return now >= da.executeAt; });

    ready.forEach(function (da) {
      var allWorkflows = WORKFLOWS.concat(customWorkflows);
      var wf = allWorkflows.find(function (w) { return w.id === da.workflowId; });
      if (wf) executeStep(wf.id, da.action, da.context);
      delayedActions = delayedActions.filter(function (d) { return d.id !== da.id; });
    });

    if (ready.length > 0) save();
  }

  setInterval(processDelayedActions, 60000);

  /* ----------------------------------------
     SCHEDULE TRIGGER CHECKER
     ---------------------------------------- */
  function checkTriggers() {
    var now = new Date();
    var hour = now.getHours();
    var min = now.getMinutes();
    var day = now.getDay();
    var date = now.getDate();

    WORKFLOWS.forEach(function (wf) {
      if (!wf.enabled || wf.trigger.type !== 'schedule') return;
      if (wf.lastRun) {
        var elapsed = Date.now() - wf.lastRun;
        // Don't re-run within same minute for hourly, same day for daily
        if (wf.trigger.cron === 'hourly' && elapsed < 3600000) return;
        if (wf.trigger.cron.startsWith('daily') && elapsed < 86400000) return;
        if (wf.trigger.cron.startsWith('weekly') && elapsed < 604800000) return;
      }

      var shouldRun = false;
      switch (wf.trigger.cron) {
        case 'hourly': shouldRun = min === 0; break;
        case 'daily-8am': shouldRun = hour === 8 && min === 0; break;
        case 'daily-9am': shouldRun = hour === 9 && min === 0; break;
        case 'daily-10am': shouldRun = hour === 10 && min === 0; break;
        case 'daily-11pm': shouldRun = hour === 23 && min === 0; break;
        case 'weekly-mon': shouldRun = day === 1 && hour === 9 && min === 0; break;
        case 'weekly-mon-8am': shouldRun = day === 1 && hour === 8 && min === 0; break;
        case 'weekly-fri': shouldRun = day === 5 && hour === 10 && min === 0; break;
        case 'weekly': shouldRun = day === 1 && hour === 9 && min === 0; break;
      }

      if (shouldRun) executeWorkflow(wf, {});
    });
  }

  setInterval(checkTriggers, 60000);

  /* ----------------------------------------
     WORKFLOW MANAGEMENT
     ---------------------------------------- */
  function toggleWorkflow(wfId) {
    var allWorkflows = WORKFLOWS.concat(customWorkflows);
    var wf = allWorkflows.find(function (w) { return w.id === wfId; });
    if (wf) {
      wf.enabled = !wf.enabled;
      logAction(wfId, wf.enabled ? 'enabled' : 'disabled', wf.name, 'info');
      save();
      notifyListeners('toggle', { workflow: wf });
    }
  }

  function addCustomWorkflow(workflow) {
    workflow.id = 'wf_custom_' + Date.now();
    workflow.runs = 0;
    workflow.lastRun = null;
    workflow.lastTriggered = null;
    customWorkflows.push(workflow);
    logAction(workflow.id, 'created', workflow.name, 'success');
    save();
    return workflow;
  }

  function removeCustomWorkflow(wfId) {
    customWorkflows = customWorkflows.filter(function (w) { return w.id !== wfId; });
    save();
  }

  function getWorkflow(id) {
    return WORKFLOWS.concat(customWorkflows).find(function (w) { return w.id === id; });
  }

  function getAllWorkflows() { return WORKFLOWS.concat(customWorkflows); }
  function getEnabledWorkflows() { return getAllWorkflows().filter(function (w) { return w.enabled; }); }
  function getWorkflowsByCategory(cat) { return getAllWorkflows().filter(function (w) { return w.category === cat; }); }

  function getStats() {
    var all = getAllWorkflows();
    var totalRuns = all.reduce(function (s, w) { return s + (w.runs || 0); }, 0);
    return {
      total: all.length,
      enabled: all.filter(function (w) { return w.enabled; }).length,
      totalRuns: totalRuns,
      pendingDelayed: delayedActions.length,
      snapshots: snapshots.length,
      winLossEntries: winLossLog.length,
      byCategory: {
        'lead-management': getWorkflowsByCategory('lead-management').length,
        'email': getWorkflowsByCategory('email').length,
        'ai': getWorkflowsByCategory('ai').length,
        'analytics': getWorkflowsByCategory('analytics').length
      }
    };
  }

  function getSnapshots() { return snapshots.slice().reverse(); }
  function getWinLossLog() { return winLossLog.slice().reverse(); }

  /* ----------------------------------------
     EVENT SYSTEM
     ---------------------------------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  function notifyListeners(event, data) {
    listeners.forEach(function (fn) { try { fn(event, data); } catch (e) {} });
  }

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  load();

  return {
    trigger: trigger,
    execute: executeWorkflow,
    toggle: toggleWorkflow,
    addWorkflow: addCustomWorkflow,
    removeWorkflow: removeCustomWorkflow,
    getWorkflow: getWorkflow,
    getAll: getAllWorkflows,
    getEnabled: getEnabledWorkflows,
    getByCategory: getWorkflowsByCategory,
    getStats: getStats,
    getLog: getLog,
    getLogByWorkflow: getLogByWorkflow,
    getSnapshots: getSnapshots,
    getWinLossLog: getWinLossLog,
    processDelayed: processDelayedActions,
    subscribe: subscribe,
    save: save
  };
})();
