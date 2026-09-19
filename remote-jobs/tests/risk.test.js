import { test } from 'node:test';
import assert from 'node:assert/strict';
import { assessRisk } from '../src/engines/risk.js';

test('assessRisk marks money-upfront scams as high risk', () => {
  const r = assessRisk('Earn $5000/day from home!', 'Pay a small application fee first to unlock your account.', 'SomeBoard', 'Mystery Corp');
  assert.equal(r.risk, 'high risk');
  assert.ok(r.reasons.some((x) => /application fee/i.test(x.label) || /upfront|fee/i.test(x.label)));
});

test('assessRisk keeps a normal listing legit', () => {
  const r = assessRisk('Senior React Engineer', 'Full-time remote role building web applications for our platform.', 'RemoteOK', 'Acme Inc');
  assert.equal(r.risk, 'probably legitimate');
  assert.ok(Array.isArray(r.reasons));
});

test('assessRisk catches pay-to-work and crypto-deposit schemes', () => {
  const results = [
    assessRisk('AI training tasker', 'You must purchase credits to access the task queue and start earning.', 'x', 'x'),
    assessRisk('Data entry role', 'Send us USDT to reserve your seat; refundable after 28 days.', 'x', 'x'),
  ];
  for (const r of results) assert.equal(r.risk, 'high risk');
});