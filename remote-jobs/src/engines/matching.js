// Matching + transparent fit scoring (§10, §11). Weights are user-editable in settings.

import { defaultSkills } from '../data/skills.js';

export function defaultWeights() {
  return {
    skill_match: 30,
    ghana: 20,
    payment: 15,
    income: 15,
    application_ease: 5,
    recurring: 5,
    strategic: 5,
    freshness: 5,
  };
}

function slug(s) {
  return String(s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
}

// Skill match: token/keyword overlap between opportunity text and each skill's keywords.
export function matchSkills(title, description) {
  const text = `${slug(title)} ${slug(description)}`;
  const hits = [];
  for (const skill of defaultSkills) {
    let score = 0;
    const kws = [skill.name, ...(skill.keywords || [])];
    for (const kw of kws) {
      const k = slug(kw);
      if (!k) continue;
      if (text.includes(k)) score += k.split(' ').length > 1 ? 3 : 2;
    }
    if (score > 0) {
      hits.push({ id: skill.id, name: skill.name, category: skill.category, level: skill.level, score: Math.min(score, 20) });
    }
  }
  hits.sort((a, b) => b.score - a.score);
  const top = hits.slice(0, 6);
  const skillMatch = top.length ? Math.min(100, Math.round(top.reduce((a, b) => a + b.score, 0) * 4.2)) : 0;
  return { matched: top, skillMatch };
}

function parseUsd(raw, currency, type) {
  const text = String(raw || '').replace(/,/g, '');
  const nums = text.match(/([\d.]+)\s*([kKmM]?)/g);
  let usd = null;
  let found = null;
  if (/\$(?![\d])/.test(String(raw)) && /(annum|year|annual|yearly)/i.test(String(raw))) raw = String(raw).replace(/[^\d.]/g, '');
  const m = String(raw).match(/\$?\s*([\d]+(?:\.\d+)?)\s*(k|K|m|M)?/);
  if (m) {
    const n = parseFloat(m[1]);
    const mult = m[2] ? (m[2].toLowerCase() === 'k' ? 1000 : m[2].toLowerCase() === 'm' ? 1000000 : 1) : 1;
    usd = n * mult;
    found = true;
  } else if (/hour|hr/i.test(type || '')) {
    usd = null;
  }
  if (currency && usd != null && currency !== 'USD') {
    // naive placeholder; currency.js applies exact rates later
  }
  return { usd, found };
}

// Strategy tags (§11) — multiple income strategies, not only hourly freelance.
export function strategyTags(c) {
  const tags = [];
  const t = `${c.title || ''} ${c.description || ''}`.toLowerCase();
  const usd = c.estimatedUsd || 0;

  if (!/[a-z]/i.test(c.oppType === 'grant' ? 'x' : '') || false) {}

  if (['micro_income', 'survey', 'microtask'].includes(c.category || '')) {
    tags.push('cash_now', 'micro_income');
  }
  if (c.applicationEffort && c.applicationEffort <= 2) tags.push('cash_now');
  if (c.deadline && c.applicationEffort <= 2) tags.push('cash_soon');
  if (usd >= 2000 || (usd && usd / (c.timeHours || 40) >= 40)) tags.push('high_value');
  if (c.recurring >= 60) tags.push('recurring');
  if (['employment', 'internship', 'apprenticeship'].includes(c.category || c.oppType || '')) tags.push('career');
  if (['digital_asset', 'course', 'template', 'plugin', 'ai_workflow'].includes(c.category || '')) tags.push('asset');
  if (['expert_network', 'consulting'].includes(c.category || '')) tags.push('network');
  if (c.strategic >= 60) tags.push('strategic');
  if (tags.length === 0) tags.push('cash_soon');
  return [...new Set(tags)];
}

export function computeFit(c, weights = defaultWeights()) {
  const w = { ...defaultWeights(), ...(weights || {}) };
  const comps = {
    skill_match: Math.min(100, c.skillMatch || 0),
    ghana: Math.min(100, c.ghanaScore ?? (c.ghanaEligible ? 100 : c.geoEligibility === 'Worldwide' ? 85 : c.geoEligibility === 'Africa eligible' ? 80 : 40)),
    payment: Math.min(100, c.paymentCompat?.score ?? 70),
    income: Math.min(100, c.incomePotential || 0),
    application_ease: Math.max(0, Math.min(100, 100 - (c.applicationEffort || 3) * 20)),
    recurring: Math.min(100, c.recurring || 0),
    strategic: Math.min(100, c.strategic || 0),
    freshness: Math.min(100, c.freshness || 50),
  };
  const totalWeight = Object.keys(w).reduce((a, k) => a + (w[k] || 0), 0) || 1;
  const fit = Math.round(
    Object.keys(comps).reduce((a, k) => a + (comps[k] || 0) * (w[k] || 0), 0) / totalWeight,
  );
  const contribution = {};
  for (const k of Object.keys(comps)) {
    if (w[k]) contribution[k] = Math.round(((comps[k] || 0) * w[k]) / totalWeight);
  }
  return { fit, components: comps, weights: w, contribution };
}

export function ranksOpportunity(c, weights) {
  const fit = computeFit(c, weights);
  const tags = strategyTags(c);
  // Hidden gem: fit strong, competition low, freshness decent
  const hiddenGem = fit.fit >= 65 && (c.competition || 3) <= 2 && (c.freshness || 50) >= 40;
  return { ...fit, tags, hiddenGem };
}