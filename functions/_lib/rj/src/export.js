// Export opportunities to CSV / JSON (§46). Inline CSV/JSON export for the API lives in api.js (§47).

import { all } from './db.js';

export async function rowsToExport() {
  return all(
    `SELECT id,title,company,opp_type,category,description,url,source,country,geo_eligibility,ghana_eligible,
            remote_status,deadline,estimated_usd,currency,payment_frequency,match_score,scam_risk,verification_status,
            income_potential,strategic_value,recurring,long_term,discovered_at,last_verified,status
     FROM opportunities ORDER BY match_score DESC`,
  );
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

export async function serialize(format = 'csv') {
  const data = await rowsToExport();
  if (format === 'json') return JSON.stringify(data, null, 2);
  const keys = data.length ? Object.keys(data[0]) : ['id'];
  const lines = [keys.map(csvEscape).join(',')];
  for (const r of data) lines.push(keys.map((k) => csvEscape(r[k])).join(','));
  return lines.join('\n');
}