import { test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';

const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'gor-test-'));
process.env.DB_PATH = path.join(tmpDir, 'test.db');
process.env.DATA_DIR = tmpDir;

const { db, all, row } = await import('../src/db.js');
const { seedAll } = await import('../src/seed.js');
const defaultSkills = (await import('../src/data/skills.js')).defaultSkills;
const defaultPaymentProviders = (await import('../src/data/seed_payments.js')).defaultPaymentProviders;
const { generateDailyReport, latestReport } = await import('../src/engines/report.js');
const { buildApplicationPlan } = await import('../src/engines/application.js');

beforeEach(async () => {
  await (await db()).exec('DELETE FROM opportunities');
});

test('seedAll populates all reference tables', async () => {
  await seedAll({ refreshFx: false });
  assert.ok((await row('SELECT COUNT(*) c FROM skills')).c >= 10);
  assert.equal((await row('SELECT COUNT(*) c FROM payment_providers')).c, defaultPaymentProviders.length);
  assert.ok((await row('SELECT COUNT(*) c FROM sources')).c >= 20);
  assert.ok((await row('SELECT COUNT(*) c FROM opportunities')).c >= 10);
});

test('seeding is idempotent (no duplicate opportunities)', async () => {
  await seedAll({ refreshFx: false });
  const first = (await row('SELECT COUNT(*) c FROM opportunities')).c;
  await seedAll({ refreshFx: false });
  const second = (await row('SELECT COUNT(*) c FROM opportunities')).c;
  assert.equal(first, second);
});

test('seeded opportunities carry Ghana payment compatibility data', async () => {
  await seedAll({ refreshFx: false });
  const opp = (await all('SELECT * FROM opportunities LIMIT 1'))[0];
  const pay = JSON.parse(opp.ghana_payment_compat || '{}');
  assert.ok(Array.isArray(pay.channels) && pay.channels.length > 0, 'expected payment channels');
});

test('buildApplicationPlan returns usable plan for a seed opportunity', async () => {
  await seedAll({ refreshFx: false });
  const opp = (await all('SELECT * FROM opportunities LIMIT 1'))[0];
  const plan = await buildApplicationPlan(opp);
  assert.ok(plan.checklist.length >= 3);
  assert.ok(typeof plan.proposal === 'string' && plan.proposal.length > 80);
  assert.ok(plan.paymentRoute.length > 0);
});

test('daily report generation works on seeded data', async () => {
  await seedAll({ refreshFx: false });
  const res = await generateDailyReport();
  assert.ok(res.id);
  const rep = await latestReport('daily');
  assert.ok(rep && rep.content.length > 200);
});

test('db helpers roundtrip meta settings and values', async () => {
  await (await db()).exec('INSERT OR REPLACE INTO settings(key, value) VALUES(\'test_key\',\'v1\')');
  const v = await row('SELECT value FROM settings WHERE key=?', ['test_key']);
  assert.equal(v.value, 'v1');
});