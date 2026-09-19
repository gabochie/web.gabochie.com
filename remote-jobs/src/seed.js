// Seed the database with researched registries (§52 STEP 6). Safe to re-run.

import { randomUUID } from 'node:crypto';
import { db, run, all, row, setMeta, setSetting } from './db.js';
import { log } from './logger.js';
import { defaultSkills, defaultPortfolio } from './data/skills.js';
import { defaultPaymentProviders } from './data/seed_payments.js';
import { defaultSources, defaultQueries } from './data/seed_sources.js';
import { defaultWeights } from './engines/matching.js';
import { refreshRates } from './data/exchange_rates.js';
import { assessRisk } from './engines/risk.js';
import { matchSkills, computeFit, strategyTags } from './engines/matching.js';
import { detectGeoEligibility, ghanaAccessibilityScore } from './engines/eligibility.js';
import { scoreOpportunityPayment } from './engines/payment.js';
import { estimateEconomics } from './engines/economics.js';
import { usdToGhs } from './data/exchange_rates.js';
import { loadWeights } from './engine_utils.js';

const now = () => new Date().toISOString();
export const SEED_DATE = '2026-09-19';

export async function seedAll({ refreshFx = true } = {}) {
  db();
  db().exec('BEGIN');
  try {
    seedSkills();
    seedPortfolio();
    seedSources();
    seedPayments();
    seedQueries();
    seedSettings();
    db().exec('COMMIT');
  } catch (e) {
    db().exec('ROLLBACK');
    throw e;
  }

  const fx = refreshFx ? await refreshRates() : { ok: false, error: 'skipped' };
  if (!fx.ok) log.warn('Exchange-rate refresh failed (offline?):', fx.error);

  const seeded = seedOpportunities();
  setMeta('last_seed', now());
  setMeta('seed_date', SEED_DATE);
  log.info(`Seed complete. Opportunities: ${seeded}. FX: ${fx.ok ? 'refreshed' : fx.error}`);
  return { seeded, fx };
}

function upsert(table, rows, key) {
  const existing = new Set(all(`SELECT ${key} FROM ${table}`).map((r) => r[key]));
  let inserted = 0, updated = 0;
  const cols = rows.length ? Object.keys(rows[0]).filter((k) => k !== key) : [];
  for (const r of rows) {
    const vals = cols.map((c) => r[c]);
    if (existing.has(r[key])) {
      const sets = cols.map((c) => `${c}=?`).join(',');
      run(`UPDATE ${table} SET ${sets} WHERE ${key}=?`, [...vals, r[key]]);
      updated++;
      continue;
    }
    run(`INSERT INTO ${table} (${key},${cols.join(',')}) VALUES (${['?', ...cols.map(() => '?')].join(',')})`, [r[key], ...vals]);
    inserted++;
  }
  return { inserted, updated };
}

function seedSkills() {
  upsert('skills', defaultSkills.map((s) => ({ id: s.id, name: s.name, category: s.category || '', level: s.level, market_demand: s.market_demand ?? 50, learning_priority: s.level <= 2 ? 3 : 2, keywords: JSON.stringify(s.keywords || []), updated_at: now() })), 'id');
}

function seedPortfolio() {
  upsert('portfolio', defaultPortfolio.map((p) => ({ id: p.id, title: p.title, skills: JSON.stringify(p.skills || []), industry: p.industry || '', tools: JSON.stringify([]), problem: p.problem || '', outcome: p.outcome || '', url: '', case_study: '', categories: JSON.stringify(p.categories || []) })), 'id');
}

function seedSources() {
  upsert('sources', defaultSources.map((s) => ({
    id: s.id, name: s.name, url: s.url || '', type: s.type || 'manual', country: s.country || 'Global',
    categories: JSON.stringify(s.categories || []), access_method: s.access_method || 'manual',
    feed_url: s.feed_url || '', update_freq: s.update_freq || 'weekly', reliability: s.reliability || 'needs verification',
    terms_status: s.terms_status || '', enabled: s.enabled ?? 1, notes: s.notes || '',
  })), 'id');
}

