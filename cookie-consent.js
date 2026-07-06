/* ========================================
   GA COOKIE CONSENT — GDPR Compliant
   Banner, preferences, consent management
   ======================================== */
window.CookieConsent = (function () {
  'use strict';

  var CONSENT_KEY = 'ga_cookie_consent';
  var PREFS_KEY = 'ga_cookie_preferences';
  var listeners = [];

  var defaultPrefs = {
    necessary: true,
    analytics: false,
    marketing: false,
    timestamp: null
  };

  /* ----------------------------------------
     INIT — Show banner if no consent
     ---------------------------------------- */
  function init() {
    var consent = localStorage.getItem(CONSENT_KEY);
    if (consent) return; // Already consented/rejected

    showBanner();
  }

  /* ----------------------------------------
     BANNER
     ---------------------------------------- */
  function showBanner() {
    if (document.getElementById('cookie-consent-banner')) return;

    var banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML = `
      <div class="cc-banner">
        <div class="cc-content">
          <div class="cc-text">
            <h3>🍪 We value your privacy</h3>
            <p>We use cookies to improve your experience, analyze site traffic, and serve targeted content. You can choose which cookies to accept.</p>
          </div>
          <div class="cc-actions">
            <button class="cc-btn cc-btn-settings" id="cc-settings-btn">Customize</button>
            <button class="cc-btn cc-btn-reject" id="cc-reject-btn">Reject All</button>
            <button class="cc-btn cc-btn-accept" id="cc-accept-btn">Accept All</button>
          </div>
        </div>
      </div>

      <div class="cc-preferences" id="cc-prefs-panel" style="display:none">
        <div class="cc-prefs-content">
          <h3>Cookie Preferences</h3>
          <div class="cc-pref-item">
            <div class="cc-pref-header">
              <label class="cc-toggle"><input type="checkbox" checked disabled><span class="cc-toggle-slider"></span></label>
              <div><strong>Necessary</strong><p class="cc-pref-desc">Required for the site to function. Cannot be disabled.</p></div>
            </div>
          </div>
          <div class="cc-pref-item">
            <div class="cc-pref-header">
              <label class="cc-toggle"><input type="checkbox" id="cc-analytics"><span class="cc-toggle-slider"></span></label>
              <div><strong>Analytics</strong><p class="cc-pref-desc">Help us understand how visitors interact with our site.</p></div>
            </div>
          </div>
          <div class="cc-pref-item">
            <div class="cc-pref-header">
              <label class="cc-toggle"><input type="checkbox" id="cc-marketing"><span class="cc-toggle-slider"></span></label>
              <div><strong>Marketing</strong><p class="cc-pref-desc">Used to deliver relevant ads and track campaign performance.</p></div>
            </div>
          </div>
          <div class="cc-prefs-actions">
            <button class="cc-btn cc-btn-save" id="cc-save-prefs">Save Preferences</button>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(banner);
    addStyles();
    wireEvents();
  }

  /* ----------------------------------------
     EVENTS
     ---------------------------------------- */
  function wireEvents() {
    document.getElementById('cc-accept-btn').addEventListener('click', function () {
      acceptAll();
    });

    document.getElementById('cc-reject-btn').addEventListener('click', function () {
      rejectAll();
    });

    document.getElementById('cc-settings-btn').addEventListener('click', function () {
      var panel = document.getElementById('cc-prefs-panel');
      panel.style.display = panel.style.display === 'none' ? 'flex' : 'none';
    });

    document.getElementById('cc-save-prefs').addEventListener('click', function () {
      savePreferences();
    });
  }

  /* ----------------------------------------
     ACTIONS
     ---------------------------------------- */
  function acceptAll() {
    var prefs = { necessary: true, analytics: true, marketing: true, timestamp: Date.now() };
    save(prefs);
    removeBanner();
    notifyListeners('accepted', prefs);
  }

  function rejectAll() {
    var prefs = { necessary: true, analytics: false, marketing: false, timestamp: Date.now() };
    save(prefs);
    removeBanner();
    notifyListeners('rejected', prefs);
  }

  function savePreferences() {
    var prefs = {
      necessary: true,
      analytics: document.getElementById('cc-analytics').checked,
      marketing: document.getElementById('cc-marketing').checked,
      timestamp: Date.now()
    };
    save(prefs);
    removeBanner();
    notifyListeners('updated', prefs);
  }

  function save(prefs) {
    localStorage.setItem(CONSENT_KEY, prefs.analytics || prefs.marketing ? 'accepted' : 'rejected');
    localStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
  }

  function removeBanner() {
    var banner = document.getElementById('cookie-consent-banner');
    if (banner) banner.remove();
  }

  /* ----------------------------------------
     GETTERS
     ---------------------------------------- */
  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) !== null;
  }

  function getConsent() {
    return localStorage.getItem(CONSENT_KEY);
  }

  function getPreferences() {
    try {
      return JSON.parse(localStorage.getItem(PREFS_KEY) || 'null') || defaultPrefs;
    } catch (e) {
      return defaultPrefs;
    }
  }

  function allowsAnalytics() {
    return getPreferences().analytics === true;
  }

  function allowsMarketing() {
    return getPreferences().marketing === true;
  }

  function showManageButton() {
    // Add a floating button to manage preferences
    var btn = document.createElement('button');
    btn.id = 'cc-manage-btn';
    btn.textContent = '🍪';
    btn.title = 'Manage Cookie Preferences';
    btn.style.cssText = 'position:fixed;bottom:20px;left:20px;z-index:9998;width:44px;height:44px;border-radius:50%;background:#1a1a20;border:1px solid #2a2a30;cursor:pointer;font-size:20px;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 12px rgba(0,0,0,.3)';
    btn.addEventListener('click', function () {
      localStorage.removeItem(CONSENT_KEY);
      showBanner();
    });
    document.body.appendChild(btn);
  }

  /* ----------------------------------------
     STYLES
     ---------------------------------------- */
  function addStyles() {
    if (document.getElementById('cc-styles')) return;
    var style = document.createElement('style');
    style.id = 'cc-styles';
    style.textContent = `
      .cc-banner { position:fixed;bottom:0;left:0;right:0;z-index:10000;background:#121216;border-top:1px solid #1f1f28;padding:20px;animation:ccSlideUp .3s ease; }
      .cc-banner .cc-content { max-width:1200px;margin:0 auto;display:flex;align-items:center;justify-content:space-between;gap:20px;flex-wrap:wrap; }
      .cc-banner .cc-text h3 { font-size:16px;margin-bottom:6px;color:#f0f0f0; }
      .cc-banner .cc-text p { font-size:13px;color:#8a8a95;margin:0;max-width:600px; }
      .cc-banner .cc-actions { display:flex;gap:10px;flex-shrink:0; }
      .cc-btn { padding:10px 20px;border-radius:8px;font-size:13px;font-weight:600;cursor:pointer;border:none;transition:all .2s; }
      .cc-btn-accept { background:#e63946;color:#fff; }
      .cc-btn-accept:hover { background:#c33040; }
      .cc-btn-reject { background:transparent;color:#8a8a95;border:1px solid #2a2a30; }
      .cc-btn-reject:hover { border-color:#8a8a95;color:#f0f0f0; }
      .cc-btn-settings { background:transparent;color:#8a8a95;border:1px solid #2a2a30; }
      .cc-btn-settings:hover { border-color:#8a8a95;color:#f0f0f0; }
      .cc-btn-save { background:#e63946;color:#fff;width:100%; }
      .cc-preferences { position:fixed;bottom:0;left:0;right:0;z-index:10001;background:#121216;border-top:1px solid #1f1f28;padding:20px;display:flex;justify-content:center;animation:ccSlideUp .3s ease; }
      .cc-prefs-content { max-width:500px;width:100%; }
      .cc-prefs-content h3 { font-size:16px;margin-bottom:16px;color:#f0f0f0; }
      .cc-pref-item { padding:12px 0;border-bottom:1px solid #1f1f28; }
      .cc-pref-header { display:flex;align-items:flex-start;gap:12px; }
      .cc-pref-header strong { font-size:14px;color:#f0f0f0; }
      .cc-pref-desc { font-size:12px;color:#8a8a95;margin:4px 0 0; }
      .cc-prefs-actions { margin-top:16px; }
      @keyframes ccSlideUp { from { transform:translateY(100%); } to { transform:translateY(0); } }
      @media (max-width:640px) { .cc-banner .cc-content { flex-direction:column;align-items:stretch; } .cc-banner .cc-actions { justify-content:stretch; } .cc-btn { flex:1; } }
    `;
    document.head.appendChild(style);
  }

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
  return {
    init: init,
    hasConsent: hasConsent,
    getConsent: getConsent,
    getPreferences: getPreferences,
    allowsAnalytics: allowsAnalytics,
    allowsMarketing: allowsMarketing,
    acceptAll: acceptAll,
    rejectAll: rejectAll,
    showManageButton: showManageButton,
    subscribe: subscribe
  };
})();
