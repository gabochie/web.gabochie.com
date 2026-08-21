/* ========================================
   DYNAMIC REPORTING ENGINE
   Date ranges, trends, comparisons, charts
   ======================================== */
window.Reporting = (function () {
  'use strict';

  var PERIODS = {
    '24h': { label: 'Last 24 Hours', ms: 86400000 },
    '7d': { label: 'Last 7 Days', ms: 604800000 },
    '30d': { label: 'Last 30 Days', ms: 2592000000 },
    '90d': { label: 'Last 90 Days', ms: 7776000000 },
    'all': { label: 'All Time', ms: Infinity }
  };

  function getLeads() {
    if (!window.FirebaseService) return [];
    // Use cached leads from CommandCenter or fetch fresh
    if (window.CommandCenter && CommandCenter.getPipelineMetrics) {
      var metrics = CommandCenter.getPipelineMetrics();
      // We need raw leads, get from Firestore
    }
    try {
      var raw = localStorage.getItem('ga_leads');
      if (raw) {
        var parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : Object.values(parsed);
      }
    } catch (e) {}
    return [];
  }

  function filterByPeriod(leads, period) {
    if (period === 'all') return leads;
    var ms = PERIODS[period] ? PERIODS[period].ms : 604800000;
    var cutoff = Date.now() - ms;
    return leads.filter(function (l) {
      var ts = l.createdAt ? new Date(l.createdAt).getTime() : (l.lastActivity || 0);
      return ts >= cutoff;
    });
  }

  function getPreviousPeriod(leads, period) {
    if (period === 'all') return [];
    var ms = PERIODS[period] ? PERIODS[period].ms : 604800000;
    var now = Date.now();
    var start = now - (ms * 2);
    var end = now - ms;
    return leads.filter(function (l) {
      var ts = l.createdAt ? new Date(l.createdAt).getTime() : (l.lastActivity || 0);
      return ts >= start && ts < end;
    });
  }

  function calcMetrics(leads) {
    var total = leads.length;
    var byStage = {};
    var bySource = {};
    var bySegment = { hot: 0, warm: 0, cold: 0 };
    var totalValue = 0;
    var scores = [];
    var won = 0;
    var lost = 0;
    var contacted = 0;

    leads.forEach(function (l) {
      var stage = l.pipelineStage || l.status || 'New';
      byStage[stage] = (byStage[stage] || 0) + 1;
      var src = l.source || 'Unknown';
      bySource[src] = (bySource[src] || 0) + 1;
      var seg = l.segment || (l.score >= 70 ? 'hot' : l.score >= 40 ? 'warm' : 'cold');
      bySegment[seg] = (bySegment[seg] || 0) + 1;
      totalValue += (l.value || 0);
      scores.push(l.qualScore || l.score || 0);
      if (stage === 'closed-won') won++;
      if (stage === 'closed-lost') lost++;
      if (stage !== 'New' && stage !== 'prospect') contacted++;
    });

    var avgScore = scores.length ? Math.round(scores.reduce(function (a, b) { return a + b; }, 0) / scores.length) : 0;
    var winRate = (won + lost) > 0 ? Math.round((won / (won + lost)) * 100) : 0;
    var convRate = contacted > 0 ? Math.round((won / contacted) * 100) : 0;

    return {
      total: total,
      won: won,
      lost: lost,
      contacted: contacted,
      byStage: byStage,
      bySource: bySource,
      bySegment: bySegment,
      totalValue: totalValue,
      avgScore: avgScore,
      winRate: winRate,
      convRate: convRate
    };
  }

  function compareMetrics(current, previous) {
    function pctChange(a, b) {
      if (b === 0) return a > 0 ? '+100' : '0';
      var change = Math.round(((a - b) / b) * 100);
      return (change >= 0 ? '+' : '') + change;
    }
    return {
      total: { current: current.total, previous: previous.total, change: pctChange(current.total, previous.total) },
      won: { current: current.won, previous: previous.won, change: pctChange(current.won, previous.won) },
      convRate: { current: current.convRate, previous: previous.convRate, change: pctChange(current.convRate, previous.convRate) },
      avgScore: { current: current.avgScore, previous: previous.avgScore, change: pctChange(current.avgScore, previous.avgScore) },
      totalValue: { current: current.totalValue, previous: previous.totalValue, change: pctChange(current.totalValue, previous.totalValue) },
      winRate: { current: current.winRate, previous: previous.winRate, change: pctChange(current.winRate, previous.winRate) }
    };
  }

  function getDailyTimeline(leads, period) {
    var ms = PERIODS[period] ? PERIODS[period].ms : 604800000;
    var days = Math.min(Math.ceil(ms / 86400000), 90);
    var buckets = [];
    var now = new Date();
    now.setHours(0, 0, 0, 0);

    for (var i = days - 1; i >= 0; i--) {
      var dayStart = new Date(now.getTime() - (i * 86400000));
      var dayEnd = new Date(dayStart.getTime() + 86400000);
      var count = 0;
      var value = 0;
      leads.forEach(function (l) {
        var ts = l.createdAt ? new Date(l.createdAt).getTime() : 0;
        if (ts >= dayStart.getTime() && ts < dayEnd.getTime()) {
          count++;
          value += (l.value || 0);
        }
      });
      buckets.push({
        date: dayStart.toISOString().split('T')[0],
        label: (dayStart.getMonth() + 1) + '/' + dayStart.getDate(),
        count: count,
        value: value
      });
    }
    return buckets;
  }

  function getSourceBreakdown(leads) {
    var sources = {};
    leads.forEach(function (l) {
      var src = l.source || 'Unknown';
      if (!sources[src]) sources[src] = { count: 0, won: 0, value: 0 };
      sources[src].count++;
      if (l.pipelineStage === 'closed-won') sources[src].won++;
      sources[src].value += (l.value || 0);
    });
    var arr = [];
    Object.keys(sources).forEach(function (k) {
      arr.push({
        name: k,
        count: sources[k].count,
        won: sources[k].won,
        value: sources[k].value,
        convRate: sources[k].count > 0 ? Math.round((sources[k].won / sources[k].count) * 100) : 0
      });
    });
    arr.sort(function (a, b) { return b.count - a.count; });
    return arr;
  }

  /* ----------------------------------------
     CANVAS CHART HELPERS — No external libs
     ---------------------------------------- */
  function drawLineChart(canvas, data, options) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.parentElement.offsetWidth;
    var h = canvas.height = options.height || 200;
    var padding = { top: 20, right: 20, bottom: 40, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);

    if (!data || data.length === 0) return;

    var maxVal = Math.max.apply(null, data.map(function (d) { return d.count; }).concat([1]));
    var stepX = chartW / Math.max(data.length - 1, 1);

    // Grid lines
    ctx.strokeStyle = '#1f1f28';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#6b6b78';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * (4 - i) / 4), padding.left - 8, y + 4);
    }

    // X labels
    ctx.fillStyle = '#6b6b78';
    ctx.textAlign = 'center';
    var labelStep = Math.max(1, Math.floor(data.length / 8));
    data.forEach(function (d, idx) {
      if (idx % labelStep === 0 || idx === data.length - 1) {
        var x = padding.left + (idx * stepX);
        ctx.fillText(d.label, x, h - 10);
      }
    });

    // Area fill
    ctx.beginPath();
    ctx.moveTo(padding.left, padding.top + chartH);
    data.forEach(function (d, idx) {
      var x = padding.left + (idx * stepX);
      var y = padding.top + chartH - (d.count / maxVal * chartH);
      if (idx === 0) ctx.lineTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.lineTo(padding.left + ((data.length - 1) * stepX), padding.top + chartH);
    ctx.closePath();
    var gradient = ctx.createLinearGradient(0, padding.top, 0, padding.top + chartH);
    gradient.addColorStop(0, 'rgba(230,57,70,0.3)');
    gradient.addColorStop(1, 'rgba(230,57,70,0.02)');
    ctx.fillStyle = gradient;
    ctx.fill();

    // Line
    ctx.beginPath();
    ctx.strokeStyle = '#e63946';
    ctx.lineWidth = 2;
    ctx.lineJoin = 'round';
    data.forEach(function (d, idx) {
      var x = padding.left + (idx * stepX);
      var y = padding.top + chartH - (d.count / maxVal * chartH);
      if (idx === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    });
    ctx.stroke();

    // Dots
    data.forEach(function (d, idx) {
      if (d.count > 0) {
        var x = padding.left + (idx * stepX);
        var y = padding.top + chartH - (d.count / maxVal * chartH);
        ctx.beginPath();
        ctx.arc(x, y, 3, 0, Math.PI * 2);
        ctx.fillStyle = '#e63946';
        ctx.fill();
        ctx.strokeStyle = '#0b0b0f';
        ctx.lineWidth = 2;
        ctx.stroke();
      }
    });
  }

  function drawBarChart(canvas, data, options) {
    var ctx = canvas.getContext('2d');
    var w = canvas.width = canvas.parentElement.offsetWidth;
    var h = canvas.height = options.height || 200;
    var padding = { top: 20, right: 20, bottom: 60, left: 50 };
    var chartW = w - padding.left - padding.right;
    var chartH = h - padding.top - padding.bottom;

    ctx.clearRect(0, 0, w, h);
    if (!data || data.length === 0) return;

    var maxVal = Math.max.apply(null, data.map(function (d) { return d.value; }).concat([1]));
    var barW = Math.min(chartW / data.length * 0.6, 40);
    var gap = chartW / data.length;

    // Grid
    ctx.strokeStyle = '#1f1f28';
    ctx.lineWidth = 1;
    for (var i = 0; i <= 4; i++) {
      var y = padding.top + (chartH * i / 4);
      ctx.beginPath();
      ctx.moveTo(padding.left, y);
      ctx.lineTo(w - padding.right, y);
      ctx.stroke();
      ctx.fillStyle = '#6b6b78';
      ctx.font = '10px system-ui';
      ctx.textAlign = 'right';
      ctx.fillText(Math.round(maxVal * (4 - i) / 4), padding.left - 8, y + 4);
    }

    // Bars
    data.forEach(function (d, idx) {
      var x = padding.left + (idx * gap) + (gap - barW) / 2;
      var barH = (d.value / maxVal) * chartH;
      var barY = padding.top + chartH - barH;

      var gradient = ctx.createLinearGradient(x, barY, x, barY + barH);
      gradient.addColorStop(0, d.color || '#e63946');
      gradient.addColorStop(1, (d.color || '#e63946') + '88');
      ctx.fillStyle = gradient;

      // Rounded top
      var r = Math.min(4, barW / 2);
      ctx.beginPath();
      ctx.moveTo(x + r, barY);
      ctx.lineTo(x + barW - r, barY);
      ctx.quadraticCurveTo(x + barW, barY, x + barW, barY + r);
      ctx.lineTo(x + barW, barY + barH);
      ctx.lineTo(x, barY + barH);
      ctx.lineTo(x, barY + r);
      ctx.quadraticCurveTo(x, barY, x + r, barY);
      ctx.fill();

      // Value on top
      ctx.fillStyle = '#f0f0f0';
      ctx.font = 'bold 11px system-ui';
      ctx.textAlign = 'center';
      ctx.fillText(d.value, x + barW / 2, barY - 6);

      // Label
      ctx.fillStyle = '#6b6b78';
      ctx.font = '10px system-ui';
      ctx.save();
      ctx.translate(x + barW / 2, h - 8);
      ctx.rotate(-0.4);
      ctx.fillText(d.label, 0, 0);
      ctx.restore();
    });
  }

  function drawDonut(canvas, data, options) {
    var ctx = canvas.getContext('2d');
    var size = Math.min(canvas.parentElement.offsetWidth, options.height || 180);
    canvas.width = size;
    canvas.height = size;
    var cx = size / 2;
    var cy = size / 2;
    var outerR = size / 2 - 10;
    var innerR = outerR * 0.6;

    ctx.clearRect(0, 0, size, size);
    if (!data || data.length === 0) return;

    var total = data.reduce(function (s, d) { return s + d.value; }, 0);
    if (total === 0) return;
    var startAngle = -Math.PI / 2;
    var colors = ['#e63946', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];

    data.forEach(function (d, idx) {
      var slice = (d.value / total) * Math.PI * 2;
      ctx.beginPath();
      ctx.arc(cx, cy, outerR, startAngle, startAngle + slice);
      ctx.arc(cx, cy, innerR, startAngle + slice, startAngle, true);
      ctx.closePath();
      ctx.fillStyle = d.color || colors[idx % colors.length];
      ctx.fill();
      startAngle += slice;
    });

    // Center text
    ctx.fillStyle = '#f0f0f0';
    ctx.font = 'bold 18px system-ui';
    ctx.textAlign = 'center';
    ctx.fillText(total, cx, cy + 2);
    ctx.fillStyle = '#6b6b78';
    ctx.font = '10px system-ui';
    ctx.fillText('total', cx, cy + 16);
  }

  /* ----------------------------------------
     REPORT GENERATION
     ---------------------------------------- */
  function generateReport(period) {
    var allLeads = getLeads();
    var current = filterByPeriod(allLeads, period);
    var previous = getPreviousPeriod(allLeads, period);
    var currentMetrics = calcMetrics(current);
    var previousMetrics = calcMetrics(previous);
    var comparison = compareMetrics(currentMetrics, previousMetrics);
    var timeline = getDailyTimeline(current, period);
    var sources = getSourceBreakdown(current);

    return {
      period: period,
      periodLabel: PERIODS[period] ? PERIODS[period].label : period,
      generated: new Date().toISOString(),
      metrics: currentMetrics,
      comparison: comparison,
      timeline: timeline,
      sources: sources
    };
  }

  function generateEmailReport(period) {
    var report = generateReport(period);
    var m = report.metrics;
    var c = report.comparison;

    var html = '<div style="font-family:system-ui,sans-serif;max-width:600px;margin:0 auto;background:#0b0b0f;color:#f0f0f0;padding:32px;border-radius:12px">';
    html += '<h1 style="color:#e63946;font-size:24px;margin-bottom:4px">GA Growth Report</h1>';
    html += '<p style="color:#8a8a95;font-size:14px;margin-bottom:24px">' + report.periodLabel + ' • Generated ' + new Date().toLocaleDateString() + '</p>';

    html += '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:24px">';
    html += '<div style="background:#121216;padding:16px;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:800;color:#3b82f6">' + m.total + '</div><div style="font-size:11px;color:#8a8a95">Total Leads</div><div style="font-size:11px;color:' + (parseInt(c.total.change) >= 0 ? '#22c55e' : '#ef4444') + '">' + c.total.change + '% vs prev</div></div>';
    html += '<div style="background:#121216;padding:16px;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:800;color:#22c55e">' + m.won + '</div><div style="font-size:11px;color:#8a8a95">Deals Won</div><div style="font-size:11px;color:' + (parseInt(c.won.change) >= 0 ? '#22c55e' : '#ef4444') + '">' + c.won.change + '% vs prev</div></div>';
    html += '<div style="background:#121216;padding:16px;border-radius:8px;text-align:center"><div style="font-size:24px;font-weight:800;color:#e63946">' + m.convRate + '%</div><div style="font-size:11px;color:#8a8a95">Conv. Rate</div><div style="font-size:11px;color:' + (parseInt(c.convRate.change) >= 0 ? '#22c55e' : '#ef4444') + '">' + c.convRate.change + '% vs prev</div></div>';
    html += '</div>';

    html += '<h3 style="color:#f0f0f0;font-size:16px;margin-bottom:12px">Pipeline Breakdown</h3>';
    Object.keys(m.byStage).forEach(function (stage) {
      var pct = m.total > 0 ? Math.round((m.byStage[stage] / m.total) * 100) : 0;
      html += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
      html += '<div style="width:100px;font-size:13px;color:#8a8a95">' + stage + '</div>';
      html += '<div style="flex:1;height:8px;background:#1a1a20;border-radius:4px"><div style="height:100%;width:' + pct + '%;background:#e63946;border-radius:4px"></div></div>';
      html += '<div style="width:40px;font-size:12px;text-align:right">' + m.byStage[stage] + '</div>';
      html += '</div>';
    });

    if (report.sources.length > 0) {
      html += '<h3 style="color:#f0f0f0;font-size:16px;margin:20px 0 12px">Top Sources</h3>';
      report.sources.slice(0, 5).forEach(function (s) {
        html += '<div style="display:flex;justify-content:space-between;padding:8px 0;border-bottom:1px solid #1f1f28;font-size:13px">';
        html += '<span>' + s.name + '</span>';
        html += '<span style="color:#8a8a95">' + s.count + ' leads • ' + s.convRate + '% conv</span>';
        html += '</div>';
      });
    }

    html += '<p style="color:#55555f;font-size:11px;margin-top:24px;text-align:center">View full dashboard: <a href="https://web.gabochie.com/admin.html" style="color:#e63946">Open Command Center</a></p>';
    html += '</div>';
    return html;
  }

  /* ----------------------------------------
     SCHEDULED REPORTS
     ---------------------------------------- */
  function sendScheduledReport(period) {
    if (!window.FirebaseService) return Promise.resolve();
    return FirebaseService.settings.get().then(function (settings) {
      var brevoKey = settings && settings.brevoApiKey;
      if (!brevoKey) return;
      var html = generateEmailReport(period);
      return fetch('/api/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipients: [{ email: 'web@gabochie.com', name: 'Web Gabochie' }],
          subject: 'GA ' + (period === '7d' ? 'Weekly' : period === '30d' ? 'Monthly' : 'Daily') + ' Growth Report',
          htmlContent: html,
          apiKey: brevoKey,
          tags: ['report', 'automated']
        })
      });
    });
  }

  return {
    PERIODS: PERIODS,
    generateReport: generateReport,
    generateEmailReport: generateEmailReport,
    sendScheduledReport: sendScheduledReport,
    getDailyTimeline: getDailyTimeline,
    getSourceBreakdown: getSourceBreakdown,
    drawLineChart: drawLineChart,
    drawBarChart: drawBarChart,
    drawDonut: drawDonut,
    getLeads: getLeads,
    filterByPeriod: filterByPeriod,
    calcMetrics: calcMetrics
  };
})();
