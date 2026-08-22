/* eslint-env node */
// End-to-end smoke suite for the wg-portal API (runs against production by default).
// Usage: npm run test:e2e  [WG_BASE=https://web.gabochie.com]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.WG_BASE || 'https://web.gabochie.com').replace(/\/$/, '');
const API = BASE + '/api/portal';

function loadAdminToken() {
  if (process.env.PORTAL_ADMIN_TOKEN) return process.env.PORTAL_ADMIN_TOKEN;
  try {
    const env = readFileSync(join(ROOT, '.env.e2e'), 'utf8');
    const m = env.match(/^PORTAL_ADMIN_TOKEN=(.+)$/m);
    if (m) return m[1].trim();
  } catch { /* file optional */ }
  return '';
}
const ADMIN_TOKEN = loadAdminToken();

const COMPANY = 'E2E Smoke Co';
const EMAIL = 'e2e-smoke@gabochie.com';
const PASSWORD = 'WG-e2e-smoke-2026-pass';

let passed = 0;
let failed = 0;
let cookie = '';

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    console.log('  \u2717 ' + name + (detail ? ' — ' + detail : ''));
  }
}

async function call(path, opts = {}) {
  const res = await fetch(API + path, {
    method: opts.method || 'GET',
    headers: Object.assign(
      opts.body ? { 'Content-Type': 'application/json' } : {},
      cookie ? { Cookie: cookie } : {},
      opts.token ? { Authorization: 'Bearer ' + opts.token } : {}
    ),
    body: opts.body ? JSON.stringify(opts.body) : undefined,
    redirect: 'manual'
  });
  let data = null;
  try { data = await res.json(); } catch { /* non-JSON */ }
  return { status: res.status, data, setCookies: res.headers.getSetCookie ? res.headers.getSetCookie() : [] };
}

function section(name) {
  console.log('\n' + name);
}

console.log('E2E smoke vs ' + BASE);

// ---------- public / auth surface ----------
section('Unauthenticated access is blocked');
{
  const me = await call('/me');
  ok('GET /me -> 401', me.status === 401, 'got ' + me.status);
  const boot = await call('/bootstrap');
  ok('GET /bootstrap -> 401', boot.status === 401, 'got ' + boot.status);
  const fb = await call('/feedback', { method: 'POST', body: { subject: 'x', message: 'y' } });
  ok('POST /feedback -> 401', fb.status === 401, 'got ' + fb.status);
}

section('Admin endpoints require the bearer token');
{
  const noTok = await call('/admin/companies');
  ok('GET /admin/companies without token -> 403', noTok.status === 403, 'got ' + noTok.status);
  const badTok = await call('/admin/companies', { token: 'wrong-token-abc' });
  ok('GET /admin/companies with bad token -> 403', badTok.status === 403, 'got ' + badTok.status);
}

section('Provisioning');
if (!ADMIN_TOKEN) {
  console.log('  - skipped (no PORTAL_ADMIN_TOKEN in .env.e2e)');
} else {
  const prov = await call('/admin/provision', {
    method: 'POST',
    token: ADMIN_TOKEN,
    body: {
      company: {
        name: COMPANY, industry: 'QA', location: 'Test City',
        tier: 'Growth', start_date: '2026-08-01', delivery_date: '2026-09-30'
      },
      email: EMAIL, password: PASSWORD
    }
  });
  const freshOrExisting = prov.status === 200 || prov.status === 409;
  ok('POST /admin/provision -> 200|409', freshOrExisting, 'got ' + prov.status + ' ' + JSON.stringify(prov.data));
  const badPass = await call('/admin/provision', {
    method: 'POST', token: ADMIN_TOKEN,
    body: { company: { name: COMPANY + ' x2' }, email: 'short-' + EMAIL, password: 'tiny' }
  });
  ok('weak password rejected -> 400', badPass.status === 400, 'got ' + badPass.status);
}

