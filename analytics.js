/* ========================================
   GA ANALYTICS — Conversion Funnel + Revenue Attribution
   Visual funnel, channel ROI, A/B results
   ======================================== */
window.Analytics = (function () {
  'use strict';

  var FUNNEL_KEY = 'ga_funnel_events';
  var ATTRIBUTION_KEY = 'ga_revenue_attribution';
  var events = [];
  var attributions = [];

  /* ----------------------------------------
     INIT
     ---------------------------------------- */
  function init() {
    load();
    trackFunnelEvents();
  }

  /* ----------------------------------------
     FUNNEL EVENT TRACKING
     ---------------------------------------- */
  function trackFunnelEvents() {
    // Step 1: Page View
    logFunnel('pageview', {
      page: window.location.pathname,
      referrer: document.referrer || '',
      utm: getUTM(),
      device: getDeviceType()
    });

    // Step 2: Score Tool Interaction
    var scoreForm = document.getElementById('heroForm') || document.getElementById('scoreForm');
    if (scoreForm) {
      scoreForm.addEventListener('submit', function () {
        logFunnel('score_submitted', {
          page: window.location.pathname,
          url: (document.getElementById('heroUrl') || document.getElementById('url') || {}).value || ''
        });
      });
    }

    // Step 3: Form Start (focus on first field)
    var nameInput = document.getElementById('heroName') || document.getElementById('name');
    if (nameInput) {
      nameInput.addEventListener('focus', function () {
        logFunnel('form_start', { page: window.location.pathname });
      }, { once: true });
    }

    // Step 4: Exit Intent
    document.addEventListener('mouseout', function (e) {
      if (e.clientY < 10) {
        logFunnel('exit_intent', { page: window.location.pathname });
      }
    }, { once: true });
  }

  function logFunnel(step, data) {
    events.push({
      step: step,
      ts: Date.now(),
      sessionId: window.VisitorTracker ? VisitorTracker.getSession()?.id : '',
      page: data.page || window.location.pathname,
      data: data
    });
    save();
  }

  function getUTM() {
    var params = new URLSearchParams(window.location.search);
    return {
      source: params.get('utm_source') || '',
      medium: params.get('utm_medium') || '',
      campaign: params.get('utm_campaign') || ''
    };
  }

  function getDeviceType() {
    var ua = navigator.userAgent;
    if (/iPad|Android(?!.*Mobile)/i.test(ua)) return 'tablet';
    if (/Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(ua)) return 'mobile';
    return 'desktop';
  }

  /* ----------------------------------------
     CONVERSION FUNNEL ANALYTICS
     ---------------------------------------- */
  function getFunnelData() {
    var steps = ['pageview', 'form_start', 'score_submitted', 'lead_created', 'contacted', 'proposal', 'closed-won'];
    var labels = ['Page Views', 'Form Started', 'Score Submitted', 'Lead Created', 'Contacted', 'Proposal Sent', 'Closed Won'];
    var counts = {};

    steps.forEach(function (s) { counts[s] = 0; });

    events.forEach(function (e) {
      if (counts[e.step] !== undefined) counts[e.step]++;
    });

    // Calculate conversion rates between steps
    var funnel = [];
    for (var i = 0; i < steps.length; i++) {
      var count = counts[steps[i]];
      var prevCount = i > 0 ? counts[steps[i - 1]] : count;
      var dropoff = i > 0 ? prevCount - count : 0;
      var convRate = prevCount > 0 ? Math.round((count / prevCount) * 100) : 100;
      var overallRate = counts[steps[0]] > 0 ? Math.round((count / counts[steps[0]]) * 100) : 0;

      funnel.push({
        step: steps[i],
        label: labels[i],
        count: count,
        dropoff: dropoff,
        convRate: convRate,
        overallRate: overallRate
      });
    }

    return {
      steps: funnel,
      totalVisitors: counts.pageview,
      totalLeads: counts.lead_created,
      totalDeals: counts['closed-won'],
      overallConversion: counts.pageview > 0 ? Math.round((counts['closed-won'] / counts.pageview) * 100) : 0
    };
  }

  /* ----------------------------------------
     REVENUE ATTRIBUTION
     ---------------------------------------- */
  function attributeRevenue(leadId, revenue, source, channel, campaign) {
    var entry = {
      leadId: leadId,
      revenue: revenue,
      source: source || 'direct',
      channel: channel || 'organic',
      campaign: campaign || '',
      ts: Date.now()
    };
    attributions.push(entry);
    save();
  }

  function getAttributionData() {
    var bySource = {};
    var byChannel = {};
    var byCampaign = {};
    var totalRevenue = 0;

    attributions.forEach(function (a) {
      totalRevenue += a.revenue || 0;

      bySource[a.source] = bySource[a.source] || { revenue: 0, deals: 0 };
      bySource[a.source].revenue += a.revenue || 0;
      bySource[a.source].deals++;

      byChannel[a.channel] = byChannel[a.channel] || { revenue: 0, deals: 0 };
      byChannel[a.channel].revenue += a.revenue || 0;
      byChannel[a.channel].deals++;

      if (a.campaign) {
        byCampaign[a.campaign] = byCampaign[a.campaign] || { revenue: 0, deals: 0 };
        byCampaign[a.campaign].revenue += a.revenue || 0;
        byCampaign[a.campaign].deals++;
      }
    });

    return {
      totalRevenue: totalRevenue,
      totalDeals: attributions.length,
      avgDealSize: attributions.length > 0 ? Math.round(totalRevenue / attributions.length) : 0,
      bySource: Object.entries(bySource).map(function (e) { return { name: e[0], revenue: e[1].revenue, deals: e[1].deals, avg: Math.round(e[1].revenue / e[1].deals) }; }).sort(function (a, b) { return b.revenue - a.revenue; }),
      byChannel: Object.entries(byChannel).map(function (e) { return { name: e[0], revenue: e[1].revenue, deals: e[1].deals, avg: Math.round(e[1].revenue / e[1].deals) }; }).sort(function (a, b) { return b.revenue - a.revenue; }),
      byCampaign: Object.entries(byCampaign).map(function (e) { return { name: e[0], revenue: e[1].revenue, deals: e[1].deals }; }).sort(function (a, b) { return b.revenue - a.revenue; })
    };
  }

  /* ----------------------------------------
     CHANNEL PERFORMANCE
     ---------------------------------------- */
  function getChannelPerformance() {
    var funnel = getFunnelData();
    var attribution = getAttributionData();
    var visitorStats = window.VisitorTracker ? VisitorTracker.getVisitorStats() : {};

    // Calculate cost per channel (placeholder — integrate with actual ad spend)
    var channels = [
      { name: 'Organic Search', icon: '🔍', visitors: visitorStats.referrers?.google || 0, leads: 0, revenue: 0, spend: 0 },
      { name: 'Direct', icon: '🔗', visitors: 0, leads: 0, revenue: 0, spend: 0 },
      { name: 'Social', icon: '📱', visitors: 0, leads: 0, revenue: 0, spend: 0 },
      { name: 'Paid Ads', icon: '💰', visitors: 0, leads: 0, revenue: 0, spend: 0 },
      { name: 'Email', icon: '📧', visitors: 0, leads: 0, revenue: 0, spend: 0 },
      { name: 'Referral', icon: '🤝', visitors: 0, leads: 0, revenue: 0, spend: 0 }
    ];

    // Map attribution revenue to channels
    attribution.byChannel.forEach(function (c) {
      var ch = channels.find(function (ch) { return ch.name.toLowerCase() === c.name.toLowerCase(); });
      if (ch) {
        ch.leads = c.deals;
        ch.revenue = c.revenue;
      }
    });

    // Calculate ROI per channel
    channels.forEach(function (ch) {
      ch.roi = ch.spend > 0 ? Math.round(((ch.revenue - ch.spend) / ch.spend) * 100) : ch.revenue > 0 ? 100 : 0;
      ch.costPerLead = ch.leads > 0 ? Math.round(ch.spend / ch.leads) : 0;
      ch.costPerAcquisition = ch.leads > 0 ? Math.round(ch.spend / ch.leads) : 0;
    });

    return channels;
  }

  /* ----------------------------------------
     A/B TEST RESULTS
     ---------------------------------------- */
  function getABTestResults() {
    if (!window.OutreachEngine) return [];
    return OutreachEngine.getABTests().map(function (test) {
      var totalA = test.variantA.sent;
      var totalB = test.variantB.sent;
      var openRateA = totalA > 0 ? Math.round((test.variantA.opens / totalA) * 100) : 0;
      var openRateB = totalB > 0 ? Math.round((test.variantB.opens / totalB) * 100) : 0;

      return {
        id: test.id,
        name: test.name,
        status: test.status,
        winner: test.winner,
        variantA: {
          name: test.variantA.name,
          sent: totalA,
          opens: test.variantA.opens,
          clicks: test.variantA.clicks,
          openRate: openRateA
        },
        variantB: {
          name: test.variantB.name,
          sent: totalB,
          opens: test.variantB.opens,
          clicks: test.variantB.clicks,
          openRate: openRateB
        },
        lift: Math.abs(openRateA - openRateB)
      };
    });
  }

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    localStorage.setItem(FUNNEL_KEY, JSON.stringify(events.slice(-2000)));
    localStorage.setItem(ATTRIBUTION_KEY, JSON.stringify(attributions.slice(-500)));
  }

  function load() {
    try {
      events = JSON.parse(localStorage.getItem(FUNNEL_KEY) || '[]');
      attributions = JSON.parse(localStorage.getItem(ATTRIBUTION_KEY) || '[]');
    } catch (e) {}
  }

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  init();

  return {
    logFunnel: logFunnel,
    getFunnelData: getFunnelData,
    attributeRevenue: attributeRevenue,
    getAttributionData: getAttributionData,
    getChannelPerformance: getChannelPerformance,
    getABTestResults: getABTestResults,
    getEvents: function () { return events.slice(); }
  };
})();
