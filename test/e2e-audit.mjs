/**
 * E2E smoke tests for the public audit/lead endpoints (production).
 * Usage: node test/e2e-audit.mjs [baseUrl]
 */
const BASE = process.argv[2] || 'https://web.gabochie.com';
let passed = 0, failed = 0;

function check(name, cond, extra) {
  if (cond) { passed++; console.log('  PASS ' + name); }
  else { failed++; console.log('  FAIL ' + name + (extra ? ' — ' + JSON.stringify(extra).slice(0, 200) : '')); }
}

async function post(path, body, headers = {}) {
  const res = await fetch(BASE + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(45000)
  });
  let data = null;
  try { data = await res.json(); } catch (e) { /* non-JSON */ }
  return { status: res.status, data };
}

console.log('== /api/analyze ==');
{
  const r = await post('/api/analyze', { url: 'example.com' });
  check('valid URL -> 200', r.status === 200, r);
  check('has scores', r.data && typeof r.data.total === 'number' && r.data.total >= 10, r.data);
  check('has issues array', r.data && Array.isArray(r.data.issues), r.data);

  const bad = await post('/api/analyze', { url: 'not a url' });
  check('invalid URL -> 400', bad.status === 400, bad);

  const private_ = await post('/api/analyze', { url: 'http://192.168.1.1/admin' });
  check('private IP -> 400', private_.status === 400, private_);

  const dead = await post('/api/analyze', { url: 'this-domain-does-not-exist-gx7q.com' });
  check('dead domain -> 502 + message', dead.status === 502 && dead.data && typeof dead.data.error === 'string', dead);

  const deadTld = await post('/api/analyze', { url: 'real-site-but-nxdomain.invalid' });
  check('dead TLD -> 502 + message', deadTld.status === 502 && deadTld.data && typeof deadTld.data.error === 'string', deadTld);

  const noBody = await fetch(BASE + '/api/analyze', {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{broken'
  });
  check('malformed JSON -> 400', noBody.status === 400, { status: noBody.status });
}

console.log('== /api/lead ==');
{
  const stamp = Date.now();
  const good = await post('/api/lead', {
    name: 'Audit E2E', email: `audit-e2e-${stamp}@example.com`, companyName: 'E2E Co',
    url: 'e2e-test-site.example', source: 'heroForm', message: 'e2e-audit test lead'
  }, { Origin: BASE });
  check('valid lead -> 200', good.status === 200 && good.data && good.data.ok === true, good);

  const noUrl = await post('/api/lead', {
    name: 'Contact E2E', email: `contact-e2e-${stamp}@example.com`, url: '', source: 'Contact Form'
  }, { Origin: BASE });
  check('contact lead (no url) -> 200', noUrl.status === 200 && noUrl.data && noUrl.data.ok === true, noUrl);

  const hp = await post('/api/lead', {
    name: 'Bot', email: 'bot@example.com', website: 'http://spam.example'
  }, { Origin: BASE });
  check('honeypot -> fake success (indistinguishable)', hp.status === 200 && hp.data && hp.data.ok === true, hp);

  const badEmail = await post('/api/lead', { name: 'X', email: 'not-an-email' }, { Origin: BASE });
  check('bad email -> 400', badEmail.status === 400, badEmail);

  const empty = await post('/api/lead', {}, { Origin: BASE });
  check('empty payload -> 400', empty.status === 400, empty);
}

console.log('== /api/send-email lockdown ==');
{
  const evil = await post('/api/send-email', {
    recipients: [{ email: 'victim@example.com' }], subject: 'hi', htmlContent: '<p>spam</p>'
  }, { Origin: 'https://evil.example' });
  check('cross-origin -> 403', evil.status === 403, evil);

  const curl = await post('/api/send-email', {
    recipients: [{ email: 'victim@example.com' }], subject: 'hi', htmlContent: '<p>spam</p>'
  });
  check('no origin/referer -> 403', curl.status === 403, curl);
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
