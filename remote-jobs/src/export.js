// Export opportunities to CSV / JSON (§46). §47 JSON API is served by server.js too.

import fs from 'node:fs';
import path from 'node:path';
import { all } from './db.js';
import { config } from './config.js';
import { todayStr } from './engines/analytics.js';

function rows() {
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

export function serialize(format = 'csv') {
  const name = `opportunities_${todayStr()}.${format}`;
  const file = path.join(config.dataDir, name);
  const data = rows();
  if (format === 'json') {
    fs.writeFileSync(file, JSON.stringify(data, null, 2));
  } else {
    const keys = data.length ? Object.keys(data[0]) : ['id'];
    const lines = [keys.map(csvEscape).join(',')];
    for (const r of data) lines.push(keys.map((k) => csvEscape(r[k])).join(','));
    fs.writeFileSync(file, lines.join('\n'));
  }
  return file;
}