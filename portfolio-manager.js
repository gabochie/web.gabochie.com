/* ========================================
   GA PORTFOLIO MANAGER — Site Monitoring
   Dashboard, audit engine, history tracker
   ======================================== */
window.PortfolioManager = (function () {
  'use strict';

  /* ----------------------------------------
     PORTFOLIO SITES
     ---------------------------------------- */
  var SITES = [
    { id: 'trustinfraos', name: 'TrustInfraOS', url: 'https://trustinfraos.com', tag: 'Fintech', color: '#0f172a' },
    { id: 'sporafind', name: 'SporaFind', url: 'https://sporafind.com', tag: 'AI Intelligence', color: '#1a3a2a' },
    { id: 'lutterodt', name: 'Lutterodt', url: 'https://lutterodt.org', tag: 'Heritage', color: '#2a1a2a' },
    { id: 'buildcostgh', name: 'BuildCost GH', url: 'https://buildcostgh.com', tag: 'Construction', color: '#3d2b1f' },
    { id: 'godnology', name: 'Godnology', url: 'https://godnology.org', tag: 'Faith/Tech', color: '#1a1a2e' },
    { id: 'neogh', name: 'NeoGH', url: 'https://neogh.gabochie.com', tag: 'Civic Tech', color: '#0a2540' }
  ];

  var auditHistory = {};
  var currentSite = null;
  var isAuditing = false;

  /* ----------------------------------------
     INIT
     ---------------------------------------- */
  function init() {
    loadHistory();
    renderDashboard();
    wireEvents();
  }

  /* ----------------------------------------
     PERSISTENCE (localStorage)
     ---------------------------------------- */
  function loadHistory() {
    try {
      auditHistory = JSON.parse(localStorage.getItem('ga_portfolio_audits') || '{}');
    } catch (e) { auditHistory = {}; }
  }

  function saveHistory() {
    localStorage.setItem('ga_portfolio_audits', JSON.stringify(auditHistory));
    if (window.FirebaseService && window.FirebaseService.isFirebase()) {
      window.FirebaseService.roadmap.save({ portfolioAudits: auditHistory }).catch(function () {});
    }
  }

  /* ----------------------------------------
     DASHBOARD RENDER
     ---------------------------------------- */
  function renderDashboard() {
    var container = document.getElementById('portfolio-dashboard');
    if (!container) return;

    var html = '<div class="pm-grid">';
    SITES.forEach(function (site) {
      var last = getLastAudit(site.id);
      var score = last ? last.overall : null;
      var scoreClass = getScoreClass(score);
      var timeAgo = last ? getTimeAgo(last.timestamp) : 'Never audited';
      var sslStatus = last && last.ssl && last.ssl.valid ? 'Valid' : 'Unknown';
      var sslIcon = sslStatus === 'Valid' ? '🔒' : '⚠️';
      var ttfb = last && last.metrics ? last.metrics.ttfb + 'ms' : '—';
      var issues = last ? (last.criticalIssues || []).length : 0;

      html += '<div class="pm-card" data-site="' + site.id + '">' +
        '<div class="pm-card-header">' +
          '<div class="pm-card-title">' +
            '<div class="pm-card-dot" style="background:' + site.color + '"></div>' +
            '<div><h3>' + site.name + '</h3><span class="pm-tag">' + site.tag + '</span></div>' +
          '</div>' +
          '<div class="pm-score ' + scoreClass + '">' + (score !== null ? score.toFixed(1) : '—') + '</div>' +
        '</div>' +
        '<div class="pm-score-bar"><div class="pm-score-fill ' + scoreClass + '" style="width:' + (score !== null ? score * 10 : 0) + '%"></div></div>' +
        '<div class="pm-card-meta">' +
          '<span>' + sslIcon + ' SSL: ' + sslStatus + '</span>' +
          '<span>⚡ TTFB: ' + ttfb + '</span>' +
          '<span>' + (issues > 0 ? '🔴 ' + issues + ' critical' : '✅ No critical') + '</span>' +
        '</div>' +
        '<div class="pm-card-footer">' +
          '<span class="pm-time">Last: ' + timeAgo + '</span>' +
          '<button class="pm-audit-btn" data-site="' + site.id + '">🔍 Run Audit</button>' +
        '</div>' +
      '</div>';
    });
    html += '</div>';

    // Detail view (hidden by default)
    html += '<div id="pm-detail" class="pm-detail" style="display:none"></div>';

    container.innerHTML = html;
  }

  /* ----------------------------------------
     RUN AUDIT
     ---------------------------------------- */
  function runAudit(siteId) {
    if (isAuditing) return;
    var site = SITES.find(function (s) { return s.id === siteId; });
    if (!site) return;

    isAuditing = true;
    var btn = document.querySelector('.pm-audit-btn[data-site="' + siteId + '"]');
    if (btn) { btn.textContent = '⏳ Auditing...'; btn.disabled = true; }

    var statusEl = document.getElementById('pm-status');
    if (statusEl) statusEl.textContent = 'Auditing ' + site.name + '...';

    fetch('/api/site-audit', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: site.url })
    })
    .then(function (r) { return r.json(); })
    .then(function (result) {
      // Store audit
      if (!auditHistory[siteId]) auditHistory[siteId] = [];
      auditHistory[siteId].unshift(result);
      if (auditHistory[siteId].length > 50) auditHistory[siteId] = auditHistory[siteId].slice(0, 50);
      saveHistory();

      isAuditing = false;
      if (btn) { btn.textContent = '🔍 Run Audit'; btn.disabled = false; }
      if (statusEl) statusEl.textContent = site.name + ' audit complete — Score: ' + result.overall;

      renderDashboard();
      showDetail(siteId);

      if (window.showToast) window.showToast('Audit complete: ' + site.name + ' — ' + result.overall + '/10');
    })
    .catch(function (err) {
      isAuditing = false;
      if (btn) { btn.textContent = '🔍 Run Audit'; btn.disabled = false; }
      if (statusEl) statusEl.textContent = 'Audit failed: ' + err.message;
    });
  }

  function runAllAudits() {
    if (isAuditing) return;
    var index = 0;
    function next() {
      if (index >= SITES.length) {
        renderDashboard();
        return;
      }
      var site = SITES[index];
      index++;
      runAudit(site.id);
      setTimeout(next, 3000);
    }
    next();
  }

  /* ----------------------------------------
     DETAIL VIEW
     ---------------------------------------- */
  function showDetail(siteId) {
    currentSite = siteId;
    var site = SITES.find(function (s) { return s.id === siteId; });
    var audits = auditHistory[siteId] || [];
    var latest = audits[0];
    var container = document.getElementById('pm-detail');
    if (!container || !latest) return;

    container.style.display = 'block';

    var html = '<div class="pm-detail-header">' +
      '<button class="pm-back-btn" id="pm-back-btn">← Back to Dashboard</button>' +
      '<h2>' + site.name + '</h2>' +
      '<span class="pm-detail-url">' + site.url + '</span>' +
    '</div>';

    // Score overview
    html += '<div class="pm-score-row">' +
      '<div class="pm-score-big ' + getScoreClass(latest.overall) + '">' + latest.overall.toFixed(1) + '<span>/10</span></div>' +
      '<div class="pm-score-categories">';

    var catNames = {
      performance: 'Performance', security: 'Security', accessibility: 'Accessibility',
      seo: 'SEO', codeQuality: 'Code Quality', mobile: 'Mobile',
      errorHandling: 'Error Handling', analytics: 'Analytics', forms: 'Forms', links: 'Links'
    };

    Object.keys(latest.categories || {}).forEach(function (key) {
      var cat = latest.categories[key];
      var name = catNames[key] || key;
      html += '<div class="pm-cat-row">' +
        '<span class="pm-cat-name">' + name + '</span>' +
        '<div class="pm-cat-bar"><div class="pm-cat-fill ' + getScoreClass(cat.score) + '" style="width:' + (cat.score * 10) + '%"></div></div>' +
        '<span class="pm-cat-score ' + getScoreClass(cat.score) + '">' + cat.score + '</span>' +
      '</div>';
    });
    html += '</div></div>';

    // Metrics
    if (latest.metrics) {
      html += '<div class="pm-metrics">' +
        '<div class="pm-metric"><span class="pm-metric-val">' + latest.metrics.ttfb + 'ms</span><span class="pm-metric-label">TTFB</span></div>' +
        '<div class="pm-metric"><span class="pm-metric-val">' + latest.metrics.htmlSize + '</span><span class="pm-metric-label">HTML Size</span></div>' +
        '<div class="pm-metric"><span class="pm-metric-val">' + latest.metrics.statusCode + '</span><span class="pm-metric-label">Status</span></div>' +
        '<div class="pm-metric"><span class="pm-metric-val">' + (latest.metrics.jsCount || '—') + '</span><span class="pm-metric-label">JS Files</span></div>' +
        '<div class="pm-metric"><span class="pm-metric-val">' + (latest.metrics.cssCount || '—') + '</span><span class="pm-metric-label">CSS Files</span></div>' +
      '</div>';
    }

    // Quick Wins
    if (latest.quickWins && latest.quickWins.length > 0) {
      html += '<div class="pm-section"><h3>🎯 Quick Wins</h3><div class="pm-wins">';
      latest.quickWins.forEach(function (w) {
        html += '<div class="pm-win ' + w.priority + '">' +
          '<span class="pm-win-sev">' + w.priority.toUpperCase() + '</span>' +
          '<div><strong>' + w.text + '</strong>' +
          (w.detail ? '<p>' + w.detail + '</p>' : '') +
          '</div></div>';
      });
      html += '</div></div>';
    }

    // Critical Issues
    if (latest.criticalIssues && latest.criticalIssues.length > 0) {
      html += '<div class="pm-section"><h3>🔴 Critical Issues (' + latest.criticalIssues.length + ')</h3><div class="pm-issues">';
      latest.criticalIssues.forEach(function (i) {
        html += '<div class="pm-issue critical">' +
          '<span class="pm-issue-cat">' + i.category + '</span>' +
          '<strong>' + i.text + '</strong>' +
          (i.detail ? '<p>' + i.detail + '</p>' : '') +
        '</div>';
      });
      html += '</div></div>';
    }

    // All Issues
    var nonCritical = (latest.allIssues || []).filter(function (i) { return i.severity !== 'critical'; });
    if (nonCritical.length > 0) {
      html += '<div class="pm-section"><h3>⚠️ All Issues (' + nonCritical.length + ')</h3><div class="pm-issues">';
      nonCritical.slice(0, 20).forEach(function (i) {
        html += '<div class="pm-issue ' + i.severity + '">' +
          '<span class="pm-sev sev-' + i.severity + '">' + i.severity + '</span>' +
          '<span class="pm-issue-cat">' + i.category + '</span>' +
          '<strong>' + i.text + '</strong>' +
        '</div>';
      });
      if (nonCritical.length > 20) html += '<p class="pm-more">...and ' + (nonCritical.length - 20) + ' more</p>';
      html += '</div></div>';
    }

    // Strengths
    if (latest.strengths && latest.strengths.length > 0) {
      html += '<div class="pm-section"><h3>✅ Strengths (' + latest.strengths.length + ')</h3><div class="pm-strengths">';
      latest.strengths.forEach(function (s) {
        html += '<div class="pm-strength">' + s.text + '</div>';
      });
      html += '</div></div>';
    }

    // Audit History
    if (audits.length > 1) {
      html += '<div class="pm-section"><h3>📈 Score History</h3><div class="pm-history">';
      audits.slice(0, 10).forEach(function (a) {
        var d = new Date(a.timestamp);
        html += '<div class="pm-history-row">' +
          '<span class="pm-history-date">' + d.toLocaleDateString() + ' ' + d.toLocaleTimeString() + '</span>' +
          '<div class="pm-history-bar"><div class="pm-history-fill ' + getScoreClass(a.overall) + '" style="width:' + (a.overall * 10) + '%"></div></div>' +
          '<span class="pm-history-score ' + getScoreClass(a.overall) + '">' + a.overall + '</span>' +
        '</div>';
      });
      html += '</div></div>';
    }

    container.innerHTML = html;

    // Wire back button
    var backBtn = document.getElementById('pm-back-btn');
    if (backBtn) {
      backBtn.addEventListener('click', function () {
        container.style.display = 'none';
        currentSite = null;
      });
    }

    container.scrollIntoView({ behavior: 'smooth' });
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function getLastAudit(siteId) {
    var audits = auditHistory[siteId] || [];
    return audits[0] || null;
  }

  function getScoreClass(score) {
    if (score === null || score === undefined) return 'score-unknown';
    if (score >= 8) return 'score-excellent';
    if (score >= 6) return 'score-good';
    if (score >= 4) return 'score-fair';
    return 'score-poor';
  }

  function getTimeAgo(timestamp) {
    var diff = Date.now() - timestamp;
    var mins = Math.floor(diff / 60000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return mins + 'm ago';
    var hours = Math.floor(mins / 60);
    if (hours < 24) return hours + 'h ago';
    var days = Math.floor(hours / 24);
    return days + 'd ago';
  }

  /* ----------------------------------------
     EVENTS
     ---------------------------------------- */
  function wireEvents() {
    document.addEventListener('click', function (e) {
      // Audit single site
      if (e.target.classList.contains('pm-audit-btn')) {
        var siteId = e.target.getAttribute('data-site');
        if (siteId) runAudit(siteId);
      }
      // Click card to show detail
      if (e.target.closest('.pm-card')) {
        var card = e.target.closest('.pm-card');
        var sid = card.getAttribute('data-site');
        if (sid && !e.target.classList.contains('pm-audit-btn')) {
          showDetail(sid);
        }
      }
    });
  }

  /* ----------------------------------------
     EXPORT
     ---------------------------------------- */
  function exportReport(siteId) {
    var audits = auditHistory[siteId] || [];
    var latest = audits[0];
    if (!latest) return;

    var site = SITES.find(function (s) { return s.id === siteId; });
    var blob = new Blob([JSON.stringify({ site: site, audit: latest }, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = siteId + '-audit-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
  }

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  return {
    init: init,
    SITES: SITES,
    runAudit: runAudit,
    runAllAudits: runAllAudits,
    showDetail: showDetail,
    exportReport: exportReport,
    getHistory: function () { return auditHistory; }
  };
})();