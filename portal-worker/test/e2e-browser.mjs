/* eslint-env node */
// Browser E2E for the client portal (production by default).
// Usage: npm run test:e2e:browser  [WG_BASE=https://web.gabochie.com]

import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { chromium } from 'playwright';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const BASE = (process.env.WG_BASE || 'https://web.gabochie.com').replace(/\/$/, '');
const EMAIL = 'e2e-smoke@gabochie.com';
const PASSWORD = 'WG-e2e-smoke-2026-pass';
const COMPANY = 'E2E Smoke Co';

let passed = 0;
let failed = 0;

function ok(name, cond, detail) {
  if (cond) {
    passed++;
    console.log('  \u2713 ' + name);
  } else {
    failed++;
    console.log('  \u2717 ' + name + (detail ? ' — ' + detail : ''));
  }
}

function section(name) {
  console.log('\n' + name);
}

// The API suite provisions this user; make sure it exists before the browser run.
async function ensureUser() {
  let token = process.env.PORTAL_ADMIN_TOKEN || '';
  if (!token) {
    try {
      token = (readFileSync(join(ROOT, '.env.e2e'), 'utf8').match(/^PORTAL_ADMIN_TOKEN=(.+)$/m) || [])[1] || '';
      token = token.trim();
    } catch { /* optional */ }
  }
  const res = await fetch(BASE + '/api/portal/admin/provision', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      company: { name: COMPANY, industry: 'QA', location: 'Test City', tier: 'Growth', start_date: '2026-08-01', delivery_date: '2026-09-30' },
      email: EMAIL, password: PASSWORD
    })
  });
  return res.status === 200 || res.status === 409;
}

console.log('Browser E2E vs ' + BASE);

const provisioned = await ensureUser();
ok('e2e user provisioned', provisioned);
if (!provisioned) process.exit(1);

const browser = await chromium.launch({ channel: 'chrome' });
const page = await browser.newPage();
page.setDefaultTimeout(20000);

const pageErrors = [];
page.on('pageerror', e => pageErrors.push(String(e)));

try {
  section('Login screen');
  await page.goto(BASE + '/portal.html', { waitUntil: 'networkidle' });
  ok('auth screen visible', await page.isVisible('#authScreen'));
  ok('company dropdown removed', (await page.$('#loginCompany')) === null);
  ok('firebase scripts removed', await page.evaluate(() => ![...document.scripts].some(s => /gstatic|firebase/.test(s.src))));

  section('Bad credentials rejected');
  await page.fill('#loginEmail', EMAIL);
  await page.fill('#loginPass', 'wrong-password-123');
  await page.click('#loginForm button[type="submit"]');
  await page.waitForSelector('#authError.show');
  ok('error message shown', ((await page.textContent('#authError')) || '').length > 0);
  ok('still on auth screen', await page.isVisible('#authScreen'));

  section('Valid login lands on dashboard');
  await page.fill('#loginPass', PASSWORD);
  await Promise.all([
    page.waitForResponse(r => r.url().includes('/api/portal/bootstrap') && r.status() === 200),
    page.click('#loginForm button[type="submit"]')
  ]);
  await page.waitForSelector('#app', { state: 'visible' });
  ok('dashboard visible', await page.isVisible('#app'));
  ok('sidebar shows company', ((await page.textContent('#sbCompany')) || '').trim() === COMPANY,
    (await page.textContent('#sbCompany')));
  ok('milestones rendered', (await page.$$('#milestonesList .milestone')).length >= 6);

  section('Feedback flow persists to server');
  await page.click('.sidebar-link[data-view="feedback"]');
  const subject = 'Browser E2E ' + Date.now();
  await page.fill('#fbSubject', subject);
  await page.fill('#fbMessage', 'Submitted through the real UI by Playwright.');
  await page.selectOption('#fbCategory', 'design');
  await page.selectOption('#fbPriority', 'low');
  await page.click('#feedbackForm button[type="submit"]');
  await page.waitForSelector(`#feedbackHistory >> text=${subject}`);
  ok('feedback appears in history', true);

  // Prove persistence: fresh reload re-fetches from the server
  await page.reload({ waitUntil: 'networkidle' });
  ok('session survives reload', await page.isVisible('#app'));
  await page.click('.sidebar-link[data-view="feedback"]');
  await page.waitForSelector(`#feedbackHistory >> text=${subject}`);
  ok('feedback persisted after reload', true);

  section('File upload through the UI');
  await page.click('.sidebar-link[data-view="files"]');
  await page.setInputFiles('#filesUpload', {
    name: 'browser-e2e.txt',
    mimeType: 'text/plain',
    buffer: Buffer.from('uploaded by playwright')
  });
  await page.waitForSelector('.file-card .file-name >> text=browser-e2e.txt');
  ok('uploaded file card rendered', true);

  section('Overview stats update');
  await page.click('.sidebar-link[data-view="overview"]');
  await page.waitForFunction(() => parseInt(document.querySelector('#statFeedback').textContent, 10) >= 2);
  ok('statFeedback >= 2', true);
  const tasks = await page.textContent('#statTasks');
  ok('statTasks shows x/6', /\/\s*6$/.test((tasks || '').trim()), tasks);

  section('Timeline renders events');
  await page.click('.sidebar-link[data-view="timeline"]');
  await page.waitForSelector('#timelineList .timeline-item');
  ok('timeline items present', (await page.$$('#timelineList .timeline-item')).length > 0);

  section('Logout returns to auth screen');
  await page.click('#logoutBtn');
  await page.waitForSelector('#authScreen', { state: 'visible' });
  ok('auth screen restored', await page.isVisible('#authScreen'));
} catch (err) {
  failed++;
  console.log('  \u2717 UNEXPECTED FAILURE — ' + err.message.split('\n')[0]);
}

if (pageErrors.length) {
  failed++;
  console.log('\n  \u2717 Uncaught page errors:');
  pageErrors.forEach(e => console.log('      ' + e.split('\n')[0]));
} else {
  ok('no uncaught page errors', true);
}

await browser.close();
console.log('\nResult: ' + passed + ' passed, ' + failed + ' failed');
process.exit(failed ? 1 : 0);
