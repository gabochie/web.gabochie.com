/* ========================================
   GA COMMAND CENTER — Real-Time Dashboard
   Agent status, pipeline metrics, activity feed
   ======================================== */
window.CommandCenter = (function () {
  'use strict';

  var refreshInterval = null;
  var REFRESH_MS = 5000;
  var listeners = [];

  /* ----------------------------------------
     PIPELINE METRICS
     ---------------------------------------- */
  function getPipelineMetrics() {
    var leads = [];
    try {
      var raw = localStorage.getItem('ga_leads');
      if (raw) {
        var parsed = JSON.parse(raw);
        leads = Array.isArray(parsed) ? parsed : Object.values(parsed);
      }
    } catch (e) {}

    // Normalize Firestore leads to match expected format
    leads = leads.map(function (l) {
      return {
        id: l.id,
        name: l.name || l.company || 'Unknown',
        company: l.company || '',
        email: l.email || '',
        url: l.url || '',
        source: l.source || 'Unknown',
        status: l.status || 'New',
        segment: l.segment || (l.score >= 70 ? 'hot' : l.score >= 40 ? 'warm' : 'cold'),
        pipelineStage: l.pipelineStage || l.status || 'prospect',
        score: l.score || 0,
        qualScore: l.qualScore || l.score || 0,
        value: l.value || 0,
        lastActivity: l.lastActivity || (l.createdAt ? new Date(l.createdAt).getTime() : 0),
        contactedAt: l.contactedAt || 0,
        createdAt: l.createdAt ? new Date(l.createdAt).getTime() : 0,
        followUpSequence: l.followUpSequence || null
      };
    });
    var stages = {};
    var segments = { hot: 0, warm: 0, cold: 0, unclassified: 0 };
    var totalValue = 0;
    var pipelineValue = 0;
    var scores = [];
    var activeFollowUps = 0;
    var needsAttention = [];

    var stageList = window.Agents ? window.Agents.PIPELINE_STAGES : [];
    stageList.forEach(function (s) { stages[s.id] = 0; });

    leads.forEach(function (l) {
      var stage = l.pipelineStage || 'prospect';
      stages[stage] = (stages[stage] || 0) + 1;
      segments[l.segment || 'unclassified'] = (segments[l.segment || 'unclassified'] || 0) + 1;
      totalValue += (l.value || 0);
      if (l.qualScore) scores.push(l.qualScore);
      if (l.pipelineStage === 'proposal' || l.pipelineStage === 'meeting') pipelineValue += (l.value || 0);
      if (l.followUpSequence && l.pipelineStage !== 'closed-won' && l.pipelineStage !== 'closed-lost') activeFollowUps++;

      // Needs attention: leads stuck in a stage for too long
      var lastActivity = l.lastActivity || l.contactedAt || l.createdAt || 0;
      var daysSince = (Date.now() - lastActivity) / 86400000;
      if (l.pipelineStage === 'contacted' && daysSince > 5) needsAttention.push(l);
      if (l.pipelineStage === 'engaged' && daysSince > 3) needsAttention.push(l);
      if (l.pipelineStage === 'proposal' && daysSince > 7) needsAttention.push(l);
    });

    var avgScore = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var hotLeads = leads.filter(function (l) { return l.segment === 'hot'; });
    var won = stages['closed-won'] || 0;
    var lost = stages['closed-lost'] || 0;
    var winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;

    return {
      total: leads.length,
      stages: stages,
      segments: segments,
      totalRevenue: totalValue,
      pipelineValue: pipelineValue,
      avgScore: avgScore,
      hotCount: hotLeads.length,
      activeFollowUps: activeFollowUps,
      winRate: winRate,
      won: won,
      lost: lost,
      needsAttention: needsAttention.slice(0, 10),
      conversionFunnel: {
        prospect: stages['prospect'] || 0,
        qualified: stages['qualified'] || 0,
        contacted: stages['contacted'] || 0,
        engaged: stages['engaged'] || 0,
        meeting: stages['meeting'] || 0,
        proposal: stages['proposal'] || 0,
        won: won
      }
    };
  }

  /* ----------------------------------------
     AGENT STATUS SUMMARY
     ---------------------------------------- */
  function getAgentSummary() {
    if (!window.Agents) return { agents: [], running: 0, completed: 0, errors: 0 };

    var agents = window.Agents.getAllAgents();
    var running = agents.filter(function (a) { return a.status === 'running'; }).length;
    var completed = agents.filter(function (a) { return a.status === 'completed'; }).length;
    var errors = agents.filter(function (a) { return a.status === 'error'; }).length;
    var totalTasks = agents.reduce(function (sum, a) { return sum + (a.tasksTotal || 0); }, 0);
    var doneTasks = agents.reduce(function (sum, a) { return sum + (a.tasksDone || 0); }, 0);

    return {
      agents: agents,
      running: running,
      completed: completed,
      errors: errors,
      totalTasks: totalTasks,
      doneTasks: doneTasks,
      progress: totalTasks > 0 ? Math.round((doneTasks / totalTasks) * 100) : 0
    };
  }

  /* ----------------------------------------
     AUTOMATION STATUS
     ---------------------------------------- */
  function getAutomationSummary() {
    if (!window.Automation) return { workflows: [], active: 0, totalRuns: 0 };

    var stats = window.Automation.getStats();
    var workflows = window.Automation.getAll();

    return {
      workflows: workflows,
      active: stats.enabled,
      total: stats.total,
      totalRuns: stats.totalRuns,
      pendingDelayed: stats.pendingDelayed
    };
  }

  /* ----------------------------------------
     ACTIVITY FEED (merged from all systems)
     ---------------------------------------- */
  function getActivityFeed(limit) {
    var agentLog = window.Agents ? window.Agents.getLog(100) : [];
    var autoLog = window.Automation ? window.Automation.getLog(100) : [];

    // Merge and sort by timestamp
    var all = agentLog.map(function (e) {
      return { ts: e.ts, source: 'agent', agent: e.agent, action: e.action, detail: e.detail, level: e.level };
    }).concat(autoLog.map(function (e) {
      return { ts: e.ts, source: 'automation', workflow: e.workflow, action: e.action, detail: e.detail, level: e.level };
    }));

    all.sort(function (a, b) { return b.ts - a.ts; });
    return all.slice(0, limit || 30);
  }

  /* ----------------------------------------
     HEALTH SCORE
     ---------------------------------------- */
  function getHealthScore() {
    var pipeline = getPipelineMetrics();
    var agentSummary = getAgentSummary();
    var score = 50; // base

    // Pipeline health
    if (pipeline.hotCount > 0) score += 10;
    if (pipeline.pipelineValue > 5) score += 10;
    if (pipeline.winRate > 20) score += 5;
    if (pipeline.needsAttention.length < 3) score += 5;

    // Agent health
    if (agentSummary.errors === 0) score += 5;
    if (agentSummary.running > 0) score += 5;

    // Penalties
    if (pipeline.needsAttention.length > 5) score -= 10;
    if (agentSummary.errors > 2) score -= 10;

    return Math.max(0, Math.min(100, score));
  }

  /* ----------------------------------------
     QUICK ACTIONS
     ---------------------------------------- */
  function runAllAgents() {
    if (window.Agents) window.Agents.runAll();
  }

  function runScout() {
    if (window.Agents) window.Agents.start('scout');
  }

  function runQualifier() {
    if (window.Agents) window.Agents.start('qualifier');
  }

  function runSales() {
    if (window.Agents) window.Agents.start('sales');
  }

  function runFollowUp() {
    if (window.Agents) window.Agents.start('followup');
  }

  function runReporter() {
    if (window.Agents) window.Agents.start('reporter');
  }

  /* ----------------------------------------
     RENDER — Command Center Dashboard
     ---------------------------------------- */
  function render(containerId) {
    var el = document.getElementById(containerId);
    if (!el) return;

    var pipeline = getPipelineMetrics();
    var agentSummary = getAgentSummary();
    var autoSummary = getAutomationSummary();
    var health = getHealthScore();
    var activity = getActivityFeed(15);
    var stages = window.Agents ? window.Agents.PIPELINE_STAGES : [];

    var html = '';

    // Health + Quick Actions
    var healthColor = health >= 70 ? '#22c55e' : health >= 40 ? '#f59e0b' : '#ef4444';
    var healthLabel = health >= 70 ? 'Healthy' : health >= 40 ? 'Needs Attention' : 'Critical';

    html += '<div class="cc-top">';
    html += '<div class="cc-health"><div class="cc-health-ring" style="--health-color:' + healthColor + '"><span>' + health + '</span></div><div class="cc-health-label">' + healthLabel + '</div></div>';
    html += '<div class="cc-quick-actions">';
    html += '<button class="btn btn-sm btn-accent" onclick="Agents.runAll()">▶ Run All Agents</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="Agents.start(\'scout\')">🔍 Scout</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="Agents.start(\'qualifier\')">📊 Qualify</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="Agents.start(\'sales\')">💰 Sales</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="Agents.start(\'followup\')">🔄 Follow-Up</button>';
    html += '<button class="btn btn-sm btn-outline" onclick="Agents.start(\'reporter\')">📈 Report</button>';
    html += '</div>';
    html += '</div>';

    // Pipeline Funnel
    html += '<div class="cc-section"><h3 class="cc-section-title">Pipeline Funnel</h3>';
    html += '<div class="cc-funnel">';
    var maxStage = Math.max.apply(null, Object.values(pipeline.conversionFunnel).concat([1]));
    stages.forEach(function (s) {
      var count = pipeline.stages[s.id] || 0;
      var pct = Math.round((count / maxStage) * 100);
      html += '<div class="cc-funnel-row">';
      html += '<div class="cc-funnel-label">' + s.icon + ' ' + s.label + '</div>';
      html += '<div class="cc-funnel-bar"><div class="cc-funnel-fill" style="width:' + pct + '%;background:' + s.color + '"></div></div>';
      html += '<div class="cc-funnel-count">' + count + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Stats Row
    html += '<div class="cc-stats-row">';
    html += ccStatCard('Total Leads', pipeline.total, '#3b82f6');
    html += ccStatCard('Pipeline Value', '$' + pipeline.pipelineValue.toFixed(1) + 'M', '#22c55e');
    html += ccStatCard('Hot Leads', pipeline.hotCount, '#ef4444');
    html += ccStatCard('Avg Score', pipeline.avgScore + '/100', '#8b5cf6');
    html += ccStatCard('Win Rate', pipeline.winRate + '%', '#06b6d4');
    html += ccStatCard('Active Sequences', pipeline.activeFollowUps, '#f59e0b');
    html += ccStatCard('Needs Attention', pipeline.needsAttention.length, pipeline.needsAttention.length > 3 ? '#ef4444' : '#22c55e');
    html += '</div>';

    // Visitor Conversion Funnel
    if (window.Analytics) {
      var funnel = Analytics.getFunnelData();
      html += '<div class="cc-section"><h3 class="cc-section-title">Visitor Conversion Funnel</h3>';
      html += '<div class="cc-funnel">';
      var maxFunnel = Math.max.apply(null, funnel.steps.map(function (s) { return s.count; }).concat([1]));
      funnel.steps.forEach(function (step, i) {
        var pct = Math.round((step.count / maxFunnel) * 100);
        var color = i === funnel.steps.length - 1 ? '#22c55e' : '#3b82f6';
        html += '<div class="cc-funnel-row">';
        html += '<div class="cc-funnel-label">' + step.label + '</div>';
        html += '<div class="cc-funnel-bar"><div class="cc-funnel-fill" style="width:' + pct + '%;background:' + color + '"></div></div>';
        html += '<div class="cc-funnel-count">' + step.count + ' <span style="font-size:11px;color:var(--text3)">' + step.convRate + '%</span></div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:8px;font-size:12px;color:var(--text3)">' + funnel.totalVisitors + ' visitors → ' + funnel.totalDeals + ' deals (' + funnel.overallConversion + '% overall)</div>';
      html += '</div>';
    }

    // Channel Performance
    if (window.Analytics) {
      var channels = Analytics.getChannelPerformance();
      var activeChannels = channels.filter(function (c) { return c.visitors > 0 || c.leads > 0; });
      if (activeChannels.length > 0) {
        html += '<div class="cc-section"><h3 class="cc-section-title">Channel Performance</h3>';
        html += '<div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(200px,1fr));gap:12px">';
        activeChannels.forEach(function (ch) {
          html += '<div style="padding:12px;background:var(--bg);border:1px solid var(--border);border-radius:8px">';
          html += '<div style="font-size:13px;font-weight:600;margin-bottom:6px">' + ch.icon + ' ' + ch.name + '</div>';
          html += '<div style="font-size:12px;color:var(--text3)">' + ch.visitors + ' visitors • ' + ch.leads + ' leads</div>';
          html += '<div style="font-size:12px;color:var(--green)">$' + ch.revenue + ' revenue</div>';
          html += '</div>';
        });
        html += '</div></div>';
      }
    }

    // Agent Status
    html += '<div class="cc-section"><h3 class="cc-section-title">Agent Status</h3>';
    html += '<div class="cc-agents-grid">';
    agentSummary.agents.forEach(function (agent) {
      var statusClass = agent.status === 'running' ? 'running' : agent.status === 'completed' ? 'done' : agent.status === 'error' ? 'error' : 'idle';
      html += '<div class="cc-agent-card cc-agent-' + statusClass + '">';
      html += '<div class="cc-agent-icon" style="color:' + agent.color + '">' + agent.icon + '</div>';
      html += '<div class="cc-agent-info">';
      html += '<div class="cc-agent-name">' + agent.name + '</div>';
      html += '<div class="cc-agent-status">' + (agent.status === 'running' ? '⏳ Running...' : agent.status === 'completed' ? '✅ Done' : agent.status === 'error' ? '❌ Error' : '💤 Idle') + '</div>';
      html += '<div class="cc-agent-tasks">' + agent.tasksDone + '/' + agent.tasksTotal + ' tasks</div>';
      html += '</div>';
      html += '<div class="cc-agent-actions">';
      if (agent.status === 'idle' || agent.status === 'completed' || agent.status === 'error') {
        html += '<button class="btn btn-xs btn-accent" onclick="Agents.start(\'' + agent.id + '\')">▶</button>';
      } else {
        html += '<button class="btn btn-xs btn-outline" onclick="Agents.stop(\'' + agent.id + '\')">⏹</button>';
      }
      html += '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Automation Workflows
    html += '<div class="cc-section"><h3 class="cc-section-title">Automation Workflows</h3>';
    html += '<div class="cc-workflows">';
    autoSummary.workflows.forEach(function (wf) {
      html += '<div class="cc-workflow ' + (wf.enabled ? 'enabled' : 'disabled') + '">';
      html += '<div class="cc-wf-header">';
      html += '<span class="cc-wf-name">' + (wf.name || 'Unnamed') + '</span>';
      html += '<label class="cc-toggle"><input type="checkbox" ' + (wf.enabled ? 'checked' : '') + ' onchange="Automation.toggle(\'' + wf.id + '\')"><span class="cc-toggle-slider"></span></label>';
      html += '</div>';
      html += '<div class="cc-wf-desc">' + (wf.description || '') + '</div>';
      html += '<div class="cc-wf-meta">Runs: ' + (wf.runs || 0) + ' • Steps: ' + (wf.steps ? wf.steps.length : 0) + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Activity Feed
    html += '<div class="cc-section"><h3 class="cc-section-title">Activity Feed</h3>';
    html += '<div class="cc-feed">';
    if (activity.length === 0) {
      html += '<div class="cc-feed-empty">No activity yet. Run an agent to get started.</div>';
    }
    activity.forEach(function (entry) {
      var timeAgo = getTimeAgo(entry.ts);
      var levelClass = entry.level || 'info';
      var source = entry.source === 'agent' ? (entry.agent || 'system') : 'automation';
      html += '<div class="cc-feed-item cc-feed-' + levelClass + '">';
      html += '<div class="cc-feed-time">' + timeAgo + '</div>';
      html += '<div class="cc-feed-source">[' + source + ']</div>';
      html += '<div class="cc-feed-action">' + (entry.action || '') + '</div>';
      html += '<div class="cc-feed-detail">' + (entry.detail || '') + '</div>';
      html += '</div>';
    });
    html += '</div></div>';

    // Needs Attention
    if (pipeline.needsAttention.length > 0) {
      html += '<div class="cc-section"><h3 class="cc-section-title">⚠️ Needs Attention</h3>';
      html += '<div class="cc-attention-list">';
      pipeline.needsAttention.forEach(function (l) {
        var days = Math.floor((Date.now() - (l.lastActivity || l.contactedAt || l.createdAt || 0)) / 86400000);
        html += '<div class="cc-attention-item">';
        html += '<span class="cc-att-name">' + (l.name || 'Unknown') + '</span>';
        html += '<span class="cc-att-stage">' + (l.pipelineStage || 'prospect') + '</span>';
        html += '<span class="cc-att-days">' + days + ' days inactive</span>';
        html += '</div>';
      });
      html += '</div></div>';
    }

    el.innerHTML = html;
  }

  function ccStatCard(label, value, color) {
    return '<div class="cc-stat-card" style="border-top:3px solid ' + color + '">' +
      '<div class="cc-stat-value" style="color:' + color + '">' + value + '</div>' +
      '<div class="cc-stat-label">' + label + '</div></div>';
  }

  function getTimeAgo(ts) {
    var diff = Date.now() - ts;
    if (diff < 60000) return 'just now';
    if (diff < 3600000) return Math.floor(diff / 60000) + 'm ago';
    if (diff < 86400000) return Math.floor(diff / 3600000) + 'h ago';
    return Math.floor(diff / 86400000) + 'd ago';
  }

  /* ----------------------------------------
     AUTO-REFRESH
     ---------------------------------------- */
  function startAutoRefresh(containerId) {
    stopAutoRefresh();
    refreshInterval = setInterval(function () { render(containerId); }, REFRESH_MS);
  }

  function stopAutoRefresh() {
    if (refreshInterval) { clearInterval(refreshInterval); refreshInterval = null; }
  }

  /* ----------------------------------------
     EVENT SYSTEM
     ---------------------------------------- */
  function subscribe(fn) {
    listeners.push(fn);
    return function () { listeners = listeners.filter(function (l) { return l !== fn; }); };
  }

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  return {
    render: render,
    getPipelineMetrics: getPipelineMetrics,
    getAgentSummary: getAgentSummary,
    getAutomationSummary: getAutomationSummary,
    getActivityFeed: getActivityFeed,
    getHealthScore: getHealthScore,
    startAutoRefresh: startAutoRefresh,
    stopAutoRefresh: stopAutoRefresh,
    runAllAgents: runAllAgents,
    runScout: runScout,
    runQualifier: runQualifier,
    runSales: runSales,
    runFollowUp: runFollowUp,
    runReporter: runReporter,
    subscribe: subscribe
  };
})();
