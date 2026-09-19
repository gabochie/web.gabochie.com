// Agent pipeline (§42, §26): Scout → Normalize → Dedupe → Eligibility → Risk → Match → Payment → Economics → Store.

import { randomUUID } from 'node:crypto';
import { all, row, run } from '../db.js';
import { log } from '../logger.js';
import { config } from '../config.js';
import { fetchSource } from './adapters.js';
import { hashListing } from '../engines/dedup.js';
import { detectGeoEligibility, ghanaAccessibilityScore } from '../engines/eligibility.js';
import { assessRisk } from '../engines/risk.js';
import { matchSkills, computeFit, defaultWeights } from '../engines/matching.js';
import { scoreOpportunityPayment } from '../engines/payment.js';
import { estimateEconomics } from '../engines/economics.js';
import { loadWeights } from '../engine_utils.js';
import { usdToGhs } from '../data/exchange_rates.js';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function runDiscovery({ maxPerSource } = {}) {
  maxPerSource = maxPerSource || config.discovery.maxPerSource;
  const runId = run('INSERT INTO discovery_runs(started_at, mode) VALUES(?,?)', [new Date().toISOString(), config.discovery.mode]).lastInsertRowid;
  const sources = all(`SELECT * FROM sources WHERE enabled=1 AND feed_url != '' AND access_method IN (?,?,?) ORDER BY last_success ASC`, ['rss', 'json', 'html']);

  let newCount = 0;
  let dupCount = 0;
  let rejCount = 0;
  let fetchCount = 0;
  let okSources = 0;
  const errors = [];

  for (const src of sources) {
    if (!src.feed_url) continue;
    try {
      const items = await fetchSource(src.access_method, src.feed_url);
      const capped = items.slice(0, maxPerSource);
      fetchCount += capped.length;
      log.info(`[scout] ${src.name}: ${capped.length} items`);
      let srcNew = 0;
      for (const item of capped) {
        const result = ingestListing(item, src);
        if (result.status === 'new') { newCount++; srcNew++; }
        else if (result.status === 'dup') dupCount++;
        else if (result.status === 'rejected') rejCount++;
      }
      run('UPDATE sources SET last_scanned=?, last_success=?, last_count=? WHERE id=?',
        [new Date().toISOString(), new Date().toISOString(), srcNew, src.id]);
      okSources++;
      await sleep(config.discovery.politeDelayMs);
    } catch (e) {
      errors.push({ source: src.name, error: e.message });
      run('UPDATE sources SET last_scanned=? WHERE id=?', [new Date().toISOString(), src.id]);
      log.warn(`[scout] ${src.name} failed: ${e.message}`);
    }
  }

  run('UPDATE discovery_runs SET finished_at=?, sources_attempted=?, sources_succeeded=?, items_fetched=?, items_new=?, items_duplicate=?, items_rejected=?, errors=?',
    [new Date().toISOString(), sources.length, okSources, fetchCount, newCount, dupCount, rejCount, JSON.stringify(errors)]);

  return { runId, sourcesAttempted: sources.length, sourcesSucceeded: okSources, fetched: fetchCount, added: newCount, dupes: dupCount, rejected: rejCount, errors };
}

