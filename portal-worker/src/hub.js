import { DurableObject } from 'cloudflare:workers';

export const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;
const ITERATIONS = 50000;
const MAX_FILE_BYTES = 1024 * 1024;
const MAX_FEEDBACK_ATTACHMENTS = 3;
const MAX_ATTACHMENT_BYTES = 512 * 1024;

function b64(buf) {
  let s = '';
  const bytes = new Uint8Array(buf);
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
  return btoa(s);
}

function unb64(str) {
  const bin = atob(str);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes.buffer;
}

async function sha256Hex(text) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(digest)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function deriveHash(password, saltB64, iterations) {
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    new TextEncoder().encode(password),
    'PBKDF2',
    false,
    ['deriveBits']
  );
  const bits = await crypto.subtle.deriveBits(
    { name: 'PBKDF2', salt: unb64(saltB64), iterations: iterations, hash: 'SHA-256' },
    keyMaterial,
    256
  );
  return b64(bits);
}

function timingSafeEqualStr(a, b) {
  const ab = new TextEncoder().encode(a);
  const bb = new TextEncoder().encode(b);
  if (ab.length !== bb.length) return false;
  if (crypto.subtle.timingSafeEqual) {
    return crypto.subtle.timingSafeEqual(ab, bb);
  }
  let diff = 0;
  for (let i = 0; i < ab.length; i++) diff |= ab[i] ^ bb[i];
  return diff === 0;
}

function escHtml(s) {
  return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}


function rows(cursor) {
  if (typeof cursor.toArray === 'function') return cursor.toArray();
  const out = [];
  const iterator = cursor.rows ? cursor.rows() : cursor;
  for (const row of iterator) {
    const obj = {};
    cursor.columnNames.forEach((name, i) => { obj[name] = row[i]; });
    out.push(obj);
  }
  return out;
}

