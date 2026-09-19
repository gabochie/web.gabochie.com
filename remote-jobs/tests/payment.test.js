import { test } from 'node:test';
import assert from 'node:assert/strict';
import { scoreOpportunityPayment } from '../src/engines/payment.js';

test('payment scoring routes Upwork through Payoneer/Raenest', () => {
  const p = scoreOpportunityPayment({ source: 'Upwork', title: 'React developer', company: 'ClientCo' });
  assert.equal(p.rail, 'upwork');
  assert.ok(p.routes.some((r) => /payoneer/i.test(r.provider)));
});

test('payment scoring routes anonymous jobs to remote employment rails', () => {
  const p = scoreOpportunityPayment({ source: 'RemoteOK', title: 'Full-time Frontend Engineer', company: 'Startup' });
  assert.equal(p.rail, 'remote_employment');
  assert.ok(p.channels.length > 0);
  assert.ok(p.score >= 0 && p.score <= 100);
});

test('payment scoring detects AI-platform listings', () => {
  const p = scoreOpportunityPayment({ source: 'Manual', title: 'AI trainer for coding models', company: 'Outlier' });
  assert.equal(p.rail, 'ai_platform');
});