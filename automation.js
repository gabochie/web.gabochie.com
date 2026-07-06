/* ========================================
   GA AUTOMATION — Workflow Engine
   Triggers, sequences, scheduling, actions
   ======================================== */
window.Automation = (function () {
  'use strict';

  /* ----------------------------------------
     PREDEFINED WORKFLOWS
     ---------------------------------------- */
  var WORKFLOWS = [
    {
      id: 'wf_new_lead',
      name: 'New Lead Onboarding',
      description: 'When a new lead enters the system, score it and generate outreach',
      enabled: true,
      trigger: { type: 'lead-created', filter: {} },
      steps: [
        { action: 'agent-start', agent: 'qualifier', delay: 0, label: 'Qualify lead' },
        { action: 'agent-start', agent: 'copywriter', delay: 5000, label: 'Generate outreach' },
        { action: 'notification', message: 'New lead {lead.name} added and processed', delay: 0, label: 'Notify' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_hot_lead',
      name: 'Hot Lead Alert',
      description: 'When a lead scores 70+, immediately generate outreach and alert',
      enabled: true,
      trigger: { type: 'lead-scored', filter: { minScore: 70 } },
      steps: [
        { action: 'lead-update', field: 'priority', value: 'High', label: 'Set priority High' },
        { action: 'lead-update', field: 'pipelineStage', value: 'qualified', label: 'Move to Qualified' },
        { action: 'agent-start', agent: 'copywriter', delay: 1000, label: 'Generate outreach' },
        { action: 'notification', message: '🔥 HOT LEAD: {lead.name} scored {lead.qualScore}/100', delay: 0, label: 'Alert' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_contacted_followup',
      name: 'Follow-Up Sequence',
      description: 'When a lead is contacted, start the drip sequence',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'contacted' } },
      steps: [
        { action: 'lead-update', field: 'followUpActive', value: true, label: 'Activate follow-up' },
        { action: 'agent-start', agent: 'followup', delay: 0, label: 'Start drip sequence' },
        { action: 'notification', message: 'Follow-up sequence started for {lead.name}', delay: 0, label: 'Log' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_meeting_booked',
      name: 'Meeting Booked',
      description: 'When a meeting is booked, prepare proposal',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'meeting' } },
      steps: [
        { action: 'lead-update', field: 'status', value: 'Meeting', label: 'Update status' },
        { action: 'proposal-generate', label: 'Generate proposal' },
        { action: 'notification', message: '📅 Meeting booked with {lead.name} — proposal generated', delay: 0, label: 'Alert' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_proposal_sent',
      name: 'Proposal Follow-Up',
      description: 'After proposal is sent, schedule follow-up sequence',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'proposal' } },
      steps: [
        { action: 'lead-update', field: 'proposalSent', value: true, label: 'Mark proposal sent' },
        { action: 'lead-update', field: 'proposalSentAt', value: 'now', label: 'Timestamp' },
        { action: 'notification', delay: 3 * 86400000, message: '⏰ Proposal follow-up due for {lead.name}', label: '3-day follow-up' },
        { action: 'notification', delay: 7 * 86400000, message: '⏰ Second proposal follow-up for {lead.name}', label: '7-day follow-up' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_deal_won',
      name: 'Deal Won — Client Onboarding',
      description: 'When a deal is closed-won, trigger client onboarding',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'closed-won' } },
      steps: [
        { action: 'lead-update', field: 'status', value: 'Closed', label: 'Mark closed' },
        { action: 'lead-update', field: 'clientSince', value: 'now', label: 'Client timestamp' },
        { action: 'notification', message: '🎉 DEAL WON: {lead.name}', delay: 0, label: 'Celebrate' },
        { action: 'agent-start', agent: 'watcher', delay: 60000, label: 'Start monitoring' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_deal_lost',
      name: 'Deal Lost — Feedback',
      description: 'When a deal is lost, log reason and schedule re-engagement',
      enabled: true,
      trigger: { type: 'lead-stage-changed', filter: { stage: 'closed-lost' } },
      steps: [
        { action: 'lead-update', field: 'status', value: 'Closed', label: 'Mark closed' },
        { action: 'notification', message: '❌ Deal lost: {lead.name} — logged for review', delay: 0, label: 'Alert' },
        { action: 'lead-update', delay: 90 * 86400000, field: 'pipelineStage', value: 'prospect', label: 'Re-engage in 90 days' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_daily_digest',
      name: 'Daily Digest',
      description: 'Send daily pipeline summary at 8am',
      enabled: true,
      trigger: { type: 'schedule', cron: 'daily-8am' },
      steps: [
        { action: 'agent-start', agent: 'reporter', label: 'Generate report' },
        { action: 'notification', message: '📊 Daily digest ready — check Command Center', label: 'Digest notification' }
      ],
      runs: 0, lastRun: null, lastTriggered: null
    },
    {
      id: 'wf_inactive_leads',
      name: 'Inactive Lead Cleanup',
      description: 'Weekly scan for leads with no activity in 14+ days',
      enabled: true,
      trigger: { type: 'schedule', cron: 'weekly' },
      steps: [
        { action: 'agent-start', agent: 'followup', label: 'Check inactive leads' },
        { action: 'notification', message: 'Inactive leads reviewed — check pipeline', label: 'Weekly cleanup' }
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
  var MAX_LOG = 200;
  var listeners = [];

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    localStorage.setItem('ga_workflows', JSON.stringify(WORKFLOWS));
    localStorage.setItem('ga_custom_workflows', JSON.stringify(customWorkflows));
    localStorage.setItem('ga_automation_log', JSON.stringify(executionLog.slice(-MAX_LOG)));
    localStorage.setItem('ga_delayed_actions', JSON.stringify(delayedActions));
  }

  function load() {
    try {
      var stored = JSON.parse(localStorage.getItem('ga_workflows') || 'null');
      if (stored) {
        stored.forEach(function (wf) {
          var existing = WORKFLOWS.find(function (w) { return w.id === wf.id; });
          if (existing) {
            existing.runs = wf.runs || 0;
            existing.lastRun = wf.lastRun;
            existing.lastTriggered = wf.lastTriggered;
            existing.enabled = wf.enabled !== undefined ? wf.enabled : existing.enabled;
          }
        });
      }
      customWorkflows = JSON.parse(localStorage.getItem('ga_custom_workflows') || '[]');
      executionLog = JSON.parse(localStorage.getItem('ga_automation_log') || '[]');
      delayedActions = JSON.parse(localStorage.getItem('ga_delayed_actions') || '[]');
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
        if (wf.trigger.filter.industry && data.industry !== wf.trigger.filter.industry) return;
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
    steps.forEach(function (step, idx) {
      var delay = step.delay || 0;

      if (delay > 0) {
        // Schedule delayed action
        delayedActions.push({
          id: 'da_' + Date.now() + '_' + idx,
          workflowId: workflow.id,
          stepIndex: idx,
          action: step,
          context: context,
          executeAt: Date.now() + delay,
          created: Date.now()
        });
        save();
      } else {
        executeStep(workflow.id, step, context);
      }
    });

    notifyListeners('workflow', { workflow: workflow, context: context });
    save();
  }

  function executeStep(workflowId, step, context) {
    var lead = context || {};

    switch (step.action) {
      case 'agent-start':
        if (window.Agents && window.Agents.start) {
          window.Agents.start(step.agent);
          logAction(workflowId, 'agent-start', 'Started ' + step.agent, 'success');
        }
        break;

      case 'lead-update':
        if (lead.id && window.Agents) {
          var value = step.value === 'now' ? Date.now() : step.value;
          // Fill template values
          if (typeof value === 'string' && value.indexOf('{lead.') !== -1) {
            value = value.replace(/\{lead\.(\w+)\}/g, function (m, field) { return lead[field] || ''; });
          }
          // Use the Agents module's updateLead via localStorage
          var leads = JSON.parse(localStorage.getItem('ga_leads') || '[]');
          var idx = leads.findIndex(function (l) { return l.id === lead.id; });
          if (idx !== -1) {
            leads[idx][step.field] = value;
            localStorage.setItem('ga_leads', JSON.stringify(leads));
          }
          logAction(workflowId, 'lead-update', lead.name + ': ' + step.field + ' = ' + value, 'info');
        }
        break;

      case 'notification':
        var msg = step.message || '';
        Object.keys(lead).forEach(function (k) {
          msg = msg.replace(new RegExp('\\{lead\\.' + k + '\\}', 'g'), lead[k] || '');
        });
        logAction(workflowId, 'notification', msg, step.level || 'info');
        if (window.GAAdmin && window.GAAdmin.showToast) {
          window.GAAdmin.showToast(msg);
        }
        break;

      case 'proposal-generate':
        logAction(workflowId, 'proposal', 'Proposal generation triggered for ' + (lead.name || 'lead'), 'success');
        break;

      case 'delayed-action':
        // Already handled in executeWorkflow
        break;

      default:
        logAction(workflowId, 'unknown', 'Unknown action: ' + step.action, 'warning');
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
      if (wf) {
        executeStep(wf.id, da.action, da.context);
      }
      // Remove from queue
      delayedActions = delayedActions.filter(function (d) { return d.id !== da.id; });
    });

    if (ready.length > 0) save();
  }

  // Process delayed actions every minute
  setInterval(processDelayedActions, 60000);

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
    notifyListeners('addWorkflow', { workflow: workflow });
    return workflow;
  }

  function removeCustomWorkflow(wfId) {
    customWorkflows = customWorkflows.filter(function (w) { return w.id !== wfId; });
    logAction(wfId, 'removed', 'Custom workflow deleted', 'warning');
    save();
  }

  function getWorkflow(id) {
    return WORKFLOWS.concat(customWorkflows).find(function (w) { return w.id === id; });
  }

  function getAllWorkflows() {
    return WORKFLOWS.concat(customWorkflows);
  }

  function getEnabledWorkflows() {
    return getAllWorkflows().filter(function (w) { return w.enabled; });
  }

  function getStats() {
    var all = getAllWorkflows();
    var totalRuns = all.reduce(function (sum, w) { return sum + (w.runs || 0); }, 0);
    var enabled = all.filter(function (w) { return w.enabled; }).length;
    return {
      total: all.length, enabled: enabled, disabled: all.length - enabled,
      totalRuns: totalRuns, pendingDelayed: delayedActions.length
    };
  }

  /* ----------------------------------------
     AUTO-TRIGGER MONITOR
     ---------------------------------------- */
  function checkTriggers() {
    // Check schedule-based triggers
    var now = new Date();
    var hour = now.getHours();
    var day = now.getDay();

    WORKFLOWS.forEach(function (wf) {
      if (!wf.enabled || wf.trigger.type !== 'schedule') return;

      if (wf.trigger.cron === 'daily-8am' && hour === 8 && now.getMinutes() === 0) {
        executeWorkflow(wf, {});
      }
      if (wf.trigger.cron === 'weekly' && day === 1 && hour === 9 && now.getMinutes() === 0) {
        executeWorkflow(wf, {});
      }
    });
  }

  // Check triggers every minute
  setInterval(checkTriggers, 60000);

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
    getStats: getStats,
    getLog: getLog,
    getLogByWorkflow: getLogByWorkflow,
    processDelayed: processDelayedActions,
    subscribe: subscribe,
    save: save
  };
})();