function genToken() {
  const bytes = new Uint8Array(32);
  crypto.getRandomValues(bytes);
  return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeId(prefix) {
  return prefix + '_' + Date.now().toString(36) + '_' + genToken().slice(0, 12);
}

const DEFAULT_MILESTONES = [
  { name: 'Discovery Call', descr: 'Initial consultation and requirements gathering', offset: 0 },
  { name: 'Strategy & wireframes', descr: 'Information architecture and wireframe delivery', offset: 7 },
  { name: 'Design concepts', descr: 'Visual design concepts presented for review', offset: 14 },
  { name: 'Development', descr: 'Building the approved design into code', offset: 28 },
  { name: 'QA & testing', descr: 'Cross-browser, mobile, and performance testing', offset: 42 },
  { name: 'Launch', descr: 'Go live with full monitoring', offset: 49 }
];

export class PortalHub extends DurableObject {
  constructor(ctx, env) {
    super(ctx, env);
    this.sql = ctx.storage.sql;
    this.ensureSchema();
  }

  ensureSchema() {
    this.sql.exec(`CREATE TABLE IF NOT EXISTS companies (
      id TEXT PRIMARY KEY, name TEXT NOT NULL UNIQUE, industry TEXT, location TEXT,
      tier TEXT, start_date TEXT, delivery_date TEXT, preview_url TEXT, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS users (
      email TEXT PRIMARY KEY, company_id TEXT NOT NULL, salt TEXT NOT NULL,
      hash TEXT NOT NULL, iterations INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS sessions (
      token_hash TEXT PRIMARY KEY, email TEXT NOT NULL, company_id TEXT NOT NULL,
      expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS milestones (
      id INTEGER PRIMARY KEY AUTOINCREMENT, company_id TEXT NOT NULL, name TEXT NOT NULL,
      descr TEXT, due_date TEXT, status TEXT NOT NULL DEFAULT 'pending', sort INTEGER NOT NULL DEFAULT 0)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS feedback (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, category TEXT, priority TEXT,
      subject TEXT NOT NULL, message TEXT NOT NULL, reply TEXT, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS files (
      id TEXT PRIMARY KEY, company_id TEXT NOT NULL, feedback_id TEXT, name TEXT NOT NULL,
      mime TEXT, size INTEGER NOT NULL, data BLOB, uploaded_by TEXT, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS login_attempts (
      key TEXT NOT NULL, ts INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS leads (
      id TEXT PRIMARY KEY, name TEXT, email TEXT, company TEXT, url TEXT,
      industry TEXT, source TEXT, message TEXT, total INTEGER, design INTEGER, mobile INTEGER,
      performance INTEGER, top_issues TEXT, user_agent TEXT, ip TEXT, created_at INTEGER NOT NULL)`);
    this.sql.exec(`CREATE TABLE IF NOT EXISTS lead_attempts (
      key TEXT NOT NULL, ts INTEGER NOT NULL)`);
    try { this.sql.exec('ALTER TABLE leads ADD COLUMN message TEXT'); } catch (e) { /* column exists */ }
    try { this.sql.exec('ALTER TABLE companies ADD COLUMN preview_url TEXT'); } catch (e) { /* column exists */ }
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_milestones_company ON milestones(company_id, sort)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_feedback_company ON feedback(company_id, created_at)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_files_company ON files(company_id, created_at)`);
    this.sql.exec(`CREATE INDEX IF NOT EXISTS idx_sessions_expiry ON sessions(expires_at)`);
    this.sql.exec(`DELETE FROM sessions WHERE expires_at < ${Date.now()}`);
    this.sql.exec(`DELETE FROM login_attempts WHERE ts < ${Date.now() - 15 * 60 * 1000}`);
  }

  async #hashPassword(password, salt, iterations) {
    return deriveHash(password, salt, iterations);
  }

  async login(email, password, ip) {
    email = String(email || '').trim().toLowerCase();
    password = String(password || '');
    if (!email || !password) return { ok: false, status: 400, error: 'Email and password are required' };

    const attemptKey = ip + '|' + email;
    const cutoff = Date.now() - 15 * 60 * 1000;
    this.sql.exec('DELETE FROM login_attempts WHERE ts < ?', cutoff);
    const recent = rows(this.sql.exec('SELECT COUNT(*) AS n FROM login_attempts WHERE key = ?', attemptKey))[0].n;
    if (recent >= 8) return { ok: false, status: 429, error: 'Too many attempts. Try again in 15 minutes.' };

    const user = rows(this.sql.exec('SELECT * FROM users WHERE email = ?', email))[0];
    if (user) {
      const candidate = await this.#hashPassword(password, user.salt, user.iterations);
      if (!timingSafeEqualStr(candidate, user.hash)) {
        // Only failed attempts count toward the lockout
        this.sql.exec('INSERT INTO login_attempts (key, ts) VALUES (?, ?)', attemptKey, Date.now());
        return { ok: false, status: 401, error: 'Invalid email or password' };
      }
    } else {
      // Burn comparable CPU so a missing user is not distinguishable by timing
      await this.#hashPassword(password, b64(crypto.getRandomValues(new Uint8Array(16))), ITERATIONS);
      this.sql.exec('INSERT INTO login_attempts (key, ts) VALUES (?, ?)', attemptKey, Date.now());
      return { ok: false, status: 401, error: 'Invalid email or password' };
    }

    const token = genToken();
    const tokenHash = await sha256Hex(token);
    const now = Date.now();
    this.sql.exec('INSERT INTO sessions (token_hash, email, company_id, expires_at, created_at) VALUES (?, ?, ?, ?, ?)',
      tokenHash, user.email, user.company_id, now + SESSION_TTL_MS, now);

    const company = rows(this.sql.exec('SELECT * FROM companies WHERE id = ?', user.company_id))[0];
    return { ok: true, token: token, company: company || null };
  }

  async getSession(tokenHash) {
    if (!tokenHash) return null;
    const session = rows(this.sql.exec('SELECT * FROM sessions WHERE token_hash = ?', tokenHash))[0];
    if (!session || session.expires_at < Date.now()) return null;
    const company = rows(this.sql.exec('SELECT * FROM companies WHERE id = ?', session.company_id))[0];
    return session && company ? { email: session.email, companyId: session.company_id, company: company } : null;
  }

  async logout(tokenHash) {
    if (tokenHash) this.sql.exec('DELETE FROM sessions WHERE token_hash = ?', tokenHash);
    return { ok: true };
  }

  async bootstrap(companyId) {
    const company = rows(this.sql.exec('SELECT * FROM companies WHERE id = ?', companyId))[0];
    const milestones = rows(this.sql.exec('SELECT id, name, descr, due_date AS date, status FROM milestones WHERE company_id = ? ORDER BY sort', companyId));
    const feedbackRows = rows(this.sql.exec('SELECT id, category, priority, subject, message, reply, created_at AS createdAt FROM feedback WHERE company_id = ? ORDER BY created_at DESC', companyId));
    const fileMeta = rows(this.sql.exec('SELECT id, feedback_id AS feedbackId, name, mime AS type, size, uploaded_by AS uploadedBy, created_at AS createdAt FROM files WHERE company_id = ? ORDER BY created_at DESC', companyId));

    const filesByFeedback = {};
    const standaloneFiles = [];
    for (const f of fileMeta) {
      if (f.feedbackId) {
        (filesByFeedback[f.feedbackId] = filesByFeedback[f.feedbackId] || []).push(f.name);
      } else {
        standaloneFiles.push(f);
      }
    }
    const feedback = feedbackRows.map(fb => Object.assign({}, fb, {
      date: new Date(fb.createdAt).toISOString(),
      files: filesByFeedback[fb.id] || []
    }));
    const files = standaloneFiles.map(f => Object.assign({}, f, { date: new Date(f.createdAt).toISOString() }));

    return { company: company, milestones: milestones, feedback: feedback, files: files };
  }

  async addFeedback(companyId, body) {
    const subject = String(body.subject || '').trim();
    const message = String(body.message || '').trim();
    if (!subject || !message) return { ok: false, status: 400, error: 'Subject and details are required' };
    const category = ['design', 'content', 'bug', 'feature', 'general'].includes(body.category) ? body.category : 'general';
    const priority = ['low', 'medium', 'high'].includes(body.priority) ? body.priority : 'medium';
    const id = makeId('fb');
    this.sql.exec('INSERT INTO feedback (id, company_id, category, priority, subject, message, reply, created_at) VALUES (?, ?, ?, ?, ?, ?, NULL, ?)',
      id, companyId, category, priority, subject.slice(0, 300), message.slice(0, 5000), Date.now());

    const attachments = Array.isArray(body.attachments) ? body.attachments : [];
    if (attachments.length > MAX_FEEDBACK_ATTACHMENTS) return { ok: false, status: 400, error: 'Max ' + MAX_FEEDBACK_ATTACHMENTS + ' attachments' };
    for (const att of attachments) {
      const bytes = unb64(String(att.data || '').split(',').pop());
      if (bytes.byteLength > MAX_ATTACHMENT_BYTES) return { ok: false, status: 400, error: 'Attachment too large (max 512KB)' };
      this.sql.exec('INSERT INTO files (id, company_id, feedback_id, name, mime, size, data, uploaded_by, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        makeId('file'), companyId, id, String(att.name || 'attachment').slice(0, 200), String(att.type || ''), bytes.byteLength, bytes, 'client', Date.now());
    }
    return { ok: true, id: id };
  }

  async listStandaloneFiles(companyId) {
    return rows(this.sql.exec('SELECT id, name, mime AS type, size, created_at AS createdAt FROM files WHERE company_id = ? AND feedback_id IS NULL ORDER BY created_at DESC', companyId));
  }

  async addFile(companyId, uploadedBy, body) {
    const bytes = unb64(String(body.data || '').split(',').pop());
    if (!bytes.byteLength) return { ok: false, status: 400, error: 'Empty file' };
    if (bytes.byteLength > MAX_FILE_BYTES) return { ok: false, status: 400, error: 'File too large (max 1MB)' };
    const total = rows(this.sql.exec("SELECT COALESCE(SUM(size), 0) AS n FROM files WHERE company_id = ?", companyId))[0].n;
    if (total + bytes.byteLength > 100 * 1024 * 1024) return { ok: false, status: 400, error: 'Project storage limit reached' };
    const id = makeId('file');
    this.sql.exec('INSERT INTO files (id, company_id, feedback_id, name, mime, size, data, uploaded_by, created_at) VALUES (?, ?, NULL, ?, ?, ?, ?, ?, ?)',
      id, companyId, String(body.name || 'file').slice(0, 200), String(body.type || ''), bytes.byteLength, bytes, uploadedBy, Date.now());
    return { ok: true, id: id, size: bytes.byteLength };
  }

  async getFile(companyId, fileId) {
    const file = rows(this.sql.exec('SELECT id, name, mime, data FROM files WHERE id = ? AND company_id = ?', fileId, companyId))[0];
    return file || null;
  }

  #seedMilestones(company) {
    const start = new Date(String(company.start_date || new Date().toISOString().slice(0, 10)) + 'T00:00:00Z');
    if (isNaN(start.getTime())) return;
    DEFAULT_MILESTONES.forEach((m, i) => {
      const due = new Date(start.getTime() + m.offset * 86400000);
      this.sql.exec('INSERT INTO milestones (company_id, name, descr, due_date, status, sort) VALUES (?, ?, ?, ?, ?, ?)',
        company.id, m.name, m.descr, due.toISOString().slice(0, 10), 'pending', i);
    });
  }

  async adminProvision(adminToken, body) {
    const expected = this.env.PORTAL_ADMIN_TOKEN;
    if (!expected) return { ok: false, status: 500, error: 'PORTAL_ADMIN_TOKEN not configured' };
    if (!adminToken || !timingSafeEqualStr(adminToken, expected)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    const c = body.company || {};
    const name = String(c.name || '').trim();
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password || '');
    if (!name || !email || !password) return { ok: false, status: 400, error: 'company.name, email and password are required' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, status: 400, error: 'Invalid email format' };
    if (password.length < 10) return { ok: false, status: 400, error: 'Password must be at least 10 characters' };

    let company = rows(this.sql.exec('SELECT * FROM companies WHERE name = ?', name))[0];
    const now = Date.now();
    if (!company) {
      const id = makeId('co');
      this.sql.exec('INSERT INTO companies (id, name, industry, location, tier, start_date, delivery_date, preview_url, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
        id, name, String(c.industry || ''), String(c.location || ''), String(c.tier || 'Growth'),
        String(c.start_date || new Date().toISOString().slice(0, 10)), String(c.delivery_date || ''),
        c.preview_url ? String(c.preview_url).slice(0, 500) : null, now);
      company = rows(this.sql.exec('SELECT * FROM companies WHERE id = ?', id))[0];
      this.#seedMilestones(company);
    } else if (rows(this.sql.exec('SELECT 1 FROM users WHERE email = ?', email)).length) {
      return { ok: false, status: 409, error: 'User already exists for this company' };
    } else if (!rows(this.sql.exec('SELECT 1 FROM milestones WHERE company_id = ?', company.id)).length) {
      this.#seedMilestones(company);
    }

    const existingUser = rows(this.sql.exec('SELECT 1 FROM users WHERE email = ?', email))[0];
    if (existingUser) return { ok: false, status: 409, error: 'A user with this email already exists' };

    const salt = b64(crypto.getRandomValues(new Uint8Array(16)));
    const hash = await this.#hashPassword(password, salt, ITERATIONS);
    this.sql.exec('INSERT INTO users (email, company_id, salt, hash, iterations, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      email, company.id, salt, hash, ITERATIONS, now);

    return { ok: true, company: company, email: email };
  }

  async adminListCompanies() {
    const companies = rows(this.sql.exec('SELECT id, name, industry, location, tier, start_date, delivery_date, created_at FROM companies ORDER BY created_at DESC'));
    const result = [];
    for (const c of companies) {
      c.users = rows(this.sql.exec('SELECT email, created_at FROM users WHERE company_id = ?', c.id)).map(u => u.email);
      result.push(c);
    }
    return result;
  }

  async addLead(ip, body) {
    body = body || {};
    // Honeypot: real users never fill the hidden "website" field.
    // Pretend success so bots do not learn they were caught.
    if (String(body.website || '').trim() !== '') {
      return { ok: true, honeypot: true };
    }

    const name = String(body.name || '').trim().slice(0, 100);
    const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
    let url = String(body.url || '').trim().slice(0, 500);
    const industry = String(body.industry || '').trim().slice(0, 60);
    const source = String(body.source || 'Website').trim().slice(0, 60);

    // url is optional: contact-form messages may not include a website
    if (!name || !email) return { ok: false, status: 400, error: 'Name and email are required' };
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, status: 400, error: 'Invalid email address' };
    if (url) {
      if (!/^https?:\/\//i.test(url)) url = 'https://' + url;
      try {
        const parsed = new URL(url);
        if (!/^https?:$/.test(parsed.protocol) || !parsed.hostname.includes('.')) throw new Error('bad');
        url = parsed.href;
      } catch (e) {
        return { ok: false, status: 400, error: 'Invalid website URL' };
      }
    }

    // Rate limit: 5 leads per hour per IP
    const attemptKey = ip;
    const cutoff = Date.now() - 60 * 60 * 1000;
    this.sql.exec('DELETE FROM lead_attempts WHERE ts < ?', cutoff);
    const recent = rows(this.sql.exec('SELECT COUNT(*) AS n FROM lead_attempts WHERE key = ?', attemptKey))[0].n;
    if (recent >= 5) return { ok: false, status: 429, error: 'Too many requests. Please try again later.' };
    this.sql.exec('INSERT INTO lead_attempts (key, ts) VALUES (?, ?)', attemptKey, Date.now());

    const id = makeId('lead');
    this.sql.exec(
      'INSERT INTO leads (id, name, email, company, url, industry, source, message, total, design, mobile, performance, top_issues, user_agent, ip, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)',
      id, name, email, String(body.companyName || '').slice(0, 150), url, industry, source,
      String(body.message || '').slice(0, 3000),
      Number.isFinite(body.total) ? Math.max(0, Math.min(100, Math.round(body.total))) : null,
      Number.isFinite(body.design) ? Math.max(0, Math.min(100, Math.round(body.design))) : null,
      Number.isFinite(body.mobile) ? Math.max(0, Math.min(100, Math.round(body.mobile))) : null,
      Number.isFinite(body.performance) ? Math.max(0, Math.min(100, Math.round(body.performance))) : null,
      Array.isArray(body.issues) ? body.issues.slice(0, 8).map(i => String(i).slice(0, 200)).join(' | ') : '',
      String(body.userAgent || '').slice(0, 300), ip, Date.now()
    );

    const lead = rows(this.sql.exec('SELECT * FROM leads WHERE id = ?', id))[0];
    return { ok: true, lead: lead };
  }

  buildLeadNotificationEmail(lead) {
    const ownerEmail = this.env.LEAD_NOTIFY_EMAIL || 'web@gabochie.com';
    const rowsHtml = [
      ['Name', lead.name], ['Email', lead.email], ['Company', lead.company],
      ['Website', lead.url], ['Industry', lead.industry], ['Source', lead.source],
      ['Audit score', lead.total === null ? 'pending' : lead.total + '/100'],
      lead.message ? ['Message', lead.message] : null,
      ['Top issues', lead.top_issues || '—']
    ].filter(Boolean).map(r => '<tr><td style="padding:6px 14px;color:#8a8a95;font-size:13px;white-space:nowrap">' + r[0] +
      '</td><td style="padding:6px 14px;color:#f0f0f0;font-size:13px">' + escHtml(r[1] === null || r[1] === undefined ? '' : String(r[1])) + '</td></tr>').join('');
    const html = '<div style="font-family:Inter,system-ui,sans-serif;max-width:600px;margin:0 auto;padding:32px;background:#0b0b0f;color:#f0f0f0">' +
      '<div style="font-size:1.4rem;font-weight:800;margin-bottom:20px">Web <span style="color:#00ff88">Gabochie</span></div>' +
      '<h1 style="font-size:1.3rem;margin-bottom:6px">New audit lead</h1>' +
      '<p style="color:#8a8a95;font-size:13px;margin-bottom:18px">' + new Date(lead.created_at).toISOString() + '</p>' +
      '<table style="background:#121216;border:1px solid #1f1f28;border-radius:12px;border-collapse:inherit;width:100%;margin-bottom:22px">' + rowsHtml + '</table>' +
      '<p style="color:#55555f;font-size:.85rem">Reply to reply directly to the lead.</p></div>';
    return { to: ownerEmail, subject: 'New audit lead — ' + lead.name + (lead.company ? ' (' + lead.company + ')' : ''), html: html };
  }

  async adminListLeads(adminToken) {
    if (!this.env.PORTAL_ADMIN_TOKEN || !adminToken || !timingSafeEqualStr(adminToken, this.env.PORTAL_ADMIN_TOKEN)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    const leads = rows(this.sql.exec('SELECT id, name, email, company, url, industry, source, total, top_issues, created_at FROM leads ORDER BY created_at DESC LIMIT 200'));
    return { ok: true, leads: leads };
  }

  async adminSetMilestoneStatus(companyToken, companyId, milestoneName, status) {
    const expected = this.env.PORTAL_ADMIN_TOKEN;
    if (!expected || !companyToken || !timingSafeEqualStr(companyToken, expected)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    if (!['pending', 'active', 'done'].includes(status)) return { ok: false, status: 400, error: 'Invalid status' };
    this.sql.exec('UPDATE milestones SET status = ? WHERE company_id = ? AND name = ?', status, companyId, milestoneName);
    return { ok: true };
  }

  async adminReplyFeedback(adminToken, feedbackId, reply) {
    if (!this.env.PORTAL_ADMIN_TOKEN || !adminToken || !timingSafeEqualStr(adminToken, this.env.PORTAL_ADMIN_TOKEN)) {
      return { ok: false, status: 403, error: 'Forbidden' };
    }
    this.sql.exec('UPDATE feedback SET reply = ? WHERE id = ?', String(reply || '').slice(0, 3000), feedbackId);
    return { ok: true };
  }
}
