/* ========================================
   GA OUTREACH ENGINE — Bulk Outreach System
   Email (Brevo API), WhatsApp (web URLs), Queue, Scheduling, Tracking
   ======================================== */
window.OutreachEngine = (function () {
  'use strict';

  /* ----------------------------------------
     CONFIG
     ---------------------------------------- */
  var CONFIG = {
    brevoApiKey: '', // Set via CF Pages env var
    trackBaseUrl: '/api/track',
    maxEmailsPerDay: 290, // Stay under Brevo 300/day limit
    maxWhatsAppPerDay: 50,
    batchSize: 50,
    batchDelayMs: 60000, // 1 min between batches
    timezone: 'America/New_York'
  };

  /* ----------------------------------------
     STATE
     ---------------------------------------- */
  var queue = [];
  var sentLog = [];
  var tracking = {}; // { leadId: { opens: 0, clicks: 0, lastOpen: null, lastClick: null } }
  var dailyCount = { email: 0, whatsapp: 0, date: todayStr() };
  var campaigns = [];
  var listeners = [];

  function todayStr() { return new Date().toISOString().slice(0, 10); }

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    localStorage.setItem('ga_outreach_queue', JSON.stringify(queue.slice(-500)));
    localStorage.setItem('ga_outreach_sent', JSON.stringify(sentLog.slice(-500)));
    localStorage.setItem('ga_outreach_tracking', JSON.stringify(tracking));
    localStorage.setItem('ga_outreach_daily', JSON.stringify(dailyCount));
    localStorage.setItem('ga_outreach_campaigns', JSON.stringify(campaigns.slice(-50)));
  }

  function load() {
    try {
      queue = JSON.parse(localStorage.getItem('ga_outreach_queue') || '[]');
      sentLog = JSON.parse(localStorage.getItem('ga_outreach_sent') || '[]');
      tracking = JSON.parse(localStorage.getItem('ga_outreach_tracking') || '{}');
      dailyCount = JSON.parse(localStorage.getItem('ga_outreach_daily') || '{}');
      campaigns = JSON.parse(localStorage.getItem('ga_outreach_campaigns') || '[]');
      if (dailyCount.date !== todayStr()) {
        dailyCount = { email: 0, whatsapp: 0, date: todayStr() };
      }
    } catch (e) {}
  }

  /* ----------------------------------------
     EMAIL SENDING — Brevo API via Netlify Function
     ---------------------------------------- */
  function sendEmailBatch(recipients, subject, htmlContent, textContent, campaignName) {
    return new Promise(function (resolve, reject) {
      if (!recipients || recipients.length === 0) {
        reject(new Error('No recipients'));
        return;
      }

      // Check daily limit
      var remaining = CONFIG.maxEmailsPerDay - dailyCount.email;
      if (remaining <= 0) {
        reject(new Error('Daily email limit reached (' + CONFIG.maxEmailsPerDay + ')'));
        return;
      }

      // Trim to daily limit
      var toSend = recipients.slice(0, Math.min(recipients.length, remaining));

      // Add tracking pixels to HTML
      var trackedHtml = addTrackingPixels(htmlContent, toSend);

      logAction('email-batch', 'Sending ' + toSend.length + ' emails via Brevo', 'info');

      // Read API key from Firestore settings
      var settingsPromise = window.FirebaseService
        ? FirebaseService.settings.get()
        : Promise.resolve({});

      settingsPromise.then(function (settings) {
        // Call CF Pages Function
        return fetch('/api/send-email', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            recipients: toSend.map(function (r) { return { email: r.email, name: r.name || r.contactName || '' }; }),
            subject: subject,
            htmlContent: trackedHtml,
            textContent: textContent || '',
            tags: ['outreach', campaignName || 'bulk'],
            apiKey: settings.brevoApiKey || '',
            senderName: settings.brevoSenderName || 'Gideon Abochie',
            senderEmail: settings.brevoSenderEmail || 'gideon@gideonabochie.com'
          })
        });
      })
        .then(function (r) { return r.json(); })
        .then(function (result) {
          dailyCount.email += result.totalSent || 0;

          // Log sent
          toSend.forEach(function (r) {
            sentLog.push({
              leadId: r.id || r.leadId || '',
              leadName: r.name || r.contactName || r.email,
              channel: 'email',
              subject: subject,
              status: result.success ? 'sent' : 'failed',
              ts: Date.now(),
              campaign: campaignName || 'bulk'
            });

            // Update lead status
            if (r.id || r.leadId) {
              updateLeadOutreach(r.id || r.leadId, 'email', 'sent');
            }
          });

          // Track campaign
          if (campaignName) {
            var camp = campaigns.find(function (c) { return c.name === campaignName; });
            if (!camp) {
              camp = { name: campaignName, emailSent: 0, whatsappSent: 0, opens: 0, clicks: 0, created: Date.now() };
              campaigns.push(camp);
            }
            camp.emailSent += result.totalSent || 0;
          }

          save();
          logAction('email-sent', result.totalSent + ' sent, ' + (result.totalFailed || 0) + ' failed', result.totalSent > 0 ? 'success' : 'error');
          notifyListeners('sent', { channel: 'email', count: result.totalSent, campaign: campaignName });
          resolve(result);
        })
        .catch(function (err) {
          logAction('email-error', err.message, 'error');
          reject(err);
        });
    });
  }

  function addTrackingPixels(html, recipients) {
    // Add open tracking pixel (first recipient — unique per send)
    var pixelUrl = CONFIG.trackBaseUrl + '/open?lid={leadId}&cid={campaignId}';
    var pixel = '<img src="' + pixelUrl + '" width="1" height="1" style="display:none" alt="">';

    // Add click tracking to links
    var tracked = html.replace(/href="([^"]+)"/g, function (match, url) {
      if (url.startsWith('mailto:') || url.startsWith('tel:') || url.startsWith('#')) return match;
      var clickUrl = CONFIG.trackBaseUrl + '/click?lid={leadId}&cid={campaignId}&url=' + encodeURIComponent(url);
      return 'href="' + clickUrl + '"';
    });

    return tracked + pixel;
  }

  /* ----------------------------------------
     WHATSAPP — Bulk send via web URLs
     ---------------------------------------- */
  function sendWhatsAppBulk(leads, messageTemplate, campaignName) {
    var sent = 0;
    var remaining = CONFIG.maxWhatsAppPerDay - dailyCount.whatsapp;

    if (remaining <= 0) {
      logAction('whatsapp-limit', 'Daily WhatsApp limit reached', 'warning');
      return sent;
    }

    var toSend = leads.slice(0, Math.min(leads.length, remaining));

    toSend.forEach(function (lead, i) {
      setTimeout(function () {
        var phone = lead.phone || lead.contactPhone || '';
        if (!phone) {
          // Try to construct from state/area code
          phone = generatePhone(lead);
        }

        var message = fillTemplate(messageTemplate, lead);
        var url = 'https://wa.me/' + phone.replace(/[^0-9]/g, '') + '?text=' + encodeURIComponent(message);

        // Open in new tab (user clicks send manually)
        window.open(url, '_blank');

        sent++;
        dailyCount.whatsapp++;

        sentLog.push({
          leadId: lead.id || '',
          leadName: lead.name || lead.contactName || '',
          channel: 'whatsapp',
          status: 'opened',
          ts: Date.now(),
          campaign: campaignName || 'bulk'
        });

        updateLeadOutreach(lead.id, 'whatsapp', 'opened');

        if (campaignName) {
          var camp = campaigns.find(function (c) { return c.name === campaignName; });
          if (camp) camp.whatsappSent++;
        }

        save();
        logAction('whatsapp-opened', 'WhatsApp opened for ' + (lead.name || lead.contactName), 'info');
      }, i * 2000); // 2 second delay between tabs
    });

    logAction('whatsapp-batch', 'Opening ' + toSend.length + ' WhatsApp chats', 'success');
    return toSend.length;
  }

  function generatePhone(lead) {
    var areaCodes = {
      'CA': '213', 'TX': '214', 'NY': '212', 'FL': '305', 'IL': '312',
      'PA': '215', 'OH': '614', 'GA': '404', 'NC': '919', 'MI': '313'
    };
    var area = areaCodes[lead.state] || '202';
    return '+1' + area + '555' + String(Math.floor(Math.random() * 9000) + 1000);
  }

  /* ----------------------------------------
     QUEUE MANAGEMENT
     ---------------------------------------- */
  function enqueue(items) {
    items.forEach(function (item) {
      item.id = 'out_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      item.status = 'queued'; // queued, sending, sent, failed
      item.created = Date.now();
      item.scheduledFor = item.scheduledFor || Date.now();
      item.attempts = 0;
      queue.push(item);
    });
    save();
    notifyListeners('queue', { added: items.length });
    return items;
  }

  function processQueue() {
    var now = Date.now();
    var ready = queue.filter(function (q) {
      return q.status === 'queued' && q.scheduledFor <= now;
    });

    if (ready.length === 0) return;

    // Group by channel
    var emailBatch = ready.filter(function (q) { return q.channel === 'email'; });
    var whatsappBatch = ready.filter(function (q) { return q.channel === 'whatsapp'; });

    if (emailBatch.length > 0) {
      processEmailBatch(emailBatch);
    }

    if (whatsappBatch.length > 0) {
      processWhatsAppBatch(whatsappBatch);
    }
  }

  function processEmailBatch(batch) {
    var recipients = batch.map(function (q) {
      return {
        id: q.leadId,
        email: q.email,
        name: q.name || q.contactName || '',
        contactName: q.contactName || ''
      };
    });

    var subject = batch[0] ? batch[0].subject : 'Outreach';
    var html = batch[0] ? batch[0].html : '';
    var campaign = batch[0] ? batch[0].campaign : '';

    batch.forEach(function (q) { q.status = 'sending'; q.attempts++; });
    save();

    sendEmailBatch(recipients, subject, html, '', campaign).then(function (result) {
      batch.forEach(function (q) {
        q.status = (result.totalSent > 0) ? 'sent' : 'failed';
        q.completedAt = Date.now();
      });
      save();
    }).catch(function (err) {
      batch.forEach(function (q) {
        q.status = q.attempts >= 3 ? 'failed' : 'queued';
        q.scheduledFor = Date.now() + 300000; // Retry in 5 min
      });
      save();
    });
  }

  function processWhatsAppBatch(batch) {
    var leads = batch.map(function (q) {
      return {
        id: q.leadId,
        name: q.name || q.contactName || '',
        contactName: q.contactName || '',
        phone: q.phone || '',
        state: q.state || ''
      };
    });

    var message = batch[0] ? batch[0].message : '';
    var campaign = batch[0] ? batch[0].campaign : '';

    sendWhatsAppBulk(leads, message, campaign);

    batch.forEach(function (q) {
      q.status = 'sent';
      q.completedAt = Date.now();
    });
    save();
  }

  /* ----------------------------------------
     TRACKING
     ---------------------------------------- */
  function trackOpen(leadId, campaignId) {
    if (!tracking[leadId]) tracking[leadId] = { opens: 0, clicks: 0, lastOpen: null, lastClick: null };
    tracking[leadId].opens++;
    tracking[leadId].lastOpen = Date.now();
    save();

    // Update campaign
    var camp = campaigns.find(function (c) { return c.name === campaignId; });
    if (camp) camp.opens++;

    // Update lead
    updateLeadOutreach(leadId, 'email', 'opened');

    logAction('track-open', 'Lead ' + leadId + ' opened email', 'info');
    notifyListeners('tracking', { type: 'open', leadId: leadId });
  }

  function trackClick(leadId, campaignId, url) {
    if (!tracking[leadId]) tracking[leadId] = { opens: 0, clicks: 0, lastOpen: null, lastClick: null };
    tracking[leadId].clicks++;
    tracking[leadId].lastClick = Date.now();
    save();

    var camp = campaigns.find(function (c) { return c.name === campaignId; });
    if (camp) camp.clicks++;

    updateLeadOutreach(leadId, 'email', 'clicked');

    logAction('track-click', 'Lead ' + leadId + ' clicked link', 'success');
    notifyListeners('tracking', { type: 'click', leadId: leadId, url: url });
  }

  function getTracking(leadId) {
    return tracking[leadId] || { opens: 0, clicks: 0, lastOpen: null, lastClick: null };
  }

  /* ----------------------------------------
     CAMPAIGNS
     ---------------------------------------- */
  function createCampaign(name, leads, channel, subject, html, message) {
    var items = leads.map(function (lead) {
      return {
        leadId: lead.id,
        leadName: lead.name || lead.contactName || '',
        email: lead.contactEmail || lead.email || '',
        phone: lead.phone || lead.contactPhone || '',
        name: lead.name || '',
        contactName: lead.contactName || '',
        state: lead.state || '',
        channel: channel,
        subject: subject || '',
        html: html || '',
        message: message || '',
        campaign: name,
        scheduledFor: Date.now()
      };
    });

    var queued = enqueue(items);

    var camp = {
      name: name,
      channel: channel,
      emailSent: 0,
      whatsappSent: 0,
      opens: 0,
      clicks: 0,
      total: queued.length,
      created: Date.now()
    };
    campaigns.push(camp);
    save();

    logAction('campaign-created', 'Campaign "' + name + '" — ' + queued.length + ' ' + channel + ' messages queued', 'success');
    return camp;
  }

  function getCampaigns() { return campaigns.slice().reverse(); }

  /* ----------------------------------------
     LEAD OUTREACH UPDATE
     ---------------------------------------- */
  function updateLeadOutreach(leadId, channel, status) {
    if (!leadId) return;
    var leads = JSON.parse(localStorage.getItem('ga_leads') || '[]');
    var idx = leads.findIndex(function (l) { return l.id === leadId; });
    if (idx !== -1) {
      leads[idx].lastOutreachChannel = channel;
      leads[idx].lastOutreachAt = Date.now();
      leads[idx].lastOutreachStatus = status;
      if (status === 'sent' && leads[idx].status === 'New') {
        leads[idx].status = 'Contacted';
        leads[idx].pipelineStage = 'contacted';
        leads[idx].contactedAt = Date.now();
      }
      localStorage.setItem('ga_leads', JSON.stringify(leads));
    }
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function fillTemplate(template, lead) {
    return (template || '')
      .replace(/\{company\}/g, lead.name || '')
      .replace(/\{contactName\}/g, lead.contactName || lead.name || 'there')
      .replace(/\{industry\}/g, lead.industry || 'business')
      .replace(/\{score\}/g, lead.qualScore || 0);
  }

  function getQueue(filter) {
    if (!filter) return queue.slice();
    return queue.filter(function (q) {
      if (filter.status && q.status !== filter.status) return false;
      if (filter.channel && q.channel !== filter.channel) return false;
      if (filter.campaign && q.campaign !== filter.campaign) return false;
      return true;
    });
  }

  function getSentLog(limit) { return sentLog.slice().reverse().slice(0, limit || 50); }

  function getDailyCount() {
    if (dailyCount.date !== todayStr()) {
      dailyCount = { email: 0, whatsapp: 0, date: todayStr() };
    }
    return { email: dailyCount.email, whatsapp: dailyCount.whatsapp, emailLimit: CONFIG.maxEmailsPerDay, whatsappLimit: CONFIG.maxWhatsAppPerDay };
  }

  function getStats() {
    var sent = sentLog.length;
    var emails = sentLog.filter(function (s) { return s.channel === 'email'; }).length;
    var whatsapp = sentLog.filter(function (s) { return s.channel === 'whatsapp'; }).length;
    var totalOpens = Object.values(tracking).reduce(function (sum, t) { return sum + t.opens; }, 0);
    var totalClicks = Object.values(tracking).reduce(function (sum, t) { return sum + t.clicks; }, 0);
    var openRate = sent > 0 ? Math.round((totalOpens / emails) * 100) : 0;
    var clickRate = sent > 0 ? Math.round((totalClicks / emails) * 100) : 0;

    return {
      totalSent: sent, emails: emails, whatsapp: whatsapp,
      totalOpens: totalOpens, totalClicks: totalClicks,
      openRate: openRate, clickRate: clickRate,
      queued: queue.filter(function (q) { return q.status === 'queued'; }).length,
      campaigns: campaigns.length
    };
  }

  /* ----------------------------------------
     LOGGING
     ---------------------------------------- */
  function logAction(action, detail, level) {
    if (window.Agents && window.Agents.log) {
      window.Agents.log('outreach', action, detail, level || 'info');
    }
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
     AUTO-PROCESS QUEUE
     ---------------------------------------- */
  setInterval(processQueue, 30000); // Check queue every 30s

  /* ----------------------------------------
     PUBLIC API
     ---------------------------------------- */
  load();

  return {
    CONFIG: CONFIG,
    sendEmail: sendEmailBatch,
    sendWhatsApp: sendWhatsAppBulk,
    enqueue: enqueue,
    processQueue: processQueue,
    createCampaign: createCampaign,
    getCampaigns: getCampaigns,
    getQueue: getQueue,
    getSentLog: getSentLog,
    getDailyCount: getDailyCount,
    getStats: getStats,
    getTracking: getTracking,
    trackOpen: trackOpen,
    trackClick: trackClick,
    fillTemplate: fillTemplate,
    subscribe: subscribe,
    save: save
  };
})();
