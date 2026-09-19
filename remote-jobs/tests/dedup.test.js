import { test } from 'node:test';
import assert from 'node:assert/strict';
import { hashListing, canonicalUrl } from '../src/engines/dedup.js';

test('hashListing is deterministic per listing', () => {
  const a = { title: 'Senior React Engineer', company: 'Acme', url: 'https://x.io/job/1' };
  assert.equal(hashListing(a), hashListing({ ...a }));
});

test('hashListing differs for different listings', () => {
  const a = hashListing({ title: 'Senior React Engineer', company: 'Acme', url: 'https://x.io/job/1' });
  const b = hashListing({ title: 'Senior Go Engineer', company: 'Acme', url: 'https://x.io/job/1' });
  assert.notEqual(a, b);
});

test('canonicalUrl normalizes trailing slash and hash', () => {
  const a = canonicalUrl('https://example.com/jobs/123/');
  const b = canonicalUrl('https://example.com/jobs/123');
  assert.equal(a, b);
  assert.ok(a.startsWith('https://example.com/jobs/123'));
});