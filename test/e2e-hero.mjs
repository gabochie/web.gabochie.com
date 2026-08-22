/**
 * Browser E2E for the marketing site forms (production).
 * Usage: node test/e2e-hero.mjs [baseUrl]
 */
import { chromium } from 'playwright';

const BASE = process.argv[2] || 'https://web.gabochie.com';
let passed = 0, failed = 0;
const check = (name, cond) => {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name); }
};

const sleep = ms => new Promise(r => setTimeout(r, ms));

async function waitFor(predicate, timeoutMs = 30000, intervalMs = 500) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const v = predicate();
    if (v) return v;
    await sleep(intervalMs);
  }
  return null;
}

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage();
const pageErrors = [];
let leadPosts = 0;
page.on('pageerror', e => pageErrors.push(String(e)));
page.on('response', r => {
  if (r.url().includes('/api/lead')) { leadPosts++; console.log('  [net] /api/lead #' + leadPosts, '->', r.status()); }
});

try {
  await page.goto(BASE + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  check('no firebase scripts on page', await page.locator('script[src*="firebase"]').count() === 0);
  check('no firestore calls (FirebaseService undefined)', await page.evaluate(() => typeof window.FirebaseService === 'undefined'));

  await page.fill('#heroName', 'Hero E2E');
  await page.fill('#heroEmail', `hero-e2e-${Date.now()}@example.com`);
  await page.fill('#heroUrl', 'https://example.com');
  await page.selectOption('#heroIndustry', 'Technology');
  await page.click('#heroSubmitBtn');

  const heroLeadSeen = await waitFor(() => leadPosts >= 1, 20000);
  check('hero form POST reached /api/lead', Boolean(heroLeadSeen));

  // Poll the rendered score from the node side
  let score = '';
  const scoreDeadline = Date.now() + 45000;
  while (Date.now() < scoreDeadline) {
    const t = await page.evaluate(() => {
      const el = document.getElementById('heroScoreTotal');
      return el && el.textContent && el.textContent !== '—' ? el.textContent.trim() : '';
    });
    if (t) { score = t; break; }
    await sleep(500);
  }

  check('hero analysis rendered a score: ' + score, /\/100/.test(score));
  if (!/\/100/.test(score)) {
    console.log('  [diag] issues list: ' + String(await page.textContent('#heroIssuesList')).trim().slice(0, 200));
  }
  check('no uncaught page errors', pageErrors.length === 0);

  await page.fill('#cName', 'Contact E2E');
  await page.fill('#cEmail', `contact-e2e-${Date.now()}@example.com`);
  await page.fill('#cMessage', 'browser e2e contact test');
  const postsBeforeContact = leadPosts;
  await page.click('#contactForm button[type="submit"]');

  const contactLeadSeen = await waitFor(() => leadPosts > postsBeforeContact, 20000);
  check('contact form POST reached /api/lead', Boolean(contactLeadSeen));

  // Final toast must reflect a handled response (success or honest rate-limit)
  let toastOk = false;
  const deadline = Date.now() + 15000;
  while (Date.now() < deadline && !toastOk) {
    const txt = await page.evaluate(() => {
      const t = document.getElementById('toast');
      return t && t.textContent ? t.textContent.trim() : '';
    });
    toastOk = /Message sent|reply within|too many requests|in touch/i.test(txt);
    if (!toastOk) await sleep(500);
  }
  check('form responses surfaced via toast', toastOk);
} catch (e) {
  failed++;
  console.log('  FAIL exception: ' + String(e).slice(0, 300));
}

await browser.close();
console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
