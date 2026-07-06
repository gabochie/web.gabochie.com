/**
 * Firebase Configuration
 * Replace with your Firebase project config from:
 * https://console.firebase.google.com → Project Settings → Your apps → Config
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyBqFdTih1WJqeyd5BVw64Xh1IC9s816j7c",
  authDomain: "gideonabochie-com.firebaseapp.com",
  projectId: "gideonabochie-com",
  storageBucket: "gideonabochie-com.firebasestorage.app",
  messagingSenderId: "131979192347",
  appId: "1:131979192347:web:6870b6d0c6ab7776f8b0be"
};

/* ========================================
   FIREBASE DATA SERVICE
   Wraps Firestore for leads, feedback, files, roadmap
   Falls back to localStorage if Firebase unavailable
   ======================================== */

var FirebaseService = (function () {
  var db = null;
  var useFirebase = false;

  function init() {
    if (typeof firebase === 'undefined' || !FIREBASE_CONFIG.apiKey || FIREBASE_CONFIG.apiKey === 'YOUR_API_KEY') {
      console.log('[Firebase] Config missing — using localStorage fallback');
      return;
    }
    try {
      firebase.initializeApp(FIREBASE_CONFIG);
      db = firebase.firestore();
      useFirebase = true;
      console.log('[Firebase] Connected to', FIREBASE_CONFIG.projectId);
    } catch (e) {
      console.warn('[Firebase] Init failed:', e.message);
    }
  }

  /* ---------- LEADS ---------- */
  function getLeads() {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_leads') || '[]'));
    return db.collection('leads').orderBy('score', 'desc').get()
      .then(function (snap) {
        var leads = [];
        snap.forEach(function (doc) { leads.push(Object.assign({ id: doc.id }, doc.data())); });
        return leads;
      })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_leads') || '[]'); });
  }

  function onLeadsChanged(callback) {
    if (!useFirebase) {
      var stored = JSON.parse(localStorage.getItem('ga_leads') || '[]');
      callback(stored);
      return function () {};
    }
    return db.collection('leads').orderBy('score', 'desc')
      .onSnapshot(function (snap) {
        var leads = [];
        snap.forEach(function (doc) { leads.push(Object.assign({ id: doc.id }, doc.data())); });
        callback(leads);
      }, function (err) {
        console.warn('[Firebase] Leads listener error:', err.message);
        callback(JSON.parse(localStorage.getItem('ga_leads') || '[]'));
      });
  }

  function saveLeads(leads) {
    if (!useFirebase) { localStorage.setItem('ga_leads', JSON.stringify(leads)); return Promise.resolve(); }
    var batch = db.batch();
    leads.forEach(function (lead) {
      var ref = db.collection('leads').doc(lead.id || undefined);
      batch.set(ref, lead, { merge: true });
    });
    return batch.commit();
  }

  function updateLead(id, data) {
    if (!useFirebase) {
      var leads = JSON.parse(localStorage.getItem('ga_leads') || '[]');
      var idx = leads.findIndex(function (l) { return l.id === id; });
      if (idx !== -1) { Object.assign(leads[idx], data); localStorage.setItem('ga_leads', JSON.stringify(leads)); }
      return Promise.resolve();
    }
    return db.collection('leads').doc(id).set(data, { merge: true });
  }

  /* ---------- FEEDBACK ---------- */
  function getFeedback(companyId) {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_portal_feedback_' + companyId) || '[]'));
    return db.collection('feedback').where('companyId', '==', companyId).orderBy('createdAt', 'desc').get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        return items;
      })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_portal_feedback_' + companyId) || '[]'); });
  }

  function onFeedbackChanged(companyId, callback) {
    if (!useFirebase) {
      callback(JSON.parse(localStorage.getItem('ga_portal_feedback_' + companyId) || '[]'));
      return function () {};
    }
    return db.collection('feedback').where('companyId', '==', companyId).orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        callback(items);
      }, function () { callback([]); });
  }

  function addFeedback(item) {
    if (!useFirebase) {
      var items = JSON.parse(localStorage.getItem('ga_portal_feedback_' + item.companyId) || '[]');
      items.unshift(item);
      localStorage.setItem('ga_portal_feedback_' + item.companyId, JSON.stringify(items));
      return Promise.resolve();
    }
    return db.collection('feedback').add(Object.assign({}, item, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
  }

  /* ---------- FILES ---------- */
  function getFiles(companyId) {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_portal_files_' + companyId) || '[]'));
    return db.collection('files').where('companyId', '==', companyId).orderBy('uploadedAt', 'desc').get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        return items;
      })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_portal_files_' + companyId) || '[]'); });
  }

  function addFile(file) {
    if (!useFirebase) {
      var items = JSON.parse(localStorage.getItem('ga_portal_files_' + file.companyId) || '[]');
      items.unshift(file);
      localStorage.setItem('ga_portal_files_' + file.companyId, JSON.stringify(items));
      return Promise.resolve();
    }
    return db.collection('files').add(Object.assign({}, file, { uploadedAt: firebase.firestore.FieldValue.serverTimestamp() }));
  }

  /* ---------- ROADMAP ---------- */
  function getRoadmap() {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_roadmap') || 'null'));
    return db.collection('settings').doc('roadmap').get()
      .then(function (doc) { return doc.exists ? doc.data() : null; })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_roadmap') || 'null'); });
  }

  function onRoadmapChanged(callback) {
    if (!useFirebase) {
      callback(JSON.parse(localStorage.getItem('ga_roadmap') || 'null'));
      return function () {};
    }
    return db.collection('settings').doc('roadmap')
      .onSnapshot(function (doc) {
        callback(doc.exists ? doc.data() : null);
      }, function () { callback(null); });
  }

  function saveRoadmap(data) {
    if (!useFirebase) { localStorage.setItem('ga_roadmap', JSON.stringify(data)); return Promise.resolve(); }
    return db.collection('settings').doc('roadmap').set(data, { merge: true });
  }

  /* ---------- TIMELINE ---------- */
  function getTimeline(companyId) {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_portal_milestones_' + companyId) || '[]'));
    return db.collection('timeline').where('companyId', '==', companyId).orderBy('date', 'desc').get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        return items;
      })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_portal_milestones_' + companyId) || '[]'); });
  }

  function onTimelineChanged(companyId, callback) {
    if (!useFirebase) {
      callback(JSON.parse(localStorage.getItem('ga_portal_milestones_' + companyId) || '[]'));
      return function () {};
    }
    return db.collection('timeline').where('companyId', '==', companyId).orderBy('date', 'desc')
      .onSnapshot(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        callback(items);
      }, function () { callback([]); });
  }

  function addTimelineEvent(event) {
    if (!useFirebase) {
      var items = JSON.parse(localStorage.getItem('ga_portal_milestones_' + event.companyId) || '[]');
      items.unshift(event);
      localStorage.setItem('ga_portal_milestones_' + event.companyId, JSON.stringify(items));
      return Promise.resolve();
    }
    return db.collection('timeline').add(Object.assign({}, event, { createdAt: firebase.firestore.FieldValue.serverTimestamp() }));
  }

  /* ---------- NOTES ---------- */
  function getNotes(leadId) {
    if (!useFirebase) return Promise.resolve(JSON.parse(localStorage.getItem('ga_notes_' + leadId) || '[]'));
    return db.collection('leads').doc(leadId).collection('notes').orderBy('createdAt', 'desc').get()
      .then(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        return items;
      })
      .catch(function () { return JSON.parse(localStorage.getItem('ga_notes_' + leadId) || '[]'); });
  }

  function onNotesChanged(leadId, callback) {
    if (!useFirebase) {
      callback(JSON.parse(localStorage.getItem('ga_notes_' + leadId) || '[]'));
      return function () {};
    }
    return db.collection('leads').doc(leadId).collection('notes').orderBy('createdAt', 'desc')
      .onSnapshot(function (snap) {
        var items = [];
        snap.forEach(function (doc) { items.push(Object.assign({ id: doc.id }, doc.data())); });
        callback(items);
      }, function () { callback([]); });
  }

  function addNote(leadId, text, author) {
    if (!useFirebase) {
      var items = JSON.parse(localStorage.getItem('ga_notes_' + leadId) || '[]');
      var note = { id: 'note_' + Date.now(), text: text, author: author || 'Admin', createdAt: new Date().toISOString() };
      items.unshift(note);
      localStorage.setItem('ga_notes_' + leadId, JSON.stringify(items));
      return Promise.resolve(note);
    }
    return db.collection('leads').doc(leadId).collection('notes').add({
      text: text,
      author: author || 'Admin',
      createdAt: firebase.firestore.FieldValue.serverTimestamp()
    });
  }

  function deleteNote(leadId, noteId) {
    if (!useFirebase) {
      var items = JSON.parse(localStorage.getItem('ga_notes_' + leadId) || '[]');
      items = items.filter(function (n) { return n.id !== noteId; });
      localStorage.setItem('ga_notes_' + leadId, JSON.stringify(items));
      return Promise.resolve();
    }
    return db.collection('leads').doc(leadId).collection('notes').doc(noteId).delete();
  }

  return {
    init: init,
    isFirebase: function () { return useFirebase; },
    leads: { get: getLeads, save: saveLeads, update: updateLead, onChanged: onLeadsChanged },
    feedback: { get: getFeedback, add: addFeedback, onChanged: onFeedbackChanged },
    files: { get: getFiles, add: addFile },
    notes: { get: getNotes, add: addNote, delete: deleteNote, onChanged: onNotesChanged },
    roadmap: { get: getRoadmap, save: saveRoadmap, onChanged: onRoadmapChanged },
    timeline: { get: getTimeline, add: addTimelineEvent, onChanged: onTimelineChanged }
  };
})();

/* ========================================
   FIREBASE AUTH SERVICE
   Login, logout, session management
   ======================================== */
var AuthService = (function () {
  var auth = null;

  function init() {
    if (typeof firebase === 'undefined') {
      console.warn('[Auth] Firebase SDK not loaded');
      return;
    }
    try {
      if (!firebase.apps.length) {
        firebase.initializeApp(FIREBASE_CONFIG);
      }
      auth = firebase.auth();
      console.log('[Auth] Initialized OK, current user:', auth.currentUser);
    } catch (e) {
      console.error('[Auth] Init failed:', e.message);
    }
  }

  function login(email, password) {
    if (!auth) return Promise.reject(new Error('Auth not initialized'));
    return auth.signInWithEmailAndPassword(email, password);
  }

  function logout() {
    if (!auth) return Promise.resolve();
    return auth.signOut();
  }

  function onAuthStateChanged(callback) {
    if (!auth) { callback(null); return function () {}; }
    return auth.onAuthStateChanged(callback);
  }

  function getCurrentUser() {
    return auth ? auth.currentUser : null;
  }

  return {
    init: init,
    login: login,
    logout: logout,
    onAuthStateChanged: onAuthStateChanged,
    getCurrentUser: getCurrentUser
  };
})();
