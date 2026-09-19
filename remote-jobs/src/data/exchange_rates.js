import { row, run, all } from '../db.js';

const SOURCE = 'open.er-api.com';

function safeRate(cur) {
  const r = row('SELECT rate, source, fetched_at FROM exchange_rates WHERE base=? AND quote=?', ['USD', cur]);
  return r;
}

export function usdToGhs() {
  const r = safeRate('GHS');
  return r ? r.rate : 11.55;
}

export function convert(amountUsd, target = 'GHS') {
  if (amountUsd == null) return null;
  const r = safeRate(target);
  if (!r) return { amount: amountUsd, currency: target, note: 'no cached rate' };
  return {
    amount: Number((amountUsd * r.rate).toFixed(2)),
    currency: target,
    rate: r.rate,
    source: r.source,
    fetched_at: r.fetched_at,
  };
}

export async function refreshRates() {
  try {
    const res = await fetch('https://open.er-api.com/v6/latest/USD', { signal: AbortSignal.timeout(15000) });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    const data = await res.json();
    if (!data || !data.rates) throw new Error('bad payload');
    const ts = data.time_last_update_utc || new Date().toISOString();
    const want = ['GHS', 'NGN', 'EUR', 'GBP', 'AUD', 'CAD', 'CHF', 'AED', 'KES'];
    for (const cur of want) {
      if (data.rates[cur] == null) continue;
      run(
        `INSERT INTO exchange_rates(base,quote,rate,source,fetched_at) VALUES(?,?,?,?,?)
         ON CONFLICT(base,quote) DO UPDATE SET rate=excluded.rate, source=excluded.source, fetched_at=excluded.fetched_at`,
        ['USD', cur, data.rates[cur], SOURCE, ts],
      );
    }
    return { ok: true, at: ts, count: want.length, source: SOURCE };
  } catch (e) {
    return { ok: false, error: e.message };
  }
}

export function rateTable() {
  return all('SELECT base, quote, rate, source, fetched_at FROM exchange_rates ORDER BY quote');
}

export { safeRate };