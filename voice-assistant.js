/* ========================================
   GA VOICE ASSISTANT — AI AGENT
   ======================================== */
(function () {
  'use strict';

  var SPEECH_ACTIVE = ('webkitSpeechRecognition' in window) || ('SpeechRecognition' in window);
  var synth = window.speechSynthesis;
  var recognition = null;
  var isListening = false;
  var panelOpen = false;

  /* ----------------------------------------
     INIT
     ---------------------------------------- */
  function init() {
    if (!SPEECH_ACTIVE) {
      console.warn('Speech Recognition not supported — voice disabled');
      return;
    }

    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    recognition = new SpeechRecognition();
    recognition.continuous = false;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    recognition.onresult = onSpeechResult;
    recognition.onend = onSpeechEnd;
    recognition.onerror = onSpeechError;

    wireFAB();
    wirePanel();
  }

  /* ----------------------------------------
     DOM WIRING
     ---------------------------------------- */
  function wireFAB() {
    var fab = document.getElementById('voiceFab');
    if (fab) fab.addEventListener('click', togglePanel);
  }

  function wirePanel() {
    var close = document.getElementById('voiceClose');
    if (close) close.addEventListener('click', closePanel);

    var send = document.getElementById('voiceSend');
    if (send) send.addEventListener('click', sendTextMessage);

    var input = document.getElementById('voiceInput');
    if (input) input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') sendTextMessage();
    });

    var mic = document.getElementById('voiceMic');
    if (mic) mic.addEventListener('click', toggleMic);
  }

  /* ----------------------------------------
     PANEL
     ---------------------------------------- */
  function togglePanel() {
    panelOpen ? closePanel() : openPanel();
  }

  function openPanel() {
    panelOpen = true;
    var panel = document.getElementById('voicePanel');
    if (panel) panel.classList.add('open');
    addMessage('agent', 'Hi! I\'m your GA assistant. Try saying:\n\n• "Show me high-growth leads"\n• "Open Dashboard"\n• "Analyze acme.com"\n• "Generate proposal for Berkshire"\n• "Show roadmap progress"\n• "Switch to Main Street"');
  }

  function closePanel() {
    panelOpen = false;
    var panel = document.getElementById('voicePanel');
    if (panel) panel.classList.remove('open');
    stopListening();
  }

  /* ----------------------------------------
     MIC
     ---------------------------------------- */
  function toggleMic() {
    isListening ? stopListening() : startListening();
  }

  function startListening() {
    if (!recognition) return;
    isListening = true;
    updateMicUI(true);
    try { recognition.start(); } catch (e) {}
  }

  function stopListening() {
    isListening = false;
    updateMicUI(false);
    if (recognition) try { recognition.stop(); } catch (e) {}
  }

  function updateMicUI(active) {
    var mic = document.getElementById('voiceMic');
    var fab = document.getElementById('voiceFab');
    var dot = document.getElementById('voiceDot');
    if (mic) mic.classList.toggle('active', active);
    if (fab) fab.classList.toggle('listening', active);
    if (dot) dot.classList.toggle('active', active);
  }

  /* ----------------------------------------
     SPEECH RECOGNITION
     ---------------------------------------- */
  function onSpeechResult(event) {
    var transcript = '';
    var isFinal = false;
    for (var i = event.resultIndex; i < event.results.length; i++) {
      transcript += event.results[i][0].transcript;
      if (event.results[i].isFinal) isFinal = true;
    }

    var input = document.getElementById('voiceInput');
    if (input) input.value = transcript;

    if (isFinal) {
      processCommand(transcript.trim());
    }
  }

  function onSpeechEnd() {
    isListening = false;
    updateMicUI(false);
  }

  function onSpeechError(event) {
    isListening = false;
    updateMicUI(false);
    if (event.error === 'no-speech') return;
    addMessage('agent', 'Sorry, I didn\'t catch that. Could you try again?');
  }

  /* ----------------------------------------
     TEXT INPUT
     ---------------------------------------- */
  function sendTextMessage() {
    var input = document.getElementById('voiceInput');
    if (!input) return;
    var text = input.value.trim();
    if (!text) return;
    input.value = '';
    processCommand(text);
  }

  /* ----------------------------------------
     COMMAND PROCESSING
     ---------------------------------------- */
  function processCommand(text) {
    addMessage('user', text);

    var lower = text.toLowerCase().replace(/[^\w\s]/g, '');
    var response = '';

    // Navigation
    if (matchAny(lower, ['open command center', 'show command center', 'go to command center', 'command center', 'dashboard', 'home'])) {
      switchTab('command-center');
      response = 'Opened Command Center. You can see all agent status, pipeline metrics, and activity here.';
    }
    else if (matchAny(lower, ['open pipeline', 'show pipeline', 'go to pipeline', 'pipeline', 'leads', 'crm'])) {
      switchTab('pipeline');
      response = 'Opened Pipeline. Track leads through every stage.';
    }
    else if (matchAny(lower, ['open finder', 'show finder', 'go to finder', 'finder', 'find leads', 'leads finder', 'scan internet', 'bulk scan'])) {
      switchTab('finder');
      response = 'Opened Leads Finder. Enter keywords or URLs to scan for prospects.';
    }
    else if (matchAny(lower, ['open outreach', 'show outreach', 'go to outreach', 'outreach', 'email templates'])) {
      switchTab('outreach');
      response = 'Opened Outreach. Templates and tracking are ready.';
    }
    else if (matchAny(lower, ['open strategy', 'show strategy', 'go to strategy', 'strategy', 'playbook'])) {
      switchTab('strategy');
      response = 'Opened Strategy. You\'ll find playbooks, pricing, and checklists here.';
    }
    else if (matchAny(lower, ['open automation', 'show automation', 'go to automation', 'automation', 'workflows', 'drip sequences'])) {
      switchTab('automation');
      response = 'Opened Automation. Workflows, triggers, and sequences are here.';
    }
    // Roadmap
    else if (matchAny(lower, ['open roadmap', 'show roadmap', 'go to roadmap', 'roadmap', 'build roadmap', 'project roadmap', 'timeline'])) {
      switchTab('roadmap');
      response = 'Opened Roadmap. You can see all phases, tasks, and progress here.';
    }
    else if (matchAny(lower, ['roadmap progress', 'how is the build going', 'project status', 'build status', 'how many tasks done'])) {
      switchTab('roadmap');
      if (typeof GAAdmin !== 'undefined' && GAAdmin.getRoadmapTasks) {
        var tasks = GAAdmin.getRoadmapTasks();
        var done = tasks.filter(function (t) { return t.status === 'Done'; }).length;
        var inProg = tasks.filter(function (t) { return t.status === 'In Progress'; }).length;
        var pct = tasks.length ? Math.round((done / tasks.length) * 100) : 0;
        response = 'Build roadmap: ' + done + '/' + tasks.length + ' tasks complete (' + pct + '%). ' + inProg + ' in progress.';
      } else {
        response = 'Opened Roadmap. Check the board for progress details.';
      }
    }
    // Mode switch
    else if (matchAny(lower, ['switch to enterprise', 'enterprise mode', 'show enterprise', 'enterprise leads'])) {
      switchTab('pipeline');
      if (typeof GAAdmin !== 'undefined') GAAdmin.toggleMode('enterprise');
      response = 'Switched to Enterprise mode. Showing 116 enterprise leads.';
    }
    else if (matchAny(lower, ['switch to main street', 'main street mode', 'show main street', 'mainstreet', 'local businesses'])) {
      switchTab('pipeline');
      if (typeof GAAdmin !== 'undefined') GAAdmin.toggleMode('mainstreet');
      response = 'Switched to Main Street mode. Showing 45 local business leads.';
    }
    // Lead queries
    else if (matchAny(lower, ['how many leads', 'total leads', 'lead count', 'count leads'])) {
      var leads = typeof GAAdmin !== 'undefined' ? GAAdmin.getLeads() : [];
      response = 'You have ' + leads.length + ' total leads in your pipeline.';
    }
    else if (matchAny(lower, ['high growth', 'top leads', 'best leads', 'highest score', 'hottest leads'])) {
      switchTab('pipeline');
      response = 'Showing Pipeline — sorted by growth score. These are your highest-intent opportunities.';
    }
    else if (lower.match(/how many (leads|companies) in/)) {
      var stateMatch = lower.match(/in ([a-z ]+)$/);
      if (stateMatch) {
        var stateName = stateMatch[1].trim();
        leads = typeof GAAdmin !== 'undefined' ? GAAdmin.getLeads() : [];
        var stateCode = findStateCode(stateName, leads);
        if (stateCode) {
          var count = leads.filter(function (l) { return l.state === stateCode; }).length;
          response = 'There are ' + count + ' leads in ' + stateCode + '.';
        } else {
          response = 'I couldn\'t find that state. Try saying the full name like "California" or "New York".';
        }
      } else {
        response = 'Which state? Try "How many leads in California?"';
      }
    }
    // Proposals
    else if (matchAny(lower, ['generate proposal', 'create proposal', 'make proposal'])) {
      var leadName = extractCompanyName(lower, ['generate', 'create', 'make', 'proposal', 'for']);
      if (leadName) {
        var lead = findLeadByName(leadName);
        if (lead) {
          switchTab('pipeline');
          if (typeof GAAdmin !== 'undefined') GAAdmin.generateProposal(lead.id);
          response = 'Generating proposal for ' + lead.name + '. Check the modal.';
        } else {
          response = 'I couldn\'t find a lead matching "' + leadName + '". Try checking the Pipeline tab.';
        }
      } else {
        switchTab('pipeline');
        response = 'Which company? Try "Generate proposal for Berkshire Hathaway".';
      }
    }
    // Analysis
    else if (matchAny(lower, ['analyze', 'check website', 'score website', 'website score'])) {
      switchTab('finder');
      var urlMatch = text.match(/https?:\/\/[^\s]+/);
      if (urlMatch) {
        var input = document.getElementById('finder-url');
        if (input) input.value = urlMatch[0];
        response = 'URL loaded: ' + urlMatch[0] + '. Click Analyze to score it.';
      } else {
        response = 'Opened Finder. Paste a URL like "Analyze https://example.com" and I\'ll score it.';
      }
    }
    // Stats
    else if (matchAny(lower, ['show stats', 'show numbers', 'pipeline', 'pipeline stats', 'overview', 'summary'])) {
      switchTab('dashboard');
      leads = typeof GAAdmin !== 'undefined' ? GAAdmin.getLeads() : [];
      var totalVal = 0;
      var states = {};
      leads.forEach(function (l) { totalVal += (l.value || 0); states[l.state] = true; });
      response = 'Pipeline summary:\n• ' + leads.length + ' total leads\n• $' + totalVal.toFixed(1) + 'M combined revenue\n• ' + Object.keys(states).length + ' states covered';
    }
    // Help
    else if (matchAny(lower, ['help', 'what can you do', 'commands', 'options'])) {
      response = 'Here\'s what I can do:\n\n• "Open Dashboard/Discover/Finder/Outreach/Strategy/Roadmap"\n• "Switch to Enterprise/Main Street"\n• "How many leads?"\n• "How many leads in Texas?"\n• "Show stats"\n• "Generate proposal for [Company]"\n• "Analyze [URL]"\n• "Show roadmap progress"\n• "Show high-growth leads"';
    }
    // Fallback
    else {
      response = 'I didn\'t quite get that. Say "help" to see what I can do, or try:\n\n• "Open Dashboard"\n• "Show stats"\n• "Open Roadmap"\n• "Generate proposal for Berkshire"';
    }

    // Show response
    showTyping(function () {
      addMessage('agent', response);
      speak(response);
    });
  }

  /* ----------------------------------------
     RESPONSE HELPERS
     ---------------------------------------- */
  function showTyping(callback) {
    var container = document.getElementById('voiceMessages');
    if (!container) { callback(); return; }

    var typing = document.createElement('div');
    typing.className = 'voice-msg agent';
    typing.innerHTML = '<span class="typing-dots"><span></span><span></span><span></span></span>';
    container.appendChild(typing);
    container.scrollTop = container.scrollHeight;

    setTimeout(function () {
      if (typing.parentNode) typing.parentNode.removeChild(typing);
      callback();
    }, 800 + Math.random() * 600);
  }

  function addMessage(type, text) {
    var container = document.getElementById('voiceMessages');
    if (!container) return;

    var msg = document.createElement('div');
    msg.className = 'voice-msg ' + type;
    msg.textContent = text;
    container.appendChild(msg);
    container.scrollTop = container.scrollHeight;
  }

  function speak(text) {
    if (!synth) return;
    synth.cancel();
    var clean = text.replace(/[\u{1F300}-\u{1F9FF}]/gu, '').replace(/[*#•✓✕]/g, '').trim();
    var utter = new SpeechSynthesisUtterance(clean);
    utter.rate = 1;
    utter.pitch = 1;
    utter.volume = 1;
    synth.speak(utter);
  }

  /* ----------------------------------------
     MATCHING HELPERS
     ---------------------------------------- */
  function matchAny(text, phrases) {
    for (var i = 0; i < phrases.length; i++) {
      if (text.indexOf(phrases[i]) !== -1) return true;
    }
    return false;
  }

  function extractCompanyName(text, exclude) {
    var words = text.split(' ');
    var capture = false;
    var name = [];
    for (var i = 0; i < words.length; i++) {
      if (capture) name.push(words[i]);
      if (exclude.indexOf(words[i]) !== -1) capture = false;
      if (words[i] === 'for' || words[i] === 'of') capture = true;
    }
    return name.join(' ').trim();
  }

  function findLeadByName(name) {
    var leads = typeof GAAdmin !== 'undefined' ? GAAdmin.getLeads() : [];
    var lower = name.toLowerCase();
    for (var i = 0; i < leads.length; i++) {
      if (leads[i].name.toLowerCase().indexOf(lower) !== -1) return leads[i];
    }
    return null;
  }

  function findStateCode(name, leads) {
    var states = {};
    leads.forEach(function (l) { states[l.state] = true; });
    var upper = name.toUpperCase();
    var lower = String(name || '').toLowerCase().trim();
    if (states[upper]) return upper;
    var map = {
      'alabama': 'AL', 'alaska': 'AK', 'arizona': 'AZ', 'arkansas': 'AR', 'california': 'CA',
      'colorado': 'CO', 'connecticut': 'CT', 'delaware': 'DE', 'florida': 'FL', 'georgia': 'GA',
      'hawaii': 'HI', 'idaho': 'ID', 'illinois': 'IL', 'indiana': 'IN', 'iowa': 'IA',
      'kansas': 'KS', 'kentucky': 'KY', 'louisiana': 'LA', 'maine': 'ME', 'maryland': 'MD',
      'massachusetts': 'MA', 'michigan': 'MI', 'minnesota': 'MN', 'mississippi': 'MS', 'missouri': 'MO',
      'montana': 'MT', 'nebraska': 'NE', 'nevada': 'NV', 'new hampshire': 'NH', 'new jersey': 'NJ',
      'new mexico': 'NM', 'new york': 'NY', 'north carolina': 'NC', 'north dakota': 'ND', 'ohio': 'OH',
      'oklahoma': 'OK', 'oregon': 'OR', 'pennsylvania': 'PA', 'rhode island': 'RI', 'south carolina': 'SC',
      'south dakota': 'SD', 'tennessee': 'TN', 'texas': 'TX', 'utah': 'UT', 'vermont': 'VT',
      'virginia': 'VA', 'washington': 'WA', 'west virginia': 'WV', 'wisconsin': 'WI', 'wyoming': 'WY',
      'canada': 'CA'
    };
    return map[lower] || null;
  }

  function switchTab(name) {
    if (typeof GAAdmin !== 'undefined' && GAAdmin.switchTab) {
      GAAdmin.switchTab(name);
    } else {
      document.querySelectorAll('.sidebar-link[data-tab]').forEach(function (t) {
        t.classList.toggle('active', t.dataset.tab === name);
      });
      document.querySelectorAll('.section').forEach(function (s) {
        s.classList.toggle('active', s.id === name);
      });
    }
  }

  /* ----------------------------------------
     EXPOSE
     ---------------------------------------- */
  window.VoiceAssistant = { init: init };

  document.addEventListener('DOMContentLoaded', init);

})();