export function ingestListing(item, src) {
  const title = String(item.title || '').trim();
  if (!title || title.length < 5) return { status: 'rejected', reason: 'empty title' };
  const h = hashListing(item);
  const existing = row('SELECT id, duplicate_of FROM opportunities WHERE normalized_hash=?', [h]);
  if (existing) return { status: 'dup', existing: existing.duplicate_of || existing.id };

  // Eligibility
  const elig = detectGeoEligibility(`${title} ${item.description}`);
  const ghana = ghanaAccessibilityScore(item);

  // Risk
  const risk = assessRisk(title, item.description, src.name, item.company);

  // if hard-rejected skip storing
  if (risk.risk === 'high risk') {
    return { status: 'rejected', reason: risk.reasons.map((r) => r.label).join('; ') };
  }

  // Match + payment + economics
  const match = matchSkills(title, item.description);
  const payment = scoreOpportunityPayment({ source: src.name, title, company: item.company });

  const estimatedUsd = parseEstimatedUsd(item.compensation_raw);
  const economics = estimateEconomics(item.compensation_raw, 'USD', { rateUsdGhs: usdToGhs() });

  const now = new Date().toISOString();
  const id = randomUUID();

  const base = {
    title,
    company: item.company || '',
    opp_type: inferType(src, title),
    category: src.categories ? (JSON.parse(src.categories) || [])[0] || 'other' : 'other',
    description: (item.description || '').slice(0, 4000),
    url: item.url || ctxUrl(src),
    source: src.name,
    source_url: src.url,
    country: item.country || src.country || '',
    geo_eligibility: elig.geo,
    ghana_eligible: ghana >= 80 ? 1 : 0,
    ghana_eligibility_evidence: JSON.stringify(elig),
    skills: JSON.stringify(match.matched),
    compensation_raw: item.compensation_raw || '',
    estimated_usd: estimatedUsd,
    payment_methods: JSON.stringify(payment.routes.map((r) => r.provider)),
    ghana_payment_compat: JSON.stringify(payment),
    freshness: 90,
    source_reliability: src.reliability,
    scam_risk: risk.risk,
    scam_reasons: JSON.stringify(risk.reasons),
    verification_status: eligibilityVerification(ghana),
    income_potential: economics.valid ? (economics.effectiveHourlyUsd >= 40 ? 90 : economics.effectiveHourlyUsd >= 15 ? 70 : 45) : 30,
    strategic_value: 50,
    skill_growth: 40,
    recurring: 40,
    long_term: 40,
    economics: JSON.stringify(economics),
    discovered_at: now,
    last_verified: now,
  };
  const fit = computeFit({ ...base, skillMatch: match.skillMatch, ghanaScore: ghana, paymentCompat: payment, applicationEffort: 3, recurring: base.recurring, strategic: base.strategic_value, freshness: 90, ghanaEligible: ghana === 100 }, loadWeights());
  const stock = { ...base, match_score: fit.fit, score_breakdown: JSON.stringify(fit) };

  const keys = Object.keys(stock);
  const sql = `INSERT INTO opportunities (id, normalized_hash, ${keys.join(',')}) VALUES (?, ?, ${keys.map(() => '?').join(',')})`;
  run(sql, [id, h, ...keys.map((k) => stock[k])]);
  return { status: 'new', id };
}

function parseEstimatedUsd(raw) {
  const m = String(raw || '').match(/([\d.,]+)\s?(k|K|m|M)?/);
  if (!m) return null;
  let n = parseFloat(m[1].replace(/,/g, ''));
  if (m[2] && m[2].toLowerCase() === 'k') n *= 1000;
  if (m[2] && m[2].toLowerCase() === 'm') n *= 1000000;
  return n;
}

function inferType(src, title) {
  const t = `${title} ${src.type}`.toLowerCase();
  if (/grant|fellowship|competition|prize|accelerator|incubator/.test(t)) return 'building';
  if (/contract|consult|consultant/.test(t)) return 'consulting';
  if (/expert|network|glg|guidepoint/.test(t)) return 'expert';
  if (/freelanc|gig|upwork|fiverr/.test(t)) return 'freelance';
  if (/ai|annotation|evaluat|trainer|label|red team|rater/.test(t)) return 'ai';
  if (/full.?time|job|employment|remote|hiring/.test(t)) return 'employment';
  return 'opportunity';
}

function ctxUrl(src) {
  return src.url || '';
}

function eligibilityVerification(score) {
  if (score >= 80) return 'Ghana eligible (rule match)';
  if (score === 0) return 'Country-restricted';
  return 'Needs verification';
}