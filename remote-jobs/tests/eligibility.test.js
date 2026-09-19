import { test } from 'node:test';
import assert from 'node:assert/strict';
import { detectGeoEligibility, ghanaAccessibilityScore } from '../src/engines/eligibility.js';

test('detectGeoEligibility flags US-only restrictions', () => {
  const d = detectGeoEligibility('Remote job - must be based in the United States only');
  assert.equal(d.ghana, false);
  assert.ok(/restricted/i.test(d.geo));
});

test('detectGeoEligibility flags "no country restriction" as global', () => {
  const d = detectGeoEligibility('Global remote role, any location welcome');
  assert.equal(d.ghana, true);
});

test('detectGeoEligibility flags explicitly open Ghana references', () => {
  const d = detectGeoEligibility('Open to applicants in Ghana and across Africa');
  assert.equal(d.ghana, true);
  assert.ok(d.evidence.some((e) => /ghana/i.test(e)));
});

test('ghanaAccessibilityScore returns 0 or 100 for clear signals', () => {
  assert.equal(ghanaAccessibilityScore({ title: 'Global remote role any location', description: 'worldwide' }), 100);
  assert.equal(ghanaAccessibilityScore({ title: 'Must be based in the United States', description: 'US only' }), 0);
});

test('ghanaAccessibilityScore returns intermediate for unknowns (no assumption)', () => {
  const s = ghanaAccessibilityScore({ title: 'Some role', description: '', country: '' });
  assert.ok(s > 0 && s < 100);
});