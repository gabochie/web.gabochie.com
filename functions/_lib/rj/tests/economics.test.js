import { test } from 'node:test';
import assert from 'node:assert/strict';
import { estimateEconomics } from '../src/engines/economics.js';

test('estimateEconomics parses annual salary', () => {
  const e = estimateEconomics('$60,000/year', 'USD', { rateUsdGhs: 11.55 });
  assert.equal(e.valid, true);
  assert.equal(e.hourlyUsd, undefined); // uses effectiveHourlyUsd (1040 working hours/year)
  assert.ok(e.effectiveHourlyUsd > 50); // 60000/1040 ~= 57.7
});

test('estimateEconomics parses hourly rates', () => {
  const e = estimateEconomics('$25/hour', 'USD', { rateUsdGhs: 11.55 });
  assert.equal(e.valid, true);
  assert.equal(e.effectiveHourlyUsd, 25);
});

test('estimateEconomics converts to GHS', () => {
  const e = estimateEconomics('$25/hour', 'USD', { rateUsdGhs: 11.55 });
  assert.equal(e.ghs, Math.round(25 * 11.55));
});

test('estimateEconomics handles unknown compensation gracefully', () => {
  const e = estimateEconomics('negotiable', 'USD', { rateUsdGhs: 11.55 });
  assert.equal(e.valid, false);
});