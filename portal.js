/* ========================================
   GA CLIENT PORTAL — API-BACKED
   Auth + data served by wg-portal Worker
   (Durable Object SQLite, cookie sessions)
   ======================================== */
(function () {
  'use strict';

  var API = '/api/portal';
  var state = {
    email: null,
    company: null,
    milestones: [],
    feedback: [],
    files: []
  };
  var currentView = 'overview';
  var pendingFiles = [];

  /* ----------------------------------------
      API HELPER
      ---------------------------------------- */
  function api(path, opts) {
    opts = opts || {};
    return fetch(API + path, {
      method: opts.method || 'GET',
      headers: opts.body ? { 'Content-Type': 'application/json' } : undefined,
      credentials: 'same-origin',
      body: opts.body ? JSON.stringify(opts.body) : undefined
    }).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (data) {
        if (!res.ok) {
          var err = new Error(data.error || ('Request failed (' + res.status + ')'));
          err.status = res.status;
          throw err;
        }
        return data;
      });
    });
  }

  /* ----------------------------------------
      INIT
      ---------------------------------------- */
  document.addEventListener('DOMContentLoaded', function () {
    wireLogin();
    wireNav();
    wireLogout();
    wireFeedback();
    wirePreview();
    wireFiles();
    restoreSession();
  });

  function restoreSession() {
    api('/me').then(function (me) {
      state.email = me.email;
      return loadBootstrap();
    }).then(showDashboard).catch(function () { showAuth(); });
  }

  function loadBootstrap() {
    return api('/bootstrap').then(function (data) {
      state.company = data.company;
      state.milestones = data.milestones || [];
      state.feedback = data.feedback || [];
      state.files = data.files || [];
    });
  }

  /* ----------------------------------------
      AUTH
      ---------------------------------------- */
  function wireLogin() {
    var form = document.getElementById('loginForm');
    if (!form) return;
    form.addEventListener('submit', function (e) {
      e.preventDefault();
      var btn = form.querySelector('button[type="submit"]');
      var email = document.getElementById('loginEmail').value.trim().toLowerCase();
      var pass = document.getElementById('loginPass').value;
      showAuthError('');
      if (btn) { btn.disabled = true; }
      api('/login', { method: 'POST', body: { email: email, password: pass } })
        .then(function (res) {
          state.email = email;
          return loadBootstrap().then(function () {
            showDashboard();
            toast('Welcome back' + (state.company ? ', ' + state.company.name : ''), 'success');
          });
        })
        .catch(function (err) {
          showAuthError(err.status === 429 ? 'Too many attempts. Try again in 15 minutes.' : (err.message || 'Sign in failed'));
        })
        .then(function () { if (btn) btn.disabled = false; });
    });
  }

  function showAuthError(msg) {
    var el = document.getElementById('authError');
    if (!el) return;
    el.textContent = msg;
    el.classList.toggle('show', !!msg);
  }

  function showAuth() {
    document.getElementById('authScreen').style.display = 'flex';
    document.getElementById('app').style.display = 'none';
  }

  function showDashboard() {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('app').style.display = 'flex';
    renderCurrentView();
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
    if (currentView === 'overview') renderDashboard();
    if (currentView === 'preview') renderPreview();
    if (currentView === 'feedback') renderFeedbackHistory();
    if (currentView === 'timeline') renderTimeline();
    if (currentView === 'files') renderFiles();
  }

  function wireLogout() {
    var btn = document.getElementById('logoutBtn');
    if (btn) btn.addEventListener('click', function () {
      api('/logout', { method: 'POST' }).catch(function () {}).then(function () {
        state.email = null;
        state.company = null;
        state.milestones = [];
        state.feedback = [];
        state.files = [];
        showAuth();
        var pass = document.getElementById('loginPass');
        if (pass) pass.value = '';
        toast('Signed out');
      });
    });
  }

  /* ----------------------------------------
      DASHBOARD
      ---------------------------------------- */
  function renderDashboard() {
    if (!state.company) return;
    var c = state.company;

    document.getElementById('sbCompany').textContent = c.name;
    document.getElementById('overviewSubtitle').textContent = c.industry
      ? c.industry + (c.location ? ' — ' + c.location : '')
      : (c.location || '');

    document.getElementById('detailIndustry').textContent = c.industry || '—';
    document.getElementById('detailLocation').textContent = c.location || '—';
    document.getElementById('detailTier').textContent = c.tier || '—';
    document.getElementById('detailStart').textContent = formatDate(c.start_date);
    document.getElementById('detailDelivery').textContent = formatDate(c.delivery_date);

    var status = getProjectStatus(c);
    document.getElementById('detailStatus').textContent = status.label;
    document.getElementById('detailStatus').style.color = status.color;

    updateStats();

    var previewLink = document.getElementById('previewLink');
    if (previewLink) {
      if (c.preview_url) {
        previewLink.href = c.preview_url;
        previewLink.style.display = 'inline-flex';
      } else {
        previewLink.style.display = 'none';
      }
    }

    renderMilestones();
    renderTimeline();
  }

  function updateStats() {
    var ms = uiMilestones();
    var completed = ms.filter(function (m) { return m.done; }).length;
    var phaseEl = document.getElementById('statPhase');
    var tasksEl = document.getElementById('statTasks');
    var fbEl = document.getElementById('statFeedback');
    var filesEl = document.getElementById('statFiles');
    if (phaseEl) phaseEl.textContent = getCurrentPhase(ms);
    if (tasksEl) tasksEl.textContent = completed + '/' + ms.length;
    if (fbEl) fbEl.textContent = state.feedback.length;
    if (filesEl) filesEl.textContent = state.files.length;
  }

  /* ----------------------------------------
      MILESTONES
      ---------------------------------------- */
  // Map server milestone rows to the shape the UI expects
  function uiMilestones() {
    return state.milestones.map(function (m, i) {
      var done = m.status === 'done';
      var active = !done && m.status === 'in_progress';
      if (!done && !active) {
        active = i > 0 && state.milestones[i - 1].status === 'in_progress' && i === firstOpenIndex();
      }
      return { name: m.name, desc: m.descr, date: m.date, done: done, active: active };
    });
  }

  function firstOpenIndex() {
    for (var i = 0; i < state.milestones.length; i++) {
      if (state.milestones[i].status !== 'done') return i;
    }
    return -1;
  }

  function getCurrentPhase(milestones) {
    for (var i = 0; i < milestones.length; i++) {
      if (milestones[i].active) return milestones[i].name;
    }
    var allDone = milestones.length && milestones.every(function (m) { return m.done; });
    return allDone ? 'Complete' : (milestones[milestones.length - 1] ? milestones[milestones.length - 1].name : '—');
  }

  function renderMilestones() {
    var container = document.getElementById('milestonesList');
    if (!container) return;
    var ms = uiMilestones();
    container.innerHTML = ms.map(function (m) {
      var cls = m.done ? 'done' : m.active ? 'active' : 'pending';
      var statusText = m.done ? 'Complete' : m.active ? 'In Progress' : 'Pending';
      return '<div class="milestone">' +
        '<div class="milestone-dot ' + cls + '"></div>' +
        '<div class="milestone-info"><div class="milestone-name">' + esc(m.name) + '</div><div class="milestone-date">' + esc(m.desc) + ' — ' + formatDate(m.date) + '</div></div>' +
        '<span class="milestone-status ' + cls + '">' + statusText + '</span>' +
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
      submitFeedback({
        category: 'design',
        priority: 'medium',
        subject: 'Preview feedback: ' + rating,
        message: text || ('Quick rating: ' + rating),
        attachments: []
      }).then(function () {
        document.getElementById('previewFeedbackText').value = '';
        document.querySelectorAll('.feedback-quick-btn').forEach(function (b) { b.classList.remove('selected'); });
      });
    });
  }

  function renderPreview() {
    if (!state.company) return;
    var c = state.company;
    var container = document.getElementById('previewContainer');
    var link = document.getElementById('previewLink');
    if (!container) return;
    if (c.preview_url) {
      container.innerHTML = '<iframe src="' + esc(c.preview_url) + '" style="width:100%;height:500px;border:none;border-radius:var(--radius)"></iframe>';
      if (link) { link.href = c.preview_url; link.style.display = 'inline-flex'; }
    } else {
      container.innerHTML = '<div class="preview-placeholder"><svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><rect x="2" y="3" width="20" height="14" rx="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg><h3>Redesign In Progress</h3><p>Your redesign is being crafted. Check back soon.</p></div>';
      if (link) link.style.display = 'none';
    }
  }

  /* ----------------------------------------
      FEEDBACK
      ---------------------------------------- */
  function submitFeedback(payload) {
    return api('/feedback', { method: 'POST', body: payload }).then(function () {
      return loadBootstrap();
    }).then(function () {
      updateStats();
      renderFeedbackHistory();
      renderTimeline();
      toast('Feedback submitted!', 'success');
    }).catch(function (err) {
      toast(err.message || 'Could not submit feedback', 'error');
    });
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

      submitFeedback({
        category: category,
        priority: priority,
        subject: subject,
        message: message,
        attachments: pendingFiles.slice()
      }).then(function () {
        form.reset();
        pendingFiles = [];
        var list = document.getElementById('fileList');
        if (list) list.innerHTML = '';
      });
    });
  }

  function handleFiles(fileList) {
    Array.from(fileList).forEach(function (file) {
      if (file.size > 512 * 1024) { toast(file.name + ' is over the 512KB attachment limit', 'error'); return; }
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
      return '<div class="file-item"><span class="file-name">' + esc(f.name) + '</span><span class="file-size">' + formatSize(f.size) + '</span><button type="button" class="file-remove" data-idx="' + i + '">&times;</button></div>';
    }).join('');
    container.querySelectorAll('.file-remove').forEach(function (btn) {
      btn.addEventListener('click', function () {
        pendingFiles.splice(parseInt(btn.dataset.idx, 10), 1);
        renderPendingFiles();
      });
    });
  }

  function renderFeedbackHistory() {
    var container = document.getElementById('feedbackHistory');
    if (!container) return;
    var list = state.feedback;
    if (!list.length) {
      container.innerHTML = '<div class="no-items">No feedback submitted yet.</div>';
      return;
    }
    container.innerHTML = list.map(function (fb) {
      var replyHTML = fb.reply ? '<div class="feedback-reply"><div class="feedback-reply-label">GA Response</div><div class="feedback-reply-text">' + esc(fb.reply) + '</div></div>' : '';
      var filesHTML = fb.files && fb.files.length ? '<div class="feedback-files">' + fb.files.map(function (f) { return '<span class="feedback-file">📎 ' + esc(f) + '</span>'; }).join('') + '</div>' : '';
      return '<div class="feedback-item">' +
        '<div class="feedback-header">' +
          '<span class="feedback-category ' + esc(fb.category) + '">' + esc(fb.category) + '</span>' +
          '<span class="feedback-priority ' + esc(fb.priority) + '">' + esc(fb.priority) + '</span>' +
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
    var ms = uiMilestones();

    var events = [];
    ms.forEach(function (m) {
      events.push({
        date: m.date,
        title: m.name,
        desc: m.desc,
        status: m.done ? 'done' : m.active ? 'active' : 'pending'
      });
    });

    state.feedback.forEach(function (fb) {
      events.push({
        date: String(fb.date || '').slice(0, 10),
        title: 'Feedback: ' + fb.subject,
        desc: String(fb.message || '').slice(0, 100) + (String(fb.message || '').length > 100 ? '...' : ''),
        status: 'done'
      });
    });

    events.sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });

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
      if (file.size > 1024 * 1024) { toast(file.name + ' is over the 1MB limit', 'error'); return; }
      var reader = new FileReader();
      reader.onload = function (e) {
        api('/files', { method: 'POST', body: { name: file.name, type: file.type, data: e.target.result } })
          .then(loadBootstrap)
          .then(function () {
            updateStats();
            renderFiles();
            toast('File uploaded: ' + file.name, 'success');
          })
          .catch(function (err) { toast(err.message || 'Upload failed', 'error'); });
      };
      reader.readAsDataURL(file);
    });
  }

  function downloadFile(id) {
    fetch(API + '/files?id=' + encodeURIComponent(id), { credentials: 'same-origin' })
      .then(function (res) {
        if (!res.ok) throw new Error('Download failed');
        var disposition = res.headers.get('Content-Disposition') || '';
        var match = disposition.match(/filename="?([^";]+)"?/);
        return res.blob().then(function (blob) { return { blob: blob, name: match ? match[1] : 'download' }; });
      })
      .then(function (f) {
        var url = URL.createObjectURL(f.blob);
        var a = document.createElement('a');
        a.href = url;
        a.download = f.name;
        a.click();
        setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
      })
      .catch(function (err) { toast(err.message || 'Download failed', 'error'); });
  }

  function renderFiles() {
    var container = document.getElementById('filesList');
    if (!container) return;
    var files = state.files;
    if (!files.length) {
      container.innerHTML = '<div class="no-items">No files uploaded yet.</div>';
      return;
    }
    container.innerHTML = '<div class="file-grid">' + files.map(function (f) {
      var icon = getFileIcon(f.type);
      return '<div class="file-card" data-id="' + esc(f.id) + '">' +
        '<div class="file-card-icon">' + icon + '</div>' +
        '<div class="file-card-name" title="' + esc(f.name) + '">' + esc(f.name) + '</div>' +
        '<div class="file-card-meta">' + formatSize(f.size) + ' · ' + formatDate(f.date) + '</div>' +
      '</div>';
    }).join('') + '</div>';

    container.querySelectorAll('.file-card').forEach(function (card) {
      card.addEventListener('click', function () { downloadFile(card.dataset.id); });
    });
  }

  /* ----------------------------------------
      HELPERS
      ---------------------------------------- */
  function getProjectStatus(c) {
    var now = new Date();
    var start = new Date(c.start_date + 'T00:00:00Z');
    var end = c.delivery_date ? new Date(c.delivery_date + 'T23:59:59Z') : null;
    if (isNaN(start.getTime())) return { label: 'Scheduled', color: 'var(--yellow)' };
    if (now < start) return { label: 'Scheduled', color: 'var(--yellow)' };
    if (end && now > end) return { label: 'Delivered', color: 'var(--green)' };
    if (!end) return { label: 'In Progress', color: 'var(--blue)' };
    var pct = (now - start) / (end - start) * 100;
    if (pct < 30) return { label: 'In Progress', color: 'var(--blue)' };
    if (pct < 70) return { label: 'In Development', color: 'var(--purple)' };
    return { label: 'Review', color: 'var(--yellow)' };
  }

  function formatDate(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
    return dt.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  }

  function formatDateTime(d) {
    if (!d) return '—';
    var dt = new Date(d);
    if (isNaN(dt.getTime())) return '—';
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
    if (str === null || str === undefined) return '';
    var div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
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