section('Login');
{
  const wrong = await call('/login', { method: 'POST', body: { email: EMAIL, password: 'definitely-wrong-pass' } });
  ok('bad password -> 401', wrong.status === 401, 'got ' + wrong.status);
  const missing = await call('/login', { method: 'POST', body: {} });
  ok('missing fields -> 400', missing.status === 400, 'got ' + missing.status);
  const good = await call('/login', { method: 'POST', body: { email: EMAIL, password: PASSWORD } });
  ok('valid login -> 200', good.status === 200, 'got ' + good.status);
  ok('login returns company name', good.data && good.data.company && good.data.company.name === COMPANY,
    JSON.stringify(good.data));
  const sc = good.setCookies.find(c => c.startsWith('wg_portal_session='));
  ok('session cookie set (HttpOnly)', sc && /httponly/i.test(sc), sc || 'no cookie');
  cookie = sc ? sc.split(';')[0] : '';
}

// ---------- authenticated flows ----------
section('Bootstrap');
{
  const boot = await call('/bootstrap');
  ok('GET /bootstrap -> 200', boot.status === 200, 'got ' + boot.status);
  ok('company present', !!(boot.data && boot.data.company));
  ok('milestones seeded (>=6)', boot.data && Array.isArray(boot.data.milestones) && boot.data.milestones.length >= 6,
    boot.data ? String(boot.data.milestones.length) : 'no data');
}

const SUBJECT = 'E2E feedback ' + new Date().toISOString();

section('Feedback with attachment');
{
  const attachmentData = Buffer.from('e2e attachment payload').toString('base64');
  const post = await call('/feedback', {
    method: 'POST',
    body: {
      subject: SUBJECT, message: 'Filed by automated e2e suite',
      category: 'general', priority: 'low',
      attachments: [{ name: 'e2e-note.txt', type: 'text/plain', data: 'data:text/plain;base64,' + attachmentData }]
    }
  });
  ok('POST /feedback -> 200', post.status === 200 && post.data && post.data.ok === true, JSON.stringify(post.data));

  const invalid = await call('/feedback', { method: 'POST', body: { subject: '', message: '' } });
  ok('empty subject/message -> 400', invalid.status === 400, 'got ' + invalid.status);

  const boot = await call('/bootstrap');
  const found = boot.data && boot.data.feedback.some(f => f.subject === SUBJECT);
  ok('feedback visible in bootstrap', !!found);
  const withFile = boot.data.feedback.find(f => f.subject === SUBJECT);
  ok('attachment linked to feedback', withFile && Array.isArray(withFile.files) && withFile.files.includes('e2e-note.txt'),
    JSON.stringify(withFile && withFile.files));
}

section('Standalone files upload/download');
let fileId = '';
{
  const bytes = Buffer.from('%PDF-1.4 e2e-test-content');
  const up = await call('/files', {
    method: 'POST',
    body: { name: 'e2e-spec.pdf', type: 'application/pdf', data: 'data:application/pdf;base64,' + bytes.toString('base64') }
  });
  ok('POST /files -> 200', up.status === 200 && up.data && up.data.ok, JSON.stringify(up.data));
  fileId = (up.data && up.data.id) || '';

  const oversize = await call('/files', {
    method: 'POST',
    body: { name: 'big.bin', type: 'application/octet-stream', data: 'data:application/octet-stream;base64,' + Buffer.alloc(1024 * 1024 + 10).toString('base64') }
  });
  ok('>1MB upload rejected -> 400', oversize.status === 400, 'got ' + oversize.status);

  if (fileId) {
    const dl = await fetch(API + '/files?id=' + encodeURIComponent(fileId), { headers: { Cookie: cookie } });
    const buf = Buffer.from(await dl.arrayBuffer());
    ok('download -> 200', dl.status === 200, 'got ' + dl.status);
    ok('content matches upload', buf.equals(bytes));
    ok('Content-Disposition filename', (dl.headers.get('content-disposition') || '').includes('e2e-spec.pdf'),
      dl.headers.get('content-disposition') || 'none');
  }
}

section('Logout kills the session');
{
  const out = await call('/logout', { method: 'POST' });
  ok('POST /logout -> 200', out.status === 200, 'got ' + out.status);
  const me = await call('/me');
  ok('session invalidated -> 401', me.status === 401, 'got ' + me.status);
}

console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
