// Deduplication (§27): normalize a listing to a stable key; keep canonical + appearances.

import { createHash } from 'node:crypto';

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^\w\s+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function hashListing({ title, company, url = '', compensationRaw = '' }) {
  const t = norm(title);
  const c = norm(company);
  const u = norm(url);
  const pay = norm(compensationRaw);
  const base = `${t}|${c}|${pay ? pay : u}`;
  return createHash('sha256').update(base).digest('hex').slice(0, 24);
}

export function canonicalUrl(urlStr) {
  const u = String(urlStr || '').trim();
  return u.split('#')[0].split('?')[0].replace(/\/$/, '');
}