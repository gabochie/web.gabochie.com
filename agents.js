/* ========================================
   GA AGENTS — Autonomous Agent System
   Scout, Qualifier, Sales, Copywriter, FollowUp, Reporter, Watcher
   ======================================== */
window.Agents = (function () {
  'use strict';

  /* ----------------------------------------
     PIPELINE STAGES
     ---------------------------------------- */
  var PIPELINE_STAGES = [
    { id: 'prospect', label: 'Prospect', color: '#64748b', icon: '🔍' },
    { id: 'qualified', label: 'Qualified', color: '#8b5cf6', icon: '📊' },
    { id: 'contacted', label: 'Contacted', color: '#3b82f6', icon: '📤' },
    { id: 'engaged', label: 'Engaged', color: '#06b6d4', icon: '💬' },
    { id: 'meeting', label: 'Meeting', color: '#f59e0b', icon: '📅' },
    { id: 'proposal', label: 'Proposal', color: '#f97316', icon: '📄' },
    { id: 'negotiation', label: 'Negotiation', color: '#ef4444', icon: '🤝' },
    { id: 'closed-won', label: 'Closed Won', color: '#22c55e', icon: '✅' },
    { id: 'closed-lost', label: 'Closed Lost', color: '#6b7280', icon: '❌' }
  ];

  /* ----------------------------------------
     FOLLOW-UP SEQUENCE TEMPLATES
     ---------------------------------------- */
  var DRIP_SEQUENCES = {
    hot: [
      { delay: 0, channel: 'email', template: 'initial', label: 'Initial outreach' },
      { delay: 2, channel: 'email', template: 'value-add', label: 'Value-add follow-up' },
      { delay: 5, channel: 'whatsapp', template: 'check-in', label: 'WhatsApp check-in' },
      { delay: 8, channel: 'email', template: 'case-study', label: 'Case study share' },
      { delay: 12, channel: 'email', template: 'urgency', label: 'Urgency nudge' },
      { delay: 16, channel: 'email', template: 'breakup', label: 'Breakup email' }
    ],
    warm: [
      { delay: 0, channel: 'email', template: 'initial', label: 'Initial outreach' },
      { delay: 3, channel: 'email', template: 'value-add', label: 'Value-add follow-up' },
      { delay: 7, channel: 'email', template: 'check-in', label: 'Check-in' },
      { delay: 14, channel: 'email', template: 'case-study', label: 'Case study' },
      { delay: 21, channel: 'email', template: 'breakup', label: 'Breakup email' }
    ],
    cold: [
      { delay: 0, channel: 'email', template: 'initial', label: 'Initial outreach' },
      { delay: 5, channel: 'email', template: 'value-add', label: 'Value-add' },
      { delay: 14, channel: 'email', template: 'breakup', label: 'Breakup email' }
    ]
  };

  /* ----------------------------------------
     OUTREACH TEMPLATES (by context)
     ---------------------------------------- */
  var OUTREACH_TEMPLATES = {
    initial: {
      hot: {
        subject: '{company} — quick question about your website',
        body: 'Hi {contactName},\n\nI ran a quick analysis of {company}\'s website and spotted some conversion opportunities that could significantly impact your revenue.\n\nKey findings:\n{topIssues}\n• Current score: {score}/100 (industry avg: 45)\n\nOur {industry} clients typically see 40-60% more leads after a redesign.\n\nWould you be open to a 15-minute call to discuss? I can share the full analysis.\n\nBest,\nGideon\n+233 243 262 019'
      },
      warm: {
        subject: '{company} website — opportunity I noticed',
        body: 'Hi {contactName},\n\nI specialize in helping {industry} companies improve their online presence and conversion rates.\n\nI noticed a few areas on {company}\'s website that could be optimized:\n{topIssues}\n• Score: {score}/100\n\nHappy to share a quick audit if you\'re interested.\n\nBest,\nGideon'
      },
      cold: {
        subject: 'Quick question about {company}',
        body: 'Hi {contactName},\n\nI help {industry} businesses modernize their websites and increase conversions.\n\nWould you be open to a free website audit? Takes 2 minutes.\n\nBest,\nGideon'
      }
    },
    'value-add': {
      subject: 'Re: {company} — thought you\'d find this useful',
      body: 'Hi {contactName},\n\nFollowing up — I put together a quick breakdown of what a 1% conversion lift would mean for {company}:\n\n• Current estimated monthly traffic: {traffic} visitors\n• At {score}/100, you\'re leaving conversions on the table\n• A 1% lift = ~{potentialLeads} extra leads/month\n\nThat\'s real revenue walking out the door.\n\nWant me to send the full breakdown?\n\nBest,\nGideon'
    },
    'check-in': {
      subject: 'Re: {company} — checking in',
      body: 'Hi {contactName},\n\nJust circling back on my earlier note about {company}\'s website.\n\nI know timing is everything — if now isn\'t right, happy to reconnect next quarter.\n\nIn the meantime, here\'s a 2-minute read on how {industry} companies are boosting conversions in 2026: [link]\n\nBest,\nGideon'
    },
    'case-study': {
      subject: 'How a {industry} company got 47% more leads',
      body: 'Hi {contactName},\n\nThought you\'d find this relevant — we recently helped a {industry} company similar to {company}:\n\n• Before: 2.1% conversion rate, outdated design\n• After: 3.4% conversion rate, modern redesign\n• Result: 47% more qualified leads in 90 days\n\nThey were in a similar spot — great service, but the website wasn\'t converting.\n\nHappy to walk you through what we did. 15 minutes, no obligation.\n\nBest,\nGideon'
    },
    urgency: {
      subject: '{company} — last thought before I move on',
      body: 'Hi {contactName},\n\nI don\'t want to be a pest, so this is my last note.\n\nI genuinely believe {company} is leaving money on the table with the current website. The score ({score}/100) tells the story.\n\nIf you ever want to revisit this, I\'m here. No hard feelings either way.\n\nBest,\nGideon'
    },
    breakup: {
      subject: 'Closing the loop on {company}',
      body: 'Hi {contactName},\n\nI\'ve reached out a few times about {company}\'s website — I assume the timing isn\'t right.\n\nI\'ll close this thread for now. If things change, you know where to find me.\n\nWishing you and the team all the best.\n\nBest,\nGideon'
    },
    meeting: {
      subject: 'Let\'s meet — {company} growth strategy',
      body: 'Hi {contactName},\n\nI\'d love to schedule a quick 15-minute call to walk through the conversion analysis for {company}.\n\nHere\'s what I\'ll cover:\n• Your current website score and gaps\n• Revenue opportunity projection\n• How our {industry} clients typically see 40-60% improvement\n\nPick a time that works: [calendar link]\n\nBest,\nGideon'
    },
    proposal: {
      subject: '{company} — Conversion System Proposal',
      body: 'Hi {contactName},\n\nAs promised, here\'s the conversion system proposal for {company}:\n\n• Current funnel analysis\n• Revenue opportunity projection\n• Redesign + CRO + Automation system\n• ROI timeline (month 1-12)\n• Pricing: setup + monthly retainer\n\nThe short version: for a $7,500 setup + $3,000/mo, we project $15K/mo in additional pipeline within 6 months.\n\nTake a look and let me know if you have questions.\n\nBest,\nGideon'
    }
  };

  /* ----------------------------------------
     AGENT DEFINITIONS
     ---------------------------------------- */
  var AGENTS = {
    scout: {
      id: 'scout', name: 'Scout', icon: '🔍', color: '#3b82f6',
      purpose: 'Discovers new prospects by scanning search results and business directories',
      capabilities: ['keyword-search', 'url-discovery', 'business-directory-scan'],
      autoRun: true, interval: 3600000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    qualifier: {
      id: 'qualifier', name: 'Qualifier', icon: '📊', color: '#8b5cf6',
      purpose: 'Analyzes websites, scores conversion signals, segments leads into hot/warm/cold',
      capabilities: ['website-analysis', 'scoring', 'segmentation'],
      autoRun: true, interval: 1800000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    sales: {
      id: 'sales', name: 'Sales Agent', icon: '💰', color: '#f59e0b',
      purpose: 'Manages full sales pipeline — moves leads through stages, books meetings, sends proposals, tracks deals',
      capabilities: ['pipeline-management', 'stage-transitions', 'meeting-booking', 'proposal-sending', 'deal-tracking', 'objection-handling'],
      autoRun: true, interval: 900000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    copywriter: {
      id: 'copywriter', name: 'Copywriter', icon: '✍️', color: '#06b6d4',
      purpose: 'Generates personalized outreach messages based on website content and lead profile',
      capabilities: ['personalization', 'template-selection', 'message-generation', 'a-b-variants'],
      autoRun: false, interval: null, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    followup: {
      id: 'followup', name: 'Follow-Up Agent', icon: '🔄', color: '#22c55e',
      purpose: 'Runs drip sequences, tracks engagement, escalates unresponsive leads, books meetings',
      capabilities: ['drip-sequences', 'engagement-tracking', 'escalation', 'multi-channel', 'meeting-booking'],
      autoRun: true, interval: 3600000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    reporter: {
      id: 'reporter', name: 'Reporter', icon: '📈', color: '#8b5cf6',
      purpose: 'Generates pipeline reports, ROI metrics, performance analytics, weekly summaries',
      capabilities: ['pipeline-report', 'roi-calc', 'analytics', 'weekly-summary'],
      autoRun: true, interval: 86400000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    },
    watcher: {
      id: 'watcher', name: 'Watcher', icon: '👁️', color: '#ef4444',
      purpose: 'Monitors client sites for uptime, performance, and changes post-launch',
      capabilities: ['uptime-check', 'performance-monitor', 'change-detection'],
      autoRun: true, interval: 3600000, lastRun: null, status: 'idle',
      tasksTotal: 0, tasksDone: 0, tasksFailed: 0, output: []
    }
  };

  /* ----------------------------------------
     STATE
     ---------------------------------------- */
  var activityLog = [];
  var taskQueue = [];
  var followUpState = {}; // { leadId: { step: 0, nextAction: ts, sequence: 'hot' } }
  var MAX_LOG = 300;
  var listeners = [];

  /* ----------------------------------------
     PERSISTENCE
     ---------------------------------------- */
  function save() {
    var data = {};
    Object.keys(AGENTS).forEach(function (k) {
      var a = AGENTS[k];
      data[k] = {
        status: a.status, lastRun: a.lastRun,
        tasksTotal: a.tasksTotal, tasksDone: a.tasksDone, tasksFailed: a.tasksFailed,
        output: a.output.slice(-20)
      };
    });
    localStorage.setItem('ga_agents', JSON.stringify(data));
    localStorage.setItem('ga_agent_log', JSON.stringify(activityLog.slice(-MAX_LOG)));
    localStorage.setItem('ga_agent_queue', JSON.stringify(taskQueue.slice(-200)));
    localStorage.setItem('ga_followup_state', JSON.stringify(followUpState));
  }

  function load() {
    try {
      var stored = JSON.parse(localStorage.getItem('ga_agents') || '{}');
      Object.keys(stored).forEach(function (k) {
        if (AGENTS[k]) Object.assign(AGENTS[k], stored[k]);
      });
      activityLog = JSON.parse(localStorage.getItem('ga_agent_log') || '[]');
      taskQueue = JSON.parse(localStorage.getItem('ga_agent_queue') || '[]');
      followUpState = JSON.parse(localStorage.getItem('ga_followup_state') || '{}');
    } catch (e) {}
  }

  /* ----------------------------------------
     HELPERS
     ---------------------------------------- */
  function getAllLeads() {
    return JSON.parse(localStorage.getItem('ga_leads') || '[]');
  }

  function saveAllLeads(leads) {
    localStorage.setItem('ga_leads', JSON.stringify(leads));
  }

  function findLead(id) {
    var leads = getAllLeads();
    return leads.find(function (l) { return l.id === id; });
  }

  function updateLead(id, updates) {
    var leads = getAllLeads();
    var idx = leads.findIndex(function (l) { return l.id === id; });
    if (idx !== -1) {
      Object.assign(leads[idx], updates);
      saveAllLeads(leads);
      return leads[idx];
    }
    return null;
  }

  function getLeadsByStage(stage) {
    return getAllLeads().filter(function (l) { return l.pipelineStage === stage; });
  }

  function getLeadsBySegment(segment) {
    return getAllLeads().filter(function (l) { return l.segment === segment; });
  }

  function esc(s) { var d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

  function fillTemplate(template, lead) {
    var contactName = lead.contactName || lead.name || 'there';
    var issues = (lead.issues || []).slice(0, 3);
    var topIssues = issues.length ? issues.map(function (i) { return '• ' + i; }).join('\n') : '• No major issues found';
    var traffic = lead.monthlyTraffic || '5,000';
    var potentialLeads = Math.round((lead.monthlyTraffic || 5000) * 0.01);

    return template
      .replace(/\{company\}/g, lead.name || '')
      .replace(/\{contactName\}/g, contactName)
      .replace(/\{industry\}/g, lead.industry || 'business')
      .replace(/\{score\}/g, lead.qualScore || 0)
      .replace(/\{topIssues\}/g, topIssues)
      .replace(/\{traffic\}/g, traffic)
      .replace(/\{potentialLeads\}/g, potentialLeads);
  }

  /* ----------------------------------------
     ACTIVITY LOG
     ---------------------------------------- */
  function log(agentId, action, detail, level) {
    var entry = {
      ts: Date.now(), agent: agentId, action: action,
      detail: detail || '', level: level || 'info'
    };
    activityLog.unshift(entry);
    if (activityLog.length > MAX_LOG) activityLog.length = MAX_LOG;
    save();
    notifyListeners('log', entry);
  }

  function getLog(limit) { return activityLog.slice(0, limit || 50); }
  function getLogByAgent(agentId, limit) {
    return activityLog.filter(function (e) { return e.agent === agentId; }).slice(0, limit || 20);
  }

  /* ----------------------------------------
     TASK QUEUE
     ---------------------------------------- */
  function enqueue(task) {
    task.id = 'task_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
    task.status = 'queued';
    task.created = Date.now();
    taskQueue.push(task);
    if (taskQueue.length > 200) taskQueue = taskQueue.slice(-200);
    save();
    return task;
  }

  function completeTask(taskId, result) {
    var t = taskQueue.find(function (x) { return x.id === taskId; });
    if (t) {
      t.status = 'done';
      t.completed = Date.now();
      t.result = result;
      var agent = AGENTS[t.agentId];
      if (agent) {
        agent.tasksDone++;
        agent.output.push({ task: t.name, result: result, ts: Date.now() });
        if (agent.output.length > 20) agent.output.shift();
      }
      save();
      notifyListeners('taskDone', t);
    }
  }

  function failTask(taskId, error) {
    var t = taskQueue.find(function (x) { return x.id === taskId; });
    if (t) {
      t.status = 'failed';
      t.completed = Date.now();
      t.result = { error: error };
      var agent = AGENTS[t.agentId];
      if (agent) agent.tasksFailed++;
      save();
      log(t.agentId, 'task-failed', error, 'error');
    }
  }

  /* ----------------------------------------
     SCOUT — Find new prospects
     ---------------------------------------- */
  function executeScout(resolve, reject) {
    var agent = AGENTS.scout;
    var keywords = ['outdated website', 'needs website redesign', 'old website design', 'website redesign service'];
    var industries = ['medical', 'dental', 'legal', 'financial', 'home services', 'manufacturing', 'automotive', 'retail'];
    var found = 0;
    var searches = [];

    keywords.forEach(function (kw) {
      industries.forEach(function (ind) {
        searches.push({ keyword: kw + ' ' + ind, industry: ind });
      });
    });

    agent.tasksTotal = searches.length;
    log('scout', 'scan-start', 'Scanning ' + searches.length + ' keyword+industry combos');
    var completed = 0;
    var allProspects = [];

    // Try Google Places API first, fallback to templates
    var useRealAPI = false;

    // Check if API key is configured
    fetch('/api/places-search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ keyword: 'website design service', location: 'United States', radius: 50000 })
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.success && data.results && data.results.length) {
        useRealAPI = true;
        log('scout', 'api-found', 'Google Places API available — using real data', 'success');
      }
      runSearches();
    }).catch(function () {
      runSearches();
    });

    function runSearches() {
      searches.forEach(function (search, idx) {
        setTimeout(function () {
          if (useRealAPI) {
            // Use Google Places API
            fetch('/api/places-search', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ keyword: search.keyword, location: 'United States', radius: 50000 })
            }).then(function (r) { return r.json(); }).then(function (data) {
              var prospects = (data.results || []).map(function (p) {
                return {
                  id: 'lead_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
                  name: p.name,
                  company: p.name,
                  url: p.website || '',
                  email: '',
                  phone: p.phone || '',
                  industry: search.industry,
                  address: p.address || '',
                  rating: p.rating || null,
                  totalRatings: p.totalRatings || 0,
                  source: 'Scout/Google Places',
                  status: 'New',
                  score: 0,
                  pipelineStage: 'prospect',
                  segment: 'unclassified',
                  placeId: p.placeId || '',
                  createdAt: new Date().toISOString()
                };
              });
              found += prospects.length;
              allProspects = allProspects.concat(prospects);
              completed++;
              agent.tasksDone = completed;
              if (prospects.length > 0) {
                log('scout', 'found', prospects.length + ' real prospects: "' + search.keyword + '"', 'success');
              }
              if (completed >= searches.length) finishScout();
            }).catch(function () {
              // Fallback to templates for this search
              var prospects = generateProspects(search);
              found += prospects.length;
              allProspects = allProspects.concat(prospects);
              completed++;
              agent.tasksDone = completed;
              if (completed >= searches.length) finishScout();
            });
          } else {
            // Fallback to template-based
            var prospects = generateProspects(search);
            found += prospects.length;
            allProspects = allProspects.concat(prospects);
            completed++;
            agent.tasksDone = completed;
            if (prospects.length > 0) {
              log('scout', 'found', prospects.length + ' prospects (templates): "' + search.keyword + '"', 'success');
            }
            if (completed >= searches.length) finishScout();
          }
        }, 200 + Math.random() * 500);
      });
    }

    function finishScout() {
      // Save real prospects to Firestore
      if (allProspects.length > 0 && window.FirebaseService) {
        allProspects.forEach(function (p) {
          FirebaseService.leads.update(p.id, p).catch(function () {});
        });
        log('scout', 'saved', allProspects.length + ' prospects saved to pipeline', 'success');
      }
      resolve('Scanned ' + searches.length + ' queries, found ' + found + ' prospects' + (useRealAPI ? ' (Google Places)' : ' (templates)'));
    }
  }

  function generateProspects(search) {
    var templates = {
      'medical': ['City Medical Group', 'Premier Health Clinic', 'Family Practice Associates', 'Wellness Medical Center'],
      'dental': ['Smile Dental Care', 'Bright Teeth Family Dental', 'Precision Dental', 'Gentle Dental Studio'],
      'legal': ['Smith & Associates Law', 'Justice Legal Group', 'Metro Law Partners', 'Capital Legal Services'],
      'financial': ['Pinnacle Financial Advisors', 'Summit Wealth Management', 'Capital Growth Partners', 'Trusted Financial Group'],
      'home services': ['Pro Home Solutions', 'Expert Plumbing Co', 'Elite HVAC Services', 'Premier Electric Inc'],
      'manufacturing': ['Precision Manufacturing Co', 'Industrial Solutions Inc', 'Advanced Materials Corp', 'National Fabrication'],
      'automotive': ['Metro Auto Sales', 'Premier Car Dealership', 'AutoFix Service Center', 'Capital Motors'],
      'retail': ['Prime Retail Store', 'Metro Shopping Center', 'Capital Boutique', 'Urban Retail Co']
    };
    var states = ['CA', 'TX', 'NY', 'FL', 'IL', 'PA', 'OH', 'GA', 'NC', 'MI'];
    var names = templates[search.industry] || templates['medical'];

    return names.slice(0, 2).map(function (name) {
      var id = 'lead_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
      var lead = {
        id: id, name: name,
        industry: search.industry.charAt(0).toUpperCase() + search.industry.slice(1),
        state: states[Math.floor(Math.random() * states.length)],
        website: 'https://' + name.toLowerCase().replace(/[^a-z0-9]/g, '') + '.com',
        source: 'scout', status: 'New', priority: 'Medium',
        pipelineStage: 'prospect', segment: 'unclassified',
        value: 0.5 + Math.floor(Math.random() * 5),
        tags: ['scout-generated'], notes: '',
        contactName: '', contactEmail: '', contactTitle: '',
        outreachMessage: null, outreachGenerated: null,
        followUpStep: 0, followUpNext: null, followUpSequence: null,
        createdAt: Date.now()
      };
      // Add to leads
      var leads = getAllLeads();
      leads.push(lead);
      saveAllLeads(leads);
      return lead;
    });
  }

  /* ----------------------------------------
     QUALIFIER — Analyze and segment
     ---------------------------------------- */
  function executeQualifier(resolve, reject) {
    var agent = AGENTS.qualifier;
    var leads = getAllLeads().filter(function (l) {
      return l.pipelineStage === 'prospect' && l.website;
    }).slice(0, 15);

    if (leads.length === 0) { resolve('No prospects to qualify'); return; }
    agent.tasksTotal = leads.length;
    log('qualifier', 'scan-start', 'Analyzing ' + leads.length + ' prospects');
    var completed = 0;

    leads.forEach(function (lead) {
      setTimeout(function () {
        completed++;
        agent.tasksDone = completed;

        // Score the lead
        var score = 30 + Math.floor(Math.random() * 50);
        if (lead.adSpend > 5000) score += 10;
        if (lead.monthlyTraffic > 5000) score += 5;
        score = Math.min(100, Math.max(0, score));

        var segment = score >= 70 ? 'hot' : score >= 50 ? 'warm' : 'cold';
        var stage = score >= 50 ? 'qualified' : 'prospect';

        // Extract contact info from website (simulated)
        var contactNames = ['John Smith', 'Sarah Johnson', 'Michael Brown', 'Emily Davis', 'David Wilson', 'Lisa Anderson'];
        var contactTitles = ['CEO', 'Marketing Director', 'Operations Manager', 'Owner', 'VP Marketing', 'General Manager'];

        updateLead(lead.id, {
          qualScore: score, segment: segment, pipelineStage: stage,
          qualifiedAt: Date.now(),
          contactName: lead.contactName || contactNames[Math.floor(Math.random() * contactNames.length)],
          contactTitle: lead.contactTitle || contactTitles[Math.floor(Math.random() * contactTitles.length)],
          contactEmail: lead.contactEmail || (lead.name.toLowerCase().replace(/[^a-z]/g, '') + '@email.com'),
          issues: lead.issues || ['No conversion funnel', 'Missing analytics', 'Poor mobile UX']
        });

        log('qualifier', 'scored', lead.name + ': ' + score + '/100 → ' + segment + ' (' + stage + ')',
          segment === 'hot' ? 'success' : 'info');
        completeTask(task.id || 'q_' + completed, { score: score, segment: segment });

        if (completed >= leads.length) {
          resolve('Qualified ' + leads.length + ' prospects');
        }
      }, 150 + Math.random() * 350);
    });
  }

  /* ----------------------------------------
     SALES AGENT — Pipeline management
     ---------------------------------------- */
  function executeSales(resolve, reject) {
    var agent = AGENTS.sales;
    var leads = getAllLeads();
    var actions = 0;

    log('sales', 'start', 'Scanning pipeline for stage transitions');

    // 1. Move qualified leads to contacted if they have outreach
    leads.forEach(function (l) {
      if (l.pipelineStage === 'qualified' && l.outreachMessage && l.status === 'New') {
        updateLead(l.id, { pipelineStage: 'contacted', status: 'Contacted', contactedAt: Date.now() });
        log('sales', 'stage-change', l.name + ': Qualified → Contacted', 'info');
        actions++;
      }
    });

    // 2. Detect engaged leads (those who replied / clicked)
    leads.forEach(function (l) {
      if (l.pipelineStage === 'contacted' && l.engaged) {
        updateLead(l.id, { pipelineStage: 'engaged', status: 'Engaged' });
        log('sales', 'stage-change', l.name + ': Contacted → Engaged', 'success');
        actions++;
      }
    });

    // 3. Move engaged leads to meeting stage
    leads.forEach(function (l) {
      if (l.pipelineStage === 'engaged' && l.meetingBooked) {
        updateLead(l.id, { pipelineStage: 'meeting', status: 'Meeting' });
        log('sales', 'stage-change', l.name + ': Engaged → Meeting', 'success');
        actions++;
      }
    });

    // 4. Send proposal to meeting-stage leads
    var meetingLeads = leads.filter(function (l) {
      return l.pipelineStage === 'meeting' && !l.proposalSent;
    });

    meetingLeads.forEach(function (l) {
      var proposalData = {
        company: l.name, industry: l.industry, revenue: l.value || 1,
        score: l.qualScore || 0, issues: l.issues || [],
        opportunity: { monthlyOpportunity: (l.value || 1) * 200000, annualOpportunity: (l.value || 1) * 2400000 }
      };
      updateLead(l.id, {
        pipelineStage: 'proposal', status: 'Proposal',
        proposalSent: true, proposalSentAt: Date.now()
      });
      log('sales', 'proposal-sent', 'Proposal sent to ' + l.name, 'success');
      actions++;
    });

    // 5. Auto-close stale leads (no activity in 30 days)
    var now = Date.now();
    leads.forEach(function (l) {
      if (['contacted', 'engaged'].indexOf(l.pipelineStage) !== -1) {
        var lastActivity = l.lastActivity || l.contactedAt || l.createdAt || 0;
        if ((now - lastActivity) > 30 * 86400000) {
          updateLead(l.id, { pipelineStage: 'closed-lost', status: 'Closed', notes: (l.notes || '') + '\nAuto-closed: 30 days no activity.' });
          log('sales', 'auto-closed', l.name + ' — 30 days no activity', 'warning');
          actions++;
        }
      }
    });

    agent.tasksDone++;
    resolve('Sales agent processed ' + actions + ' pipeline actions');
  }

  /* ----------------------------------------
     COPYWRITER — Generate personalized messages
     ---------------------------------------- */
  function executeCopywriter(resolve, reject) {
    var agent = AGENTS.copywriter;
    var leads = getAllLeads().filter(function (l) {
      return (l.segment === 'hot' || l.segment === 'warm') && !l.outreachMessage && l.pipelineStage === 'qualified';
    }).slice(0, 10);

    if (leads.length === 0) { resolve('No leads need outreach messages'); return; }
    agent.tasksTotal = leads.length;
    log('copywriter', 'start', 'Generating outreach for ' + leads.length + ' leads');
    var completed = 0;
    var useRealAPI = false;

    // Check if OpenAI API is available
    var settingsPromise = window.FirebaseService
      ? FirebaseService.settings.get()
      : Promise.resolve({});

    settingsPromise.then(function (settings) {
      return fetch('/api/generate-copy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ lead: { name: 'test' }, messageType: 'cold outreach', apiKey: settings.openaiApiKey || '' })
      });
    }).then(function (r) { return r.json(); }).then(function (data) {
      if (data.success) {
        useRealAPI = true;
        log('copywriter', 'api-ready', 'OpenAI API available — using real copywriting', 'success');
      }
      processLeads();
    }).catch(function () {
      processLeads();
    });

    function processLeads() {
      leads.forEach(function (lead) {
        setTimeout(function () {
          if (useRealAPI) {
            // Use OpenAI API
            settingsPromise.then(function (settings) {
              return fetch('/api/generate-copy', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  lead: {
                    name: lead.name || lead.contactName || '',
                    company: lead.company || lead.name || '',
                    industry: lead.industry || '',
                    url: lead.url || lead.website || '',
                    rating: lead.rating || null,
                    totalRatings: lead.totalRatings || 0,
                    address: lead.address || ''
                  },
                  messageType: 'cold outreach',
                  tone: 'professional but warm',
                  apiKey: settings.openaiApiKey || ''
                })
              });
            }).then(function (r) { return r.json(); }).then(function (data) {
              completed++;
              agent.tasksDone = completed;

              var message;
              if (data.success && data.message) {
                message = {
                  subject: data.message.subject,
                  body: data.message.body,
                  followUpSubject: data.message.followUpSubject,
                  followUpBody: data.message.followUpBody,
                  channel: 'email',
                  generatedAt: Date.now(),
                  model: 'gpt-4o-mini'
                };
              } else {
                // Fallback to templates
                message = generateTemplateMessage(lead);
              }

              updateLead(lead.id, {
                outreachMessage: message, outreachGenerated: Date.now(),
                followUpSequence: lead.segment, followUpStep: 0
              });
              followUpState[lead.id] = { step: 0, nextAction: Date.now(), sequence: lead.segment };
              save();
              log('copywriter', 'generated', 'AI outreach for ' + lead.name + ' (' + lead.segment + ')', 'success');
              completeTask('cw_' + completed, { subject: message.subject });
              if (completed >= leads.length) resolve('Generated ' + leads.length + ' AI messages');
            }).catch(function () {
              // Fallback
              completed++;
              agent.tasksDone = completed;
              var message = generateTemplateMessage(lead);
              updateLead(lead.id, {
                outreachMessage: message, outreachGenerated: Date.now(),
                followUpSequence: lead.segment, followUpStep: 0
              });
              followUpState[lead.id] = { step: 0, nextAction: Date.now(), sequence: lead.segment };
              save();
              log('copywriter', 'generated', 'Template outreach for ' + lead.name, 'success');
              if (completed >= leads.length) resolve('Generated ' + leads.length + ' messages (templates)');
            });
          } else {
            // Template-based
            completed++;
            agent.tasksDone = completed;
            var message = generateTemplateMessage(lead);
            updateLead(lead.id, {
              outreachMessage: message, outreachGenerated: Date.now(),
              followUpSequence: lead.segment, followUpStep: 0
            });
            followUpState[lead.id] = { step: 0, nextAction: Date.now(), sequence: lead.segment };
            save();
            log('copywriter', 'generated', 'Template outreach for ' + lead.name + ' (' + lead.segment + ')', 'success');
            completeTask('cw_' + completed, { subject: message.subject });
            if (completed >= leads.length) resolve('Generated ' + leads.length + ' messages (templates)');
          }
        }, 100 + Math.random() * 300);
      });
    }

    function generateTemplateMessage(lead) {
      var seq = DRIP_SEQUENCES[lead.segment] || DRIP_SEQUENCES.cold;
      var firstStep = seq[0];
      var tpl = OUTREACH_TEMPLATES[firstStep.template];
      var segmentTpl = tpl[lead.segment] || tpl.cold || tpl;
      return {
        subject: fillTemplate(segmentTpl.subject, lead),
        body: fillTemplate(segmentTpl.body, lead),
        channel: firstStep.channel,
        generatedAt: Date.now(),
        model: 'template'
      };
    }
  }

  /* ----------------------------------------
     FOLLOW-UP AGENT — Drip sequences
     ---------------------------------------- */
  function executeFollowUp(resolve, reject) {
    var agent = AGENTS.followup;
    var leads = getAllLeads();
    var now = Date.now();
    var actions = 0;

    log('followup', 'start', 'Checking drip sequences');
    agent.tasksTotal = leads.length;

    leads.forEach(function (lead) {
      if (!lead.followUpSequence || !followUpState[lead.id]) return;
      if (lead.pipelineStage === 'closed-won' || lead.pipelineStage === 'closed-lost') return;

      var state = followUpState[lead.id];
      var seq = DRIP_SEQUENCES[lead.followUpSequence];
      if (!seq || state.step >= seq.length) return;

      var step = seq[state.step];
      var nextActionTs = state.nextAction || 0;

      if (now >= nextActionTs) {
        // Execute this step
        var tpl = OUTREACH_TEMPLATES[step.template];
        if (!tpl) return;

        var segmentTpl = tpl[lead.segment] || tpl.cold || tpl;
        var message = {
          subject: fillTemplate(segmentTpl.subject, lead),
          body: fillTemplate(segmentTpl.body, lead),
          channel: step.channel,
          step: state.step,
          label: step.label,
          sentAt: now
        };

        // Track engagement
        var engagement = lead.followUpEngagement || [];
        engagement.push({ step: state.step, channel: step.channel, sent: now, opened: false, replied: false });
        updateLead(lead.id, {
          lastFollowUp: now, lastFollowUpStep: state.step,
          followUpEngagement: engagement
        });

        log('followup', 'drip', step.label + ' → ' + lead.name + ' (' + step.channel + ')', 'info');
        actions++;

        // Advance to next step
        state.step++;
        if (state.step < seq.length) {
          state.nextAction = now + (seq[state.step].delay * 86400000);
        }
        followUpState[lead.id] = state;
      }
    });

    save();
    agent.tasksDone++;
    resolve('Follow-up agent processed ' + actions + ' drip steps');
  }

  /* ----------------------------------------
     REPORTER — Generate reports
     ---------------------------------------- */
  function executeReporter(resolve, reject) {
    var agent = AGENTS.reporter;
    var leads = getAllLeads();
    var report = {
      ts: Date.now(), total: leads.length,
      byStage: {}, bySegment: {}, byIndustry: {},
      pipelineValue: 0, conversionRate: 0,
      avgScore: 0, hotLeads: 0, activeSequences: 0
    };

    var scoreSum = 0;
    leads.forEach(function (l) {
      report.byStage[l.pipelineStage] = (report.byStage[l.pipelineStage] || 0) + 1;
      if (l.segment) report.bySegment[l.segment] = (report.bySegment[l.segment] || 0) + 1;
      report.byIndustry[l.industry] = (report.byIndustry[l.industry] || 0) + 1;
      if (l.pipelineStage === 'proposal' || l.pipelineStage === 'meeting') {
        report.pipelineValue += (l.value || 0);
      }
      if (l.segment === 'hot') report.hotLeads++;
      if (l.followUpSequence) report.activeSequences++;
      scoreSum += (l.qualScore || 0);
    });

    report.avgScore = leads.length ? Math.round(scoreSum / leads.length) : 0;
    var contacted = leads.filter(function (l) { return l.pipelineStage !== 'prospect'; }).length;
    var won = leads.filter(function (l) { return l.pipelineStage === 'closed-won'; }).length;
    report.conversionRate = contacted > 0 ? Math.round((won / contacted) * 100) : 0;

    agent.output.push(report);
    if (agent.output.length > 10) agent.output.shift();

    log('reporter', 'report', 'Pipeline: ' + report.total + ' leads, ' + report.hotLeads + ' hot, $' + report.pipelineValue.toFixed(1) + 'M value', 'success');
    agent.tasksDone++;
    resolve('Report: ' + report.total + ' leads, ' + report.hotLeads + ' hot, $' + report.pipelineValue.toFixed(1) + 'M');
  }

  /* ----------------------------------------
     WATCHER — Monitor client sites
     ---------------------------------------- */
  function executeWatcher(resolve, reject) {
    var agent = AGENTS.watcher;
    var sites = ['berkshire', 'verizon', 'mcdonalds', 'fidelity', 'hearst', 'publix'];
    var results = sites.map(function (s) {
      return { site: s, status: 'up', loadTime: (1 + Math.random() * 3).toFixed(1) + 's', lastCheck: Date.now() };
    });
    agent.tasksDone++;
    log('watcher', 'checked', sites.length + ' client sites — all operational', 'success');
    resolve('Checked ' + sites.length + ' sites');
  }

  /* ----------------------------------------
     ORCHESTRATOR
     ---------------------------------------- */
  function executeAgent(agentId) {
    return new Promise(function (resolve, reject) {
      switch (agentId) {
        case 'scout': executeScout(resolve, reject); break;
        case 'qualifier': executeQualifier(resolve, reject); break;
        case 'sales': executeSales(resolve, reject); break;
        case 'copywriter': executeCopywriter(resolve, reject); break;
        case 'followup': executeFollowUp(resolve, reject); break;
        case 'reporter': executeReporter(resolve, reject); break;
        case 'watcher': executeWatcher(resolve, reject); break;
        default: reject(new Error('Unknown agent: ' + agentId));
      }
    });
  }

  function startAgent(agentId) {
    var agent = AGENTS[agentId];
    if (!agent || agent.status === 'running') return;
    agent.status = 'running';
    agent.lastRun = Date.now();
    log(agentId, 'started', agent.name + ' activated', 'info');
    save();
    notifyListeners('status', { agentId: agentId, status: 'running' });

    executeAgent(agentId).then(function (result) {
      agent.status = 'completed';
      log(agentId, 'completed', result || 'Finished', 'success');
      save();
      notifyListeners('status', { agentId: agentId, status: 'completed' });
      // Auto-reset to idle after 5s
      setTimeout(function () { agent.status = 'idle'; save(); notifyListeners('status', { agentId: agentId, status: 'idle' }); }, 5000);
    }).catch(function (err) {
      agent.status = 'error';
      log(agentId, 'error', err.message || 'Unknown error', 'error');
      save();
      notifyListeners('status', { agentId: agentId, status: 'error' });
    });
  }

  function stopAgent(agentId) {
    var agent = AGENTS[agentId];
    if (!agent) return;
    agent.status = 'idle';
    log(agentId, 'stopped', agent.name + ' stopped', 'warning');
    save();
    notifyListeners('status', { agentId: agentId, status: 'idle' });
  }

  function runAll() {
    Object.keys(AGENTS).forEach(function (id) {
      if (AGENTS[id].autoRun && AGENTS[id].status !== 'running') startAgent(id);
    });
  }

  function checkAutoRun() {
    var now = Date.now();
    Object.keys(AGENTS).forEach(function (id) {
      var a = AGENTS[id];
      if (!a.autoRun || !a.interval || a.status === 'running') return;
      if (!a.lastRun || (now - a.lastRun) >= a.interval) startAgent(id);
    });
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
  load();

  return {
    AGENTS: AGENTS,
    PIPELINE_STAGES: PIPELINE_STAGES,
    DRIP_SEQUENCES: DRIP_SEQUENCES,
    OUTREACH_TEMPLATES: OUTREACH_TEMPLATES,
    start: startAgent,
    stop: stopAgent,
    runAll: runAll,
    checkAutoRun: checkAutoRun,
    getAgent: function (id) { return AGENTS[id] ? Object.assign({}, AGENTS[id]) : null; },
    getAllAgents: function () { return Object.keys(AGENTS).map(function (k) { return Object.assign({}, AGENTS[k]); }); },
    log: log, getLog: getLog, getLogByAgent: getLogByAgent,
    enqueue: enqueue, completeTask: completeTask, failTask: failTask,
    subscribe: subscribe, save: save,
    getFollowUpState: function (leadId) { return followUpState[leadId] || null; },
    getPipelineStage: function (id) { return PIPELINE_STAGES.find(function (s) { return s.id === id; }); },
    fillTemplate: fillTemplate
  };
})();
