// Deduplication (§27): normalize a listing to a stable key; keep canonical + appearances.

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/&amp;/g, '&')
    .replace(/[^\w\s+]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

const textEncoder = new TextEncoder();

async function sha256Hex(input) {
  const digest = await crypto.subtle.digest('SHA-256', textEncoder.encode(input));
  const bytes = new Uint8Array(digest);
  let hex = '';
  for (const b of bytes) hex += b.toString(16).padStart(2, '0');
  return hex;
}

export async function hashListing({ title, company, url = '', compensationRaw = '' }) {
  const t = norm(title);
  const c = norm(company);
  const u = norm(url);
  const pay = norm(compensationRaw);
  const base = `${t}|${c}|${pay ? pay : u}`;
  const hex = await sha256Hex(base);
  return hex.slice(0, 24);
}

export function canonicalUrl(urlStr) {
  const u = String(urlStr || '').trim();
  return u.split('#')[0].split('?')[0].replace(/\/$/, '');
}