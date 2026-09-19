import { test } from 'node:test';
import assert from 'node:assert/strict';
import { defaultWeights, matchSkills, computeFit, strategyTags, ranksOpportunity } from '../src/engines/matching.js';

test('default weights sum to 100', () => {
  const w = defaultWeights();
  const total = Object.values(w).reduce((a, b) => a + b, 0);
  assert.equal(total, 100);
});

test('matchSkills finds known skills in a title/description', () => {
  const res = matchSkills('Senior WordPress Developer for headless CMS', 'We need strong PHP and MySQL experience.');
  assert.ok(res.matched.length > 0, 'expected some matched skills');
  assert.ok(res.skillMatch > 0, 'expected a positive skill match score');
});

test('matchSkills no-op string yields low match', () => {
  const res = matchSkills('Nondescript gig listing', 'Generic text with no relevant keywords at all here.');
  assert.equal(res.matched.length, 0);
  assert.equal(res.skillMatch, 0);
});

test('computeFit produces a bounded score with components', () => {
  const fit = computeFit({ title: 'A', skillMatch: 80, ghanaScore: 70, paymentCompat: { score: 60 }, ghanaEligible: true });
  assert.ok(fit.fit >= 0 && fit.fit <= 100);
  assert.ok(fit.components && typeof fit.components === 'object');
  assert.ok('skill_match' in fit.components);
  assert.ok('payment' in fit.components);
});

test('strategyTags categorize by opportunity type', () => {
  const tags = strategyTags({ opp_type: 'freelance', category: 'freelance', estimatedUsd: 5000, recurring: 70 });
  assert.ok(Array.isArray(tags));
  assert.ok(tags.some((t) => typeof t === 'string'));
});

test('ranksOpportunity returns fit, tags and hiddenGem flag', () => {
  const r = ranksOpportunity({ title: 'Senior React Engineer', category: 'employment', estimatedUsd: 80000, recurring: 90, competition: 2, freshness: 80, skillMatch: 85, ghanaEligible: true });
  assert.ok(r.fit >= 0 && r.fit <= 100);
  assert.ok(Array.isArray(r.tags));
  assert.equal(typeof r.hiddenGem, 'boolean');
});