function seedPayments() {
  upsert('payment_providers', defaultPaymentProviders.map((p) => ({
    id: p.id, name: p.name, url: p.url || '', ghana_signup: p.ghana_signup || 'unknown',
    can_receive: p.can_receive || 'unknown', withdraw_bank: p.withdraw_bank || 'unknown', mobile_money: p.mobile_money || 'unknown',
    supported_currencies: p.supported_currencies || '', fees: p.fees || '', min_withdraw: p.min_withdraw || '',
    kyc: p.kyc || '', tax_notes: p.tax_notes || '', restrictions: p.restrictions || '', profile_type: p.profile_type || '',
    verified_date: p.verified_date || SEED_DATE, source: p.source || '', confidence: p.confidence || 'unknown',
    status: p.status || 'needs verification', notes: p.notes || '',
  })), 'id');
}

function seedQueries() {
  upsert('search_queries', defaultQueries.map((q, i) => ({ id: 'q' + i, query: q, status: 'active', runs: 0 })), 'id');
}

function seedSettings() {
  setSetting('weights', defaultWeights());
  setSetting('any_task_mode', false);
  setSetting('profile', {
    name: 'User',
    country: 'Ghana',
    timezone: 'Africa/Accra',
    location: 'Ghana (Accra)',
    positioning: ['Architectural/BIM professional', 'AEC technology specialist', 'AI automation specialist', 'WordPress/digital solutions specialist', 'Business development consultant'],
    note: 'Editable via Settings.',
  });
}

// ---- Starter opportunity dataset ----
// Anchored to real platforms/companies discovered in research on 2026-09-19.
// Application URLs point at the platform/company page (NOT a fabricated job URL).
// verification_status: "Needs verification via platform page" where we have not personally confirmed an open role.

