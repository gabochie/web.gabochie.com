/* ========================================
   GA CLIENT PORTAL — PRODUCTION
   ======================================== */
(function () {
  'use strict';

  /* ----------------------------------------
     CONFIG — Company credentials & data
     Each company has unique email + password
     ---------------------------------------- */
  var COMPANIES = {
    berkshire: {
      name: 'Berkshire Hathaway', industry: 'Finance / Conglomerate', location: 'Omaha, Nebraska',
      tier: 'Enterprise', startDate: '2026-06-01', delivery: '2026-08-15',
      preview: 'redesigns/berkshire.html',
      credentials: { 'warren@berkshire.com': 'berkshire2026' }
    },
    koch: {
      name: 'Koch Industries', industry: 'Manufacturing / Energy', location: 'Wichita, Kansas',
      tier: 'Professional', startDate: '2026-06-15', delivery: '2026-08-01',
      preview: null,
      credentials: { 'charles@koch.com': 'koch2026' }
    },
    cargill: {
      name: 'Cargill', industry: 'Food / Agriculture', location: 'Wayzata, Minnesota',
      tier: 'Professional', startDate: '2026-06-10', delivery: '2026-07-28',
      preview: null,
      credentials: { 'ceo@cargill.com': 'cargill2026' }
    },
    fidelity: {
      name: 'Fidelity', industry: 'Financial Services', location: 'Boston, Massachusetts',
      tier: 'Enterprise', startDate: '2026-05-20', delivery: '2026-08-01',
      preview: 'redesigns/fidelity.html',
      credentials: { 'admin@fidelity.com': 'fidelity2026' }
    },
    hearst: {
      name: 'Hearst', industry: 'Media / Publishing', location: 'New York, NY',
      tier: 'Enterprise', startDate: '2026-05-15', delivery: '2026-07-30',
      preview: 'redesigns/hearst.html',
      credentials: { 'digital@hearst.com': 'hearst2026' }
    },
    scjohnson: {
      name: 'S.C. Johnson', industry: 'Consumer Goods', location: 'Racine, Wisconsin',
      tier: 'Professional', startDate: '2026-06-20', delivery: '2026-08-10',
      preview: null,
      credentials: { 'marketing@scjohnson.com': 'scjohnson2026' }
    },
    heb: {
      name: 'H-E-B', industry: 'Retail / Grocery', location: 'San Antonio, Texas',
      tier: 'Essentials', startDate: '2026-07-01', delivery: '2026-08-12',
      preview: null,
      credentials: { 'team@heb.com': 'heb2026' }
    },
    publix: {
      name: 'Publix', industry: 'Retail / Grocery', location: 'Lakeland, Florida',
      tier: 'Enterprise', startDate: '2026-06-05', delivery: '2026-08-20',
      preview: 'redesigns/publix.html',
      credentials: { 'admin@publix.com': 'publix2026' }
    },
    comcast: {
      name: 'Comcast', industry: 'Telecom / Media', location: 'Philadelphia, PA',
      tier: 'Professional', startDate: '2026-06-12', delivery: '2026-08-05',
      preview: null,
      credentials: { 'digital@comcast.com': 'comcast2026' }
    },
    verizon: {
      name: 'Verizon', industry: 'Telecom', location: 'New York, NY',
      tier: 'Enterprise', startDate: '2026-05-25', delivery: '2026-08-10',
      preview: 'redesigns/verizon.html',
      credentials: { 'marketing@verizon.com': 'verizon2026' }
    },
    mcdonalds: {
      name: "McDonald's", industry: 'Food / QSR', location: 'Chicago, Illinois',
      tier: 'Enterprise', startDate: '2026-06-01', delivery: '2026-08-25',
      preview: 'redesigns/mcdonalds.html',
      credentials: { 'digital@mcdonalds.com': 'mcdonalds2026' }
    },
    parkave: {
      name: 'Park Avenue Dental', industry: 'Dental', location: 'New York, NY',
      tier: 'Essentials', startDate: '2026-07-05', delivery: '2026-08-15',
      preview: null,
      credentials: { 'dr@parkavedental.com': 'parkave2026' }
    },
    bhmedical: {
      name: 'Beverly Hills Medical Group', industry: 'Medical', location: 'Beverly Hills, CA',
      tier: 'Professional', startDate: '2026-06-25', delivery: '2026-08-08',
      preview: null,
      credentials: { 'admin@bhmedical.com': 'bhmedical2026' }
    },
    goldcoast: {
      name: 'Gold Coast Plumbing', industry: 'Home Services', location: 'Sydney, Australia',
      tier: 'Essentials', startDate: '2026-07-10', delivery: '2026-08-20',
      preview: null,
      credentials: { 'info@goldcoastplumbing.com': 'goldcoast2026' }
    },
    hudsonlegal: {
      name: 'Hudson Valley Legal Group', industry: 'Legal', location: 'Hudson Valley, NY',
      tier: 'Professional', startDate: '2026-06-18', delivery: '2026-08-01',
      preview: null,
      credentials: { 'partner@hudsonlegal.com': 'hudsonlegal2026' }
    },
    heritage: {
      name: 'Heritage Wealth Management', industry: 'Financial Services', location: 'Dallas, Texas',
      tier: 'Professional', startDate: '2026-06-22', delivery: '2026-08-05',
      preview: null,
      credentials: { 'advisor@heritagewealth.com': 'heritage2026' }
    }
  };

  var MILESTONES_DEFAULT = [
    { name: 'Discovery Call', desc: 'Initial consultation and requirements gathering', daysOffset: 0 },
    { name: 'Strategy & wireframes', desc: 'Information architecture and wireframe delivery', daysOffset: 7 },
    { name: 'Design concepts', desc: 'Visual design concepts presented for review', daysOffset: 14 },
    { name: 'Development', desc: 'Building the approved design into code', daysOffset: 28 },
    { name: 'QA & testing', desc: 'Cross-browser, mobile, and performance testing', daysOffset: 42 },
    { name: 'Launch', desc: 'Go live with full monitoring', daysOffset: 49 }
  ];

  var SESSION_KEY = 'ga_portal_session';
  var SESSION_TTL = 24 * 60 * 60 * 1000; // 24 hours

  var currentCompany = null;
  var currentView = 'overview';
  var pendingFiles = [];

  /* ----------------------------------------
     INIT
     ---------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    FirebaseService.init();
    populateCompanyDropdown();
    wireLogin();
    wireNav();
    wireLogout();
    wireFeedback();
    wirePreview();
    wireFiles();
    checkSession();
  });

  /* ----------------------------------------
     SESSION MANAGEMENT
     ---------------------------------------- */
  function checkSession() {
    var stored = localStorage.getItem(SESSION_KEY);
    if (!stored) return showAuth();
    try {
      var session = JSON.parse(stored);
      if (Date.now() - session.ts > SESSION_TTL) {
        localStorage.removeItem(SESSION_KEY);
        return showAuth();
      }
      var company = COMPANIES[session.companyKey];
      if (!company) { localStorage.removeItem(SESSION_KEY); return showAuth(); }
      currentCompany = { key: session.companyKey, data: company, email: session.email };
      showDashboard();
    } catch (e) {
      localStorage.removeItem(SESSION_KEY);
      showAuth();
    }
  }

  function saveSession() {
    localStorage.setItem(SESSION_KEY, JSON.stringify({
      companyKey: currentCompany.key,
      email: currentCompany.email,
      ts: Date.now()
    }));
  }

  function clearSession() {
    localStorage.removeItem(SESSION_KEY);
  }

  /* ----------------------------------------
     AUTH
     ---------------------------------------- */
  function populateCompanyDropdown() {
    var sel = document.getElementById('loginCompany');
    if (!sel) return;
    Object.keys(COMPANIES).forEach(function (key) {
      var opt = document.createElement('option');
      opt.value = key;
      opt.textContent = COMPANIES[key].name;
      sel.appendChild(opt);
    });
  }

  function wireLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var key = document.getElementById('loginCompany').value;
      var email = document.getElementById('loginEmail').value.trim().toLowerCase();
      var pass = document.getElementById('loginPass').value;
      var errEl = document.getElementById('authError');

      var company = COMPANIES[key];
      if (!company) { showAuthError('Please select a company'); return; }

      var valid = false;
      Object.keys(company.credentials).forEach(function (e) {
        if (e.toLowerCase() === email && company.credentials[e] === pass) valid = true;
      });

      if (!valid) { showAuthError('Invalid email or password'); return; }

      currentCompany = { key: key, data: company, email: email };
      saveSession();
      showDashboard();
      toast('Welcome to ' + company.name + ' portal', 'success');
    });
  }

  function showAuthError(msg) {
    var el = document.getElementById('authError');
    if (el) { el.textContent = msg; el.classList.add('show'); }
  }

  function showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }

  function showDashboard() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    renderDashboard();
  }

  /* ----------------------------------------
     NAV
     ---------------------------------------- */
  function wireNav() {
    document.querySelectorAll('.sidebar-link[data-view]').forEach(function (link) {
      link.addEventListener('click', function () { switchView(link.dataset.view); });
    });
  }

  function switchView(view) {
    currentView = view;
    document.querySelectorAll('.sidebar-link[data-view]').forEach(function (l) {
      l.classList.toggle('active', l.dataset.view === view);
    });
    document.querySelectorAll('.view').forEach(function (v) {
      v.classList.toggle('active', v.id === 'view-' + view);
    });
    renderCurrentView();
  }

  function renderCurrentView() {
    if (currentView === 'overview') renderOverview();
    if (currentView === 'preview') renderPreview();
    if (currentView === 'feedback') renderFeedbackHistory();
    if (currentView === 'timeline') renderTimeline();
    if (currentView === 'files') renderFiles();
  }

  function wireLogout() {
    var btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', function () {
      clearSession();
      currentCompany = null;
      showAuth();
      document.getElementById('loginPass').value = '';
      toast('Signed out');
    });
  }

  /* ----------------------------------------
     DASHBOARD
     ---------------------------------------- */
  function renderDashboard() {
    if (!currentCompany) return;
    var c = currentCompany.data;
    var key = currentCompany.key;

    document.getElementById('sbCompany').textContent = c.name;
    document.getElementById('overviewSubtitle').textContent = c.industry + ' — ' + c.location;

    // Project details
    document.getElementById('detailIndustry').textContent = c.industry;
    document.getElementById('detailLocation').textContent = c.location;
    document.getElementById('detailTier').textContent = c.tier;
    document.getElementById('detailStart').textContent = formatDate(c.startDate);
    document.getElementById('detailDelivery').textContent = formatDate(c.delivery);

    var status = getProjectStatus(c);
    document.getElementById('detailStatus').textContent = status.label;
    document.getElementById('detailStatus').style.color = status.color;

    // Stats
    var feedback = getFeedback();
    var files = getFiles();
    var milestones = getMilestones();
    var completed = milestones.filter(function (m) { return m.done; }).length;

    document.getElementById('statPhase').textContent = getCurrentPhase(milestones);
    document.getElementById('statTasks').textContent = completed + '/' + milestones.length;
    document.getElementById('statFeedback').textContent = feedback.length;
    document.getElementById('statFiles').textContent = files.length;

    // Preview link
    var previewLink = document.getElementById('previewLink');
    if (c.preview) {
      previewLink.href = c.preview;
      previewLink.style.display = 'inline-flex';
    } else {
      previewLink.style.display = 'none';
    }

    renderMilestones();
    renderTimeline();
  }

  /* ----------------------------------------
     MILESTONES
     ---------------------------------------- */
  function getMilestones() {
    var key = currentCompany.key;
    var stored = localStorage.getItem('ga_portal_milestones_' + key);
    if (stored) {
      try { return JSON.parse(stored); } catch (e) {}
    }
    // Generate from defaults
    var c = currentCompany.data;
    var start = new Date(c.startDate);
    var ms = MILESTONES_DEFAULT.map(function (m, i) {
      var d = new Date(start);
      d.setDate(d.getDate() + m.daysOffset);
      var done = d < new Date();
      return { name: m.name, desc: m.desc, date: d.toISOString().slice(0, 10), done: done, active: !done && (i === 0 || new Date(MILESTONES_DEFAULT[i - 1].daysOffset + start.getDate()) < new Date()) };
    });
    // Make first milestone done, second active
    if (ms.length > 0) ms[0].done = true;
    if (ms.length > 1) { ms[1].active = true; ms[1].done = false; }
    localStorage.setItem('ga_portal_milestones_' + key, JSON.stringify(ms));
    return ms;
  }

  function saveMilestones(ms) {
    localStorage.setItem('ga_portal_milestones_' + currentCompany.key, JSON.stringify(ms));
  }

  function getCurrentPhase(milestones) {
    for (var i = 0; i < milestones.length; i++) {
      if (milestones[i].active) return milestones[i].name;
    }
    return milestones[milestones.length - 1].name;
  }

  function renderMilestones() {
    var container = document.getElementById('milestonesList');
    if (!container) return;
    var ms = getMilestones();
    container.innerHTML = ms.map(function (m) {
      var cls = m.done ? 'done' : m.active ? 'active' : 'pending';
      var statusCls = m.done ? 'done' : m.active ? 'active' : 'pending';
      var statusText = m.done ? 'Complete' : m.active ? 'In Progress' : 'Pending';
      return '<div class="milestone">' +
        '<div class="milestone-dot ' + cls + '"></div>' +
        '<div class="milestone-info"><div class="milestone-name">' + esc(m.name) + '</div><div class="milestone-date">' + esc(m.desc) + ' — ' + formatDate(m.date) + '</div></div>' +
        '<span class="milestone-status ' + statusCls + '">' + statusText + '</span>' +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------
     PREVIEW
     ---------------------------------------- */
  function wirePreview() {
    document.querySelectorAll('.feedback-quick-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        document.querySelectorAll('.feedback-quick-btn').forEach(function (b) { b.classList.remove('selected'); });
        btn.classList.add('selected');
      });
    });

    var submitBtn = document.getElementById('submitPreviewFeedback');
    if (submitBtn) submitBtn.addEventListener('click', function () {
      var selected = document.querySelector('.feedback-quick-btn.selected');
      var text = document.getElementById('previewFeedbackText').value.trim();
      if (!selected && !text) { toast('Add some feedback first', 'error'); return; }
      var rating = selected ? selected.dataset.rating : 'general';
      var fb = {
        id: 'fb_' + Date.now(),
        category: 'design',
        priority: 'medium',
        subject: 'Preview feedback: ' + rating,
        message: text || ('Quick rating: ' + rating),
        files: [],
        date: new Date().toISOString(),
        reply: null
      };
      saveFeedback(fb);
      document.getElementById('previewFeedbackText').value = '';
      document.querySelectorAll('.feedback-quick-btn').forEach(function (b) { b.classList.remove('selected'); });
      toast('Feedback submitted!', 'success');
    });
  }

  function renderPreview() {
    var c = currentCompany.data;
    var container = document.getElementById('previewContainer');
    var link = document.getElementById('previewLink');
    if (c.preview) {
      container.innerHTML = '<iframe src="' + c.preview + '" style="width:100%;height:500px;border:none;border-radius:var(--radius)"></iframe>';
      link.href = c.preview;
      link.style.display = 'inline-flex';
    } else {
      container.innerHTML = '<div class="preview-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><h3>Redesign In Progress</h3><p>Your redesign is being crafted. Check back soon.</p></div>';
      link.style.display = 'none';
    }
  }

  /* ----------------------------------------
     FEEDBACK
     ---------------------------------------- */
  function getFeedback() {
    var key = currentCompany.key;
    var stored = localStorage.getItem('ga_portal_feedback_' + key);
    if (stored) { try { return JSON.parse(stored); } catch (e) {} }
    return [];
  }

  function saveFeedback(fb) {
    var list = getFeedback();
    list.unshift(fb);
    localStorage.setItem('ga_portal_feedback_' + currentCompany.key, JSON.stringify(list));
    renderFeedbackHistory();
    updateStats();
  }

  function wireFeedback() {
    var uploadArea = document.getElementById('fileUploadArea');
    var fileInput = document.getElementById('fbFiles');
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', function () { fileInput.click(); });
      uploadArea.addEventListener('dragover', function (e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
      uploadArea.addEventListener('dragleave', function () { uploadArea.classList.remove('dragover'); });
      uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', function () { handleFiles(fileInput.files); });
    }

    var form = document.getElementById('feedbackForm');
    if (form) form.addEventListener('submit', function (e) {
      e.preventDefault();
      var subject = document.getElementById('fbSubject').value.trim();
      var message = document.getElementById('fbMessage').value.trim();
      var category = document.getElementById('fbCategory').value;
      var priority = document.getElementById('fbPriority').value;
      if (!subject || !message) { toast('Subject and details are required', 'error'); return; }

      var fb = {
        id: 'fb_' + Date.now(),
        category: category,
        priority: priority,
        subject: subject,
        message: message,
        files: pendingFiles.slice(),
        date: new Date().toISOString(),
        reply: null
      };
      saveFeedback(fb);
      form.reset();
      pendingFiles = [];
      document.getElementById('fileList').innerHTML = '';
      toast('Feedback submitted!', 'success');
    });
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        pendingFiles.push({ name: file.name, size: file.size, type: file.type, data: e.target.result });
        renderPendingFiles();
      };
      reader.readAsDataURL(file);
    });
  }

  function renderPendingFiles() {
    var container = document.getElementById('fileList');
    if (!container) return;
    container.innerHTML = pendingFiles.map(function (f, i) {
      return '<div class="file-item"><span class="file-name">' + esc(f.name) + '</span><span class="file-size">' + formatSize(f.size) + '</span><button class="file-remove" data-idx="' + i + '">&times;</button></div>';
    }).join('');
    container.querySelectorAll('.file-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pendingFiles.splice(parseInt(btn.dataset.idx), 1);
        renderPendingFiles();
      });
    });
  }

  function renderFeedbackHistory() {
    var container = document.getElementById('feedbackHistory');
    if (!container) return;
    var list = getFeedback();
    if (!list.length) {
      container.innerHTML = '<div class="no-items">No feedback submitted yet.</div>';
      return;
    }
    container.innerHTML = list.map(function (fb) {
      var replyHTML = fb.reply ? '<div class="feedback-reply"><div class="feedback-reply-label">GA Response</div><div class="feedback-reply-text">' + esc(fb.reply) + '</div></div>' : '';
      var filesHTML = fb.files && fb.files.length ? '<div class="feedback-files">' + fb.files.map(function (f) { return '<span class="feedback-file">📎 ' + esc(f.name) + '</span>'; }).join('') + '</div>' : '';
      return '<div class="feedback-item">' +
        '<div class="feedback-header">' +
          '<span class="feedback-category ' + fb.category + '">' + fb.category + '</span>' +
          '<span class="feedback-priority ' + fb.priority + '">' + fb.priority + '</span>' +
          '<span class="feedback-subject">' + esc(fb.subject) + '</span>' +
          '<span class="feedback-date">' + formatDateTime(fb.date) + '</span>' +
        '</div>' +
        '<div class="feedback-message">' + esc(fb.message) + '</div>' +
        filesHTML + replyHTML +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------
     TIMELINE
     ---------------------------------------- */
  function renderTimeline() {
    var container = document.getElementById('timelineList');
    if (!container) return;
    var milestones = getMilestones();
    var feedback = getFeedback();

    var events = [];

    milestones.forEach(function (m) {
      events.push({
        date: m.date,
        title: m.name,
        desc: m.desc,
        type: 'milestone',
        status: m.done ? 'done' : m.active ? 'active' : 'pending'
      });
    });

    feedback.forEach(function (fb) {
      events.push({
        date: fb.date.slice(0, 10),
        title: 'Feedback: ' + fb.subject,
        desc: fb.message.slice(0, 100) + (fb.message.length > 100 ? '...' : ''),
        type: 'feedback',
        status: 'done'
      });
    });

    events.sort(function (a, b) { return b.date.localeCompare(a.date); });

    if (!events.length) {
      container.innerHTML = '<div class="no-items">No timeline events yet.</div>';
      return;
    }

    container.innerHTML = events.map(function (ev) {
      return '<div class="timeline-item ' + ev.status + '">' +
        '<div class="timeline-dot"></div>' +
        '<div class="timeline-date">' + formatDate(ev.date) + '</div>' +
        '<div class="timeline-title">' + esc(ev.title) + '</div>' +
        '<div class="timeline-desc">' + esc(ev.desc) + '</div>' +
      '</div>';
    }).join('');
  }

  /* ----------------------------------------
     FILES
     ---------------------------------------- */
  function getFiles() {
    var key = currentCompany.key;
    var stored = localStorage.getItem('ga_portal_files_' + key);
    if (stored) { try { return JSON.parse(stored); } catch (e) {} }
    return [];
  }

  function saveFile(file) {
    var list = getFiles();
    list.unshift(file);
    localStorage.setItem('ga_portal_files_' + currentCompany.key, JSON.stringify(list));
    renderFiles();
    updateStats();
  }

  function wireFiles() {
    var uploadArea = document.getElementById('filesUploadArea');
    var fileInput = document.getElementById('filesUpload');
    if (uploadArea && fileInput) {
      uploadArea.addEventListener('click', function () { fileInput.click(); });
      uploadArea.addEventListener('dragover', function (e) { e.preventDefault(); uploadArea.classList.add('dragover'); });
      uploadArea.addEventListener('dragleave', function () { uploadArea.classList.remove('dragover'); });
      uploadArea.addEventListener('drop', function (e) {
        e.preventDefault();
        uploadArea.classList.remove('dragover');
        uploadProjectFiles(e.dataTransfer.files);
      });
      fileInput.addEventListener('change', function () { uploadProjectFiles(fileInput.files); });
    }
  }

  function uploadProjectFiles(fileList) {
    Array.from(fileList).forEach(function (file) {
      var reader = new FileReader();
      reader.onload = function (e) {
        saveFile({
          id: 'file_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6),
          name: file.name,
          size: file.size,
          type: file.type,
          data: e.target.result,
          date: new Date().toISOString(),
          uploadedBy: 'client'
        });
        toast('File uploaded: ' + file.name, 'success');
      };
      reader.readAsDataURL(file);
    });
  }

  function renderFiles() {
    var container = document.getElementById('filesList');
    if (!container) return;
    var files = getFiles();
    if (!files.length) {
      container.innerHTML = '<div class="no-items">No files uploaded yet.</div>';
      return;
    }
    container.innerHTML = '<div class="file-grid">' + files.map(function (f) {
      var icon = getFileIcon(f.type);
      return '<div class="file-card" data-id="' + f.id + '">' +
        '<div class="file-card-icon">' + icon + '</div>' +
        '<div class="file-card-name" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' +
        '<div class="file-card-meta">' + formatSize(f.size) + ' · ' + formatDate(f.date) + '</div>' +
      '</div>';
    }).join('') + '</div>';

    container.querySelectorAll('.file-card').forEach(function (card) {
      card.addEventListener('click', function () {
        var file = files.find(function (f) { return f.id === card.dataset.id; });
        if (file && file.data) {
          var a = document.createElement('a');
          a.href = file.data;
          a.download = file.name;
          a.click();
        }
      });
    });
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function getProjectStatus(c) {
    var now = new Date();
    var start = new Date(c.startDate);
    var end = new Date(c.delivery);
    if (now < start) return { label: 'Scheduled', color: 'var(--yellow)' };
    if (now > end) return { label: 'Delivered', color: 'var(--green)' };
    var pct = (now - start) / (end - start) * 100;
    if (pct < 30) return { label: 'In Progress', color: 'var(--blue)' };
    if (pct < 70) return { label: 'In Development', color: 'var(--purple)' };
    return { label: 'Review', color: 'var(--yellow)' };
  }

  function updateStats() {
    if (!currentCompany) return;
    var feedback = getFeedback();
    var files = getFiles();
    document.getElementById('statFeedback').textContent = feedback.length;
    document.getElementById('statFiles').textContent = files.length;
  }

  function formatDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(d) {
    if (!d) return '—';
    var dt = new Date(d);
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  function formatSize(bytes) {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / 1048576).toFixed(1) + ' MB';
  }

  function getFileIcon(type) {
    if (!type) return '📄';
    if (type.startsWith('image/')) return '🖼️';
    if (type.includes('pdf')) return '📕';
    if (type.includes('word') || type.includes('doc')) return '📘';
    if (type.includes('spreadsheet') || type.includes('excel') || type.includes('csv')) return '📊';
    return '📄';
  }

  function esc(str) {
    if (!str) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
  }

  function toast(msg, type) {
    var el = document.getElementById('toast');
    if (!el) return;
    el.textContent = msg;
    el.className = 'toast ' + (type || '') + ' show';
    clearTimeout(el._t);
    el._t = setTimeout(function () { el.classList.remove('show'); }, 3500);
  }

})();
