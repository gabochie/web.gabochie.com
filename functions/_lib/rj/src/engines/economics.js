// Opportunity economics (§20): transparent net-income estimates from advertised values.

export function estimateEconomics(raw, currency = 'USD', { rateUsdGhs } = {}) {
  const m = String(raw || '').match(/([\d.,]+)\s?(k|K|m|M)?/);
  let usd = null;
  let unit = 'unknown';
  let advertised = raw;

  if (/per? ?hour|\/ ?hr|\$[\d.]+\/ ?hour/i.test(String(raw))) {
    const h = String(raw).match(/[\d.,]+/);
    usd = h ? parseFloat(h[0].replace(/,/g, '')) : null;
    unit = 'hourly';
  } else if (/month|mo\b/i.test(String(raw))) {
    const n = String(raw).match(/[\d.,]+/);
    usd = n ? parseFloat(n[0].replace(/,/g, '')) : null;
    unit = 'monthly';
  } else if (/year|annual|annum|pa\b/i.test(String(raw))) {
    const n = String(raw).match(/[\d.,]+/);
    usd = n ? parseFloat(n[0].replace(/,/g, '')) : null;
    unit = 'yearly';
  } else if (m) {
    usd = parseFloat(m[1].replace(/,/g, ''));
    if (m[2] && m[2].toLowerCase() === 'k') usd *= 1000;
    if (m[2] && m[2].toLowerCase() === 'm') usd *= 1000000;
    unit = 'project';
  }

  if (usd == null) return { valid: false, reason: 'no numeric compensation found' };

  const ghs = (r) => (r == null ? null : Number((usd * r).toFixed(0)));
  const platformFee = estimatePlatformFee(usd, unit);
  const paymentFee = Math.max(3, usd * 0.02); // 2% typical blended (Payoneer/wire/convert) - ESTIMATE
  const net = Math.max(0, usd - platformFee - paymentFee);
  const hours = unit === 'hourly' ? 1 : 8; // 1 day for project assumed for hourly-adjacent display
  const hourly = unit === 'yearly' ? usd / 1040 : unit === 'monthly' ? usd / 160 : unit === 'hourly' ? usd : usd / 20;

  return {
    valid: true,
    advertised: String(advertised),
    currency,
    unit,
    grossUsd: usd,
    ghs: ghs(rateUsdGhs),
    platformFeeUsd: Math.round(platformFee),
    paymentFeeUsd: Math.round(paymentFee),
    estimatedNetUsd: Math.round(net),
    estimatedHours: unit === 'hourly' ? 1 : 40,
    effectiveHourlyUsd: Math.round(hourly * 100) / 100,
    labels: {
      note: 'All figures are ESTIMATES. Platform and payment fees vary. Show gross first.',
    },
  };
}

function estimatePlatformFee(usd, unit) {
  // Known 2026 anchors: Upwork service fee 0-15% (avg ~10%), Fiverr 20%, marketplace card fees ~2-5%.
  // We use a conservative blended estimate, clearly labelled.
  const pct = unit === 'project' ? 0.1 : 0.1;
  return usd * pct;
}