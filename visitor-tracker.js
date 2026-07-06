/* ========================================
   GA VISITOR TRACKER — Anonymous Session Tracking
   Pages, device, referrer, geolocation, funnel
   ======================================== */
window.VisitorTracker = (function () {
  'use strict';

  var SESSION_KEY = 'ga_visitor_session';
  var VISITS_KEY = 'ga_visitor_visits';
  var CONSENT_KEY = 'ga_cookie_consent';
  var session = null;
  var visits = [];

  /* ----------------------------------------
     INIT — Start tracking on page load
     ---------------------------------------- */
  function init() {
    if (!hasConsent()) return;

    session = getOrCreateSession();
    trackPageview();
    trackReferrer();
    trackDevice();
    trackExit();
    save();
  }

  /* ----------------------------------------
     CONSENT CHECK
     ---------------------------------------- */
  function hasConsent() {
    return localStorage.getItem(CONSENT_KEY) === 'accepted';
  }

  function setConsent(status) {
    localStorage.setItem(CONSENT_KEY, status);
    if (status === 'accepted') {
      init();
    }
  }

  /* ----------------------------------------
     SESSION MANAGEMENT
     ---------------------------------------- */
  function getOrCreateSession() {
    var stored = localStorage.getItem(SESSION_KEY);
    if (stored) {
      try {
        var s = JSON.parse(stored);
        // Session expires after 30 minutes of inactivity
        if (Date.now() - s.lastActive < 1800000) {
          s.lastActive = Date.now();
          s.pageCount = (s.pageCount || 0) + 1;
          return s;
        }
      } catch (e) {}
    }

    // New session
    return {
      id: 'sess_' + Date.now() + '_' + Math.random().toString(36).slice(2, 10),
      started: Date.now(),
      lastActive: Date.now(),
      pageCount: 1,
      pages: [],
      referrer: document.referrer || '',
      utm: getUTMParams(),
      device: null,
      geo: null,
      converted: false,
      leadId: null
    };
  }

  function getUTMParams() {
    var params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || '',
      term: params.get('utm_term') || '',
      content: params.get('utm_content') || ''
    };
  }

  /* ----------------------------------------
     PAGEVIEW TRACKING
     ---------------------------------------- */
  function trackPageview() {
    if (!session) return;

    var page = {
      url: window.location.href,
      path: window.location.pathname,
      title: document.title,
      ts: Date.now(),
      referrer: document.referrer || ''
    };

    session.pages.push(page);
    session.lastActive = Date.now();

    // Save to visits log
    visits.push({
      sessionId: session.id,
      type: 'pageview',
      page: page.path,
      title: page.title,
      ts: page.ts,
      referrer: page.referrer,
      utm: session.utm,
      device: session.device,
      geo: session.geo
    });

    // Keep last 500 visits
    if (visits.length > 500) visits = visits.slice(-500);
  }

  /* ----------------------------------------
     REFERRER TRACKING
     ---------------------------------------- */
  function trackReferrer() {
    if (!session) return;
    var ref = document.referrer || '';
    if (!ref) return;

    var isSearch = /google|bing|yahoo|duckduckgo|baidu/i.test(ref);
    var isSocial = /facebook|linkedin|twitter|instagram|tiktok|youtube/i.test(ref);
    var isDirect = !ref || ref.indexOf(window.location.host) !== -1;

    session.referrerType = isSearch ? 'search' : isSocial ? 'social' : isDirect ? 'direct' : 'referral';
    session.referrerDomain = ref ? new URL(ref).hostname : '';
  }

  /* ----------------------------------------
     DEVICE TRACKING
     ---------------------------------------- */
  function trackDevice() {
    if (!session) return;
    var ua = navigator.userAgent;

    var isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua);
    var isTablet = /iPad|Android(?!.*Mobile)/i.test(ua);
    var isDesktop = !isMobile && !isTablet;

    var browser = 'Unknown';
    if (/Chrome/i.test(ua) && !/Edg/i.test(ua)) browser = 'Chrome';
    else if (/Firefox/i.test(ua)) browser = 'Firefox';
    else if (/Safari/i.test(ua) && !/Chrome/i.test(ua)) browser = 'Safari';
    else if (/Edg/i.test(ua)) browser = 'Edge';
    else if (/Opera|OPR/i.test(ua)) browser = 'Opera';

    var os = 'Unknown';
    if (/Windows/i.test(ua)) os = 'Windows';
    else if (/Mac/i.test(ua)) os = 'macOS';
    else if (/Linux/i.test(ua)) os = 'Linux';
    else if (/Android/i.test(ua)) os = 'Android';
    else if (/iPhone|iPad|iPod/i.test(ua)) os = 'iOS';

    session.device = {
      type: isTablet ? 'tablet' : isMobile ? 'mobile' : 'desktop',
      browser: browser,
      os: os,
      screen: screen.width + 'x' + screen.height,
      language: navigator.language || ''
    };
  }

  /* ----------------------------------------
     EXIT TRACKING
     ---------------------------------------- */
  function trackExit() {
    if (!session) return;

    // Track when user leaves
    window.addEventListener('beforeunload', function () {
      session.lastActive = Date.now();
      session.exitPage = window.location.pathname;
      session.duration = Date.now() - session.started;
      save();
    });

    // Track visibility changes (tab switch, minimize)
    document.addEventListener('visibilitychange', function () {
      if (document.hidden) {
        session.lastActive = Date.now();
        save();
      }
    });
  }

  /* ----------------------------------------
     GEOLOCATION — Fetch from CF Worker
     ---------------------------------------- */
  function fetchGeo() {
    if (!session || session.geo) return;

    return fetch('/api/visitor-geo')
      .then(function (r) { return r.json(); })
      .then(function (data) {
        if (data.city) {
          session.geo = {
            city: data.city || '',
            region: data.region || '',
            country: data.country || '',
            countryName: data.countryName || '',
            lat: data.lat || null,
            lng: data.lng || null,
            timezone: data.timezone || ''
          };
          save();
        }
      })
      .catch(function () {});
  }

  /* ----------------------------------------
     FORM SUBMIT — Merge session with lead
     ---------------------------------------- */
  function onFormSubmit(leadId) {
    if (!session) return;

    session.converted = true;
    session.leadId = leadId;
    session.convertedAt = Date.now();
    session.convertedPage = window.location.pathname;
    save();

    // Save full session data to the lead in Firestore
    if (window.FirebaseService) {
      FirebaseService.leads.update(leadId, {
        visitorSession: {
          sessionId: session.id,
          pages: session.pages,
          referrer: session.referrer,
          referrerType: session.referrerType,
          referrerDomain: session.referrerDomain,
          utm: session.utm,
          device: session.device,
          geo: session.geo,
          pageViews: session.pageCount,
          firstVisit: session.started,
          convertedAt: session.convertedAt
        }
      }).catch(function () {});
    }

    // Log conversion
    logVisit('conversion', { leadId: leadId, sessionId: session.id });
  }

  /* ----------------------------------------
     LOG VISIT
     ---------------------------------------- */
  function logVisit(type, data) {
    visits.push({
      sessionId: session ? session.id : '',
      type: type,
      ts: Date.now(),
      data: data
    });
    save();
  }

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    if (session) localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    localStorage.setItem(VISITS_KEY, JSON.stringify(visits.slice(-500)));
  }

  function load() {
    try {
      visits = JSON.parse(localStorage.getItem(VISITS_KEY) || '[]');
    } catch (e) {}
  }

  /* ----------------------------------------
     GETTERS
     ---------------------------------------- */
  function getSession() { return session; }
  function getVisits() { return visits.slice(); }
  function getVisitCount() { return visits.filter(function (v) { return v.type === 'pageview'; }).length; }
  function getConversionCount() { return visits.filter(function (v) { return v.type === 'conversion'; }).length; }

  function getVisitorStats() {
    var pageviews = visits.filter(function (v) { return v.type === 'pageview'; });
    var conversions = visits.filter(function (v) { return v.type === 'conversion'; });
    var uniqueSessions = new Set(pageviews.map(function (v) { return v.sessionId; }));

    // Referrer breakdown
    var referrers = {};
    pageviews.forEach(function (v) {
      var ref = v.referrer || 'direct';
      referrers[ref] = (referrers[ref] || 0) + 1;
    });

    // Device breakdown
    var devices = { mobile: 0, desktop: 0, tablet: 0 };
    pageviews.forEach(function (v) {
      if (v.device) devices[v.device.type] = (devices[v.device.type] || 0) + 1;
    });

    // Page popularity
    var pages = {};
    pageviews.forEach(function (v) {
      pages[v.page] = (pages[v.page] || 0) + 1;
    });

    // UTM breakdown
    var utmSources = {};
    pageviews.forEach(function (v) {
      if (v.utm && v.utm.source) {
        utmSources[v.utm.source] = (utmSources[v.utm.source] || 0) + 1;
      }
    });

    return {
      totalPageviews: pageviews.length,
      uniqueVisitors: uniqueSessions.size,
      conversions: conversions.length,
      conversionRate: uniqueSessions.size > 0 ? Math.round((conversions.length / uniqueSessions.size) * 100) : 0,
      referrers: referrers,
      devices: devices,
      topPages: Object.entries(pages).sort(function (a, b) { return b[1] - a[1]; }).slice(0, 10),
      utmSources: utmSources,
      recentVisits: visits.slice(-20).reverse()
    };
  }

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  load();

  return {
    init: init,
    hasConsent: hasConsent,
    setConsent: setConsent,
    fetchGeo: fetchGeo,
    onFormSubmit: onFormSubmit,
    getSession: getSession,
    getVisits: getVisits,
    getVisitCount: getVisitCount,
    getConversionCount: getConversionCount,
    getVisitorStats: getVisitorStats,
    logVisit: logVisit,
    trackPageview: trackPageview
  };
})();