function seedOpportunities() {
  const listings = [
    {
      title: 'Freelance Full-Stack Web App Developer (Africa-remote)',
      company: 'Regional tech employer (Remote4Africa listing)',
      opp_type: 'freelance',
      category: 'Freelance',
      description: 'Full-stack web app development contract open to African countries including Ghana. Example of the Africa-wide web development demand visible on Remote4Africa in Sep 2026. Pay range advertised US$31k-62k equivalent.',
      url: 'https://remote4africa.com/jobs',
      apply_url: 'https://remote4africa.com/register',
      source: 'Remote4Africa',
      source_url: 'https://remote4africa.com/jobs/region/ghana',
      country: 'Africa',
      compensation_raw: 'US$31,200 - US$62,400 (annual equivalent)',
      deadline: '',
      skills_hint: ['web-dev', 'wordpress', 'no-code', 'apis'],
      estimated_usd_override: 32400,
      application_effort: 3,
      recurring: 70,
      strategic: 70,
      note: 'Type example from research; find the specific live post on Remote4Africa.',
    },
    {
      title: 'Manual QA Tester — remote (Ghana-tagged)',
      company: 'Boolearn/Recruiter via Remote4Africa (GH)',
      opp_type: 'employment',
      category: 'Employment',
      description: 'Ghana-tagged, fully remote QA tester role listed on Remote4Africa (Sep 4, 2026). Representative of entry-level remote testing demand explicitly hiring in Ghana.',
      url: 'https://remote4africa.com/jobs/region/ghana',
      apply_url: 'https://remote4africa.com/register',
      source: 'Remote4Africa',
      source_url: 'https://remote4africa.com/jobs/region/ghana',
      country: 'Ghana',
      compensation_raw: '',
      deadline: '',
      skills_hint: ['qa', 'web-research', 'data'],
      estimated_usd_override: null,
      application_effort: 1,
      recurring: 60,
      strategic: 40,
      note: 'Type example from research (Sep 4 2026 listing); verify the live opening.',
    },
    {
      title: 'Customer Support Agent (remote, Ghana-friendly)',
      company: 'Global support provider (via Remote4Africa/DailyRemote)',
      opp_type: 'employment',
      category: 'Employment',
      description: 'Fully remote customer support / admin roles explicitly tagged Ghana. Seen in Multiple boards (Remote4Africa GH, DailyRemote Ghana) around Sep 2026. Good "cash now" any-task-mode opportunity.',
      url: 'https://dailyremote.com/remote-jobs-in-ghana',
      apply_url: 'https://dailyremote.com/remote-jobs-in-ghana',
      source: 'DailyRemote + Remote4Africa',
      source_url: 'https://dailyremote.com/remote-jobs-in-ghana',
      country: 'Global (Ghana open)',
      compensation_raw: 'US$8-15/hour',
      deadline: '',
      skills_hint: ['customer-support', 'virtual-assist', 'transcription'],
      estimated_usd_override: 12,
      application_effort: 1,
      recurring: 70,
      strategic: 30,
      note: 'Type example; verify live listing.',
    },
    {
      title: 'Data Annotator — AI careers (Ghana, KOICA partnership)',
      company: 'Datamaker / KOICA IBS Programme (Ghana)',
      opp_type: 'ai',
      category: 'AI Economy',
      description: 'Ghana Labour Market listing: Data Annotator jobs at Datamaker open to KOICA-IBS ICT scholarship graduates - image/text/video/3D point-cloud annotation. Posted via GLMIS (Ghana Labour Market Information System).',
      url: 'https://www.glmis.gov.gh/JobPostings/JobDetails/2051',
      apply_url: 'https://www.glmis.gov.gh',
      source: 'GLMIS Ghana',
      source_url: 'https://www.glmis.gov.gh',
      country: 'Ghana',
      compensation_raw: '',
      deadline: '',
      skills_hint: ['ai-research', 'data', 'ai-automation'],
      estimated_usd_override: null,
      application_effort: 2,
      recurring: 60,
      strategic: 40,
      note: 'Real listing found 2026-09-19 on GLMIS (posted ~21 months prior). Still verify current intake.',
    },
    {
      title: 'AI data/training contributor (Ghana context) — Outlier/Mercor/Turing family',
      company: 'AI training platforms (sign up individually)',
      opp_type: 'ai',
      category: 'AI Economy',
      description: 'AI training & evaluation contributor work. 2026 rates: Outlier generalists $12-18/hr, coding/experts $22-60/hr; Mercor $25-75/hr typical with experts to $250/hr; Turing $50-100+/hr coding. Ghana eligibility must be verified at signup - platforms list "100+ countries" but do not publish Ghana explicitly.',
      url: 'https://outlier.ai',
      apply_url: 'https://outlier.ai',
      source: 'SignalGigs / AITraining.jobs research (Sep 2026)',
      source_url: 'https://aitraining.jobs/roles/coding',
      country: '100+ countries (verify Ghana)',
      compensation_raw: 'US$12-75/hour (platform-dependent)',
      deadline: '',
      skills_hint: ['ai-research', 'ai-automation', 'web-research', 'writing'],
      estimated_usd_override: null,
      application_effort: 2,
      recurring: 80,
      strategic: 60,
      note: 'DataAnnotation is US/UK/CA/AU/NZ ONLY - excluded for Ghana. Verify each platform at signup.',
    },
    {
      title: 'Expert network consult (architecture/AEC + Ghana market) — GLG, Guidepoint, AlphaSights',
      company: 'GLG / Guidepoint / AlphaSights',
      opp_type: 'expert',
      category: 'Expert Networks',
      description: 'Paid expert consultations for investors/consultants. GLG: set your own rate, direct deposit. Guidepoint typical $100-500/hr. AlphaSights similar. Your Ghana market + AEC + construction-cost + digital knowledge is a differentiated profile for Africa-focused research calls.',
      url: 'https://glg.com/for-experts',
      apply_url: 'https://glg.com/for-experts',
      source: 'GLG / Guidepoint / AlphaSights (Sep 2026)',
      source_url: 'https://app.myexpertnetwork.ai/expert-networks',
      country: 'Global (verify Ghana payout)',
      compensation_raw: 'US$100-500+/hour',
      deadline: '',
      skills_hint: ['arch-design', 'africa-market', 'market-research', 'construction-tech', 'strategy'],
      estimated_usd_override: 150,
      application_effort: 2,
      recurring: 85,
      strategic: 90,
      note: 'Payout method for Ghana (wire/ACH) must be confirmed at onboarding.',
    },
    {
      title: 'International development consultant (remote, Africa) — UN/World Bank/AfDB contract',
      company: 'UN System / World Bank / AfDB',
      opp_type: 'consulting',
      category: 'Development',
      description: 'Short-term consultancy and call-for-experts with UN agencies, World Bank and AfDB — many remote/field-advisory roles open to Ghanaian experts (e.g., construction cost, digital transformation, research). Tracked via unjobs.org, ReliefWeb jobs, World Bank/AfDB careers.',
      url: 'https://unjobs.org',
      apply_url: 'https://unjobs.org',
      source: 'UN Jobs / World Bank / AfDB (Sep 2026)',
      source_url: 'https://reliefweb.int/jobs',
      country: 'Global (Ghana eligible)',
      compensation_raw: 'US$5,000-30,000 per contract (varies)',
      deadline: '',
      skills_hint: ['strategy', 'proposals', 'market-research', 'africa-market', 'web-research'],
      estimated_usd_override: 12000,
      application_effort: 4,
      recurring: 60,
      strategic: 95,
      note: 'Consultant roster/individual-consultant (IC) contracts; competitive but net $5k-15k typical for short IC stints.',
    },
    {
      title: 'Tony Elumelu Foundation Entrepreneurship Programme',
      company: 'Tony Elumelu Foundation',
      opp_type: 'building',
      category: 'Entrepreneurship',
      description: 'Seed funding + mentorship for African entrepreneurs (up to $5,000 seed + training). For a productized service business (AI + WordPress automation, digital products, AEC consulting) targeting global clients.',
      url: 'https://www.tonyelumelufoundation.org',
      apply_url: 'https://www.tonyelumelufoundation.org',
      source: 'TEF',
      source_url: 'https://www.tonyelumelufoundation.org',
      country: 'Africa',
      compensation_raw: 'US$5,000 seed',
      deadline: 'application window opens annually',
      skills_hint: ['entrepreneurship', 'product-dev', 'business-dev', 'strategy'],
      estimated_usd_override: 5000,
      application_effort: 4,
      recurring: 0,
      strategic: 85,
      note: 'Annual cycle; verify 2027 application dates.',
    },
    {
      title: "MEST Africa Incubator (Accra) — tech founder programme",
      company: 'MEST Africa',
      opp_type: 'building',
      category: 'Entrepreneurship',
      description: 'Accra-based software/tech entrepreneurship training + incubation with seed investment for African founders. Strong fit for packaging skills into a venture.',
      url: 'https://meltwater.org',
      apply_url: 'https://meltwater.org',
      source: 'MEST',
      source_url: 'https://meltwater.org',
      country: 'Africa',
      compensation_raw: 'Incubation + investment',
      deadline: 'annual intake',
      skills_hint: ['product-dev', 'business-dev', 'ai-automation', 'strategy'],
      estimated_usd_override: null,
      application_effort: 4,
      recurring: 0,
      strategic: 85,
      note: 'Verify current programme cycle.',
    },
    {
      title: 'Africa\'s Business Heroes / Anzisha Prize — entrepreneurial competition',
      company: 'Jack Ma Foundation (ABH) / African Leadership Academy (Anzisha)',
      opp_type: 'building',
      category: 'Entrepreneurship',
      description: 'Prizes for African entrepreneurs: ABH up to $300k total pool; Anzisha for ages 18-22. Useful for a Ghana-based services venture.',
      url: 'https://africabusinessheroes.org',
      apply_url: 'https://africabusinessheroes.org',
      source: 'ABH / Anzisha',
      source_url: 'https://www.anzishaprize.org',
      country: 'Africa',
      compensation_raw: 'Prize up to $100,000',
      deadline: 'annual',
      skills_hint: ['entrepreneurship', 'business-dev', 'product-dev'],
      estimated_usd_override: 100000,
      application_effort: 4,
      recurring: 0,
      strategic: 80,
      note: 'High competition; treat as strategic prize, not income plan.',
    },
    {
      title: 'Ghana-based AI/data company contributor — Aya Data',
      company: 'Aya Data (Ghana)',
      opp_type: 'ai',
      category: 'AI Economy',
      description: 'Ghana-headquartered AI data annotation/consulting company (Accra) that hires locally and serves global AI clients (drones, medical imaging, e-scooter detection). Track their careers page for gig/project roles.',
      url: 'https://www.ayadata.ai',
      apply_url: 'https://www.ayadata.ai',
      source: 'Aya Data',
      source_url: 'https://www.ayadata.ai',
      country: 'Ghana',
      compensation_raw: '',
      deadline: '',
      skills_hint: ['ai-research', 'data', '3d-viz', 'ai-automation'],
      estimated_usd_override: null,
      application_effort: 2,
      recurring: 50,
      strategic: 50,
      note: 'Local first; monitor careers page.',
    },
    {
      title: 'DataLens Africa — certified AI data contributor programme',
      company: 'DataLens Africa',
      opp_type: 'ai',
      category: 'AI Economy',
      description: 'Free certified data-annotation courses (LLM fine-tuning, HITL QA) for African talent, then projects paying per task. 3,000+ contributors across 16 African countries.',
      url: 'https://datalens.africa/ai-talents-program',
      apply_url: 'https://datalens.africa/ai-talents-program',
      source: 'DataLens Africa',
      source_url: 'https://datalens.africa',
      country: 'Africa',
      compensation_raw: 'Per-task',
      deadline: '',
      skills_hint: ['ai-research', 'data', 'writing'],
      estimated_usd_override: null,
      application_effort: 1,
      recurring: 60,
      strategic: 60,
      note: 'Good entry to AI income from Ghana; certifications add portfolio evidence.',
    },
    {
      title: 'Fiverr digital services gig (AI + WordPress + visualization)',
      company: 'Fiverr',
      opp_type: 'freelance',
      category: 'Freelance',
      description: 'Sell productized gigs (AI automation, WordPress, architectural visualization). Fees: 20% commission, 14-day clearance (7 for Top Rated). Payout to Ghana: bank transfer $1/$20 min or Payoneer. 2026: average order $50-500 — treat as pipeline-building.',
      url: 'https://www.fiverr.com',
      apply_url: 'https://www.fiverr.com',
      source: 'Fiverr + Raenest guide (Aug 2026)',
      source_url: 'https://www.raenest.com/blog/how-to-receive-payments-from-fiverr-in-ghana',
      country: 'Global (Ghana eligible)',
      compensation_raw: 'US$50-500 typical order',
      deadline: '',
      skills_hint: ['wordpress', 'ai-automation', '3d-viz', 'web-dev'],
      estimated_usd_override: 300,
      application_effort: 2,
      recurring: 80,
      strategic: 70,
      note: 'Digital-asset strategy: templates + AI workflows is an asset category.',
    },
    {
      title: 'Upwork contracts (project-based builds)',
      company: 'Upwork',
      opp_type: 'freelance',
      category: 'Freelance',
      description: 'Agency-tier contracts: average Upwork project ~$800, 32% of 2026 jobs $1,000+. Fee 0-15%, Connects $0.15. Payout to Ghana: Payoneer (built-in), direct-to-bank, US ACH (via Raenest FastTrack).',
      url: 'https://www.upwork.com',
      apply_url: 'https://www.upwork.com',
      source: 'Upwork 8-K research + Raenest (Aug 2026)',
      source_url: 'https://www.raenest.com/blog/how-to-receive-upwork-payments-in-ghana',
      country: 'Global (Ghana eligible)',
      compensation_raw: 'US$800 average project',
      deadline: '',
      skills_hint: ['web-dev', 'wordpress', 'ai-automation', 'no-code'],
      estimated_usd_override: 800,
      application_effort: 3,
      recurring: 75,
      strategic: 70,
      note: 'Direct to local bank has poor FX; prefer Payoneer or US ACH route.',
    },
  ];

  let inserted = 0;
  const weights = loadWeights();
  for (const l of listings) {
    const nowIso = now();
    const existing = row('SELECT id FROM opportunities WHERE source=? AND title=?', [l.source, l.title]);
    if (existing) continue;
    const det = detectGeoEligibility(l.title + ' ' + l.description);
    const ghScore = ghanaAccessibilityScore(l);
    const risk = assessRisk(l.title, l.description, l.source, l.company);
    const match = matchSkills(l.title, l.description + ' ' + (l.skills_hint || []).join(' '));
    const payment = scoreOpportunityPayment({ source: l.source, title: l.title, company: l.company });
    const econ = estimateEconomics(l.compensation_raw, 'USD', { rateUsdGhs: usdToGhs() });
    const estUsd = l.estimated_usd_override ?? econ.valid ? econ.grossUsd : null;

    const c = {
      title: l.title,
      company: l.company,
      opp_type: l.opp_type,
      category: l.category,
      description: l.description,
      url: l.url,
      source: l.source,
      source_url: l.source_url,
      country: l.country,
      geo_eligibility: det.geo,
      ghana_eligibility_evidence: JSON.stringify(det),
      skills: JSON.stringify(match.matched),
      compensation_raw: l.compensation_raw,
      estimated_usd: estUsd,
      payment_methods: JSON.stringify(payment.routes.map((r) => r.provider)),
      ghana_payment_compat: JSON.stringify(payment),
      deadline: l.deadline,
      recurring: l.recurring ?? 40,
      strategic: l.strategic ?? 40,
      skill_growth: 50,
      long_term: 40,
      income_potential: econ.valid ? (econ.effectiveHourlyUsd >= 40 ? 90 : econ.effectiveHourlyUsd >= 15 ? 70 : 45) : 30,
      freshness: 80,
      source_reliability: 'probably legitimate',
      scam_risk: risk.risk,
      scam_reasons: JSON.stringify(risk.reasons),
      verification_status: 'Needs verification via platform page',
      application_effort: l.application_effort || 3,
      difficulty: 3,
      competition: 3,
      ghana_eligible: ghScore >= 80 ? 1 : 0,
      notes: l.note || '',
      discovered_at: nowIso,
      last_verified: SEED_DATE,
    };
    const fit = computeFit({ ...c, skillMatch: match.skillMatch, ghanaScore: ghScore, paymentCompat: payment, ghanaEligible: c.ghana_eligible }, weights);
    const tags = strategyTags({ ...c, estimatedUsd: estUsd, timeHours: 40 });
    const id = randomUUID();

    const cols = [
      ['id', id],
      ['normalized_hash', 'seed-' + randomUUID().slice(0, 10)],
      ['title', c.title], ['company', c.company], ['opp_type', c.opp_type], ['category', c.category],
      ['description', c.description], ['url', c.url], ['apply_url', l.apply_url || ''],
      ['source', c.source], ['source_url', c.source_url], ['country', c.country],
      ['geo_eligibility', c.geo_eligibility], ['ghana_eligible', c.ghana_eligible],
      ['ghana_eligibility_evidence', c.ghana_eligibility_evidence], ['skills', c.skills],
      ['compensation_raw', c.compensation_raw], ['estimated_usd', c.estimated_usd],
      ['payment_methods', c.payment_methods], ['ghana_payment_compat', c.ghana_payment_compat],
      ['deadline', c.deadline], ['time_commitment', ''],
      ['difficulty', c.difficulty], ['competition', c.competition], ['application_effort', c.application_effort],
      ['freshness', c.freshness], ['source_reliability', c.source_reliability], ['scam_risk', c.scam_risk],
      ['verification_status', c.verification_status], ['scam_reasons', c.scam_reasons],
      ['match_score', fit.fit], ['score_breakdown', JSON.stringify(fit)],
      ['income_potential', c.income_potential], ['strategic_value', c.strategic],
      ['skill_growth', c.skill_growth], ['recurring', c.recurring], ['long_term', c.long_term],
      ['strategy_tags', JSON.stringify(tags)], ['economics', JSON.stringify(econ)],
      ['notes', c.notes], ['discovered_at', c.discovered_at], ['last_verified', c.last_verified],
      ['status', 'new'],
    ];
    run(
      `INSERT INTO opportunities (${cols.map((c) => c[0]).join(',')}) VALUES (${cols.map(() => '?').join(',')})`,
      cols.map((c) => c[1]),
    );
    inserted++;
  }
  return inserted;
}