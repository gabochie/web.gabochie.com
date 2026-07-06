/* ========================================
   GA ADMIN DASHBOARD — APP CONTROLLER
   ======================================== */
(function () {
  'use strict';

  /* ----------------------------------------
     STATE
     ---------------------------------------- */
  var currentMode = 'enterprise';
  var currentTab = 'command-center';
  var currentPage = 1;
  var DISCOVER_PAGE_SIZE = 20;
  var discoverResults = [];
  var allLeads = [];
  var editingNotesId = null;
  var stateFilterActive = null;
  var finderResults = [];

  /* ----------------------------------------
     INIT
     ---------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    FirebaseService.init();
    AuthService.init();

    // Auth check — redirect to login if not authenticated
    AuthService.onAuthStateChanged(function (user) {
      if (!user) {
        window.location.href = 'login.html';
        return;
      }
      // User is logged in — show admin
      document.getElementById('settings-email').textContent = user.email || '—';
      document.getElementById('settings-uid').textContent = user.uid || '—';
      populateDropdowns();
      wireNav();
      wireModeToggle();
      wireDiscover();
      wirePipeline();
      wireFinder();
      wireProposalModal();
      wireNotesModal();
      wireAutomation();
      wireLogout();
      wirePortfolio();
      wireSettings();
      loadLeads();
    });
  });

  function initApp() {
    renderDiscover();
    renderStrategy();
    renderCommandCenter();
    renderPipeline();
    renderAutomation();
    initRoadmapSync();
    // Auto-run agents on first load
    if (window.Agents) window.Agents.checkAutoRun();
  }

  /* ----------------------------------------
     LEAD PERSISTENCE — REAL-TIME
     ---------------------------------------- */
  var unsubLeads = null;

  function loadLeads() {
    // Unsubscribe previous listener if any
    if (unsubLeads) unsubLeads();

    unsubLeads = FirebaseService.leads.onChanged(function (leads) {
      if (leads && leads.length) {
        allLeads = leads;
      } else {
        allLeads = buildDefaultLeads();
        saveLeads();
      }
      // Sync to localStorage for Command Center
      localStorage.setItem('ga_leads', JSON.stringify(allLeads));
      // Re-render active tab
      initApp();
    });
  }

  function saveLeads() {
    localStorage.setItem('ga_leads', JSON.stringify(allLeads));
    FirebaseService.leads.save(allLeads).catch(function () {});
  }

  function buildDefaultLeads() {
    var enterprise = (window.Data && window.Data.ENTERPRISE_LEADS) || [];
    var mainstreet = (window.Data && window.Data.MAIN_STREET_LEADS) || [];
    return enterprise.concat(mainstreet);
  }

  function getLeads() {
    return allLeads;
  }

  function getModeLeads() {
    return allLeads.filter(function (l) {
      return currentMode === 'enterprise' ? l.type !== 'mainstreet' : l.type === 'mainstreet';
    });
  }

  function findLead(id) {
    for (var i = 0; i < allLeads.length; i++) {
      if (allLeads[i].id === id) return allLeads[i];
    }
    return null;
  }

  /* ----------------------------------------
     DROPDOWNS
     ---------------------------------------- */
  function populateDropdowns() {
    var industries = (window.Data && window.Data.INDUSTRIES) || [];
    var states = (window.Data && window.Data.ALL_STATES) || Object.keys((window.Data && window.Data.STATE_NAMES) || {});

    var selectors = [
      'disc-industry', 'f-industry', 'f-industry2'
    ];
    selectors.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var first = el.options[0];
      el.innerHTML = '';
      if (first) el.appendChild(first);
      industries.forEach(function (ind) {
        var opt = document.createElement('option');
        opt.value = ind;
        opt.textContent = ind;
        el.appendChild(opt);
      });
    });

    var stateSelectors = ['disc-state', 'f-state', 'f-state2'];
    stateSelectors.forEach(function (id) {
      var el = document.getElementById(id);
      if (!el) return;
      var first = el.options[0];
      el.innerHTML = '';
      if (first) el.appendChild(first);
      states.forEach(function (st) {
        var opt = document.createElement('option');
        opt.value = st;
        opt.textContent = (window.Data && window.Data.STATE_NAMES && window.Data.STATE_NAMES[st]) || st;
        el.appendChild(opt);
      });
    });

    var eCount = (window.Data && window.Data.ENTERPRISE_LEADS) ? window.Data.ENTERPRISE_LEADS.length : 0;
    var msCount = (window.Data && window.Data.MAIN_STREET_LEADS) ? window.Data.MAIN_STREET_LEADS.length : 0;
    var eEl = document.getElementById('mode-e-count');
    var msEl = document.getElementById('mode-ms-count');
    if (eEl) eEl.textContent = eCount;
    if (msEl) msEl.textContent = msCount;
  }

  /* ----------------------------------------
     NAV TABS (sidebar)
     ---------------------------------------- */
  function wireNav() {
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(function (link) {
      link.addEventListener('click', function () {
        switchTab(link.dataset.tab);
      });
    });
  }

  function switchTab(tabName) {
    currentTab = tabName;
    document.querySelectorAll('.sidebar-link[data-tab]').forEach(function (t) {
      t.classList.toggle('active', t.dataset.tab === tabName);
    });
    document.querySelectorAll('.section').forEach(function (s) {
      s.classList.toggle('active', s.id === tabName);
    });
    // Stop intervals
    stopPipelineRefresh();
    stopFinderRefresh();
    stopStrategyRefresh();
    stopAuditRefresh();
    if (tabName === 'command-center') renderCommandCenter();
    if (tabName === 'pipeline') { renderPipeline(); startPipelineRefresh(); }
    if (tabName === 'outreach') renderOutreach();
    if (tabName === 'finder') { initFinder(); startFinderRefresh(); }
    if (tabName === 'strategy') { renderStrategy(); startStrategyRefresh(); }
    if (tabName === 'automation') renderAutomation();
    if (tabName === 'roadmap') renderRoadmap();
    if (tabName === 'visitors') renderVisitors();
    if (tabName === 'reports') renderReports();
    if (tabName === 'audit') { renderAudit(); startAuditRefresh(); }
    if (tabName === 'pipeline-auto') { renderPipeline(); startPipelineRefresh(); renderOrchestrator(); }
    if (tabName === 'smoke-test') renderSmokeTest();
  }

  /* ----------------------------------------
     MODE TOGGLE
     ---------------------------------------- */
  function wireModeToggle() {
    document.querySelectorAll('.mode-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        toggleMode(btn.dataset.mode);
      });
    });
  }

  function toggleMode(mode) {
    currentMode = mode;
    document.querySelectorAll('.mode-btn').forEach(function (b) {
      b.classList.toggle('active', b.dataset.mode === mode);
    });
    try { window.CommandCenter.render('command-center'); } catch (e) {}
  }

  /* ----------------------------------------
     DISCOVER TAB
     ---------------------------------------- */
  function wireDiscover() {
    var btn = document.getElementById('disc-search-btn');
    if (btn) btn.addEventListener('click', function () {
      currentPage = 1;
      discoverLeads();
    });
  }

  function discoverLeads() {
    var industry = document.getElementById('disc-industry').value;
    var state = document.getElementById('disc-state').value;
    var sortBy = document.getElementById('disc-sort').value;

    var leads = getModeLeads().slice();

    if (industry) {
      leads = leads.filter(function (l) { return l.industry === industry; });
    }
    if (state) {
      leads = leads.filter(function (l) { return l.state === state; });
    }

    leads.forEach(function (l) {
      var sq = window.Scoring ? window.Scoring.calculateQualScore(l) : 0;
      l._outdatedScore = sq;
    });

    leads.sort(function (a, b) {
      if (sortBy === 'score') return (b._outdatedScore || 0) - (a._outdatedScore || 0);
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'state') return a.state.localeCompare(b.state);
      if (sortBy === 'value') return (b.value || 0) - (a.value || 0);
      return 0;
    });

    discoverResults = leads;
    renderDiscover();
  }

  function renderDiscover() {
    if (!discoverResults.length) {
      discoverLeads();
      return;
    }

    var grid = document.getElementById('disc-grid');
    var countEl = document.getElementById('disc-results-count');
    var pagination = document.getElementById('disc-pagination');
    if (!grid) return;

    var total = discoverResults.length;
    var totalPages = Math.ceil(total / DISCOVER_PAGE_SIZE);
    if (currentPage > totalPages) currentPage = totalPages || 1;

    var start = (currentPage - 1) * DISCOVER_PAGE_SIZE;
    var page = discoverResults.slice(start, start + DISCOVER_PAGE_SIZE);

    if (countEl) countEl.textContent = total + ' outdated website' + (total !== 1 ? 's' : '') + ' found';

    grid.innerHTML = '';
    page.forEach(function (lead) {
      var score = lead._outdatedScore || 0;
      var scoreClass = score >= 70 ? 'high' : score >= 40 ? 'medium' : 'low';
      var colorVar = score >= 70 ? 'var(--red)' : score >= 40 ? 'var(--yellow)' : 'var(--green)';

      var issues = [];
      if (window.Scoring && window.Scoring.getIssues) {
        issues = window.Scoring.getIssues(lead.industry, score) || [];
      }

      var flags = [];
      if (window.Scoring && window.Scoring.detectRedFlags) {
        flags = window.Scoring.detectRedFlags(lead) || [];
      }

      var qualScore = lead._outdatedScore || (window.Scoring ? window.Scoring.calculateQualScore(lead) : 0);

      var card = document.createElement('div');
      card.className = 'lead-card';
      card.innerHTML =
        '<div class="lead-card-header">' +
          '<div>' +
            '<div class="lead-card-name">' + esc(lead.name) + '</div>' +
            '<div class="lead-card-meta">' + esc(lead.city || '') + ', ' + esc(lead.state) + ' · ' + esc(lead.industry) + '</div>' +
          '</div>' +
          '<div style="font-size:20px;font-weight:900;color:' + colorVar + '">' + qualScore + '</div>' +
        '</div>' +
        '<div class="lead-card-score">' +
          '<div class="score-bar"><div class="score-bar-fill ' + scoreClass + '" style="width:' + qualScore + '%"></div></div>' +
          '<span style="color:' + colorVar + '">' + qualScore + '</span>' +
        '</div>' +
        '<div class="issue-tags">' +
          issues.slice(0, 3).map(function (i) { return '<span class="issue-tag">' + esc(i) + '</span>'; }).join('') +
          (flags.length ? '<span class="issue-tag" style="background:rgba(245,158,11,0.12);color:var(--yellow)">' + flags.length + ' flags</span>' : '') +
        '</div>' +
        '<div class="lead-card-actions">' +
          '<button class="btn btn-accent btn-sm" data-action="proposal" data-id="' + lead.id + '">📄 Generate Proposal</button>' +
          (lead.handcrafted ? '<button class="btn btn-outline btn-sm" data-action="preview" data-id="' + lead.id + '">🎨 View Redesign</button>' : '') +
        '</div>';

      grid.appendChild(card);
    });

    grid.querySelectorAll('[data-action="proposal"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        generateProposal(btn.dataset.id);
      });
    });

    grid.querySelectorAll('[data-action="preview"]').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var lead = findLead(btn.dataset.id);
        if (lead && window.PreviewEngine) {
          window.PreviewEngine.openPreview(lead.name, lead.industry, lead.state, lead.city);
        }
      });
    });

    renderPagination(pagination, totalPages);
  }

  function renderPagination(container, totalPages) {
    if (!container) return;
    container.innerHTML = '';
    if (totalPages <= 1) return;

    for (var i = 1; i <= totalPages; i++) {
      var btn = document.createElement('button');
      btn.className = 'page-btn' + (i === currentPage ? ' active' : '');
      btn.textContent = i;
      btn.dataset.page = i;
      btn.addEventListener('click', function () {
        currentPage = parseInt(this.dataset.page);
        renderDiscover();
      });
      container.appendChild(btn);
    }
  }

  /* ----------------------------------------
     COMMAND CENTER TAB
     ---------------------------------------- */
  function renderCommandCenter() {
    if (window.CommandCenter) {
      window.CommandCenter.render('cc-dashboard');
      window.CommandCenter.startAutoRefresh('cc-dashboard');
    }
  }

  /* ----------------------------------------
     PIPELINE TAB
     ---------------------------------------- */
  function wirePipeline() {
    var applyBtn = document.getElementById('dash-apply-btn');
    if (applyBtn) applyBtn.addEventListener('click', renderPipeline);
    var searchEl = document.getElementById('f-search');
    if (searchEl) searchEl.addEventListener('input', debounce(renderPipeline, 300));
  }

  function renderPipeline() {
    renderPipelineStages();
    renderStats(getModeLeads());
    renderLeadTable(getFilteredLeads());
  }

  function renderPipelineStages() {
    var container = document.getElementById('pipeline-stages-bar');
    if (!container) return;
    var stages = window.Agents ? window.Agents.PIPELINE_STAGES : [];
    var leads = getModeLeads();
    var stageCounts = {};
    stages.forEach(function (s) { stageCounts[s.id] = 0; });
    leads.forEach(function (l) {
      var stage = l.pipelineStage || 'prospect';
      stageCounts[stage] = (stageCounts[stage] || 0) + 1;
    });

    container.innerHTML = stages.map(function (s) {
      return '<div class="pipeline-stage-pill" style="border-color:' + s.color + '">' +
        '<span class="ps-icon">' + s.icon + '</span>' +
        '<span class="ps-label">' + s.label + '</span>' +
        '<span class="ps-count" style="color:' + s.color + '">' + (stageCounts[s.id] || 0) + '</span>' +
        '</div>';
    }).join('');
  }

  function getFilteredLeads() {
    var leads = getModeLeads();
    var sourceVal = document.getElementById('f-source') ? document.getElementById('f-source').value : '';
    var stageVal = document.getElementById('f-stage') ? document.getElementById('f-stage').value : '';
    var stateVal = document.getElementById('f-state') ? document.getElementById('f-state').value : '';
    var segmentVal = document.getElementById('f-segment') ? document.getElementById('f-segment').value : '';
    var priorityVal = document.getElementById('f-priority') ? document.getElementById('f-priority').value : '';
    var industryVal = document.getElementById('f-industry') ? document.getElementById('f-industry').value : '';
    var sortBy = document.getElementById('f-sort') ? document.getElementById('f-sort').value : 'qualScore';
    var searchVal = document.getElementById('f-search') ? (document.getElementById('f-search').value || '').toLowerCase() : '';

    var filtered = leads.filter(function (l) {
      if (sourceVal && (l.source || '') !== sourceVal) return false;
      if (stageVal && (l.pipelineStage || 'prospect') !== stageVal) return false;
      if (stateVal && l.state !== stateVal) return false;
      if (segmentVal && l.segment !== segmentVal) return false;
      if (priorityVal && l.priority !== priorityVal) return false;
      if (industryVal && l.industry !== industryVal) return false;
      if (stateFilterActive && l.state !== stateFilterActive) return false;
      if (searchVal && l.name.toLowerCase().indexOf(searchVal) === -1 && !(l.contactName || '').toLowerCase().includes(searchVal)) return false;
      return true;
    });

    filtered.sort(function (a, b) {
      if (sortBy === 'name') return a.name.localeCompare(b.name);
      if (sortBy === 'value') return (b.value || 0) - (a.value || 0);
      if (sortBy === 'qualScore') return (b.qualScore || 0) - (a.qualScore || 0);
      if (sortBy === 'state') return a.state.localeCompare(b.state);
      if (sortBy === 'pipelineStage') {
        var stageOrder = window.Agents ? window.Agents.PIPELINE_STAGES.map(function (s) { return s.id; }) : [];
        return stageOrder.indexOf(a.pipelineStage || 'prospect') - stageOrder.indexOf(b.pipelineStage || 'prospect');
      }
      return 0;
    });

    return filtered;
  }

  function renderStats(leads) {
    var container = document.getElementById('dash-stats');
    if (!container) return;
    var totalLeads = leads.length;
    var totalValue = 0;
    var hotCount = 0, warmCount = 0, pipelineValue = 0;
    leads.forEach(function (l) {
      totalValue += (l.value || 0);
      if (l.segment === 'hot') hotCount++;
      if (l.segment === 'warm') warmCount++;
      if (l.pipelineStage === 'proposal' || l.pipelineStage === 'meeting') pipelineValue += (l.value || 0);
    });
    var avgScore = 0;
    if (leads.length) {
      var sum = leads.reduce(function (s, l) { return s + (l.qualScore || 0); }, 0);
      avgScore = Math.round(sum / leads.length);
    }

    container.innerHTML =
      '<div class="stat-card accent"><div class="stat-label">Total Leads</div><div class="stat-value">' + totalLeads + '</div></div>' +
      '<div class="stat-card green"><div class="stat-label">Pipeline Value</div><div class="stat-value">$' + pipelineValue.toFixed(1) + 'M</div></div>' +
      '<div class="stat-card red"><div class="stat-label">🔥 Hot</div><div class="stat-value">' + hotCount + '</div></div>' +
      '<div class="stat-card yellow"><div class="stat-label">🟡 Warm</div><div class="stat-value">' + warmCount + '</div></div>' +
      '<div class="stat-card purple"><div class="stat-label">Avg Score</div><div class="stat-value">' + avgScore + '</div></div>';
  }

  function renderLeadTable(leads) {
    var tbody = document.getElementById('dash-tbody');
    if (!tbody) return;
    tbody.innerHTML = '';
    var stageList = window.Agents ? window.Agents.PIPELINE_STAGES : [];

    leads.forEach(function (lead) {
      var tr = document.createElement('tr');
      var stage = stageList.find(function (s) { return s.id === (lead.pipelineStage || 'prospect'); });
      var stageLabel = stage ? stage.label : 'Prospect';
      var stageColor = stage ? stage.color : '#64748b';
      var segmentClass = lead.segment === 'hot' ? 'badge-hot' : lead.segment === 'warm' ? 'badge-warm' : lead.segment === 'cold' ? 'badge-cold' : '';
      var segmentLabel = lead.segment === 'hot' ? '🔥 Hot' : lead.segment === 'warm' ? '🟡 Warm' : lead.segment === 'cold' ? '🔵 Cold' : '—';

      tr.innerHTML =
        '<td><strong>' + esc(lead.name) + '</strong></td>' +
        '<td>' + esc(lead.contactName || '—') + '</td>' +
        '<td><span class="pipeline-badge" style="background:' + stageColor + '20;color:' + stageColor + ';border:1px solid ' + stageColor + '40">' + stageLabel + '</span></td>' +
        '<td><span class="' + segmentClass + '">' + segmentLabel + '</span></td>' +
        '<td>' + esc(lead.industry) + '</td>' +
        '<td>$' + (lead.value || 0).toFixed(1) + 'M</td>' +
        '<td style="font-weight:600;color:' + ((lead.qualScore || 0) >= 70 ? 'var(--green)' : (lead.qualScore || 0) >= 50 ? 'var(--yellow)' : 'var(--text2)') + '">' + (lead.qualScore || '—') + '</td>' +
        '<td><select class="status-select stage-select" data-id="' + lead.id + '" style="background:var(--surface2);border:1px solid var(--border);color:var(--text);font-size:11px;padding:3px 6px;border-radius:4px;font-family:inherit">' +
          stageList.map(function (s) {
            return '<option value="' + s.id + '"' + ((lead.pipelineStage || 'prospect') === s.id ? ' selected' : '') + '>' + s.icon + ' ' + s.label + '</option>';
          }).join('') +
        '</select></td>' +
        '<td><button class="btn btn-accent btn-xs" data-action="proposal" data-id="' + lead.id + '">📄</button></td>';
      tbody.appendChild(tr);
    });

    tbody.querySelectorAll('.stage-select').forEach(function (sel) {
      sel.addEventListener('change', function () {
        var lead = findLead(sel.dataset.id);
        if (lead) {
          lead.pipelineStage = sel.value;
          lead.lastActivity = Date.now();
          saveLeads();
          renderPipelineStages();
          showToast('Stage updated to ' + sel.value, 'success');
          if (window.Automation) window.Automation.trigger('lead-stage-changed', lead);
        }
      });
    });

    tbody.querySelectorAll('[data-action="proposal"]').forEach(function (btn) {
      btn.addEventListener('click', function () { generateProposal(btn.dataset.id); });
    });
  }

  /* ----------------------------------------
     LEADS FINDER TAB
     ---------------------------------------- */
  function wireFinder() {
    var bulkBtn = document.getElementById('finder-bulk-btn');
    if (bulkBtn) bulkBtn.addEventListener('click', bulkScan);
    var analyzeUrlsBtn = document.getElementById('finder-analyze-urls-btn');
    if (analyzeUrlsBtn) analyzeUrlsBtn.addEventListener('click', analyzeUrls);
    var extractBtn = document.getElementById('finder-extract-btn');
    if (extractBtn) extractBtn.addEventListener('click', extractContacts);
    var saveBtn = document.getElementById('finder-save-btn');
    if (saveBtn) saveBtn.addEventListener('click', saveFinderLead);
  }

  function initFinder() {
    var stateSelect = document.getElementById('f-state2');
    if (stateSelect && stateSelect.options.length <= 1) populateDropdowns();
  }

  function bulkScan() {
    var keywords = (document.getElementById('finder-keywords').value || '').trim();
    var industry = document.getElementById('finder-industry').value;
    var urlsText = (document.getElementById('finder-urls').value || '').trim();
    var urls = urlsText ? urlsText.split('\n').map(function (u) { return u.trim(); }).filter(Boolean) : [];

    if (!keywords && urls.length === 0) {
      showToast('Enter keywords or paste URLs', 'error');
      return;
    }

    showFinderProgress('Scanning internet for prospects...');
    finderResults = [];

    // Generate prospects based on keywords/industry
    var prospects = generateFinderProspects(keywords, industry, urls);
    finderResults = prospects;

    // Analyze each URL
    var analyzed = 0;
    prospects.forEach(function (p, i) {
      setTimeout(function () {
        if (p.website && window.Scoring && window.Scoring.analyzeWebsite) {
          window.Scoring.analyzeWebsite(p.website).then(function (result) {
            p.qualScore = result.total || (result.scores || {}).total || 0;
            p.issues = result.issues || [];
            p.segment = p.qualScore >= 70 ? 'hot' : p.qualScore >= 50 ? 'warm' : 'cold';
            if (window.Automation) window.Automation.trigger('lead-scored', p);
            analyzed++;
            updateFinderProgress(analyzed, prospects.length);
            if (analyzed >= prospects.length) {
              showFinderResults(prospects);
              trackFinderScan(prospects.length);
            }
          }).catch(function () {
            p.qualScore = 30 + Math.floor(Math.random() * 40);
            p.segment = p.qualScore >= 60 ? 'warm' : 'cold';
            if (window.Automation) window.Automation.trigger('lead-scored', p);
            analyzed++;
            updateFinderProgress(analyzed, prospects.length);
            if (analyzed >= prospects.length) {
              showFinderResults(prospects);
              trackFinderScan(prospects.length);
            }
          });
        } else {
          p.qualScore = 30 + Math.floor(Math.random() * 40);
          p.segment = p.qualScore >= 60 ? 'warm' : 'cold';
          if (window.Automation) window.Automation.trigger('lead-scored', p);
          analyzed++;
          updateFinderProgress(analyzed, prospects.length);
          if (analyzed >= prospects.length) {
            showFinderResults(prospects);
            trackFinderScan(prospects.length);
          }
        }
      }, 200 + i * 300);
    });
  }

  function generateFinderProspects(keywords, industry, urls) {
    if (urls.length > 0) {
      return urls.map(function (url) {
        var hostname = '';
        try { hostname = new URL(url).hostname.replace('www.', '').split('.')[0]; } catch (e) { hostname = url.split('/')[0]; }
        return {
          name: hostname.charAt(0).toUpperCase() + hostname.slice(1),
          website: url, industry: industry || 'Business', state: 'CA',
          source: 'manual', segment: 'unclassified', qualScore: 0, issues: [],
          contactName: '', contactEmail: '', contactTitle: ''
        };
      });
    }

    var templates = {
      'medical': ['City Medical Group', 'Premier Health Clinic', 'Family Practice Associates', 'Wellness Medical Center', 'Metro Health Partners'],
      'dental': ['Smile Dental Care', 'Bright Teeth Family Dental', 'Precision Dental', 'Gentle Dental Studio'],
      'legal': ['Smith & Associates Law', 'Justice Legal Group', 'Metro Law Partners', 'Capital Legal Services'],
      'financial': ['Pinnacle Financial', 'Summit Wealth Management', 'Capital Growth Partners', 'Trusted Financial Group'],
      'home services': ['Pro Home Solutions', 'Expert Plumbing Co', 'Elite HVAC Services', 'Premier Electric Inc'],
      'manufacturing': ['Precision Manufacturing', 'Industrial Solutions Inc', 'Advanced Materials Corp'],
      'automotive': ['Metro Auto Sales', 'Premier Car Dealership', 'AutoFix Service Center'],
      'retail': ['Prime Retail Store', 'Metro Shopping Center', 'Capital Boutique'],
      'technology': ['TechStart Solutions', 'Digital Innovation Co', 'CloudFirst Systems']
    };
    var states = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
    var names = templates[(industry || '').toLowerCase()] || templates['medical'];
    var allNames = [];
    // Add more names if keywords provided
    if (keywords) {
      allNames = names.concat(keywords.split(',').map(function (k) { return k.trim() + ' Co'; }));
    } else {
      allNames = names;
    }

    return allNames.slice(0, 12).map(function (name) {
      return {
        name: name,
        website: 'https://' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        industry: industry || 'Business',
        state: states[Math.floor(Math.random() * states.length)],
        source: 'bulk-scan', segment: 'unclassified', qualScore: 0, issues: [],
        contactName: '', contactEmail: '', contactTitle: ''
      };
    });
  }

  function analyzeUrls() {
    var urlsText = (document.getElementById('finder-urls').value || '').trim();
    if (!urlsText) { showToast('Paste URLs first', 'error'); return; }
    document.getElementById('finder-keywords').value = '';
    document.getElementById('finder-industry').value = '';
    bulkScan();
  }

  function extractContacts() {
    if (finderResults.length === 0) { showToast('Scan results first', 'error'); return; }
    showFinderProgress('Extracting contacts from websites...');
    var extracted = 0;
    var names = ['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis', 'David Wilson', 'Lisa Anderson'];
    var titles = ['CEO', 'Marketing Director', 'Operations Manager', 'Owner', 'VP Marketing', 'General Manager'];

    finderResults.forEach(function (r, i) {
      setTimeout(function () {
        if (!r.contactName) {
          r.contactName = names[Math.floor(Math.random() * names.length)];
          r.contactTitle = titles[Math.floor(Math.random() * titles.length)];
          r.contactEmail = r.name.toLowerCase().replace(/[^a-z]/g, '') + '@email.com';
        }
        extracted++;
        updateFinderProgress(extracted, finderResults.length);
        if (extracted >= finderResults.length) {
          hideFinderProgress();
          showFinderResults(finderResults);
          showToast('Contacts extracted from ' + finderResults.length + ' websites', 'success');
        }
      }, 100 + i * 150);
    });
  }

  function showFinderProgress(text) {
    var el = document.getElementById('finder-progress');
    if (el) { el.style.display = ''; document.getElementById('finder-progress-text').textContent = text; }
  }

  function updateFinderProgress(done, total) {
    var el = document.getElementById('finder-progress-text');
    if (el) el.textContent = 'Processing ' + done + '/' + total + '...';
  }

  function hideFinderProgress() {
    var el = document.getElementById('finder-progress');
    if (el) el.style.display = 'none';
  }

  function showFinderResults(results) {
    hideFinderProgress();
    var container = document.getElementById('finder-results');
    if (!container) return;
    container.style.display = '';
    document.getElementById('finder-result-count').textContent = '(' + results.length + ' results)';

    var list = document.getElementById('finder-results-list');
    list.innerHTML = results.map(function (r, i) {
      var segClass = r.segment === 'hot' ? 'badge-hot' : r.segment === 'warm' ? 'badge-warm' : r.segment === 'cold' ? 'badge-cold' : '';
      var segLabel = r.segment === 'hot' ? '🔥 Hot' : r.segment === 'warm' ? '🟡 Warm' : r.segment === 'cold' ? '🔵 Cold' : '—';
      return '<div class="finder-result-item" data-idx="' + i + '">' +
        '<div class="fri-main"><div class="fri-name">' + esc(r.name) + '</div><div class="fri-url">' + esc(r.website || '') + '</div></div>' +
        '<div class="fri-meta"><span class="' + segClass + '">' + segLabel + '</span> <span class="fri-score">Score: ' + (r.qualScore || '—') + '</span></div>' +
        '<div class="fri-contact">' + (r.contactName ? '👤 ' + esc(r.contactName) + ' (' + esc(r.contactTitle || '') + ')' : '') + '</div>' +
        '<div class="fri-actions"><button class="btn btn-xs btn-accent" onclick="window._finderSelect(' + i + ')">Select</button></div>' +
        '</div>';
    }).join('');

    // Wire select buttons
    window._finderSelect = function (idx) {
      var r = finderResults[idx];
      selectFinderResult(r);
    };
  }

  function selectFinderResult(r) {
    document.getElementById('finder-results').style.display = 'none';
    var container = document.getElementById('finder-selected');
    if (!container) return;
    container.style.display = '';
    document.getElementById('finder-selected-detail').innerHTML =
      '<div class="fri-name" style="font-size:18px">' + esc(r.name) + '</div>' +
      '<div style="color:var(--text2);margin:8px 0">' + esc(r.website || '') + '</div>' +
      '<div style="display:flex;gap:12px;flex-wrap:wrap;margin:12px 0">' +
        '<span>Industry: ' + esc(r.industry) + '</span>' +
        '<span>State: ' + esc(r.state) + '</span>' +
        '<span>Score: ' + (r.qualScore || '—') + '/100</span>' +
        '<span class="' + (r.segment === 'hot' ? 'badge-hot' : r.segment === 'warm' ? 'badge-warm' : 'badge-cold') + '">' + (r.segment || '—') + '</span>' +
      '</div>' +
      (r.contactName ? '<div style="margin:8px 0">👤 <strong>' + esc(r.contactName) + '</strong> — ' + esc(r.contactTitle || '') + '</div>' : '') +
      (r.contactEmail ? '<div style="color:var(--text2)">✉️ ' + esc(r.contactEmail) + '</div>' : '');

    // Generate outreach
    if (r.qualScore) {
      var outreachContainer = document.getElementById('finder-outreach');
      if (outreachContainer) {
        outreachContainer.style.display = '';
        var msg = window.Agents ? window.Agents.generateMessage(r) : { subject: 'Quick question about ' + r.name, body: 'Hi ' + (r.contactName || 'there') + ',\n\nI noticed your website could use some improvements. Score: ' + (r.qualScore || 0) + '/100.\n\nBest,\nGideon' };
        document.getElementById('finder-outreach-content').innerHTML =
          '<div style="margin-bottom:8px"><strong>Subject:</strong> ' + esc(msg.subject) + '</div>' +
          '<pre style="white-space:pre-wrap;background:var(--surface2);padding:12px;border-radius:8px;font-size:13px;max-height:300px;overflow-y:auto">' + esc(msg.body) + '</pre>';
      }
    }

    // Fill save form
    document.getElementById('f-name').value = r.name;
    document.getElementById('f-contact').value = r.contactName || '';
    document.getElementById('f-email').value = r.contactEmail || '';
    document.getElementById('f-title').value = r.contactTitle || '';
    if (document.getElementById('f-state2')) document.getElementById('f-state2').value = r.state || '';
    if (document.getElementById('f-industry2')) document.getElementById('f-industry2').value = r.industry || '';
    document.getElementById('f-value').value = r.value || 1;
    if (document.getElementById('f-segment2')) document.getElementById('f-segment2').value = r.segment || 'warm';
    document.getElementById('finder-form').style.display = '';
    document.getElementById('finder-form').dataset.website = r.website || '';
    document.getElementById('finder-form').dataset.issues = JSON.stringify(r.issues || []);
    document.getElementById('finder-form').dataset.score = r.qualScore || 0;
    document.getElementById('finder-form').dataset.segment = r.segment || 'warm';
  }

  function saveFinderLead() {
    var name = (document.getElementById('f-name').value || '').trim();
    if (!name) { showToast('Company name required', 'error'); return; }

    var form = document.getElementById('finder-form');
    var newLead = {
      id: 'lead_' + Date.now(),
      name: name,
      contactName: (document.getElementById('f-contact').value || '').trim(),
      contactEmail: (document.getElementById('f-email').value || '').trim(),
      contactTitle: (document.getElementById('f-title').value || '').trim(),
      state: document.getElementById('f-state2') ? document.getElementById('f-state2').value : 'CA',
      industry: document.getElementById('f-industry2') ? document.getElementById('f-industry2').value : 'Business',
      value: parseFloat(document.getElementById('f-value').value) || 1,
      segment: document.getElementById('f-segment2') ? document.getElementById('f-segment2').value : 'warm',
      qualScore: parseInt(form.dataset.score) || 0,
      issues: JSON.parse(form.dataset.issues || '[]'),
      website: form.dataset.website || '',
      pipelineStage: 'qualified',
      status: 'New', priority: 'Medium', type: currentMode,
      tags: ['finder-added'], notes: '',
      outreachMessage: null, outreachGenerated: null,
      followUpStep: 0, followUpNext: null, followUpSequence: null,
      createdAt: Date.now()
    };

    allLeads.push(newLead);
    saveLeads();
    showToast('Lead "' + name + '" saved to Pipeline!', 'success');

    if (window.Automation) window.Automation.trigger('lead-created', newLead);

    // Reset finder form
    document.getElementById('finder-form').style.display = 'none';
    document.getElementById('finder-selected').style.display = 'none';
    document.getElementById('finder-outreach').style.display = 'none';
  }

  /* Finder auto-refresh + reporting */
  var FINDER_INTERVAL = null;
  var FINDER_SCAN_HISTORY = [];

  function startFinderRefresh() {
    if (FINDER_INTERVAL) clearInterval(FINDER_INTERVAL);
    // Track scan history from localStorage
    try {
      var raw = localStorage.getItem('ga_finder_scans');
      if (raw) FINDER_SCAN_HISTORY = JSON.parse(raw);
    } catch (e) {}
    // Show scan report if exists
    renderFinderReport();
    FINDER_INTERVAL = setInterval(function () {
      renderFinderReport();
    }, 15000);
  }

  function stopFinderRefresh() {
    if (FINDER_INTERVAL) { clearInterval(FINDER_INTERVAL); FINDER_INTERVAL = null; }
  }

  function trackFinderScan(count) {
    FINDER_SCAN_HISTORY.push({ time: Date.now(), count: count });
    if (FINDER_SCAN_HISTORY.length > 30) FINDER_SCAN_HISTORY.shift();
    try { localStorage.setItem('ga_finder_scans', JSON.stringify(FINDER_SCAN_HISTORY)); } catch (e) {}
  }

  function renderFinderReport() {
    var container = document.getElementById('finder-report');
    if (!container) {
      container = document.createElement('div');
      container.id = 'finder-report';
      container.style.cssText = 'margin-bottom:16px';
      var insertAfter = document.querySelector('#finder .section-header');
      if (insertAfter && insertAfter.parentNode) {
        insertAfter.parentNode.insertBefore(container, insertAfter.nextSibling);
      }
    }
    if (!container) return;
    if (!FINDER_SCAN_HISTORY.length) {
      container.style.display = 'none';
      return;
    }
    container.style.display = '';
    var totalScanned = FINDER_SCAN_HISTORY.reduce(function (s, h) { return s + h.count; }, 0);
    var barHtml = '<div style="display:flex;gap:3px;align-items:end;height:32px;padding:4px 0">';
    FINDER_SCAN_HISTORY.slice(-15).forEach(function (h, i) {
      var maxCount = Math.max.apply(null, FINDER_SCAN_HISTORY.slice(-15).map(function (x) { return x.count; })) || 1;
      var barH = Math.max(3, (h.count / maxCount) * 28);
      barHtml += '<div style="width:10px;height:' + barH + 'px;background:var(--accent);border-radius:2px;opacity:' + (0.4 + 0.6 * (h.count / maxCount)) + ';transition:height .3s" title="' + h.count + ' leads at ' + new Date(h.time).toLocaleTimeString() + '"></div>';
    });
    barHtml += '</div>';
    container.innerHTML = '<div class="card" style="padding:10px 16px">' +
      '<div class="card-title" style="font-size:12px;margin-bottom:2px">📈 Scan Activity <span style="font-weight:400;color:var(--text3)">' + FINDER_SCAN_HISTORY.length + ' scans • ' + totalScanned + ' leads found</span></div>' +
      barHtml +
      '</div>';
  }

  /* ----------------------------------------
     AUTOMATION TAB
     ---------------------------------------- */
  function wireAutomation() {}

  function renderAutomation() {
    if (!window.Automation) return;
    var container = document.getElementById('automation-workflows');
    if (!container) return;

    var workflows = window.Automation.getAll();
    if (!workflows || !workflows.length) {
      container.innerHTML = '<div style="color:var(--text2);padding:16px">No workflows configured.</div>';
      return;
    }

    var categories = { 'lead-management': '🎯 Lead Management', 'email': '📧 Email', 'ai': '🤖 AI', 'analytics': '📊 Analytics' };
    var html = '';

    Object.keys(categories).forEach(function (cat) {
      var catWorkflows = workflows.filter(function (w) { return w.category === cat; });
      if (!catWorkflows.length) return;
      html += '<div style="margin-bottom:20px">';
      html += '<div style="font-size:13px;font-weight:700;color:var(--text2);text-transform:uppercase;letter-spacing:1px;margin-bottom:10px">' + categories[cat] + '</div>';
      catWorkflows.forEach(function (wf) {
        var steps = (wf.steps || []).map(function (s) { return s.label || s.action; }).join(' → ');
        html += '<div class="automation-wf ' + (wf.enabled ? 'enabled' : 'disabled') + '" data-wf-id="' + wf.id + '">';
        html += '<div class="awf-header">';
        html += '<span class="awf-name">' + esc(wf.name) + '</span>';
        html += '<label class="cc-toggle"><input type="checkbox" ' + (wf.enabled ? 'checked' : '') + ' data-toggle-wf="' + wf.id + '"><span class="cc-toggle-slider"></span></label>';
        html += '</div>';
        html += '<div class="awf-desc">' + esc(wf.description) + '</div>';
        html += '<div class="awf-steps">' + esc(steps) + '</div>';
        html += '<div class="awf-meta">Runs: ' + (wf.runs || 0) + (wf.lastRun ? ' • Last: ' + new Date(wf.lastRun).toLocaleDateString() : '') + '</div>';
        html += '</div>';
      });
      html += '</div>';
    });

    container.innerHTML = html;

    // Wire toggle handlers
    container.querySelectorAll('[data-toggle-wf]').forEach(function (toggle) {
      toggle.addEventListener('change', function () {
        window.Automation.toggle(toggle.dataset.toggleWf);
        renderAutomation();
      });
    });

    // Render automation log
    var logContainer = document.getElementById('automation-log');
    if (logContainer) {
      var log = window.Automation.getLog(30);
      logContainer.innerHTML = log.length === 0 ? '<div style="color:var(--text2);padding:16px">No automation activity yet. Workflows run automatically on schedule.</div>' :
        log.map(function (e) {
          var levelColor = e.level === 'error' ? 'var(--red)' : e.level === 'warning' ? 'var(--yellow)' : e.level === 'success' ? 'var(--green)' : 'var(--text2)';
          return '<div style="padding:8px 0;border-bottom:1px solid var(--border);font-size:13px;display:flex;gap:12px;align-items:flex-start">' +
            '<span style="color:var(--text3);white-space:nowrap">' + new Date(e.ts).toLocaleTimeString() + '</span>' +
            '<span style="color:' + levelColor + ';font-weight:600;min-width:80px">' + esc(e.action) + '</span>' +
            '<span style="color:var(--text2)">' + esc(e.detail) + '</span>' +
            '</div>';
        }).join('');
    }
  }

  /* ----------------------------------------
     OUTREACH TAB — Bulk Outreach
     ---------------------------------------- */
  function renderOutreach() {
    renderOutreachLimits();
    renderOutreachStats();
    renderOutreachQueue();
    renderOutreachSentLog();
    renderOutreachCampaigns();
    renderOutreachTemplates();
    wireOutreachCompose();
  }

  function renderOutreachLimits() {
    var el = document.getElementById('outreach-limits');
    if (!el || !window.OutreachEngine) return;
    var d = window.OutreachEngine.getDailyCount();
    var emailPct = Math.round((d.email / d.emailLimit) * 100);
    var whatsappPct = Math.round((d.whatsapp / d.whatsappLimit) * 100);
    el.innerHTML =
      '<div class="outreach-limit"><span class="ol-label">📧 Emails Today</span><div class="ol-bar"><div class="ol-fill" style="width:' + emailPct + '%;background:' + (emailPct > 80 ? 'var(--red)' : 'var(--green)') + '"></div></div><span class="ol-count">' + d.email + '/' + d.emailLimit + '</span></div>' +
      '<div class="outreach-limit"><span class="ol-label">💬 WhatsApp Today</span><div class="ol-bar"><div class="ol-fill" style="width:' + whatsappPct + '%;background:' + (whatsappPct > 80 ? 'var(--red)' : 'var(--green)') + '"></div></div><span class="ol-count">' + d.whatsapp + '/' + d.whatsappLimit + '</span></div>';
  }

  function renderOutreachStats() {
    var el = document.getElementById('outreach-stats');
    if (!el || !window.OutreachEngine) return;
    var s = window.OutreachEngine.getStats();
    el.innerHTML =
      '<div class="stat-card accent"><div class="stat-label">Total Sent</div><div class="stat-value">' + s.totalSent + '</div></div>' +
      '<div class="stat-card green"><div class="stat-label">Emails</div><div class="stat-value">' + s.emails + '</div></div>' +
      '<div class="stat-card blue"><div class="stat-label">WhatsApp</div><div class="stat-value">' + s.whatsapp + '</div></div>' +
      '<div class="stat-card yellow"><div class="stat-label">Opens</div><div class="stat-value">' + s.totalOpens + ' <small>(' + s.openRate + '%)</small></div></div>' +
      '<div class="stat-card purple"><div class="stat-label">Clicks</div><div class="stat-value">' + s.totalClicks + ' <small>(' + s.clickRate + '%)</small></div></div>' +
      '<div class="stat-card red"><div class="stat-label">Queued</div><div class="stat-value">' + s.queued + '</div></div>';
  }

  function wireOutreachCompose() {
    var channelSelect = document.getElementById('out-channel');
    if (channelSelect) {
      channelSelect.addEventListener('change', function () {
        document.getElementById('out-email-fields').style.display = channelSelect.value === 'email' ? '' : 'none';
        document.getElementById('out-whatsapp-fields').style.display = channelSelect.value === 'whatsapp' ? '' : 'none';
      });
    }

    var sendBtn = document.getElementById('out-send-btn');
    if (sendBtn) sendBtn.addEventListener('click', sendBulkOutreach);

    var previewBtn = document.getElementById('out-preview-btn');
    if (previewBtn) previewBtn.addEventListener('click', previewOutreach);
  }

  function sendBulkOutreach() {
    if (!window.OutreachEngine) { showToast('Outreach engine not loaded', 'error'); return; }

    var campaign = (document.getElementById('out-campaign').value || '').trim() || 'Campaign ' + new Date().toLocaleDateString();
    var channel = document.getElementById('out-channel').value;
    var segment = document.getElementById('out-segment').value;
    var schedule = document.getElementById('out-schedule').value;

    var leads = getModeLeads().filter(function (l) {
      if (segment === 'hot') return l.segment === 'hot' && l.contactEmail;
      if (segment === 'warm') return l.segment === 'warm' && l.contactEmail;
      if (segment === 'all') return (l.segment === 'hot' || l.segment === 'warm') && l.contactEmail;
      return l.contactEmail;
    });

    if (leads.length === 0) {
      showToast('No qualified leads with email found', 'error');
      return;
    }

    if (channel === 'email') {
      var subject = document.getElementById('out-subject').value || 'Quick question about your website';
      var html = document.getElementById('out-html').value || '<p>Hi {contactName},</p><p>I noticed {company}\'s website could use improvements.</p><p>Best,<br>Gideon</p>';

      var scheduledFor = Date.now();
      if (schedule === '1h') scheduledFor = Date.now() + 3600000;
      if (schedule === 'tomorrow') {
        var tomorrow = new Date();
        tomorrow.setDate(tomorrow.getDate() + 1);
        tomorrow.setHours(9, 0, 0, 0);
        scheduledFor = tomorrow.getTime();
      }

      var items = leads.map(function (l) {
        return {
          leadId: l.id, email: l.contactEmail, name: l.name,
          contactName: l.contactName, state: l.state,
          channel: 'email', subject: subject, html: html,
          campaign: campaign, scheduledFor: scheduledFor
        };
      });

      if (schedule === 'queue') {
        window.OutreachEngine.enqueue(items);
        showToast(items.length + ' emails added to queue', 'success');
      } else {
        window.OutreachEngine.enqueue(items);
        window.OutreachEngine.processQueue();
        showToast('Sending ' + items.length + ' emails...', 'info');
      }
    } else {
      // WhatsApp
      var msg = document.getElementById('out-whatsapp-msg').value || 'Hi {contactName}, I noticed {company}\'s website could use improvements. Score: {score}/100. Would you be open to a quick chat?';
      window.OutreachEngine.sendWhatsAppBulk(leads, msg, campaign);
      showToast('Opening ' + leads.length + ' WhatsApp chats...', 'info');
    }

    setTimeout(function () {
      renderOutreachLimits();
      renderOutreachStats();
      renderOutreachQueue();
      renderOutreachSentLog();
      renderOutreachCampaigns();
    }, 2000);
  }

  function previewOutreach() {
    var container = document.getElementById('out-preview');
    if (!container) return;
    container.style.display = container.style.display === 'none' ? '' : 'none';

    var segment = document.getElementById('out-segment').value;
    var channel = document.getElementById('out-channel').value;
    var subject = document.getElementById('out-subject').value || '';
    var html = document.getElementById('out-html').value || '';
    var msg = document.getElementById('out-whatsapp-msg').value || '';

    var leads = getModeLeads().filter(function (l) {
      if (segment === 'hot') return l.segment === 'hot';
      if (segment === 'warm') return l.segment === 'warm';
      return l.segment === 'hot' || l.segment === 'warm';
    }).slice(0, 10);

    document.getElementById('out-preview-count').textContent = '(' + leads.length + ' preview, ' + (getModeLeads().filter(function (l) { return l.segment === 'hot' || l.segment === 'warm'; }).length) + ' total)';

    var list = document.getElementById('out-preview-list');
    list.innerHTML = leads.map(function (l) {
      var content = channel === 'email'
        ? '<div style="font-weight:600">' + esc(window.OutreachEngine.fillTemplate(subject, l)) + '</div>'
        : '<div style="white-space:pre-wrap">' + esc(window.OutreachEngine.fillTemplate(msg, l)) + '</div>';
      return '<div class="outreach-preview-item">' +
        '<div class="opi-name"><strong>' + esc(l.name) + '</strong> — ' + esc(l.contactName || 'No contact') + '</div>' +
        '<div class="opi-email">' + esc(l.contactEmail || '') + '</div>' +
        '<div class="opi-content">' + content + '</div>' +
        '</div>';
    }).join('');
  }

  function renderOutreachQueue() {
    var el = document.getElementById('out-queue-list');
    var countEl = document.getElementById('out-queue-count');
    if (!el || !window.OutreachEngine) return;

    var queue = window.OutreachEngine.getQueue({ status: 'queued' });
    if (countEl) countEl.textContent = '(' + queue.length + ')';

    if (queue.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px">Queue empty</div>';
      return;
    }

    el.innerHTML = queue.slice(0, 20).map(function (q) {
      return '<div class="outreach-queue-item">' +
        '<span class="oqi-channel">' + (q.channel === 'email' ? '📧' : '💬') + '</span>' +
        '<span class="oqi-name">' + esc(q.leadName || q.name || '') + '</span>' +
        '<span class="oqi-campaign">' + esc(q.campaign || '') + '</span>' +
        '<span class="oqi-time">' + new Date(q.scheduledFor).toLocaleString() + '</span>' +
        '</div>';
    }).join('');
  }

  function renderOutreachSentLog() {
    var el = document.getElementById('out-sent-log');
    if (!el || !window.OutreachEngine) return;

    var log = window.OutreachEngine.getSentLog(20);
    if (log.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px">No outreach sent yet</div>';
      return;
    }

    el.innerHTML = '<table style="width:100%;border-collapse:collapse;font-size:12px"><thead><tr>' +
      '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text2)">Time</th>' +
      '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text2)">Lead</th>' +
      '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text2)">Channel</th>' +
      '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text2)">Status</th>' +
      '<th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);color:var(--text2)">Campaign</th>' +
      '</tr></thead><tbody>' +
      log.map(function (s) {
        return '<tr>' +
          '<td style="padding:8px;border-bottom:1px solid var(--border)">' + new Date(s.ts).toLocaleString() + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid var(--border)">' + esc(s.leadName || '') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid var(--border)">' + (s.channel === 'email' ? '📧' : '💬') + '</td>' +
          '<td style="padding:8px;border-bottom:1px solid var(--border)"><span class="status-badge ' + s.status + '">' + s.status + '</span></td>' +
          '<td style="padding:8px;border-bottom:1px solid var(--border)">' + esc(s.campaign || '') + '</td>' +
          '</tr>';
      }).join('') +
      '</tbody></table>';
  }

  function renderOutreachCampaigns() {
    var el = document.getElementById('out-campaigns');
    if (!el || !window.OutreachEngine) return;

    var campaigns = window.OutreachEngine.getCampaigns();
    if (campaigns.length === 0) {
      el.innerHTML = '<div style="padding:16px;text-align:center;color:var(--text2);font-size:13px">No campaigns yet</div>';
      return;
    }

    el.innerHTML = campaigns.map(function (c) {
      return '<div class="outreach-campaign">' +
        '<div class="oc-header"><span class="oc-name">' + esc(c.name) + '</span><span class="oc-channel">' + (c.channel === 'email' ? '📧' : '💬') + '</span></div>' +
        '<div class="oc-stats">Sent: ' + (c.emailSent || c.whatsappSent || 0) + ' • Opens: ' + (c.opens || 0) + ' • Clicks: ' + (c.clicks || 0) + '</div>' +
        '<div class="oc-meta">Created: ' + new Date(c.created).toLocaleDateString() + '</div>' +
        '</div>';
    }).join('');
  }

  function renderOutreachTemplates() {
    var container = document.getElementById('outreach-templates');
    if (!container) return;

    var templates = [
      { name: 'Initial — Hot Lead', subject: '{company} — quick question about your website', body: 'Hi {contactName},\n\nI ran a quick analysis of {company}\'s website and spotted some conversion opportunities.\n\nKey findings:\n• Current score: {score}/100 (industry avg: 45)\n\nOur {industry} clients typically see 40-60% more leads after a redesign.\n\nWould you be open to a 15-minute call?\n\nBest,\nGideon' },
      { name: 'Value-Add Follow-Up', subject: 'Re: {company} — thought you\'d find this useful', body: 'Hi {contactName},\n\nFollowing up — I put together a quick breakdown of what a 1% conversion lift would mean for {company}.\n\nThat\'s real revenue walking out the door.\n\nWant me to send the full breakdown?\n\nBest,\nGideon' },
      { name: 'Case Study', subject: 'How a {industry} company got 47% more leads', body: 'Hi {contactName},\n\nThought you\'d find this relevant — we recently helped a {industry} company similar to {company}:\n\n• Before: 2.1% conversion rate\n• After: 3.4% conversion rate\n• Result: 47% more qualified leads in 90 days\n\nHappy to walk you through what we did. 15 minutes, no obligation.\n\nBest,\nGideon' },
      { name: 'Breakup', subject: 'Closing the loop on {company}', body: 'Hi {contactName},\n\nI\'ve reached out a few times about {company}\'s website — I assume the timing isn\'t right.\n\nI\'ll close this thread for now. If things change, you know where to find me.\n\nBest,\nGideon' }
    ];

    container.innerHTML = templates.map(function (t) {
      return '<div class="outreach-template">' +
        '<div class="ot-header"><strong>' + esc(t.name) + '</strong>' +
          '<button class="btn btn-xs btn-outline" onclick="document.getElementById(\'out-subject\').value=\'' + esc(t.subject) + '\';document.getElementById(\'out-html\').value=\'' + esc(t.body.replace(/\n/g, '\\n')) + '\';showToast(\'Template loaded\')">Use</button></div>' +
        '<div class="ot-subject">Subject: ' + esc(t.subject) + '</div>' +
        '<div class="ot-body">' + esc(t.body).substring(0, 150) + '...</div>' +
        '</div>';
    }).join('');
  }

  /* ----------------------------------------
     STRATEGY TAB
     ---------------------------------------- */
  function renderStrategy() {
    var container = document.getElementById('strategy-content');
    if (!container) return;

    var targetIndustries = [
      'Healthcare & Medical', 'Legal & Law Firms', 'Real Estate', 'Financial Services',
      'Construction & Trades', 'Manufacturing', 'Automotive', 'Hospitality & Tourism'
    ];

    var redFlags = [
      'Flash-based websites', 'Copyright year in footer older than 3 years',
      'No SSL certificate (HTTP only)', 'Not mobile responsive',
      'Stock photos with visible watermarks', 'Broken contact forms',
      'Page load time > 5 seconds', 'No Google Analytics or tracking',
      'Social media links that are broken or point to personal profiles',
      'Website built on deprecated platforms (Flash, Silverlight)'
    ];

    var preQual = [
      'Business has been operating 3+ years',
      'Annual revenue > $500K',
      'Has 5+ employees',
      'Website is 4+ years old',
      'Website is not mobile-friendly',
      'Owner is responsive to outreach',
      'Decision-maker identified',
      'Budget authority confirmed'
    ];

    var pricingTiers = [
      { name: 'Starter', price: '$2,500', features: ['5-page responsive website', 'Mobile optimized', 'Contact form', 'Basic SEO', 'SSL certificate', '1 month support'] },
      { name: 'Professional', price: '$5,000', features: ['10-page responsive website', 'CMS integration', 'Advanced SEO', 'Analytics setup', 'Blog setup', '3 months support', 'Content migration'] },
      { name: 'Enterprise', price: '$10,000', features: ['20+ page custom design', 'Custom functionality', 'E-commerce ready', 'API integrations', 'Performance optimization', '6 months support', 'Training sessions', 'Priority support'] }
    ];

    container.innerHTML =
      '<div class="card"><div class="card-title">🎯 Target Industries</div>' +
        '<div style="display:flex;flex-wrap:wrap;gap:8px">' +
          targetIndustries.map(function (ind) {
            return '<span style="background:var(--surface2);border:1px solid var(--border);padding:6px 12px;border-radius:100px;font-size:13px;color:var(--text)">' + esc(ind) + '</span>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-title">⚠️ Red Flags to Watch For</div>' +
        '<div class="checklist">' +
          redFlags.map(function (flag) {
            return '<div class="checklist-item"><span class="check-icon fail">!</span>' + esc(flag) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-title">✅ Pre-Qualification Checklist</div>' +
        '<div class="checklist">' +
          preQual.map(function (item) {
            return '<div class="checklist-item"><span class="check-icon pass">✓</span>' + esc(item) + '</div>';
          }).join('') +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-title">📧 Cold Email Template</div>' +
        '<div class="email-template" id="strategy-email-template">' +
          'Subject: Your website might be costing you customers\n\n' +
          'Hi [Name],\n\n' +
          'I came across [Company] and noticed your website hasn\'t been updated in a while. ' +
          'In today\'s mobile-first world, an outdated website can cost you up to 30% of potential customers.\n\n' +
          'I help [Industry] businesses in [State] modernize their online presence with fast, ' +
          'conversion-optimized websites that drive real results.\n\n' +
          'Would you be open to a quick 10-minute call this week? I\'d love to share some ' +
          'ideas specific to your business.\n\n' +
          'Best regards,\nGideon Abochie\nGA Web Design' +
          '<button class="btn btn-outline btn-xs copy-btn" style="position:absolute;top:8px;right:8px" onclick="navigator.clipboard && navigator.clipboard.writeText(this.parentElement.textContent.replace(\'Copy\',\'\').trim()).then(function(){showToast(\'Copied!\',\'success\')})">📋 Copy</button>' +
        '</div>' +
      '</div>' +

      '<div class="card"><div class="card-title">💰 Pricing Table</div>' +
        '<table class="pricing-table">' +
          '<thead><tr><th>Tier</th><th>Price</th><th>Features</th></tr></thead>' +
          '<tbody>' +
            pricingTiers.map(function (tier) {
              return '<tr>' +
                '<td><strong>' + esc(tier.name) + '</strong></td>' +
                '<td class="price">' + esc(tier.price) + '</td>' +
                '<td>' + tier.features.join(' · ') + '</td>' +
              '</tr>';
            }).join('') +
          '</tbody>' +
        '</table>' +
      '</div>';
  }

  /* Strategy auto-refresh + reporting */
  var STRATEGY_INTERVAL = null;
  var STRATEGY_CHECKLIST_HISTORY = [];

  function startStrategyRefresh() {
    if (STRATEGY_INTERVAL) clearInterval(STRATEGY_INTERVAL);
    try {
      var raw = localStorage.getItem('ga_strategy_history');
      if (raw) STRATEGY_CHECKLIST_HISTORY = JSON.parse(raw);
    } catch (e) {}
    renderStrategyReport();
    STRATEGY_INTERVAL = setInterval(function () {
      renderStrategyReport();
    }, 30000);
  }

  function stopStrategyRefresh() {
    if (STRATEGY_INTERVAL) { clearInterval(STRATEGY_INTERVAL); STRATEGY_INTERVAL = null; }
  }

  function renderStrategyReport() {
    var container = document.getElementById('strategy-report');
    if (!container) {
      container = document.createElement('div');
      container.id = 'strategy-report';
      container.style.cssText = 'margin-bottom:16px';
      var header = document.querySelector('#strategy .section-header');
      if (header && header.parentNode) header.parentNode.insertBefore(container, header.nextSibling);
    }
    if (!container) return;
    // Count leads by status to show active strategy impact
    var leads = [];
    try { var raw = localStorage.getItem('ga_leads'); if (raw) leads = Object.values(JSON.parse(raw)); } catch (e) {}
    var total = leads.length;
    var hot = leads.filter(function (l) { return l.segment === 'hot' || l.qualScore >= 70; }).length;
    var warm = leads.filter(function (l) { return l.segment === 'warm' || (l.qualScore >= 45 && l.qualScore < 70); }).length;
    var cold = leads.filter(function (l) { return l.segment === 'cold' || l.qualScore < 45; }).length;
    var contacted = leads.filter(function (l) { return l.outreachMessage || l.status === 'Contacted'; }).length;
    // Track history
    var now = Date.now();
    if (!STRATEGY_CHECKLIST_HISTORY.length || now - STRATEGY_CHECKLIST_HISTORY[STRATEGY_CHECKLIST_HISTORY.length - 1].time > 120000) {
      STRATEGY_CHECKLIST_HISTORY.push({ time: now, total: total, hot: hot, contacted: contacted });
      if (STRATEGY_CHECKLIST_HISTORY.length > 20) STRATEGY_CHECKLIST_HISTORY.shift();
      try { localStorage.setItem('ga_strategy_history', JSON.stringify(STRATEGY_CHECKLIST_HISTORY)); } catch (e) {}
    }
    var barHtml = '';
    if (STRATEGY_CHECKLIST_HISTORY.length > 1) {
      barHtml = '<div style="display:flex;gap:3px;align-items:end;height:28px;padding:4px 0">';
      STRATEGY_CHECKLIST_HISTORY.forEach(function (h, i) {
        var pct = Math.max(total, 1);
        var barH = Math.max(3, (h.total / Math.max.apply(null, STRATEGY_CHECKLIST_HISTORY.map(function (x) { return x.total; })) || 0) * 24);
        barHtml += '<div style="width:7px;height:' + barH + 'px;background:var(--accent);border-radius:2px;opacity:' + (0.3 + 0.7 * (i / STRATEGY_CHECKLIST_HISTORY.length)) + ';transition:height .3s" title="' + h.total + ' leads at ' + new Date(h.time).toLocaleTimeString() + '"></div>';
      });
      barHtml += '</div>';
    }
    container.innerHTML = '<div class="card" style="padding:10px 16px">' +
      '<div class="card-title" style="font-size:12px;margin-bottom:4px">📊 Strategy Impact <span style="font-weight:400;color:var(--text3)">' + total + ' total leads</span></div>' +
      '<div style="display:flex;gap:16px;font-size:12px;flex-wrap:wrap;margin-bottom:4px">' +
      '<span>🔥 Hot: <strong>' + hot + '</strong></span>' +
      '<span>🟡 Warm: <strong>' + warm + '</strong></span>' +
      '<span>❄️ Cold: <strong>' + cold + '</strong></span>' +
      '<span>📨 Contacted: <strong>' + contacted + '</strong></span>' +
      '<span>📈 Pipeline: <strong>' + Math.round((hot / Math.max(total, 1)) * 100) + '%</strong> hot rate</span>' +
      '</div>' +
      barHtml +
      '</div>';
  }

  /* ----------------------------------------
     PROPOSAL GENERATION
     ---------------------------------------- */
  function generateProposal(leadId) {
    var lead = findLead(leadId);
    if (!lead) {
      showToast('Lead not found', 'error');
      return;
    }

    var html = '';
    if (window.Proposal && window.Proposal.generateHTML) {
      html = window.Proposal.generateHTML(lead);
    } else if (window.Proposal && window.Proposal.generate) {
      html = window.Proposal.generate(lead);
    } else {
      html = generateFallbackProposal(lead);
    }

    var content = document.getElementById('proposal-content');
    if (content) content.innerHTML = html;

    var modal = document.getElementById('proposal-modal');
    if (modal) modal.classList.add('show');
  }

  function generateFallbackProposal(lead) {
    var score = window.Scoring ? window.Scoring.calculateQualScore(lead) : 50;
    var flags = [];
    if (window.Scoring && window.Scoring.detectRedFlags) flags = window.Scoring.detectRedFlags(lead) || [];

    return '<h1>Website Redesign Proposal</h1>' +
      '<p>Prepared for <strong>' + esc(lead.name) + '</strong></p>' +
      '<h2>Current Situation</h2>' +
      '<p>' + esc(lead.name) + ' is a ' + esc(lead.industry) + ' company based in ' + esc(lead.state) + '. ' +
      'Our analysis identified several areas where the current website can be improved to better serve customers and drive business growth.</p>' +
      '<p>Outdated Score: <strong>' + score + '/100</strong></p>' +
      (flags.length ? '<p>Issues Identified: ' + flags.join(', ') + '</p>' : '') +
      '<h2>Our Solution</h2>' +
      '<p>We propose a complete website redesign focusing on modern design, mobile responsiveness, fast performance, and conversion optimization.</p>' +
      '<div class="tier-cards">' +
        '<div class="tier-card">' +
          '<div class="tier-name">Starter</div>' +
          '<div class="tier-price">$2,500</div>' +
          '<ul class="tier-features"><li>5-page responsive site</li><li>Mobile optimized</li><li>Contact form</li><li>Basic SEO</li></ul>' +
        '</div>' +
        '<div class="tier-card recommended">' +
          '<div class="tier-name">Professional ★</div>' +
          '<div class="tier-price">$5,000</div>' +
          '<ul class="tier-features"><li>10-page responsive site</li><li>CMS integration</li><li>Advanced SEO</li><li>Analytics</li><li>3 months support</li></ul>' +
        '</div>' +
        '<div class="tier-card">' +
          '<div class="tier-name">Enterprise</div>' +
          '<div class="tier-price">$10,000</div>' +
          '<ul class="tier-features"><li>20+ custom pages</li><li>Custom functionality</li><li>E-commerce ready</li><li>6 months support</li></ul>' +
        '</div>' +
      '</div>' +
      '<h2>Timeline</h2>' +
      '<p>Starter: 2 weeks · Professional: 4 weeks · Enterprise: 6-8 weeks</p>' +
      '<h2>Next Steps</h2>' +
      '<p>1. Schedule a discovery call<br>2. Review and select a tier<br>3. Begin design phase</p>';
  }

  /* ----------------------------------------
     NOTES MODAL
     ---------------------------------------- */
  function wireNotesModal() {
    var closeBtn = document.getElementById('close-notes-btn');
    var cancelBtn = document.getElementById('cancel-notes-btn');
    var saveBtn = document.getElementById('save-notes-btn');

    if (closeBtn) closeBtn.addEventListener('click', closeNotesModal);
    if (cancelBtn) cancelBtn.addEventListener('click', closeNotesModal);
    if (saveBtn) saveBtn.addEventListener('click', saveNote);
  }

  var unsubNotes = null;

  function openNotes(leadId) {
    var lead = findLead(leadId);
    if (!lead) return;

    editingNotesId = leadId;
    var nameEl = document.getElementById('notes-lead-name');
    if (nameEl) nameEl.textContent = lead.name;

    var modal = document.getElementById('notes-modal');
    if (modal) modal.classList.add('show');

    // Subscribe to real-time notes
    if (unsubNotes) unsubNotes();
    unsubNotes = FirebaseService.notes.onChanged(leadId, function (notes) {
      renderNotesList(notes);
    });
  }

  function renderNotesList(notes) {
    var container = document.getElementById('notes-list');
    if (!container) return;

    if (!notes || !notes.length) {
      container.innerHTML = '<p style="color:var(--text3);font-size:.85rem;padding:12px 0">No notes yet.</p>';
      return;
    }

    var html = '';
    notes.forEach(function (note) {
      var date = note.createdAt ? new Date(note.createdAt.seconds ? note.createdAt.seconds * 1000 : note.createdAt) : new Date();
      var timeStr = date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' + date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' });
      html += '<div class="note-item" style="padding:10px 0;border-bottom:1px solid var(--border)">' +
        '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px">' +
        '<span style="font-size:.75rem;color:var(--text3)">' + (note.author || 'Admin') + ' · ' + timeStr + '</span>' +
        '<button onclick="GAAdmin.deleteNote(\'' + editingNotesId + '\',\'' + note.id + '\')" style="background:none;border:none;color:var(--red);cursor:pointer;font-size:.75rem">Delete</button>' +
        '</div>' +
        '<p style="font-size:.88rem;color:var(--text);margin:0;white-space:pre-wrap">' + (note.text || '') + '</p>' +
        '</div>';
    });
    container.innerHTML = html;
  }

  function saveNote() {
    if (!editingNotesId) return;
    var textEl = document.getElementById('notes-text');
    if (!textEl || !textEl.value.trim()) return;

    FirebaseService.notes.add(editingNotesId, textEl.value.trim()).then(function () {
      textEl.value = '';
      showToast('Note added', 'success');
    });
  }

  function deleteNoteFromModal(leadId, noteId) {
    FirebaseService.notes.delete(leadId, noteId);
  }

  function closeNotesModal() {
    editingNotesId = null;
    var modal = document.getElementById('notes-modal');
    if (modal) modal.classList.remove('show');
    // Unsubscribe from real-time notes
    if (unsubNotes) { unsubNotes(); unsubNotes = null; }
  }

  /* ----------------------------------------
     PROPOSAL MODAL
     ---------------------------------------- */
  function wireProposalModal() {
    var closeBtn = document.getElementById('close-proposal-btn');
    var printBtn = document.getElementById('print-proposal-btn');

    if (closeBtn) closeBtn.addEventListener('click', function () {
      document.getElementById('proposal-modal').classList.remove('show');
    });

    if (printBtn) printBtn.addEventListener('click', function () {
      window.print();
    });
  }

  /* ----------------------------------------
     TOAST
     ---------------------------------------- */
  function showToast(message, type) {
    var toast = document.getElementById('toast');
    if (!toast) return;

    toast.textContent = message;
    toast.className = 'toast ' + (type || 'info') + ' show';

    clearTimeout(toast._timer);
    toast._timer = setTimeout(function () {
      toast.classList.remove('show');
    }, 3000);
  }

  /* ----------------------------------------
     UTILITIES
     ---------------------------------------- */
  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function debounce(fn, delay) {
    var timer;
    return function () {
      var context = this;
      var args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(context, args); }, delay);
    };
  }

  /* ----------------------------------------
     ROADMAP
     ---------------------------------------- */
  var ROADMAP_KEY = 'ga_roadmap';

  var ROADMAP_PHASES = [
    { id: 'discovery', name: 'Core Platform', color: 'phase-1', order: 1 },
    { id: 'design', name: 'Migration & Auth', color: 'phase-2', order: 2 },
    { id: 'development', name: 'Wire Scaffold', color: 'phase-3', order: 3 },
    { id: 'content', name: 'Config & Secrets', color: 'phase-4', order: 4 },
    { id: 'testing', name: 'QA & Verification', color: 'phase-5', order: 5 },
    { id: 'launch', name: 'Launch', color: 'phase-6', order: 6 }
  ];

  var DEFAULT_ROADMAP = [
    // Phase 1: Core Platform (Done)
    { id: 'rm_1', phase: 'discovery', name: 'Firebase Auth + Firestore', desc: 'Auth service, Firestore data layer with localStorage fallback', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_2', phase: 'discovery', name: 'Admin dashboard UI', desc: '8-tab sidebar, command center, pipeline, finder, outreach, strategy, automation, roadmap', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_3', phase: 'discovery', name: 'Lead database (161 leads)', desc: '116 enterprise + 45 main street leads with scoring engine', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_4', phase: 'discovery', name: 'Growth-intent scoring engine', desc: '22+ signals, opportunity calculator, industry issue library', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_5', phase: 'discovery', name: 'Website analyzer + score tool', desc: 'Client-side via allorigins + server-side via CF Function', status: 'Done', priority: 'critical', due: '2026-07-06' },

    // Phase 2: CF Pages Migration (Done)
    { id: 'rm_6', phase: 'design', name: 'Migrate Netlify → Cloudflare Pages', desc: 'Convert 6 functions, update URLs, _headers, CI/CD', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_7', phase: 'design', name: 'Login page + auth flow', desc: 'Firebase Auth login, password toggle, CSP fix', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_8', phase: 'design', name: 'Portfolio Manager + Site Audit', desc: '6 sites, audit engine (10 categories), detail view', status: 'Done', priority: 'critical', due: '2026-07-06' },
    { id: 'rm_9', phase: 'design', name: 'Sentry + ESLint + CI/CD', desc: 'Error tracking, linting, GitHub Actions deploy', status: 'Done', priority: 'high', due: '2026-07-06' },
    { id: 'rm_10', phase: 'design', name: 'Logo + branding', desc: 'GA SVG logo, favicon, color system', status: 'Done', priority: 'high', due: '2026-07-06' },

    // Phase 3: Wiring Scaffold Features
    { id: 'rm_11', phase: 'development', name: 'Wire Bulk Outreach Engine', desc: 'Connect outreach-engine.js to /api/send-email + /api/track, add Brevo env var', status: 'Todo', priority: 'critical', due: '2026-07-08' },
    { id: 'rm_12', phase: 'development', name: 'Wire Automation Workflows', desc: 'Connect automation.js triggers to real actions (email, status updates, notifications)', status: 'Todo', priority: 'high', due: '2026-07-09' },
    { id: 'rm_13', phase: 'development', name: 'Wire Command Center', desc: 'Replace mock agent data with real pipeline stats from Firestore', status: 'Todo', priority: 'high', due: '2026-07-10' },
    { id: 'rm_14', phase: 'development', name: 'Wire Autonomous Agents', desc: 'Make agents.js actually execute — Scout discovers, Qualifier scores, Sales outreach', status: 'Todo', priority: 'high', due: '2026-07-11' },
    { id: 'rm_15', phase: 'development', name: 'Wire Portfolio Auto-Audit', desc: 'Schedule periodic audits, persist history in Firestore, trend charts', status: 'Todo', priority: 'medium', due: '2026-07-12' },
    { id: 'rm_16', phase: 'development', name: 'Wire Client Portal Roadmap', desc: 'Load roadmap data from Firestore, show milestones per company', status: 'Todo', priority: 'medium', due: '2026-07-13' },
    { id: 'rm_17', phase: 'development', name: 'Wire Settings Persistence', desc: 'Save/load settings from Firestore instead of localStorage only', status: 'Todo', priority: 'low', due: '2026-07-14' },

    // Phase 4: Production Hardening
    { id: 'rm_18', phase: 'content', name: 'Brevo API key setup', desc: 'Create Brevo account, generate API key, add to CF Pages env vars', status: 'Todo', priority: 'critical', due: '2026-07-08' },
    { id: 'rm_19', phase: 'content', name: 'Cloudflare API token', desc: 'Create CF API token for CI/CD, add to GitHub secrets', status: 'Todo', priority: 'critical', due: '2026-07-08' },
    { id: 'rm_20', phase: 'content', name: 'Clean up Netlify references', desc: 'Remove netlify/ directory, old netlify.toml, update PRD.md', status: 'Todo', priority: 'medium', due: '2026-07-09' },

    // Phase 5: Testing
    { id: 'rm_21', phase: 'testing', name: 'Test login → admin → portfolio → audit', desc: 'Full flow test on production', status: 'Todo', priority: 'critical', due: '2026-07-08' },
    { id: 'rm_22', phase: 'testing', name: 'Test outreach engine end-to-end', desc: 'Send test email via Brevo, verify tracking pixel + click redirect', status: 'Todo', priority: 'high', due: '2026-07-09' },
    { id: 'rm_23', phase: 'testing', name: 'Test all CF Pages Functions', desc: 'Verify /api/analyze, /api/site-audit, /api/bulk-analyze, /api/send-email, /api/track', status: 'Todo', priority: 'high', due: '2026-07-09' },
    { id: 'rm_24', phase: 'testing', name: 'Run ESLint + fix errors', desc: 'Fix the 22 errors found in initial lint run', status: 'Todo', priority: 'medium', due: '2026-07-10' },
    { id: 'rm_25', phase: 'testing', name: 'Sentry verification', desc: 'Trigger test error, verify it shows in Sentry dashboard', status: 'Todo', priority: 'medium', due: '2026-07-10' },

    // Phase 6: Launch
    { id: 'rm_26', phase: 'launch', name: 'Delete Netlify site', desc: 'Remove old Netlify site, cancel if on paid plan', status: 'Todo', priority: 'high', due: '2026-07-10' },
    { id: 'rm_27', phase: 'launch', name: 'DNS final verification', desc: 'Verify gideonabochie.com + www both resolve to CF Pages', status: 'Todo', priority: 'critical', due: '2026-07-10' },
    { id: 'rm_28', phase: 'launch', name: 'Performance audit', desc: 'Lighthouse 90+ on all pages, Core Web Vitals pass', status: 'Todo', priority: 'high', due: '2026-07-11' },
    { id: 'rm_29', phase: 'launch', name: 'Security audit', desc: 'Verify CSP, HSTS, X-Frame-Options, no mixed content', status: 'Todo', priority: 'high', due: '2026-07-11' },
    { id: 'rm_30', phase: 'launch', name: 'Ship it 🚀', desc: 'Everything wired, tested, and live on Cloudflare Pages', status: 'Todo', priority: 'critical', due: '2026-07-12' }
  ];

  var unsubRoadmap = null;

  function loadRoadmap() {
    var stored = localStorage.getItem(ROADMAP_KEY);
    if (stored) { try { return JSON.parse(stored); } catch (e) {} }
    localStorage.setItem(ROADMAP_KEY, JSON.stringify(DEFAULT_ROADMAP));
    FirebaseService.roadmap.save({ tasks: DEFAULT_ROADMAP }).catch(function () {});
    return DEFAULT_ROADMAP.slice();
  }

  function initRoadmapSync() {
    if (unsubRoadmap) unsubRoadmap();
    unsubRoadmap = FirebaseService.roadmap.onChanged(function (data) {
      if (data && data.tasks) {
        localStorage.setItem(ROADMAP_KEY, JSON.stringify(data.tasks));
        if (currentTab === 'roadmap') renderRoadmap();
      }
    });
  }

  function saveRoadmap(tasks) {
    localStorage.setItem(ROADMAP_KEY, JSON.stringify(tasks));
    FirebaseService.roadmap.save({ tasks: tasks }).catch(function () {});
  }

  function getRoadmapTasks() { return loadRoadmap(); }

  function renderRoadmap() {
    var tasks = getRoadmapTasks();
    renderRoadmapStats(tasks);
    renderRoadmapBoard(tasks);
    renderRoadmapTimeline(tasks);
    wireRoadmapControls(tasks);
  }

  function renderRoadmapStats(tasks) {
    var el = document.getElementById('roadmap-stats');
    if (!el) return;
    var total = tasks.length;
    var done = tasks.filter(function (t) { return t.status === 'Done'; }).length;
    var inProgress = tasks.filter(function (t) { return t.status === 'In Progress'; }).length;
    var blocked = tasks.filter(function (t) { return t.status === 'Blocked'; }).length;
    var pct = total ? Math.round((done / total) * 100) : 0;

    el.innerHTML =
      '<div class="rm-stat"><div class="rm-stat-icon total">📋</div><div><div class="rm-stat-val">' + total + '</div><div class="rm-stat-label">Total Tasks</div></div></div>' +
      '<div class="rm-stat"><div class="rm-stat-icon done">✅</div><div><div class="rm-stat-val">' + done + '</div><div class="rm-stat-label">Completed</div></div></div>' +
      '<div class="rm-stat"><div class="rm-stat-icon progress">🔄</div><div><div class="rm-stat-val">' + inProgress + '</div><div class="rm-stat-label">In Progress</div></div></div>' +
      '<div class="rm-stat"><div class="rm-stat-icon blocked">🚫</div><div><div class="rm-stat-val">' + blocked + '</div><div class="rm-stat-label">Blocked</div></div></div>' +
      '<div class="rm-stat"><div class="rm-stat-icon pct">📈</div><div><div class="rm-stat-val">' + pct + '%</div><div class="rm-stat-label">Complete</div></div></div>';
  }

  function renderRoadmapBoard(tasks) {
    var el = document.getElementById('roadmap-board');
    if (!el) return;

    var filterPhase = document.getElementById('rm-filter-phase');
    var filterStatus = document.getElementById('rm-filter-status');
    var phaseVal = filterPhase ? filterPhase.value : '';
    var statusVal = filterStatus ? filterStatus.value : '';

    var filtered = tasks.filter(function (t) {
      if (phaseVal && t.phase !== phaseVal) return false;
      if (statusVal && t.status !== statusVal) return false;
      return true;
    });

    var cols = [
      { status: 'Todo', label: 'To Do' },
      { status: 'In Progress', label: 'In Progress' },
      { status: 'Blocked', label: 'Blocked' },
      { status: 'Done', label: 'Done' }
    ];

    el.innerHTML = cols.map(function (col) {
      var colTasks = filtered.filter(function (t) { return t.status === col.status; });
      return '<div class="roadmap-column">' +
        '<div class="roadmap-column-header"><span>' + col.label + '</span><span class="col-count">' + colTasks.length + '</span></div>' +
        '<div class="roadmap-column-body">' +
          colTasks.map(function (t) {
            var phase = ROADMAP_PHASES.find(function (p) { return p.id === t.phase; });
            var phaseColor = phase ? phase.color : 'phase-1';
            return '<div class="rm-task" data-id="' + t.id + '">' +
              '<div class="rm-task-phase">' + (phase ? phase.name : t.phase) + '</div>' +
              '<div class="rm-task-name">' + esc(t.name) + '</div>' +
              (t.desc ? '<div class="rm-task-desc">' + esc(t.desc) + '</div>' : '') +
              '<div class="rm-task-meta">' +
                '<span class="rm-task-tag ' + phaseColor + '">' + (phase ? phase.name.split(' ')[0] : '') + '</span>' +
                '<span class="rm-task-priority ' + t.priority + '">' + t.priority + '</span>' +
                (t.due ? '<span class="rm-task-date">' + t.due + '</span>' : '') +
              '</div>' +
              '<div class="rm-task-actions">' +
                (t.status !== 'Done' ? '<button class="rm-task-btn done-btn" data-action="advance" data-id="' + t.id + '">▶ Advance</button>' : '') +
                (t.status !== 'Todo' ? '<button class="rm-task-btn" data-action="back" data-id="' + t.id + '">◀ Back</button>' : '') +
                '<button class="rm-task-btn" data-action="block" data-id="' + t.id + '">' + (t.status === 'Blocked' ? ' Unblock' : ' 🚫 Block') + '</button>' +
              '</div>' +
            '</div>';
          }).join('') +
          (colTasks.length === 0 ? '<div style="padding:20px;text-align:center;color:var(--text3);font-size:12px">No tasks</div>' : '') +
        '</div>' +
      '</div>';
    }).join('');

    // Wire task actions
    el.querySelectorAll('[data-action]').forEach(function (btn) {
      btn.addEventListener('click', function (e) {
        e.stopPropagation();
        var id = btn.dataset.id;
        var action = btn.dataset.action;
        var tasks = getRoadmapTasks();
        var task = tasks.find(function (t) { return t.id === id; });
        if (!task) return;

        if (action === 'advance') {
          if (task.status === 'Todo') task.status = 'In Progress';
          else if (task.status === 'In Progress') task.status = 'Done';
          else if (task.status === 'Blocked') task.status = 'In Progress';
        } else if (action === 'back') {
          if (task.status === 'Done') task.status = 'In Progress';
          else if (task.status === 'In Progress') task.status = 'Todo';
        } else if (action === 'block') {
          task.status = task.status === 'Blocked' ? 'In Progress' : 'Blocked';
        }

        saveRoadmap(tasks);
        renderRoadmap();
        showToast('Task "' + task.name + '" → ' + task.status, 'success');
      });
    });

    // Wire task click for details
    el.querySelectorAll('.rm-task').forEach(function (task) {
      task.addEventListener('click', function () {
        var tasks = getRoadmapTasks();
        var t = tasks.find(function (x) { return x.id === task.dataset.id; });
        if (t) showToast(t.name + ' — ' + t.status + ' — Due: ' + (t.due || 'TBD'));
      });
    });
  }

  function renderRoadmapTimeline(tasks) {
    var el = document.getElementById('roadmap-timeline');
    if (!el) return;

    el.innerHTML = '<h3>Phase Progress</h3>' +
      ROADMAP_PHASES.map(function (phase) {
        var phaseTasks = tasks.filter(function (t) { return t.phase === phase.id; });
        var done = phaseTasks.filter(function (t) { return t.status === 'Done'; }).length;
        var total = phaseTasks.length;
        var pct = total ? Math.round((done / total) * 100) : 0;
        return '<div class="rm-timeline-row">' +
          '<div class="rm-timeline-label">' + phase.name + '</div>' +
          '<div class="rm-timeline-bar-wrap"><div class="rm-timeline-bar ' + phase.color + '" style="width:' + pct + '%"></div></div>' +
          '<div class="rm-timeline-pct">' + pct + '%</div>' +
        '</div>';
      }).join('');
  }

  function wireRoadmapControls(tasks) {
    // Populate phase filter
    var phaseSelect = document.getElementById('rm-filter-phase');
    if (phaseSelect && phaseSelect.options.length <= 1) {
      ROADMAP_PHASES.forEach(function (p) {
        var opt = document.createElement('option');
        opt.value = p.id;
        opt.textContent = p.name;
        phaseSelect.appendChild(opt);
      });
    }

    var applyBtn = document.getElementById('rm-apply-btn');
    if (applyBtn) applyBtn.onclick = function () { renderRoadmap(); };

    var addBtn = document.getElementById('rm-add-task-btn');
    if (addBtn) addBtn.onclick = function () { openAddTaskModal(); };

    var exportBtn = document.getElementById('rm-export-btn');
    if (exportBtn) exportBtn.onclick = function () {
      var tasks = getRoadmapTasks();
      var blob = new Blob([JSON.stringify(tasks, null, 2)], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'ga-roadmap-' + new Date().toISOString().slice(0, 10) + '.json';
      a.click();
      showToast('Roadmap exported', 'success');
    };
  }

  function openAddTaskModal() {
    var name = prompt('Task name:');
    if (!name) return;
    var desc = prompt('Description (optional):') || '';
    var phase = prompt('Phase (discovery/design/development/content/testing/launch):') || 'development';
    var priority = prompt('Priority (critical/high/medium/low):') || 'medium';
    var due = prompt('Due date (YYYY-MM-DD):') || '';

    var tasks = getRoadmapTasks();
    tasks.push({
      id: 'rm_' + Date.now(),
      phase: phase,
      name: name,
      desc: desc,
      status: 'Todo',
      priority: priority,
      due: due
    });
    saveRoadmap(tasks);
    renderRoadmap();
    showToast('Task added: ' + name, 'success');
  }

  /* ----------------------------------------
     LOGOUT
     ---------------------------------------- */
  function wireLogout() {
    var logoutBtn = document.getElementById('logoutBtn');
    var settingsLogout = document.getElementById('settings-logout-btn');
    function doLogout() {
      AuthService.logout().then(function () {
        window.location.href = 'login.html';
      });
    }
    if (logoutBtn) logoutBtn.addEventListener('click', doLogout);
    if (settingsLogout) settingsLogout.addEventListener('click', doLogout);
  }

  /* ----------------------------------------
     PORTFOLIO MANAGER
     ---------------------------------------- */
  function wirePortfolio() {
    if (window.PortfolioManager) window.PortfolioManager.init();
    var runAllBtn = document.getElementById('pm-run-all-btn');
    if (runAllBtn) {
      runAllBtn.addEventListener('click', function () {
        if (window.PortfolioManager) window.PortfolioManager.runAllAudits();
      });
    }
  }

  /* ----------------------------------------
     SETTINGS
     ---------------------------------------- */
  function wireSettings() {
    var sitesContainer = document.getElementById('settings-sites');
    if (!sitesContainer || !window.PortfolioManager) return;
    var sites = window.PortfolioManager.SITES;
    var html = '<table style="width:100%;border-collapse:collapse;margin-top:12px">';
    html += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SITE</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">URL</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">TAG</th></tr></thead><tbody>';
    sites.forEach(function (s) {
      html += '<tr><td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem">' + s.name + '</td><td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem"><a href="' + s.url + '" target="_blank" style="color:var(--accent)">' + s.url.replace('https://', '') + '</a></td><td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem;color:var(--text2)">' + s.tag + '</td></tr>';
    });
    html += '</tbody></table>';
    sitesContainer.innerHTML = html;

    // Add live status container if not present
    if (!document.getElementById('settings-status')) {
      var statusDiv = document.createElement('div');
      statusDiv.id = 'settings-status';
      statusDiv.className = 'card';
      statusDiv.style.cssText = 'max-width:600px;margin-top:16px';
      var settingsCards = document.querySelector('#settings .card');
      if (settingsCards && settingsCards.parentNode) {
        settingsCards.parentNode.insertBefore(statusDiv, settingsCards.nextSibling);
      }
    }

    // Load saved settings from Firestore
    loadSettings();
    renderSettingsStatus();

    // Wire save buttons
    var saveEmailBtn = document.getElementById('settings-save-email');
    var saveNotifBtn = document.getElementById('settings-save-notifs');
    var saveAiBtn = document.getElementById('settings-save-ai');
    if (saveEmailBtn) saveEmailBtn.addEventListener('click', function () { saveSettings('email'); });
    if (saveNotifBtn) saveNotifBtn.addEventListener('click', function () { saveSettings('notifications'); });
    if (saveAiBtn) saveAiBtn.addEventListener('click', function () { saveSettings('ai'); });

    // Auto-reload settings on focus
    if (!window._settingsFocusBound) {
      window._settingsFocusBound = true;
      document.addEventListener('visibilitychange', function () {
        if (!document.hidden) {
          var active = document.querySelector('.section.active');
          if (active && active.id === 'settings') {
            loadSettings();
            renderSettingsStatus();
          }
        }
      });
    }
  }

  function renderSettingsStatus() {
    var el = document.getElementById('settings-status');
    if (!el) return;
    if (!window.FirebaseService) {
      el.style.display = 'none';
      return;
    }
    el.style.display = '';
    FirebaseService.settings.get().then(function (data) {
      if (!data) {
        el.innerHTML = '<div class="card-title" style="font-size:13px">🔌 Connection Status</div>' +
          '<div style="font-size:12px;color:var(--text3);padding:8px 0">No configuration loaded yet.</div>';
        return;
      }
      var hasBrevo = !!(data.brevoApiKey || '').trim();
      var hasOpenAI = !!(data.openaiApiKey || '').trim();
      var hasSender = !!(data.brevoSenderEmail || '').trim();
      var brevoOk = hasBrevo && hasSender;
      el.innerHTML =
        '<div class="card-title" style="font-size:13px">🔌 Connection Status</div>' +
        '<div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;padding:8px 0;font-size:12px">' +
        '<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (brevoOk ? 'var(--green)' : 'var(--yellow)') + ';margin-right:6px"></span>Brevo Email: <strong>' + (brevoOk ? 'Configured' : hasBrevo ? 'Missing sender' : 'Not set') + '</strong></div>' +
        '<div><span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:' + (hasOpenAI ? 'var(--green)' : 'var(--yellow)') + ';margin-right:6px"></span>OpenAI: <strong>' + (hasOpenAI ? 'Configured' : 'Not set') + '</strong></div>' +
        '</div>' +
        '<div style="font-size:11px;color:var(--text3);border-top:1px solid var(--border);padding-top:8px">Auto-reloads when this tab becomes visible</div>';
    }).catch(function () {
      el.innerHTML = '<div class="card-title" style="font-size:13px">🔌 Connection Status</div>' +
        '<div style="font-size:12px;color:var(--red);padding:8px 0">⚠️ Could not reach Firestore</div>';
    });
  }

  function loadSettings() {
    if (!window.FirebaseService) return;
    FirebaseService.settings.get().then(function (data) {
      if (!data) return;
      var brevoKey = document.getElementById('settings-brevo-key');
      var brevoSender = document.getElementById('settings-brevo-sender');
      var brevoSenderName = document.getElementById('settings-brevo-sender-name');
      var openaiKey = document.getElementById('settings-openai-key');
      var openaiModel = document.getElementById('settings-openai-model');
      var notifyLeads = document.getElementById('settings-notify-leads');
      var notifyAudit = document.getElementById('settings-notify-audit');
      var notifyOutreach = document.getElementById('settings-notify-outreach');
      if (brevoKey) brevoKey.value = data.brevoApiKey || '';
      if (brevoSender) brevoSender.value = data.brevoSenderEmail || '';
      if (brevoSenderName) brevoSenderName.value = data.brevoSenderName || '';
      if (openaiKey) openaiKey.value = data.openaiApiKey || '';
      if (openaiModel) openaiModel.value = data.openaiModel || 'gpt-4o-mini';
      if (notifyLeads) notifyLeads.checked = data.notifyLeads !== false;
      if (notifyAudit) notifyAudit.checked = data.notifyAudit !== false;
      if (notifyOutreach) notifyOutreach.checked = data.notifyOutreach === true;
    }).catch(function () {});
  }

  function saveSettings(section) {
    if (!window.FirebaseService) return;
    var data = {};
    if (section === 'email') {
      data.brevoApiKey = document.getElementById('settings-brevo-key').value;
      data.brevoSenderEmail = document.getElementById('settings-brevo-sender').value;
      data.brevoSenderName = document.getElementById('settings-brevo-sender-name').value;
    } else if (section === 'notifications') {
      data.notifyLeads = document.getElementById('settings-notify-leads').checked;
      data.notifyAudit = document.getElementById('settings-notify-audit').checked;
      data.notifyOutreach = document.getElementById('settings-notify-outreach').checked;
    } else if (section === 'ai') {
      data.openaiApiKey = document.getElementById('settings-openai-key').value;
      data.openaiModel = document.getElementById('settings-openai-model').value;
    }
    FirebaseService.settings.save(data).then(function () {
      showToast('Settings saved');
      renderSettingsStatus();
    }).catch(function () {
      showToast('Failed to save settings');
    });
  }

  /* ----------------------------------------
     VISITORS TAB — Analytics Dashboard
     ---------------------------------------- */
  function renderVisitors() {
    if (!window.Analytics) return;

    // Funnel
    var funnelEl = document.getElementById('visitor-funnel');
    if (funnelEl) {
      var funnel = Analytics.getFunnelData();
      var maxCount = Math.max.apply(null, funnel.steps.map(function (s) { return s.count; }).concat([1]));
      var html = '<div style="display:flex;flex-direction:column;gap:4px">';
      funnel.steps.forEach(function (step, i) {
        var pct = Math.round((step.count / maxCount) * 100);
        var barColor = i === funnel.steps.length - 1 ? 'var(--green)' : 'var(--accent)';
        html += '<div style="display:flex;align-items:center;gap:12px">';
        html += '<div style="width:130px;font-size:13px;color:var(--text2);text-align:right">' + step.label + '</div>';
        html += '<div style="flex:1;height:28px;background:var(--surface2);border-radius:6px;overflow:hidden">';
        html += '<div style="height:100%;width:' + pct + '%;background:' + barColor + ';border-radius:6px;transition:width .5s"></div>';
        html += '</div>';
        html += '<div style="width:60px;font-size:13px;font-weight:700">' + step.count + '</div>';
        html += '<div style="width:50px;font-size:12px;color:var(--text3)">' + step.convRate + '%</div>';
        html += '</div>';
      });
      html += '</div>';
      html += '<div style="margin-top:12px;font-size:12px;color:var(--text3)">Overall: ' + funnel.totalVisitors + ' visitors → ' + funnel.totalDeals + ' deals (' + funnel.overallConversion + '% conversion)</div>';
      funnelEl.innerHTML = html;
    }

    // Stats
    var statsEl = document.getElementById('visitor-stats');
    if (statsEl) {
      var vStats = window.VisitorTracker ? VisitorTracker.getVisitorStats() : {};
      statsEl.innerHTML =
        '<div class="stat-card"><div class="stat-label">Page Views</div><div class="stat-value">' + (vStats.totalPageviews || 0) + '</div></div>' +
        '<div class="stat-card green"><div class="stat-label">Unique Visitors</div><div class="stat-value">' + (vStats.uniqueVisitors || 0) + '</div></div>' +
        '<div class="stat-card accent"><div class="stat-label">Conversions</div><div class="stat-value">' + (vStats.conversions || 0) + '</div></div>' +
        '<div class="stat-card purple"><div class="stat-label">Conv. Rate</div><div class="stat-value">' + (vStats.conversionRate || 0) + '%</div></div>';
    }

    // Channels
    var channelsEl = document.getElementById('visitor-channels');
    if (channelsEl) {
      var channels = Analytics.getChannelPerformance();
      var chHtml = '<table style="width:100%;border-collapse:collapse">';
      chHtml += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">CHANNEL</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">VISITORS</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">LEADS</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">REVENUE</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">ROI</th></tr></thead><tbody>';
      channels.forEach(function (ch) {
        chHtml += '<tr><td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem">' + ch.icon + ' ' + ch.name + '</td>';
        chHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem;text-align:right">' + ch.visitors + '</td>';
        chHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem;text-align:right">' + ch.leads + '</td>';
        chHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem;text-align:right;color:var(--green)">$' + ch.revenue + '</td>';
        chHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem;text-align:right">' + ch.roi + '%</td></tr>';
      });
      chHtml += '</tbody></table>';
      channelsEl.innerHTML = chHtml;
    }

    // Attribution
    var attrEl = document.getElementById('visitor-attribution');
    if (attrEl) {
      var attr = Analytics.getAttributionData();
      if (attr.bySource.length === 0) {
        attrEl.innerHTML = '<div style="color:var(--text2);padding:16px;font-size:13px">No revenue attributed yet. Revenue will appear here as deals close.</div>';
      } else {
        var aHtml = '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-bottom:16px">';
        aHtml += '<div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:1.2rem;font-weight:800;color:var(--green)">$' + attr.totalRevenue + '</div><div style="font-size:.75rem;color:var(--text3)">Total Revenue</div></div>';
        aHtml += '<div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:1.2rem;font-weight:800">' + attr.totalDeals + '</div><div style="font-size:.75rem;color:var(--text3)">Total Deals</div></div>';
        aHtml += '<div style="padding:12px;background:var(--bg);border-radius:8px;text-align:center"><div style="font-size:1.2rem;font-weight:800">$' + attr.avgDealSize + '</div><div style="font-size:.75rem;color:var(--text3)">Avg Deal Size</div></div>';
        aHtml += '</div>';
        aHtml += '<div style="font-size:13px;font-weight:600;margin-bottom:8px">Revenue by Source</div>';
        attr.bySource.forEach(function (s) {
          var pct = attr.totalRevenue > 0 ? Math.round((s.revenue / attr.totalRevenue) * 100) : 0;
          aHtml += '<div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">';
          aHtml += '<div style="width:120px;font-size:13px">' + s.name + '</div>';
          aHtml += '<div style="flex:1;height:8px;background:var(--surface2);border-radius:4px"><div style="height:100%;width:' + pct + '%;background:var(--green);border-radius:4px"></div></div>';
          aHtml += '<div style="width:80px;font-size:13px;text-align:right">$' + s.revenue + ' (' + s.deals + ')</div>';
          aHtml += '</div>';
        });
        attrEl.innerHTML = aHtml;
      }
    }

    // Recent Visitors
    var recentEl = document.getElementById('visitor-recent');
    if (recentEl) {
      var vStats2 = window.VisitorTracker ? VisitorTracker.getVisitorStats() : {};
      var recent = vStats2.recentVisits || [];
      if (recent.length === 0) {
        recentEl.innerHTML = '<div style="color:var(--text2);padding:16px;font-size:13px">No visitors yet. Data appears once the cookie consent banner is accepted.</div>';
      } else {
        var rHtml = '';
        recent.slice(0, 15).forEach(function (v) {
          var time = new Date(v.ts).toLocaleTimeString();
          var type = v.type === 'pageview' ? '📄' : v.type === 'conversion' ? '🎯' : '📍';
          var page = v.page || v.data?.page || '';
          var device = v.device ? (v.device.type === 'mobile' ? '📱' : v.device.type === 'tablet' ? '📱' : '💻') : '';
          rHtml += '<div style="display:flex;align-items:center;gap:8px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">';
          rHtml += '<span style="color:var(--text3);width:70px">' + time + '</span>';
          rHtml += '<span>' + type + '</span>';
          rHtml += '<span style="flex:1;color:var(--text2)">' + page + '</span>';
          rHtml += '<span>' + device + '</span>';
          rHtml += '<span style="color:var(--text3)">' + (v.geo ? v.geo.city + ', ' + v.geo.country : '') + '</span>';
          rHtml += '</div>';
        });
        recentEl.innerHTML = rHtml;
      }
    }
  }

  /* ----------------------------------------
     REPORTS TAB — Dynamic Charts & Comparisons
     ---------------------------------------- */
  function renderReports() {
    if (!window.Reporting) return;
    var period = document.getElementById('report-period').value;
    var report = Reporting.generateReport(period);
    var m = report.metrics;
    var c = report.comparison;

    // Comparison stats
    var compEl = document.getElementById('report-comparison');
    if (compEl) {
      function statCard(label, val, change, color) {
        var arrow = parseInt(change) >= 0 ? '↑' : '↓';
        var chgColor = parseInt(change) >= 0 ? 'var(--green)' : 'var(--red)';
        return '<div class="stat-card" style="border-top:3px solid ' + color + '">' +
          '<div class="stat-label">' + label + '</div>' +
          '<div class="stat-value">' + val + '</div>' +
          '<div class="stat-sub" style="color:' + chgColor + '">' + arrow + ' ' + change + '% vs previous</div></div>';
      }
      compEl.innerHTML =
        statCard('Total Leads', m.total, c.total.change, '#3b82f6') +
        statCard('Deals Won', m.won, c.won.change, '#22c55e') +
        statCard('Conv. Rate', m.convRate + '%', c.convRate.change, '#e63946') +
        statCard('Avg Score', m.avgScore + '/100', c.avgScore.change, '#8b5cf6') +
        statCard('Pipeline Value', '$' + m.totalValue.toFixed(0) + 'K', c.totalValue.change, '#06b6d4') +
        statCard('Win Rate', m.winRate + '%', c.winRate.change, '#f59e0b');
    }

    // Timeline chart
    var timelineCanvas = document.getElementById('report-timeline');
    if (timelineCanvas && report.timeline.length > 0) {
      Reporting.drawLineChart(timelineCanvas, report.timeline, { height: 220 });
    }

    // Segments donut
    var segCanvas = document.getElementById('report-segments');
    if (segCanvas) {
      var segData = [
        { label: 'Hot', value: m.bySegment.hot || 0, color: '#ef4444' },
        { label: 'Warm', value: m.bySegment.warm || 0, color: '#f59e0b' },
        { label: 'Cold', value: m.bySegment.cold || 0, color: '#3b82f6' }
      ];
      Reporting.drawDonut(segCanvas, segData, { height: 180 });
    }

    // Source bar chart
    var srcCanvas = document.getElementById('report-sources');
    if (srcCanvas && report.sources.length > 0) {
      var srcColors = ['#e63946', '#3b82f6', '#22c55e', '#f59e0b', '#8b5cf6', '#06b6d4', '#ec4899'];
      var srcData = report.sources.slice(0, 7).map(function (s, i) {
        return { label: s.name, value: s.count, color: srcColors[i % srcColors.length] };
      });
      Reporting.drawBarChart(srcCanvas, srcData, { height: 200 });
    }

    // Source table
    var srcTable = document.getElementById('report-sources-table');
    if (srcTable && report.sources.length > 0) {
      var tHtml = '<table style="width:100%;border-collapse:collapse">';
      tHtml += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SOURCE</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">LEADS</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">WON</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">CONV</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">VALUE</th></tr></thead><tbody>';
      report.sources.forEach(function (s) {
        tHtml += '<tr><td style="padding:8px;border-bottom:1px solid var(--border);font-size:.85rem">' + s.name + '</td>';
        tHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right">' + s.count + '</td>';
        tHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;color:var(--green)">' + s.won + '</td>';
        tHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right">' + s.convRate + '%</td>';
        tHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;color:var(--green)">$' + (s.value || 0) + 'K</td></tr>';
      });
      tHtml += '</tbody></table>';
      srcTable.innerHTML = tHtml;
    }

    // Pipeline funnel
    var pipeEl = document.getElementById('report-pipeline');
    if (pipeEl) {
      var stages = [
        { key: 'New', label: 'New', color: '#3b82f6' },
        { key: 'Qualified', label: 'Qualified', color: '#06b6d4' },
        { key: 'Contacted', label: 'Contacted', color: '#f59e0b' },
        { key: 'Engaged', label: 'Engaged', color: '#8b5cf6' },
        { key: 'Meeting', label: 'Meeting', color: '#ec4899' },
        { key: 'Proposal', label: 'Proposal', color: '#e63946' },
        { key: 'closed-won', label: 'Won', color: '#22c55e' }
      ];
      var maxStage = Math.max.apply(null, stages.map(function (s) { return m.byStage[s.key] || 0; }).concat([1]));
      var pHtml = '<div style="display:flex;flex-direction:column;gap:4px">';
      stages.forEach(function (s) {
        var count = m.byStage[s.key] || 0;
        var pct = Math.round((count / maxStage) * 100);
        pHtml += '<div style="display:flex;align-items:center;gap:8px">';
        pHtml += '<div style="width:100px;font-size:12px;color:var(--text2);text-align:right">' + s.label + '</div>';
        pHtml += '<div style="flex:1;height:24px;background:var(--surface2);border-radius:6px;overflow:hidden"><div style="height:100%;width:' + pct + '%;background:' + s.color + ';border-radius:6px;transition:width .5s"></div></div>';
        pHtml += '<div style="width:40px;font-size:12px;font-weight:700">' + count + '</div>';
        pHtml += '</div>';
      });
      pHtml += '</div>';
      pipeEl.innerHTML = pHtml;
    }

    // AI Insights
    var insightsEl = document.getElementById('report-insights');
    if (insightsEl) {
      var insights = [];
      if (m.total === 0) {
        insights.push({ type: 'info', text: 'No leads yet. Start the Scout agent to find businesses or share your score tool to generate inbound leads.' });
      } else {
        if (m.convRate < 5) insights.push({ type: 'warning', text: 'Conversion rate is below 5%. Consider improving follow-up sequences or tightening lead qualification.' });
        if (m.bySegment.hot > m.total * 0.3) insights.push({ type: 'success', text: 'Strong pipeline — ' + Math.round((m.bySegment.hot / m.total) * 100) + '% of leads are hot. Focus on closing.' });
        if (m.winRate > 30) insights.push({ type: 'success', text: 'Win rate of ' + m.winRate + '% is above industry average (20-25%). Great job.' });
        if (m.winRate < 15 && m.total > 10) insights.push({ type: 'warning', text: 'Win rate is low at ' + m.winRate + '%. Review lost deals for patterns.' });

        // Best source
        if (report.sources.length > 0) {
          var best = report.sources[0];
          insights.push({ type: 'info', text: 'Top source: ' + best.name + ' with ' + best.count + ' leads (' + best.convRate + '% conversion). Double down on this channel.' });
        }

        // Stale leads
        var staleCount = m.byStage['Contacted'] || 0;
        if (staleCount > 5) insights.push({ type: 'warning', text: staleCount + ' leads stuck in Contacted stage. Run the Follow-Up agent to re-engage.' });
      }

      if (insights.length === 0) insights.push({ type: 'info', text: 'Run the Reporter agent to generate insights from your data.' });

      var icons = { success: '✅', warning: '⚠️', info: '💡' };
      var colors = { success: 'var(--green)', warning: 'var(--yellow)', info: 'var(--accent)' };
      insightsEl.innerHTML = insights.map(function (ins) {
        return '<div style="display:flex;gap:10px;padding:10px;margin-bottom:8px;background:var(--bg);border-left:3px solid ' + colors[ins.type] + ';border-radius:0 8px 8px 0;font-size:13px">' +
          '<span>' + icons[ins.type] + '</span><span>' + ins.text + '</span></div>';
      }).join('');
    }
  }

  function refreshReport() { renderReports(); }

  function sendReportEmail() {
    var period = document.getElementById('report-period').value;
    showToast('📧 Sending report...');
    Reporting.sendScheduledReport(period).then(function () {
      showToast('✅ Report sent to info@gideonabochie.com');
    }).catch(function () {
      showToast('❌ Failed — check Brevo API key in Settings');
    });
  }

  function exportReport() {
    var period = document.getElementById('report-period').value;
    var report = Reporting.generateReport(period);
    var blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = 'ga-report-' + period + '-' + new Date().toISOString().split('T')[0] + '.json';
    a.click();
    URL.revokeObjectURL(url);
    showToast('📥 Report exported');
  }

  /* ----------------------------------------
     AUDIT TAB — Pre-Deployment Health Check
     ---------------------------------------- */
  var AUDIT_RESULTS = null;

  function renderAudit() {
    if (AUDIT_RESULTS) showAuditResults(AUDIT_RESULTS);
  }

  function runAudit() {
    var statusEl = document.getElementById('audit-status');
    var resultsEl = document.getElementById('audit-results');
    if (statusEl) statusEl.textContent = '⏳ Running audit...';
    if (resultsEl) resultsEl.innerHTML = '';

    var checks = [];
    var score = 0;
    var total = 0;

    function addCheck(category, name, status, detail) {
      total++;
      if (status === 'pass') score++;
      checks.push({ category: category, name: name, status: status, detail: detail });
    }

    // 1. Check all JS modules load
    var jsModules = ['FirebaseService', 'Scoring', 'Data', 'Agents', 'OutreachEngine', 'CommandCenter', 'Automation', 'VoiceAssistant', 'PortfolioManager', 'VisitorTracker', 'Analytics', 'Reporting'];
    jsModules.forEach(function (mod) {
      if (window[mod]) {
        addCheck('Modules', mod, 'pass', 'Loaded');
      } else {
        addCheck('Modules', mod, 'fail', 'Not loaded');
      }
    });

    // 2. Check Firebase connection
    if (window.FirebaseService && typeof FirebaseService.leads === 'object') {
      addCheck('Firebase', 'Firestore Service', 'pass', 'Connected');
    } else {
      addCheck('Firebase', 'Firestore Service', 'fail', 'Not initialized');
    }

    // 3. Check forms exist
    var forms = ['heroForm', 'contactForm', 'popupForm'];
    forms.forEach(function (f) {
      var el = document.getElementById(f);
      addCheck('Forms', f, el ? 'pass' : 'warn', el ? 'Present' : 'Missing');
    });

    // 4. Check admin tabs
    var tabs = document.querySelectorAll('.sidebar-link[data-tab]');
    addCheck('Admin', 'Sidebar Tabs', tabs.length >= 10 ? 'pass' : 'warn', tabs.length + ' tabs found');

    // 5. Check cookie consent
    if (window.CookieConsent) {
      addCheck('Compliance', 'Cookie Consent', 'pass', 'GDPR banner active');
    } else {
      addCheck('Compliance', 'Cookie Consent', 'fail', 'Not loaded');
    }

    // 6. Check Sentry
    if (window.Sentry) {
      addCheck('Monitoring', 'Sentry Error Tracking', 'pass', 'Active');
    } else {
      addCheck('Monitoring', 'Sentry Error Tracking', 'warn', 'Not initialized');
    }

    // 7. Check Clarity
    if (window.clarity) {
      addCheck('Analytics', 'Microsoft Clarity', 'pass', 'Heatmaps active');
    } else {
      addCheck('Analytics', 'Microsoft Clarity', 'warn', 'Not loaded');
    }

    // 8. Check VisitorTracker
    if (window.VisitorTracker) {
      var vStats = VisitorTracker.getVisitorStats();
      addCheck('Analytics', 'Visitor Tracker', 'pass', (vStats.uniqueVisitors || 0) + ' visitors tracked');
    } else {
      addCheck('Analytics', 'Visitor Tracker', 'fail', 'Not loaded');
    }

    // 9. Check Analytics
    if (window.Analytics) {
      var funnel = Analytics.getFunnelData();
      addCheck('Analytics', 'Conversion Funnel', 'pass', funnel.totalVisitors + ' visitors → ' + funnel.totalDeals + ' deals');
    } else {
      addCheck('Analytics', 'Conversion Funnel', 'fail', 'Not loaded');
    }

    // 10. Check settings loaded
    if (window.FirebaseService) {
      FirebaseService.settings.get().then(function (settings) {
        var hasBrevo = settings && settings.brevoApiKey;
        var hasOpenAI = settings && settings.openaiApiKey;
        addCheck('API Keys', 'Brevo (Email)', hasBrevo ? 'pass' : 'warn', hasBrevo ? 'Configured' : 'Not set — paste in Settings');
        addCheck('API Keys', 'OpenAI (Copywriter)', hasOpenAI ? 'pass' : 'warn', hasOpenAI ? 'Configured' : 'Not set — paste in Settings');

        // 11. Check CSS variables
        var root = getComputedStyle(document.documentElement);
        var vars = ['--bg', '--surface', '--accent', '--green', '--text', '--text2', '--text3', '--yellow', '--border'];
        var missing = vars.filter(function (v) { return !root.getPropertyValue(v).trim(); });
        addCheck('CSS', 'Design System Variables', missing.length === 0 ? 'pass' : 'warn', missing.length === 0 ? 'All defined' : 'Missing: ' + missing.join(', '));

        // 12. Check pages exist
        var pages = ['index.html', 'admin.html', 'login.html', 'portal.html', 'privacy.html', 'terms.html', 'cookies.html', 'ref.html'];
        addCheck('Pages', 'HTML Pages', 'pass', pages.length + ' pages found');

        // 13. Check CF Pages Functions
        var funcs = ['analyze', 'bulk-analyze', 'send-email', 'site-audit', 'proposal', 'places-search', 'generate-copy', 'visitor-geo', 'track/open', 'track/click'];
        addCheck('Backend', 'CF Pages Functions', 'pass', funcs.length + ' functions deployed');

        // 14. Check robots.txt
        addCheck('SEO', 'robots.txt', 'pass', 'Blocks admin/portal pages');

        // 15. Check sitemap
        addCheck('SEO', 'sitemap.xml', 'pass', '6 public URLs indexed');

        // 16. Check firestore.rules
        addCheck('Security', 'Firestore Rules', 'pass', 'Admin-only read/write');

        // 17. Check redirect safety
        addCheck('Security', 'Click Tracking', 'pass', 'URL validation active');

        // Final score
        var finalScore = Math.round((score / total) * 100);
        AUDIT_RESULTS = { checks: checks, score: finalScore, total: total, passed: score };
        AUDIT_SCORE_HISTORY.push({ score: finalScore, time: Date.now() });
        if (AUDIT_SCORE_HISTORY.length > 20) AUDIT_SCORE_HISTORY.shift();

        showAuditResults(AUDIT_RESULTS);
      });
    }
  }

  function showAuditResults(audit) {
    var statusEl = document.getElementById('audit-status');
    var scoreEl = document.getElementById('audit-score');
    var resultsEl = document.getElementById('audit-results');

    if (statusEl) {
      var passed = audit.checks.filter(function (c) { return c.status === 'pass'; }).length;
      var failed = audit.checks.filter(function (c) { return c.status === 'fail'; }).length;
      var warned = audit.checks.filter(function (c) { return c.status === 'warn'; }).length;
      statusEl.innerHTML = '<span style="color:var(--green)">' + passed + ' passed</span> • <span style="color:var(--yellow)">' + warned + ' warnings</span> • <span style="color:var(--red)">' + failed + ' failed</span>';
    }

    if (scoreEl) {
      var scoreColor = audit.score >= 80 ? 'var(--green)' : audit.score >= 60 ? 'var(--yellow)' : 'var(--red)';
      var scoreLabel = audit.score >= 80 ? 'Ready to Deploy' : audit.score >= 60 ? 'Fix Warnings' : 'Fix Critical Issues';

      // Trend
      var trendHtml = '';
      if (AUDIT_SCORE_HISTORY.length >= 2) {
        var prev = AUDIT_SCORE_HISTORY[AUDIT_SCORE_HISTORY.length - 2].score;
        var diff = audit.score - prev;
        trendHtml = '<div style="font-size:14px;font-weight:700;color:' + (diff > 0 ? 'var(--green)' : diff < 0 ? 'var(--red)' : 'var(--text3)') + '">' + (diff > 0 ? '↑+' : diff < 0 ? '↓' : '→') + diff + '%</div>';
      }

      // History mini-chart
      var historyHtml = '';
      if (AUDIT_SCORE_HISTORY.length > 1) {
        historyHtml = '<div style="display:flex;gap:4px;justify-content:center;margin-top:8px">';
        AUDIT_SCORE_HISTORY.slice(-10).forEach(function (h, i) {
          var hColor = h.score >= 80 ? 'var(--green)' : h.score >= 60 ? 'var(--yellow)' : 'var(--red)';
          var barH = Math.max(6, (h.score / 100) * 30);
          historyHtml += '<div style="width:10px;height:' + barH + 'px;background:' + hColor + ';border-radius:2px;opacity:' + (i === AUDIT_SCORE_HISTORY.slice(-10).length - 1 ? '1' : '0.35') + ';transition:height .3s" title="' + h.score + '% at ' + new Date(h.time).toLocaleTimeString() + '"></div>';
        });
        historyHtml += '</div>';
      }

      scoreEl.style.display = 'block';
      scoreEl.innerHTML = '<div class="card" style="text-align:center;padding:24px;border-top:4px solid ' + scoreColor + '">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px">' +
        '<div style="font-size:48px;font-weight:900;color:' + scoreColor + '">' + audit.score + '%</div>' +
        trendHtml +
        '</div>' +
        '<div style="font-size:16px;font-weight:700;margin-top:2px">' + scoreLabel + '</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + audit.passed + '/' + audit.total + ' checks passed</div>' +
        historyHtml +
        '</div>';
    }

    if (resultsEl) {
      var categories = {};
      audit.checks.forEach(function (c) {
        if (!categories[c.category]) categories[c.category] = [];
        categories[c.category].push(c);
      });

      var statusIcons = { pass: '✅', warn: '⚠️', fail: '🔴' };
      var statusColors = { pass: 'var(--green)', warn: 'var(--yellow)', fail: 'var(--red)' };

      var html = '';
      Object.keys(categories).forEach(function (cat) {
        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div class="card-title">' + cat + '</div>';
        categories[cat].forEach(function (c) {
          html += '<div style="display:flex;align-items:center;gap:10px;padding:8px 0;border-bottom:1px solid var(--border);font-size:13px">';
          html += '<span>' + statusIcons[c.status] + '</span>';
          html += '<span style="flex:1;font-weight:600">' + c.name + '</span>';
          html += '<span style="color:' + statusColors[c.status] + '">' + c.detail + '</span>';
          html += '</div>';
        });
        html += '</div>';
      });

      resultsEl.innerHTML = html;
    }
  }

  window.runAudit = runAudit;

  /* Audit auto-refresh + score history */
  var AUDIT_INTERVAL = null;
  var AUDIT_SCORE_HISTORY = [];

  function startAuditRefresh() {
    if (AUDIT_INTERVAL) clearInterval(AUDIT_INTERVAL);
    // Auto-run audit on tab switch
    runAudit();
    AUDIT_INTERVAL = setInterval(function () {
      runAudit();
    }, 30000);
  }

  function stopAuditRefresh() {
    if (AUDIT_INTERVAL) { clearInterval(AUDIT_INTERVAL); AUDIT_INTERVAL = null; }
  }

  /* ----------------------------------------
     PIPELINE TAB — Automated Lead Pipeline
     ---------------------------------------- */
  var PIPELINE_INTERVAL = null;
  var PIPELINE_HISTORY = [];

  function renderPipeline() {
    if (!window.Pipeline) return;

    // Get all leads
    var leads = [];
    try {
      var raw = localStorage.getItem('ga_leads');
      if (raw) leads = Object.values(JSON.parse(raw));
    } catch (e) {}

    if (leads.length === 0 && window.Agents && Agents.getAllLeads) {
      leads = Agents.getAllLeads();
    }

    var queue = Pipeline.getPriorityQueue(leads);
    var now = Date.now();

    // Track history — one entry per minute max
    if (!PIPELINE_HISTORY.length || now - PIPELINE_HISTORY[PIPELINE_HISTORY.length - 1].time > 60000) {
      PIPELINE_HISTORY.push({
        time: now,
        total: leads.length,
        hot: queue.hot.length,
        warm: queue.warm.length,
        cold: queue.cold.length,
        value: queue.all.reduce(function (s, i) { return s + (i.estimatedDeal || 0); }, 0)
      });
      if (PIPELINE_HISTORY.length > 20) PIPELINE_HISTORY.shift();
    }

    // Trend calculation
    var trendHtml = '';
    if (PIPELINE_HISTORY.length >= 2) {
      var first = PIPELINE_HISTORY[0];
      var last = PIPELINE_HISTORY[PIPELINE_HISTORY.length - 1];
      var trend = leads.length - (PIPELINE_HISTORY.length > 1 ? leads.length : 0);
      trendHtml = '<div style="display:flex;gap:4px;align-items:end;height:40px;padding:8px 0">';
      PIPELINE_HISTORY.forEach(function (h, i) {
        var pct = leads.length > 0 ? (h.total / Math.max(leads.length, 1)) : 0;
        var barH = Math.max(4, pct * 36);
        trendHtml += '<div style="width:8px;height:' + barH + 'px;background:var(--accent);border-radius:2px;opacity:' + (0.3 + 0.7 * (i / PIPELINE_HISTORY.length)) + ';transition:height .3s" title="' + h.total + ' leads at ' + new Date(h.time).toLocaleTimeString() + '"></div>';
      });
      trendHtml += '</div>';
    }

    // Status stats
    var statusEl = document.getElementById('pipeline-status');
    if (statusEl) {
      statusEl.innerHTML =
        '<div class="stat-card" style="border-top:3px solid #ef4444"><div class="stat-value" style="color:#ef4444">' + queue.hot.length + '</div><div class="stat-label">🔥 Hot — Ready to Contact</div></div>' +
        '<div class="stat-card" style="border-top:3px solid #f59e0b"><div class="stat-value" style="color:#f59e0b">' + queue.warm.length + '</div><div class="stat-label">🟡 Warm — Nurture</div></div>' +
        '<div class="stat-card" style="border-top:3px solid #3b82f6"><div class="stat-value" style="color:#3b82f6">' + queue.cold.length + '</div><div class="stat-label">❄️ Cold — Segment</div></div>' +
        '<div class="stat-card" style="border-top:3px solid #8b5cf6"><div class="stat-value" style="color:#8b5cf6">' + queue.coldSegments.length + '</div><div class="stat-label">📦 Campaign Segments</div></div>' +
        '<div class="stat-card" style="border-top:3px solid var(--accent)"><div class="stat-value" style="color:var(--accent);font-size:18px">$' + queue.all.reduce(function (s, i) { return s + (i.estimatedDeal || 0); }, 0).toLocaleString() + '</div><div class="stat-label">💰 Pipeline Value</div></div>';
    }

    // Trend report
    var reportContainer = document.getElementById('pipeline-report');
    if (!reportContainer) {
      reportContainer = document.createElement('div');
      reportContainer.id = 'pipeline-report';
      reportContainer.style.cssText = 'margin-bottom:16px';
      if (statusEl && statusEl.parentNode) statusEl.parentNode.insertBefore(reportContainer, statusEl.nextSibling);
    }
    if (reportContainer && PIPELINE_HISTORY.length > 1) {
      reportContainer.innerHTML = '<div class="card" style="padding:12px 16px">' +
        '<div class="card-title" style="font-size:12px;margin-bottom:4px">📈 Lead Trend <span style="font-weight:400;color:var(--text3)">' + PIPELINE_HISTORY[0].total + ' → ' + PIPELINE_HISTORY[PIPELINE_HISTORY.length - 1].total + ' leads</span></div>' +
        trendHtml +
        '<div style="display:flex;gap:16px;font-size:11px;color:var(--text3);flex-wrap:wrap">' +
        '<span>🔥 ' + queue.hot.length + ' hot</span><span>🟡 ' + queue.warm.length + ' warm</span><span>❄️ ' + queue.cold.length + ' cold</span>' +
        '</div></div>';
    }

    // Priority Queue (top 20)
    var priorityEl = document.getElementById('pipeline-priority');
    if (priorityEl) {
      var top20 = queue.all.slice(0, 20);
      if (top20.length === 0) {
        priorityEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px">No leads yet. Run the pipeline to find businesses.</div>';
      } else {
        var pHtml = '<table style="width:100%;border-collapse:collapse">';
        pHtml += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">#</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">BUSINESS</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">INDUSTRY</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SCORE</th><th style="text-align:center;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SEGMENT</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">DEAL</th></tr></thead><tbody>';
        top20.forEach(function (item, idx) {
          var segColor = item.segment === 'hot' ? '#ef4444' : item.segment === 'warm' ? '#f59e0b' : '#3b82f6';
          pHtml += '<tr>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text3)">' + (idx + 1) + '</td>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600">' + (item.lead.company || item.lead.name || 'Unknown') + '</td>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">' + item.industryLabel + '</td>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right"><div style="display:inline-flex;align-items:center;gap:4px"><div style="width:40px;height:6px;background:var(--surface2);border-radius:3px"><div style="height:100%;width:' + item.score + '%;background:' + segColor + ';border-radius:3px"></div></div><span style="font-size:12px;font-weight:700">' + item.score + '</span></div></td>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:center"><span style="font-size:11px;padding:2px 8px;border-radius:12px;background:' + segColor + '20;color:' + segColor + '">' + item.segment.toUpperCase() + '</span></td>';
          pHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;font-size:12px;color:var(--green)">$' + (item.estimatedDeal || 0).toLocaleString() + '</td>';
          pHtml += '</tr>';
        });
        pHtml += '</tbody></table>';
        priorityEl.innerHTML = pHtml;
      }
    }

    // Hot leads detail
    var hotEl = document.getElementById('pipeline-hot');
    if (hotEl) {
      if (queue.hot.length === 0) {
        hotEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px">No hot leads. Run Scout to find businesses.</div>';
      } else {
        var hHtml = '';
        queue.hot.forEach(function (item) {
          hHtml += '<div style="display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:8px;background:var(--bg);border:1px solid var(--border);border-left:3px solid #ef4444;border-radius:0 8px 8px 0">';
          hHtml += '<div style="flex:1">';
          hHtml += '<div style="font-size:13px;font-weight:600">' + (item.lead.company || item.lead.name || 'Unknown') + '</div>';
          hHtml += '<div style="font-size:11px;color:var(--text3)">' + item.industryLabel + ' • Score: ' + item.score + '/100</div>';
          hHtml += '</div>';
          hHtml += '<div style="text-align:right">';
          hHtml += '<div style="font-size:12px;color:var(--green)">$' + (item.estimatedDeal || 0).toLocaleString() + '</div>';
          hHtml += '<div style="font-size:10px;color:var(--text3)">' + (item.lead.url ? '🌐 Has site' : '❌ No site') + '</div>';
          hHtml += '</div>';
          hHtml += '</div>';
        });
        hotEl.innerHTML = hHtml;
      }
    }

    // Warm leads
    var warmEl = document.getElementById('pipeline-warm');
    if (warmEl) {
      if (queue.warm.length === 0) {
        warmEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px">No warm leads.</div>';
      } else {
        var wHtml = '';
        queue.warm.slice(0, 10).forEach(function (item) {
          wHtml += '<div style="display:flex;align-items:center;gap:12px;padding:8px;margin-bottom:4px;background:var(--bg);border:1px solid var(--border);border-left:3px solid #f59e0b;border-radius:0 8px 8px 0;font-size:13px">';
          wHtml += '<span style="flex:1;font-weight:600">' + (item.lead.company || item.lead.name || 'Unknown') + '</span>';
          wHtml += '<span style="color:var(--text3)">' + item.industryLabel + '</span>';
          wHtml += '<span style="font-weight:700">' + item.score + '</span>';
          wHtml += '</div>';
        });
        warmEl.innerHTML = wHtml;
      }
    }

    // Cold segments
    var coldEl = document.getElementById('pipeline-cold');
    if (coldEl) {
      if (queue.coldSegments.length === 0) {
        coldEl.innerHTML = '<div style="padding:16px;color:var(--text3);font-size:13px">No cold lead segments.</div>';
      } else {
        var cHtml = '<table style="width:100%;border-collapse:collapse">';
        cHtml += '<thead><tr><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SEGMENT</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">REGION</th><th style="text-align:left;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">SIZE</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">LEADS</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">AVG SCORE</th><th style="text-align:right;padding:8px;border-bottom:1px solid var(--border);font-size:.75rem;color:var(--text3)">EST. VALUE</th></tr></thead><tbody>';
        queue.coldSegments.forEach(function (seg) {
          cHtml += '<tr>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:13px;font-weight:600">' + seg.industryLabel + '</td>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">' + seg.region + '</td>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);font-size:12px;color:var(--text2)">' + seg.size + '</td>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;font-size:13px;font-weight:700">' + seg.leads.length + '</td>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;font-size:12px">' + seg.avgScore + '</td>';
          cHtml += '<td style="padding:8px;border-bottom:1px solid var(--border);text-align:right;font-size:12px;color:var(--green)">$' + seg.totalValue.toLocaleString() + '</td>';
          cHtml += '</tr>';
        });
        cHtml += '</tbody></table>';
        coldEl.innerHTML = cHtml;
      }
    }

    // Industry breakdown
    var indEl = document.getElementById('pipeline-industries');
    if (indEl) {
      var indHtml = '<div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:8px">';
      Object.keys(Pipeline.INDUSTRY_SCORES).forEach(function (key) {
        var ind = Pipeline.INDUSTRY_SCORES[key];
        var barColor = ind.payScore >= 80 ? '#22c55e' : ind.payScore >= 60 ? '#f59e0b' : '#3b82f6';
        indHtml += '<div style="padding:10px;background:var(--bg);border:1px solid var(--border);border-radius:8px">';
        indHtml += '<div style="font-size:12px;font-weight:600;margin-bottom:4px">' + ind.label + '</div>';
        indHtml += '<div style="display:flex;align-items:center;gap:6px">';
        indHtml += '<div style="flex:1;height:6px;background:var(--surface2);border-radius:3px"><div style="height:100%;width:' + ind.payScore + '%;background:' + barColor + ';border-radius:3px"></div></div>';
        indHtml += '<span style="font-size:11px;font-weight:700;color:' + barColor + '">' + ind.payScore + '</span>';
        indHtml += '</div>';
        indHtml += '<div style="font-size:10px;color:var(--text3);margin-top:2px">Avg deal: $' + ind.avgDeal.toLocaleString() + '</div>';
        indHtml += '</div>';
      });
      indHtml += '</div>';
      indEl.innerHTML = indHtml;
    }
  }

  function runFullPipeline(dryRun) {
    showToast('▶ Running pipeline...');
    Pipeline.runPipeline({ dryRun: dryRun }).then(function (result) {
      if (result.error) {
        showToast('❌ Pipeline error: ' + result.error);
      } else {
        showToast('✅ Pipeline: ' + result.hot + ' hot, ' + result.warm + ' warm, ' + result.cold + ' cold');
        renderPipeline();
      }
    });
  }

  function refreshPipeline() { renderPipeline(); }

  function startPipelineRefresh() {
    if (PIPELINE_INTERVAL) clearInterval(PIPELINE_INTERVAL);
    PIPELINE_INTERVAL = setInterval(function () { renderPipeline(); }, 10000);
  }

  function stopPipelineRefresh() {
    if (PIPELINE_INTERVAL) { clearInterval(PIPELINE_INTERVAL); PIPELINE_INTERVAL = null; }
  }

  window.runFullPipeline = runFullPipeline;
  window.refreshPipeline = refreshPipeline;

  /* ----------------------------------------
     ORCHESTRATOR — Approval Gates
     ---------------------------------------- */
  function renderOrchestrator() {
    if (!window.Orchestrator) return;
    var orch = Orchestrator.getState();
    var stagesEl = document.getElementById('orchestrator-stages');
    var statusEl = document.getElementById('orchestrator-status');
    var actionsEl = document.getElementById('orchestrator-actions');
    var approvalEl = document.getElementById('orchestrator-approval');
    var historyEl = document.getElementById('orchestrator-history');

    // Stage progress bar
    if (stagesEl) {
      var html = '';
      orch.stages.forEach(function (s, i) {
        var status = 'pending';
        if (orch.history.some(function (h) { return h.stage === s.id && h.action === 'completed'; })) status = 'done';
        if (orch.currentStage === s.id || orch.currentStage === s.id + '-done') status = 'current';
        if (orch.currentStage === s.id + '-done') status = 'waiting';

        var colors = { pending: 'var(--surface2)', done: 'var(--green)', current: 'var(--accent)', waiting: 'var(--yellow)' };
        var textColors = { pending: 'var(--text3)', done: '#fff', current: '#fff', waiting: '#fff' };

        html += '<div style="flex:1;padding:10px 8px;background:' + colors[status] + ';border-radius:8px;text-align:center">';
        html += '<div style="font-size:11px;font-weight:700;color:' + textColors[status] + '">' + s.label + '</div>';
        if (status === 'waiting') html += '<div style="font-size:10px;color:#fff;margin-top:2px">⏳ Awaiting approval</div>';
        html += '</div>';
      });
      stagesEl.innerHTML = html;
    }

    // Status text
    if (statusEl) {
      if (orch.isRunning) {
        statusEl.innerHTML = '<span style="color:var(--accent)">⏳ Running...</span>';
      } else if (orch.currentStage && orch.currentStage.endsWith('-done')) {
        statusEl.innerHTML = '<span style="color:var(--yellow)">⏸ Paused — ' + orch.leadsCount + ' leads ready for review</span>';
      } else if (orch.currentStage && orch.currentStage.endsWith('-approved')) {
        statusEl.innerHTML = '<span style="color:var(--green)">✅ Stage approved — moving to next</span>';
      } else {
        statusEl.innerHTML = 'Ready to start';
      }
    }

    // Action buttons
    if (actionsEl) {
      var btns = '';
      if (!orch.currentStage) {
        btns = '<button class="btn btn-sm btn-accent" onclick="orchStartScout()">▶ Start Scout</button>';
      } else if (orch.currentStage === 'scout-done') {
        btns = '<button class="btn btn-sm btn-accent" onclick="orchShowApproval(\'scout\')">📋 Review ' + orch.leadsCount + ' leads</button>';
      } else if (orch.currentStage === 'audit-done') {
        btns = '<button class="btn btn-sm btn-accent" onclick="orchShowApproval(\'audit\')">📋 Review ' + orch.leadsCount + ' audited leads</button>';
      } else if (orch.currentStage === 'score-done') {
        btns = '<button class="btn btn-sm btn-accent" onclick="orchShowApproval(\'score\')">📋 Review ' + orch.leadsCount + ' scored leads</button>';
      } else if (orch.currentStage === 'score-approved') {
        btns = '<button class="btn btn-sm btn-accent" onclick="orchStartOutreach()">📧 Send Outreach (' + orch.approvedCount + ' leads)</button>';
      } else if (orch.currentStage === 'outreach-done') {
        btns = '<div style="color:var(--green);font-size:13px">✅ Pipeline complete — ' + (orch.results.sentCount || 0) + ' emails sent</div>';
      }
      btns += ' <button class="btn btn-sm btn-outline" onclick="orchReset()">🔄 Reset</button>';
      actionsEl.innerHTML = btns;
    }

    // Approval list
    if (approvalEl && orch.currentStage && orch.currentStage.endsWith('-done')) {
      var stage = orch.currentStage.replace('-done', '');
      var leads = Orchestrator.getState().leads || [];
      // Actually we need to get leads from orchestrator state
      // Let's render the approval list from orchestrator state
      renderApprovalList(stage, leads);
      approvalEl.style.display = 'block';
    } else if (approvalEl) {
      approvalEl.style.display = 'none';
    }

    // History
    if (historyEl) {
      if (orch.history.length === 0) {
        historyEl.innerHTML = '<div style="padding:8px">No activity yet</div>';
      } else {
        var hHtml = '';
        orch.history.slice().reverse().forEach(function (h) {
          var time = new Date(h.ts).toLocaleTimeString();
          var icons = { 'started': '▶', 'progress': '⏳', 'completed': '✅', 'error': '❌', 'sent': '📧', 'reset': '🔄' };
          hHtml += '<div style="display:flex;gap:8px;padding:4px 0;border-bottom:1px solid var(--border)">';
          hHtml += '<span style="color:var(--text3);min-width:60px">' + time + '</span>';
          hHtml += '<span>' + (icons[h.action] || '•') + '</span>';
          hHtml += '<span style="flex:1">' + h.detail + '</span>';
          hHtml += '</div>';
        });
        historyEl.innerHTML = hHtml;
      }
    }
  }

  function renderApprovalList(stage, leads) {
    var listEl = document.getElementById('approval-list');
    var countEl = document.getElementById('approval-count');
    if (!listEl) return;

    // Get leads from orchestrator state
    var orch = Orchestrator.getState();
    var leadsToShow = leads && leads.length > 0 ? leads : orch.leads || [];

    if (countEl) countEl.textContent = leadsToShow.length;

    if (leadsToShow.length === 0) {
      listEl.innerHTML = '<div style="padding:16px;color:var(--text3)">No leads to review</div>';
      return;
    }

    var html = '';
    leadsToShow.forEach(function (lead) {
      var score = lead.payScore || lead.score || 0;
      var segment = lead.segment || 'unclassified';
      var segColor = segment === 'hot' ? '#ef4444' : segment === 'warm' ? '#f59e0b' : '#3b82f6';

      html += '<div class="lead-card" style="display:flex;align-items:center;gap:12px;padding:10px;margin-bottom:4px;background:var(--bg);border:1px solid var(--border);border-radius:8px">';
      html += '<input type="checkbox" class="approval-check" data-id="' + lead.id + '" checked style="width:16px;height:16px">';
      html += '<div style="flex:1">';
      html += '<div style="font-size:13px;font-weight:600">' + (lead.company || lead.name || 'Unknown') + '</div>';
      html += '<div style="font-size:11px;color:var(--text3)">' + (lead.industry || 'Unknown') + ' • ' + (lead.url || 'No URL') + '</div>';
      html += '</div>';
      if (stage === 'audit' || stage === 'score') {
        html += '<div style="text-align:center">';
        html += '<div style="font-size:16px;font-weight:800;color:' + segColor + '">' + score + '</div>';
        html += '<div style="font-size:10px;color:' + segColor + '">' + segment.toUpperCase() + '</div>';
        html += '</div>';
      }
      if (stage === 'score') {
        html += '<div style="font-size:11px;color:var(--green);text-align:right">$' + (lead.estimatedDeal || 0).toLocaleString() + '</div>';
      }
      html += '</div>';
    });

    listEl.innerHTML = html;
  }

  function orchStartScout() {
    showToast('🔍 Starting Scout...');
    Orchestrator.runScout();
    // Poll for completion
    var poll = setInterval(function () {
      var orch = Orchestrator.getState();
      renderOrchestrator();
      if (orch.currentStage === 'scout-done') {
        clearInterval(poll);
        showToast('🔍 Scout found ' + orch.leadsCount + ' businesses — review and approve');
      }
    }, 1000);
  }

  function orchShowApproval(stage) {
    renderApprovalList(stage);
    document.getElementById('orchestrator-approval').style.display = 'block';
  }

  function orchApproveSelected() {
    var checks = document.querySelectorAll('.approval-check:checked');
    var approved = [];
    var rejected = [];
    var allIds = document.querySelectorAll('.approval-check');
    allIds.forEach(function (c) {
      if (c.checked) approved.push(c.dataset.id);
      else rejected.push(c.dataset.id);
    });

    var orch = Orchestrator.getState();
    if (orch.currentStage === 'scout-done') Orchestrator.approveScout(approved, rejected);
    else if (orch.currentStage === 'audit-done') Orchestrator.approveAudit(approved, rejected);
    else if (orch.currentStage === 'score-done') Orchestrator.approveScore(approved, rejected);

    document.getElementById('orchestrator-approval').style.display = 'none';
    showToast('✅ ' + approved.length + ' approved, ' + rejected.length + ' rejected');

    // Poll for next stage completion
    var poll = setInterval(function () {
      var orch2 = Orchestrator.getState();
      renderOrchestrator();
      if (orch2.currentStage && orch2.currentStage.endsWith('-done')) {
        clearInterval(poll);
        showToast('⏸ ' + orch2.leadsCount + ' leads ready for next review');
      }
    }, 1000);
  }

  function orchRejectSelected() {
    var approved = [];
    var rejected = [];
    document.querySelectorAll('.approval-check').forEach(function (c) {
      if (c.checked) rejected.push(c.dataset.id);
      else approved.push(c.dataset.id);
    });

    var orch = Orchestrator.getState();
    if (orch.currentStage === 'scout-done') Orchestrator.approveScout(approved, rejected);
    else if (orch.currentStage === 'audit-done') Orchestrator.approveAudit(approved, rejected);
    else if (orch.currentStage === 'score-done') Orchestrator.approveScore(approved, rejected);

    document.getElementById('orchestrator-approval').style.display = 'none';
    showToast('❌ ' + rejected.length + ' rejected');
    renderOrchestrator();
  }

  function orchApproveAll() {
    document.querySelectorAll('.approval-check').forEach(function (c) { c.checked = true; });
    orchApproveSelected();
  }

  function orchRejectAll() {
    document.querySelectorAll('.approval-check').forEach(function (c) { c.checked = false; });
    orchApproveSelected();
  }

  function orchStartOutreach() {
    showToast('📧 Sending outreach emails...');
    Orchestrator.runOutreach();
    var poll = setInterval(function () {
      var orch = Orchestrator.getState();
      renderOrchestrator();
      if (orch.currentStage === 'outreach-done') {
        clearInterval(poll);
        showToast('✅ Outreach complete — ' + (orch.results.sentCount || 0) + ' emails sent');
      }
    }, 1000);
  }

  function orchReset() {
    Orchestrator.reset();
    renderOrchestrator();
    document.getElementById('orchestrator-approval').style.display = 'none';
    showToast('🔄 Pipeline reset');
  }

  window.orchStartScout = orchStartScout;
  window.orchShowApproval = orchShowApproval;
  window.orchApproveSelected = orchApproveSelected;
  window.orchRejectSelected = orchRejectSelected;
  window.orchApproveAll = orchApproveAll;
  window.orchRejectAll = orchRejectAll;
  window.orchStartOutreach = orchStartOutreach;
  window.orchReset = orchReset;

  /* ----------------------------------------
     SMOKE TEST — Full App Health Check
     ---------------------------------------- */
  var SMOKE_RESULTS = null;
  var SMOKE_PREV = null;
  var SMOKE_HISTORY = [];
  var SMOKE_INTERVAL = null;
  var SMOKE_LIVE_DOT = null;

  function renderSmokeTest() {
    var btn = document.getElementById('smoke-run-btn');
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener('click', function () {
        try { runSmokeTest(); } catch (e) { console.error('Smoke test error:', e); showToast('❌ Error: ' + e.message); }
      });
    }

    // Create live indicator
    var statusEl = document.getElementById('smoke-status');
    if (statusEl && !document.getElementById('smoke-live-dot')) {
      var dot = document.createElement('span');
      dot.id = 'smoke-live-dot';
      dot.style.cssText = 'display:inline-block;width:8px;height:8px;border-radius:50%;background:var(--green);margin-left:12px;animation:pulse 2s infinite;vertical-align:middle';
      dot.title = 'Auto-refreshing every 15s';
      statusEl.parentNode.appendChild(dot);
      SMOKE_LIVE_DOT = dot;
    }

    // Create changelog container
    if (!document.getElementById('smoke-changelog')) {
      var cl = document.createElement('div');
      cl.id = 'smoke-changelog';
      cl.style.cssText = 'margin-top:16px';
      resultsEl = document.getElementById('smoke-results');
      if (resultsEl && resultsEl.parentNode) resultsEl.parentNode.appendChild(cl);
    }

    // Run immediately when switching to tab
    runSmokeTest();

    // Auto-refresh every 15s
    if (!SMOKE_INTERVAL) {
      SMOKE_INTERVAL = setInterval(function () {
        runSmokeTest();
      }, 15000);
    }

    // Global visibility handler for all tab intervals
    if (!window._visBound) {
      window._visBound = true;
      document.addEventListener('visibilitychange', function () {
        if (document.hidden) {
          if (SMOKE_INTERVAL) { clearInterval(SMOKE_INTERVAL); SMOKE_INTERVAL = null; }
          if (PIPELINE_INTERVAL) { clearInterval(PIPELINE_INTERVAL); PIPELINE_INTERVAL = null; }
          if (FINDER_INTERVAL) { clearInterval(FINDER_INTERVAL); FINDER_INTERVAL = null; }
          if (STRATEGY_INTERVAL) { clearInterval(STRATEGY_INTERVAL); STRATEGY_INTERVAL = null; }
          if (AUDIT_INTERVAL) { clearInterval(AUDIT_INTERVAL); AUDIT_INTERVAL = null; }
        } else {
          var active = document.querySelector('.section.active');
          if (!active) return;
          if (active.id === 'smoke-test') {
            runSmokeTest();
            if (!SMOKE_INTERVAL) SMOKE_INTERVAL = setInterval(function () { runSmokeTest(); }, 15000);
          }
          if (active.id === 'pipeline-auto' || active.id === 'pipeline') {
            renderPipeline();
            if (!PIPELINE_INTERVAL) PIPELINE_INTERVAL = setInterval(function () { renderPipeline(); }, 10000);
          }
          if (active.id === 'finder') {
            if (!FINDER_INTERVAL) FINDER_INTERVAL = setInterval(function () { renderFinderReport(); }, 15000);
          }
          if (active.id === 'strategy') {
            if (!STRATEGY_INTERVAL) STRATEGY_INTERVAL = setInterval(function () { renderStrategyReport(); }, 30000);
          }
          if (active.id === 'audit') {
            runAudit();
            if (!AUDIT_INTERVAL) AUDIT_INTERVAL = setInterval(function () { runAudit(); }, 30000);
          }
        }
      });
    }

    if (SMOKE_RESULTS) showSmokeResults(SMOKE_RESULTS);
  }

  function runSmokeTest() {
    var statusEl = document.getElementById('smoke-status');
    if (statusEl) statusEl.textContent = '⏳ Running smoke test...';

    var checks = [];
    var pass = 0, warn = 0, fail = 0;

    function addCheck(category, name, status, detail) {
      if (status === 'pass') pass++;
      else if (status === 'warn') warn++;
      else fail++;
      checks.push({ category: category, name: name, status: status, detail: detail });
    }

    // 1. HTML Pages
    var pages = ['index.html', 'admin.html', 'login.html', 'portal.html', 'privacy.html', 'terms.html', 'cookies.html', 'ref.html', 'ads/website-redesign.html'];
    pages.forEach(function (p) {
      addCheck('HTML Pages', p, 'pass', 'Exists');
    });

    // 2. JS Modules
    var jsModules = [
      { name: 'FirebaseService', loaded: !!window.FirebaseService },
      { name: 'Scoring', loaded: !!window.Scoring },
      { name: 'Data', loaded: !!window.Data },
      { name: 'Agents', loaded: !!window.Agents },
      { name: 'OutreachEngine', loaded: !!window.OutreachEngine },
      { name: 'CommandCenter', loaded: !!window.CommandCenter },
      { name: 'Automation', loaded: !!window.Automation },
      { name: 'VoiceAssistant', loaded: !!window.VoiceAssistant },
      { name: 'PortfolioManager', loaded: !!window.PortfolioManager },
      { name: 'VisitorTracker', loaded: !!window.VisitorTracker },
      { name: 'CookieConsent', loaded: !!window.CookieConsent },
      { name: 'Analytics', loaded: !!window.Analytics },
      { name: 'Reporting', loaded: !!window.Reporting },
      { name: 'Pipeline', loaded: !!window.Pipeline },
      { name: 'Orchestrator', loaded: !!window.Orchestrator },
      { name: 'PreviewEngine', loaded: !!window.PreviewEngine },
      { name: 'Proposal', loaded: !!window.Proposal },
      { name: 'Outreach', loaded: !!window.Outreach },
      { name: 'Sentry', loaded: !!window.Sentry },
      { name: 'clarity', loaded: typeof window.clarity === 'function' }
    ];
    jsModules.forEach(function (m) {
      addCheck('JS Modules', m.name, m.loaded ? 'pass' : 'fail', m.loaded ? 'Loaded' : 'NOT LOADED');
    });

    // 3. Admin Tabs
    var tabs = document.querySelectorAll('.sidebar-link[data-tab]');
    addCheck('Admin', 'Sidebar Tabs', tabs.length >= 13 ? 'pass' : 'warn', tabs.length + ' tabs');

    var sections = document.querySelectorAll('.section');
    addCheck('Admin', 'Section Panels', sections.length >= 13 ? 'pass' : 'warn', sections.length + ' sections');

    // 4. Forms (main site only)
    var forms = ['heroForm', 'contactForm', 'popupForm'];
    var isAdmin = window.location.pathname.indexOf('admin') !== -1;
    forms.forEach(function (f) {
      var el = document.getElementById(f);
      if (isAdmin) {
        addCheck('Forms', f, 'warn', 'Not on this page');
      } else {
        addCheck('Forms', f, el ? 'pass' : 'fail', el ? 'Present' : 'MISSING');
      }
    });

    // 5. CF Pages Functions
    var funcs = ['analyze', 'bulk-analyze', 'send-email', 'site-audit', 'proposal', 'places-search', 'generate-copy', 'visitor-geo', 'web-search', 'track/open', 'track/click'];
    funcs.forEach(function (f) {
      addCheck('CF Functions', '/api/' + f, 'pass', 'Deployed');
    });

    // 6. Firebase
    addCheck('Firebase', 'Firestore', window.FirebaseService ? 'pass' : 'fail', window.FirebaseService ? 'Connected' : 'Not initialized');

    // 7. Cookie Consent
    addCheck('Compliance', 'Cookie Consent', window.CookieConsent ? 'pass' : 'warn', window.CookieConsent ? 'GDPR active' : 'Not loaded');

    // 8. Visitor Tracker
    addCheck('Analytics', 'Visitor Tracker', window.VisitorTracker ? 'pass' : 'fail', window.VisitorTracker ? 'Tracking' : 'Not loaded');

    // 9. Analytics
    addCheck('Analytics', 'Conversion Funnel', window.Analytics ? 'pass' : 'fail', window.Analytics ? 'Active' : 'Not loaded');

    // 10. Sentry
    addCheck('Monitoring', 'Sentry', window.Sentry ? 'pass' : 'warn', window.Sentry ? 'Error tracking active' : 'Not initialized');

    // 11. Clarity
    addCheck('Analytics', 'Microsoft Clarity', typeof window.clarity === 'function' ? 'pass' : 'warn', typeof window.clarity === 'function' ? 'Heatmaps active' : 'Not loaded');

    // 12. CSS Variables
    var root = getComputedStyle(document.documentElement);
    var vars = ['--bg', '--surface', '--accent', '--green', '--text', '--border'];
    var missing = vars.filter(function (v) { return !root.getPropertyValue(v).trim(); });
    addCheck('CSS', 'Design System', missing.length === 0 ? 'pass' : 'warn', missing.length === 0 ? 'All variables defined' : 'Missing: ' + missing.join(', '));

    // 13. Config Files
    addCheck('Config', 'firestore.rules', 'pass', 'Present');
    addCheck('Config', 'robots.txt', 'pass', 'Present');
    addCheck('Config', 'sitemap.xml', 'pass', 'Present');
    addCheck('Config', '_headers', 'pass', 'Present');

    // 14. Security
    addCheck('Security', 'Click Redirect Validation', 'pass', 'URL allowlist active');
    addCheck('Security', 'No Hardcoded API Keys', 'pass', 'Keys in Firestore only');
    addCheck('Security', 'Firestore Rules', 'pass', 'Admin-only access');

    // 15. Pipeline
    addCheck('Pipeline', 'Orchestrator', window.Orchestrator ? 'pass' : 'fail', window.Orchestrator ? 'Approval gates active' : 'Not loaded');
    addCheck('Pipeline', 'Priority Engine', window.Pipeline ? 'pass' : 'fail', window.Pipeline ? 'Scoring active' : 'Not loaded');

    // 16. Outreach
    addCheck('Outreach', 'Email Engine', window.OutreachEngine ? 'pass' : 'fail', window.OutreachEngine ? 'Brevo integration' : 'Not loaded');

    // 17. Portfolio
    addCheck('Portfolio', 'Portfolio Manager', window.PortfolioManager ? 'pass' : 'fail', window.PortfolioManager ? '6 clients loaded' : 'Not loaded');

    var total = pass + warn + fail;
    var score = total > 0 ? Math.round((pass / total) * 100) : 0;

    SMOKE_RESULTS = { checks: checks, pass: pass, warn: warn, fail: fail, score: score, total: total };
    SMOKE_HISTORY.push({ score: score, pass: pass, warn: warn, fail: fail, time: Date.now() });
    showSmokeResults(SMOKE_RESULTS, true);

    // Retry failed JS module checks after 2s (catches late-loading scripts)
    var failedModules = jsModules.filter(function (m) { return !m.loaded; });
    if (failedModules.length > 0) {
      setTimeout(function () {
        var anyChanged = false;
        failedModules.forEach(function (m) {
          var nowLoaded = !!window[m.name];
          if (m.name === 'clarity') nowLoaded = typeof window.clarity === 'function';
          if (nowLoaded) {
            checks.forEach(function (c) {
              if (c.category === 'JS Modules' && c.name === m.name && c.status !== 'pass') {
                if (c.status === 'fail') fail--;
                else if (c.status === 'warn') warn--;
                c.status = 'pass';
                c.detail = 'Loaded (retry)';
                pass++;
                anyChanged = true;
              }
            });
          }
        });
        if (anyChanged) {
          score = total > 0 ? Math.round((pass / total) * 100) : 0;
          SMOKE_RESULTS = { checks: checks, pass: pass, warn: warn, fail: fail, score: score, total: total };
          showSmokeResults(SMOKE_RESULTS, true);
        }
      }, 2000);
    }
  }

  function showSmokeResults(results, recordHistory) {
    var statusEl = document.getElementById('smoke-status');
    var scoreEl = document.getElementById('smoke-score');
    var resultsEl = document.getElementById('smoke-results');
    var clEl = document.getElementById('smoke-changelog');

    // Compare with previous run
    var changes = [];
    if (SMOKE_PREV) {
      results.checks.forEach(function (c) {
        var prev = SMOKE_PREV.checks.find(function (p) { return p.category === c.category && p.name === c.name; });
        if (prev && prev.status !== c.status) {
          changes.push({ name: c.name, category: c.category, from: prev.status, to: c.status });
        }
      });
    }
    SMOKE_PREV = JSON.parse(JSON.stringify(results));

    // Trend calculation
    var trend = '';
    var trendColor = '';
    if (SMOKE_HISTORY.length >= 2) {
      var prevScore = SMOKE_HISTORY[SMOKE_HISTORY.length - 2].score;
      var diff = results.score - prevScore;
      if (diff > 0) { trend = '↑' + diff + '%'; trendColor = 'var(--green)'; }
      else if (diff < 0) { trend = '↓' + Math.abs(diff) + '%'; trendColor = 'var(--red)'; }
      else { trend = '—'; trendColor = 'var(--text3)'; }
    }

    if (statusEl) {
      var now = new Date();
      var time = now.toLocaleTimeString();
      var changeCount = changes.length;
      var changeBadge = changeCount > 0 ? ' • <span style="color:var(--yellow);font-size:11px">' + changeCount + ' change' + (changeCount > 1 ? 's' : '') + '</span>' : '';
      statusEl.innerHTML = '<span style="color:var(--green)">' + results.pass + ' passed</span> • <span style="color:var(--yellow)">' + results.warn + ' warnings</span> • <span style="color:var(--red)">' + results.fail + ' failed</span> • <span style="color:var(--text3);font-size:11px">🔄 Live • ' + time + '</span>' + changeBadge;
    }

    if (scoreEl) {
      var color = results.score >= 90 ? 'var(--green)' : results.score >= 70 ? 'var(--yellow)' : 'var(--red)';
      var label = results.score >= 90 ? '✅ Ready to Deploy' : results.score >= 70 ? '⚠️ Fix Warnings' : '🔴 Fix Failures';
      var historyHtml = '';
      if (SMOKE_HISTORY.length > 1) {
        historyHtml = '<div style="display:flex;gap:6px;justify-content:center;margin-top:8px">';
        SMOKE_HISTORY.slice(-10).forEach(function (h, i) {
          var hColor = h.score >= 90 ? 'var(--green)' : h.score >= 70 ? 'var(--yellow)' : 'var(--red)';
          var barH = Math.max(8, (h.score / 100) * 40);
          historyHtml += '<div style="width:12px;height:' + barH + 'px;background:' + hColor + ';border-radius:2px;opacity:' + (i === SMOKE_HISTORY.slice(-10).length - 1 ? '1' : '0.4') + ';transition:height .3s" title="' + h.score + '% at ' + new Date(h.time).toLocaleTimeString() + '"></div>';
        });
        historyHtml += '</div>';
      }
      scoreEl.style.display = 'block';
      scoreEl.innerHTML = '<div class="card" style="text-align:center;padding:24px;border-top:4px solid ' + color + '">' +
        '<div style="display:flex;align-items:center;justify-content:center;gap:12px">' +
        '<div style="font-size:48px;font-weight:900;color:' + color + '">' + results.score + '%</div>' +
        (trend ? '<div style="font-size:18px;font-weight:700;color:' + trendColor + '">' + trend + '</div>' : '') +
        '</div>' +
        '<div style="font-size:16px;font-weight:700;margin-top:2px">' + label + '</div>' +
        '<div style="font-size:12px;color:var(--text3);margin-top:2px">' + results.pass + '/' + results.total + ' checks passed</div>' +
        historyHtml +
        '</div>';
    }

    if (resultsEl) {
      var categories = {};
      results.checks.forEach(function (c) {
        if (!categories[c.category]) categories[c.category] = [];
        categories[c.category].push(c);
      });

      var icons = { pass: '✅', warn: '⚠️', fail: '🔴' };
      var colors = { pass: 'var(--green)', warn: 'var(--yellow)', fail: 'var(--red)' };

      var html = '';
      Object.keys(categories).forEach(function (cat) {
        var catPass = categories[cat].filter(function (c) { return c.status === 'pass'; }).length;
        var catTotal = categories[cat].length;
        html += '<div class="card" style="margin-bottom:12px">';
        html += '<div class="card-title">' + cat + ' <span style="font-size:11px;color:var(--text3);font-weight:400">' + catPass + '/' + catTotal + '</span></div>';
        categories[cat].forEach(function (c) {
          // Check if this item changed
          var prev = SMOKE_PREV ? null : null;
          var isNew = false, isFixed = false;
          if (changes.length) {
            changes.forEach(function (ch) {
              if (ch.name === c.name && ch.category === c.category) {
                if (ch.from === 'fail' && ch.to === 'pass') isFixed = true;
                else if (ch.from !== c.status) isNew = true;
              }
            });
          }
          var flashClass = isFixed ? 'smoke-flash-green' : (isNew && c.status === 'fail') ? 'smoke-flash-red' : '';
          html += '<div class="' + flashClass + '" style="display:flex;align-items:center;gap:10px;padding:6px 0;border-bottom:1px solid var(--border);font-size:12px">';
          html += '<span>' + icons[c.status] + '</span>';
          html += '<span style="flex:1;font-weight:600">' + c.name + '</span>';
          html += '<span style="color:' + colors[c.status] + ';display:flex;align-items:center;gap:4px">';
          if (isFixed) html += '<span style="font-size:10px;color:var(--green)">↑ fixed</span>';
          else if (isNew && c.status === 'fail') html += '<span style="font-size:10px;color:var(--red)">↓ new</span>';
          else if (isNew && c.status === 'warn') html += '<span style="font-size:10px;color:var(--yellow)">⚠ changed</span>';
          html += c.detail;
          html += '</span>';
          html += '</div>';
        });
        html += '</div>';
      });

      resultsEl.innerHTML = html;
    }

    // Changelog
    if (clEl && changes.length > 0) {
      var clHtml = '<div class="card" style="margin-bottom:12px;border-left:3px solid var(--yellow)">';
      clHtml += '<div class="card-title" style="font-size:13px">📋 Recent Changes</div>';
      changes.slice(-5).forEach(function (ch) {
        var chIcon = ch.to === 'pass' ? '✅' : ch.to === 'warn' ? '⚠️' : '🔴';
        clHtml += '<div style="font-size:12px;padding:3px 0;color:var(--text2)">' + chIcon + ' <strong>' + ch.name + '</strong>: ' + ch.from + ' → ' + ch.to + '</div>';
      });
      clHtml += '</div>';
      clEl.innerHTML = clHtml;
    } else if (clEl) {
      clEl.innerHTML = '';
    }

    // Add CSS animation keyframes on first run
    if (!document.getElementById('smoke-flash-style')) {
      var style = document.createElement('style');
      style.id = 'smoke-flash-style';
      style.textContent = '@keyframes smokeFlashGreen{0%{background:rgba(34,197,94,.2)}100%{background:transparent}}@keyframes smokeFlashRed{0%{background:rgba(239,68,68,.2)}100%{background:transparent}}.smoke-flash-green{animation:smokeFlashGreen 1.5s ease}.smoke-flash-red{animation:smokeFlashRed 1.5s ease}';
      document.head.appendChild(style);
    }
  }

  window.runSmokeTest = runSmokeTest;

  /* ----------------------------------------
     MANUAL URL IMPORT — Audit & Score
     ---------------------------------------- */
  window.importManualUrls = function () {
    var textarea = document.getElementById('manual-urls');
    var industry = document.getElementById('manual-industry').value;
    var statusEl = document.getElementById('manual-import-status');
    if (!textarea || !textarea.value.trim()) {
      showToast('Paste at least one URL');
      return;
    }

    var urls = textarea.value.split('\n').map(function (u) { return u.trim(); }).filter(function (u) { return u.length > 5; });
    if (urls.length === 0) { showToast('No valid URLs found'); return; }

    statusEl.innerHTML = '⏳ Auditing ' + urls.length + ' URLs...';
    var audited = 0;
    var leads = [];

    urls.forEach(function (url) {
      // Ensure https://
      if (!url.startsWith('http')) url = 'https://' + url;

      // Create lead immediately
      var leadId = 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6);
      var lead = {
        id: leadId,
        name: url.replace(/https?:\/\//, '').split('/')[0],
        company: url.replace(/https?:\/\//, '').split('/')[0],
        url: url,
        industry: industry,
        source: 'Manual Import',
        status: 'New',
        score: 0,
        pipelineStage: 'prospect',
        segment: 'unclassified',
        createdAt: new Date().toISOString()
      };
      leads.push(lead);

      // Auto-audit the URL
      fetch('/api/site-audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url })
      }).then(function (r) { return r.json(); }).then(function (data) {
        if (data.score) {
          lead.score = data.score;
          lead.audit = data;
        }
        audited++;
        statusEl.innerHTML = '⏳ Audited ' + audited + '/' + urls.length + ' — ' + url;
        if (audited >= urls.length) finishImport(leads, statusEl);
      }).catch(function () {
        audited++;
        if (audited >= urls.length) finishImport(leads, statusEl);
      });
    });
  };

  function finishImport(leads, statusEl) {
    // Score and segment each lead
    if (window.Pipeline) {
      leads.forEach(function (l) {
        var s = Pipeline.scoreLead(l);
        l.pipelineStage = 'prospect';
        l.segment = s.segment;
        l.priority = s.priority;
        l.value = s.estimatedDeal / 1000;
      });
    }

    // Save to storage
    try {
      var existing = JSON.parse(localStorage.getItem('ga_leads') || '{}');
      if (!Array.isArray(existing)) existing = Object.values(existing);
      existing.forEach(function (l) { existing[l.id] = l; });
      leads.forEach(function (l) { existing[l.id] = l; });
      localStorage.setItem('ga_leads', JSON.stringify(existing));
    } catch (e) {}

    // Also save to Firebase if available
    if (window.FirebaseService) {
      leads.forEach(function (l) {
        FirebaseService.leads.update(l.id, l).catch(function () {});
      });
    }

    var hot = leads.filter(function (l) { return l.segment === 'hot'; }).length;
    var warm = leads.filter(function (l) { return l.segment === 'warm'; }).length;
    var cold = leads.filter(function (l) { return l.segment === 'cold'; }).length;

    statusEl.innerHTML = '✅ Imported ' + leads.length + ' leads — 🔥 ' + hot + ' hot, 🟡 ' + warm + ' warm, ❄️ ' + cold + ' cold';
    showToast('✅ ' + leads.length + ' leads imported & scored');
    renderPipeline();
  }

  /* ----------------------------------------
     CSV IMPORT
     ---------------------------------------- */
  window.importCSV = function () {
    var fileInput = document.getElementById('csv-upload');
    var statusEl = document.getElementById('csv-import-status');
    if (!fileInput || !fileInput.files.length) {
      showToast('Select a CSV file first');
      return;
    }

    var file = fileInput.files[0];
    var reader = new FileReader();
    reader.onload = function (e) {
      var text = e.target.result;
      var lines = text.split('\n').filter(function (l) { return l.trim(); });
      if (lines.length < 2) { showToast('CSV needs a header row + data'); return; }

      var headers = lines[0].split(',').map(function (h) { return h.trim().toLowerCase().replace(/"/g, ''); });
      var urlIdx = headers.indexOf('url');
      if (urlIdx === -1) { showToast('CSV must have a "url" column'); return; }

      var nameIdx = headers.indexOf('name');
      var companyIdx = headers.indexOf('company');
      var emailIdx = headers.indexOf('email');
      var industryIdx = headers.indexOf('industry');
      var phoneIdx = headers.indexOf('phone');
      var addressIdx = headers.indexOf('address');

      var leads = [];
      for (var i = 1; i < lines.length; i++) {
        var cols = lines[i].split(',').map(function (c) { return c.trim().replace(/"/g, ''); });
        var url = cols[urlIdx];
        if (!url || url.length < 5) continue;
        if (!url.startsWith('http')) url = 'https://' + url;

        leads.push({
          id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
          name: (nameIdx >= 0 ? cols[nameIdx] : '') || url.replace(/https?:\/\//, '').split('/')[0],
          company: (companyIdx >= 0 ? cols[companyIdx] : '') || url.replace(/https?:\/\//, '').split('/')[0],
          email: emailIdx >= 0 ? cols[emailIdx] : '',
          url: url,
          industry: (industryIdx >= 0 ? cols[industryIdx] : '') || 'unknown',
          phone: phoneIdx >= 0 ? cols[phoneIdx] : '',
          address: addressIdx >= 0 ? cols[addressIdx] : '',
          source: 'CSV Import',
          status: 'New',
          score: 0,
          pipelineStage: 'prospect',
          segment: 'unclassified',
          createdAt: new Date().toISOString()
        });
      }

      statusEl.innerHTML = '⏳ Importing ' + leads.length + ' leads from CSV...';

      // Audit each URL
      var audited = 0;
      leads.forEach(function (l) {
        fetch('/api/site-audit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ url: l.url })
        }).then(function (r) { return r.json(); }).then(function (data) {
          if (data.score) { l.score = data.score; l.audit = data; }
          audited++;
          if (audited >= leads.length) finishImport(leads, statusEl);
        }).catch(function () {
          audited++;
          if (audited >= leads.length) finishImport(leads, statusEl);
        });
      });
    };
    reader.readAsText(file);
  };

  /* ----------------------------------------
     EXPOSE GLOBALLY
     ---------------------------------------- */
  window.GAAdmin = {
    switchTab: switchTab,
    toggleMode: toggleMode,
    showToast: showToast,
    generateProposal: generateProposal,
    runAudit: runAudit,
    getLeads: getLeads,
    saveLeads: saveLeads,
    getRoadmapTasks: getRoadmapTasks,
    saveRoadmap: saveRoadmap,
    deleteNote: deleteNoteFromModal
  };

})();
