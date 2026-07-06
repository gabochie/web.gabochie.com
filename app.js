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
    if (tabName === 'command-center') renderCommandCenter();
    if (tabName === 'pipeline') renderPipeline();
    if (tabName === 'outreach') renderOutreach();
    if (tabName === 'finder') initFinder();
    if (tabName === 'strategy') renderStrategy();
    if (tabName === 'automation') renderAutomation();
    if (tabName === 'roadmap') renderRoadmap();
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
    try { CommandCenter.render('command-center'); } catch (e) {}
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
    var stageVal = document.getElementById('f-stage') ? document.getElementById('f-stage').value : '';
    var stateVal = document.getElementById('f-state') ? document.getElementById('f-state').value : '';
    var segmentVal = document.getElementById('f-segment') ? document.getElementById('f-segment').value : '';
    var priorityVal = document.getElementById('f-priority') ? document.getElementById('f-priority').value : '';
    var industryVal = document.getElementById('f-industry') ? document.getElementById('f-industry').value : '';
    var sortBy = document.getElementById('f-sort') ? document.getElementById('f-sort').value : 'qualScore';
    var searchVal = document.getElementById('f-search') ? (document.getElementById('f-search').value || '').toLowerCase() : '';

    var filtered = leads.filter(function (l) {
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
            if (analyzed >= prospects.length) showFinderResults(prospects);
          }).catch(function () {
            p.qualScore = 30 + Math.floor(Math.random() * 40);
            p.segment = p.qualScore >= 60 ? 'warm' : 'cold';
            if (window.Automation) window.Automation.trigger('lead-scored', p);
            analyzed++;
            updateFinderProgress(analyzed, prospects.length);
            if (analyzed >= prospects.length) showFinderResults(prospects);
          });
        } else {
          p.qualScore = 30 + Math.floor(Math.random() * 40);
          p.segment = p.qualScore >= 60 ? 'warm' : 'cold';
          if (window.Automation) window.Automation.trigger('lead-scored', p);
          analyzed++;
          updateFinderProgress(analyzed, prospects.length);
          if (analyzed >= prospects.length) showFinderResults(prospects);
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

  function loadRoadmap() {
    var stored = localStorage.getItem(ROADMAP_KEY);
    if (stored) { try { return JSON.parse(stored); } catch (e) {} }
    localStorage.setItem(ROADMAP_KEY, JSON.stringify(DEFAULT_ROADMAP));
    FirebaseService.roadmap.save({ tasks: DEFAULT_ROADMAP }).catch(function () {});
    return DEFAULT_ROADMAP.slice();
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

    // Load saved settings from Firestore
    loadSettings();

    // Wire save buttons
    var saveEmailBtn = document.getElementById('settings-save-email');
    var saveNotifBtn = document.getElementById('settings-save-notifs');
    var saveAiBtn = document.getElementById('settings-save-ai');
    if (saveEmailBtn) saveEmailBtn.addEventListener('click', function () { saveSettings('email'); });
    if (saveNotifBtn) saveNotifBtn.addEventListener('click', function () { saveSettings('notifications'); });
    if (saveAiBtn) saveAiBtn.addEventListener('click', function () { saveSettings('ai'); });
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
    }).catch(function () {
      showToast('Failed to save settings');
    });
  }

  /* ----------------------------------------
     EXPOSE GLOBALLY
     ---------------------------------------- */
  window.GAAdmin = {
    switchTab: switchTab,
    toggleMode: toggleMode,
    showToast: showToast,
    generateProposal: generateProposal,
    getLeads: getLeads,
    saveLeads: saveLeads,
    getRoadmapTasks: getRoadmapTasks,
    saveRoadmap: saveRoadmap,
    deleteNote: deleteNoteFromModal
  };

})();
