// Export the desktop GOR radar.db (C:\Users\user\Desktop\gro.gabochie\data\radar.db)
// into a gitignored seed.sql for importing into Cloudflare D1:
//   node scripts/export-d1.mjs [source.db] [out.sql]
//   wrangler d1 execute remote-jobs-db --remote --file=scripts/seed.sql
import { DatabaseSync } from 'node:sqlite';
import { writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';

const src = resolve(process.argv[2] || 'C:/Users/user/Desktop/gro.gabochie/data/radar.db');
const out = resolve(process.argv[3] || 'scripts/seed.sql');

const TABLE_ORDER = [
  'meta', 'skills', 'portfolio', 'sources', 'payment_providers',
  'opportunities', 'applications', 'search_queries', 'discovery_runs',
  'reports', 'alerts', 'settings', 'exchange_rates', 'discovery_notes',
];

const db = new DatabaseSync(src, { readOnly: true });

const esc = (v) => {
  if (v === null || v === undefined) return 'NULL';
  if (typeof v === 'number') return Number.isFinite(v) ? String(v) : 'NULL';
  return `'${String(v).replace(/'/g, "''")}'`;
};

function ddlFor(table) {
  const r = db.prepare("SELECT sql FROM sqlite_master WHERE type='table' AND name=?").get(table);
  if (!r || !r.sql) return null;
  return r.sql.replace(/^CREATE TABLE /, 'CREATE TABLE IF NOT EXISTS ');
}

const lines = [];
lines.push('PRAGMA foreign_keys = OFF;');
lines.push('BEGIN;');
lines.push('');

for (const t of TABLE_ORDER) {
  const ddl = ddlFor(t);
  if (!ddl) { console.log(`skip (no table): ${t}`); continue; }
  const rows = db.prepare(`SELECT * FROM "${t}"`).all();
  lines.push(ddl + ';');
  if (!rows.length) { lines.push(''); continue; }
  const cols = Object.keys(rows[0]);
  const placeholders = cols.map(() => '?').join(',');
  for (const r of rows) {
    const vals = cols.map((c) => esc(r[c])).join(',');
    lines.push(`INSERT OR REPLACE INTO "${t}" (${cols.map((c) => `"${c}"`).join(',')}) VALUES (${vals});`);
  }
  lines.push('');
  console.log(`${t}: ${rows.length} rows`);
}

lines.push('COMMIT;');
mkdirSync(dirname(out), { recursive: true });
writeFileSync(out, lines.join('\n'), 'utf8');
console.log(`Wrote ${out} (${(lines.join('\n').length / 1024).toFixed(1)} KB).`);