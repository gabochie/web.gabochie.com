// HTTP API handlers (§47) - ported from server.js for Cloudflare Pages Functions (D1-backed).

import { db, all, row, run, getSetting, setSetting } from './db.js';
import { analytics, commandCenter, todayStr } from './engines/analytics.js';
import { loadWeights, saveWeights } from './engine_utils.js';
import { generateDailyReport, latestReport, gapAnalysis } from './engines/report.js';
import { runDiscovery } from './discover/agents.js';
import { buildApplicationPlan, stageLabels, applicationsWithOpportunities } from './engines/application.js';
import { seedAll } from './seed.js';
import { config } from './config.js';

function parseOpp(r) {
  const p = (s, d) => { try { return JSON.parse(s || 'null') ?? d; } catch { return d; } };
  return {
    ...r,
    skills: p(r.skills, []),
    payment_methods: p(r.payment_methods, []),
    ghana_payment_compat: p(r.ghana_payment_compat, {}),
    scam_reasons: p(r.scam_reasons, []),
    score_breakdown: p(r.score_breakdown, {}),
    strategy_tags: p(r.strategy_tags, []),
    portfolio_match: p(r.portfolio_match, []),
    application_assistant: p(r.application_assistant, {}),
    economics: p(r.economics, {}),
    ghana_eligibility_evidence: p(r.ghana_eligibility_evidence, {}),
  };
}

const oppSelect = 'id,title,company,opp_type,category,description,url,apply_url,source,source_url,country,geo_eligibility,ghana_eligible,ghana_eligibility_evidence,remote_status,skills,experience_req,education_req,language_req,portfolio_req,deadline,opening_date,compensation_raw,currency,compensation_type,estimated_usd,payment_frequency,payment_methods,ghana_payment_compat,time_commitment,difficulty,competition,application_effort,freshness,source_reliability,scam_risk,verification_status,scam_reasons,match_score,score_breakdown,income_potential,strategic_value,skill_growth,recurring,long_term,strategy_tags,notes,discovered_at,last_verified,status,matched_queries';

async function queryOpportunities(q = {}) {
  const where = [];
  const params = [];
  if (q.category && q.category !== 'all') {
    where.push(`(opp_type=? OR category=? OR category LIKE ?)`);
    params.push(q.category, q.category, `%${q.category}%`);
  }
  if (q.ghana === '1' || q.ghana === 'true') where.push('ghana_eligible=1');
  if (q.ghana === '0') where.push('ghana_eligible=0');
  if (q.status && q.status !== 'all') where.push('status=?');
  if (q.q) {
    where.push('(title LIKE ? OR company LIKE ? OR description LIKE ?)');
    const like = `%${q.q}%`;
    params.push(like, like, like);
  }
  if (q.risk && q.risk !== 'all') where.push('scam_risk=?');
  if (q.minfit) where.push('match_score >= ?');
  if (q.minfit) params.push(Number(q.minfit));
  const w = where.length ? 'WHERE ' + where.join(' AND ') : '';
  const sort = { fit: 'match_score DESC', newest: 'discovered_at DESC', usd: 'estimated_usd DESC', deadline: 'deadline ASC' }[q.sort] || 'match_score DESC';
  const limit = Math.min(500, Number(q.limit) || 100);
  return (await all(`SELECT ${oppSelect} FROM opportunities ${w} ORDER BY ${sort} LIMIT ?`, [...params, limit])).map(parseOpp);
}

function csvEscape(v) {
  const s = String(v ?? '');
  if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

async function exportContent(fmt = 'csv') {
  const data = await all(
    `SELECT id,title,company,opp_type,category,description,url,source,country,geo_eligibility,ghana_eligible,
            remote_status,deadline,estimated_usd,currency,payment_frequency,match_score,scam_risk,verification_status,
            income_potential,strategic_value,recurring,long_term,discovered_at,last_verified,status
     FROM opportunities ORDER BY match_score DESC`,
  );
  if (fmt === 'json') return JSON.stringify(data, null, 2);
  const keys = data.length ? Object.keys(data[0]) : ['id'];
  const lines = [keys.map(csvEscape).join(',')];
  for (const r of data) lines.push(keys.map((k) => csvEscape(r[k])).join(','));
  return lines.join('\n');
}

export async function handleApi(parts, url, method, body = {}) {
  const [a] = parts;

  if (a === 'overview' && method === 'GET') {
    const cc = await commandCenter();
    const an = await analytics();
    const weights = await loadWeights();
    return result(200, {
      cc,
      analytics: an,
      today: todayStr(),
      weights,
      anyTaskMode: await getSetting('any_task_mode', false),
      appName: config.appName,
    });
  }

  if (a === 'opportunities' && method === 'GET' && !parts[1]) {
    const q = Object.fromEntries(url.searchParams.entries());
    const count = (await queryOpportunities({ limit: 10000 })).length;
    return result(200, { total: count, items: await queryOpportunities(q) });
  }

  if (a === 'opportunities' && method === 'GET' && parts[1]) {
    const opp = await row(`SELECT ${oppSelect} FROM opportunities WHERE id=?`, [parts[1]]);
    if (!opp) return result(404, { error: 'not found' });
    const plan = await buildApplicationPlan(parseOpp(opp));
    return result(200, { opportunity: parseOpp(opp), plan });
  }

  if (a === 'opportunities' && method === 'PATCH' && parts[1]) {
    const allowed = ['status', 'notes', 'match_score', 'scam_risk', 'verification_status', 'deadline', 'application_effort'];
    const sets = [];
    const params = [];
    for (const k of Object.keys(body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k}=?`);
      params.push(body[k]);
    }
    if (sets.length) {
      params.push(parts[1]);
      await run(`UPDATE opportunities SET ${sets.join(',')} WHERE id=?`, params);
    }
    return result(200, { ok: true });
  }

  if (a === 'applications' && method === 'GET') {
    return result(200, { items: await applicationsWithOpportunities(), stages: stageLabels });
  }

  if (a === 'applications' && method === 'POST') {
    const id = globalThis.crypto.randomUUID();
    const stage = body.stage || 'preparing';
    await run(`INSERT INTO applications(id, opportunity_id, stage, applied_at, follow_up_at, contact, documents, notes, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      [id, body.opportunity_id, stage, body.applied_at || new Date().toISOString(), body.follow_up_at || null, body.contact || '', JSON.stringify(body.documents || []), body.notes || '', new Date().toISOString()]);
    if (stage && ['applied', 'interview', 'offer', 'won', 'paid'].includes(stage)) {
      await run("UPDATE opportunities SET status=? WHERE id=?", [stage, body.opportunity_id]);
    }
    return result(200, { ok: true, id });
  }

  if (a === 'applications' && method === 'PATCH' && parts[1]) {
    const allowed = ['stage', 'applied_at', 'follow_up_at', 'contact', 'notes', 'result', 'compensation_agreed', 'payment_method', 'proposal', 'cover_letter'];
    const sets = [];
    const params = [];
    for (const k of Object.keys(body)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k}=?`);
      params.push(body[k]);
    }
    sets.push('updated_at=?');
    params.push(new Date().toISOString());
    params.push(parts[1]);
    await run(`UPDATE applications SET ${sets.join(',')} WHERE id=?`, params);
    return result(200, { ok: true });
  }

  if (a === 'skills' && method === 'GET') return result(200, await all('SELECT * FROM skills ORDER BY market_demand DESC'));
  if (a === 'skills' && method === 'POST') {
    for (const { id, level, market_demand, learning_priority } of body.updates || []) {
      if (!id) continue;
      await run('UPDATE skills SET level=?, market_demand=?, learning_priority=? WHERE id=?', [level, market_demand, learning_priority, id]);
    }
    return result(200, { ok: true });
  }
  if (a === 'portfolio' && method === 'GET') return result(200, await all('SELECT * FROM portfolio'));

  if (a === 'payments' && method === 'GET') return result(200, await all('SELECT * FROM payment_providers ORDER BY status DESC, name'));
  if (a === 'sources' && method === 'GET') return result(200, await all('SELECT * FROM sources ORDER BY reliability DESC, name'));
  if (a === 'sources' && method === 'PATCH' && parts[1]) {
    const allowed = ['enabled', 'reliability', 'feed_url', 'access_method', 'notes'];
    const sets = []; const params = [];
    for (const k of Object.keys(body)) if (allowed.includes(k)) { sets.push(`${k}=?`); params.push(body[k]); }
    if (sets.length) { params.push(parts[1]); await run(`UPDATE sources SET ${sets.join(',')} WHERE id=?`, params); }
    return result(200, { ok: true });
  }

  if (a === 'analytics' && method === 'GET') {
    const gap = await gapAnalysis();
    const an = await analytics();
    return result(200, { ...an, gap: { learningPriority: gap.learningPriority, results: gap.results }, fx: an.fx });
  }

  if (a === 'radar' && method === 'GET') {
    const hidden = (await all(`SELECT ${oppSelect} FROM opportunities WHERE competition<=2 AND match_score>=65 AND scam_risk != 'high risk' ORDER BY match_score DESC LIMIT 10`)).map(parseOpp);
    const deadlines = (await all(`SELECT ${oppSelect} FROM opportunities WHERE deadline != '' AND deadline != 'n/a' AND (deadline LIKE ? OR deadline LIKE ? OR deadline LIKE ?) ORDER BY deadline ASC LIMIT 12`,
      ['%20__', '%/20__', '%2026%'])).map(parseOpp);
    const today = await queryOpportunities({ ghana: '1', minfit: '60', sort: 'fit', limit: 10 });
    const quickCashRaw = await queryOpportunities({ ghana: '1' });
    const quickCash = quickCashRaw.filter((o) => o.application_effort <= 2).slice(0, 10);
    const highValue = (await all(`SELECT ${oppSelect} FROM opportunities WHERE estimated_usd >= 2000 ORDER BY estimated_usd DESC LIMIT 10`)).map(parseOpp);
    const ai = await queryOpportunities({ category: 'AI Economy', sort: 'fit', limit: 10 });
    const aec = (await all(`SELECT ${oppSelect} FROM opportunities WHERE category LIKE '%AEC%' OR category LIKE '%architecture%' OR skills LIKE '%AEC%' OR skills LIKE '%Architecture%' ORDER BY match_score DESC LIMIT 10`)).map(parseOpp);
    const consulting = await queryOpportunities({ category: 'Consulting', sort: 'fit', limit: 10 });
    const building = await queryOpportunities({ category: 'Entrepreneurship', sort: 'fit', limit: 10 });
    const freelance = (await all(`SELECT ${oppSelect} FROM opportunities WHERE opp_type IN ('freelance','expert','ai') AND scam_risk != 'high risk' ORDER BY match_score DESC LIMIT 12`)).map(parseOpp);
    const employment = (await all(`SELECT ${oppSelect} FROM opportunities WHERE opp_type IN ('employment') ORDER BY match_score DESC LIMIT 12`)).map(parseOpp);
    return result(200, { hidden, deadlines, today, quickCash, highValue, ai, aec, consulting, building, freelance, employment });
  }

  if (a === 'reports' && method === 'GET') {
    const daily = await latestReport('daily');
    const weekly = await latestReport('weekly');
    return result(200, { daily: daily?.content || '', weekly: weekly?.content || '', generated: daily?.generated_at });
  }

  if (a === 'settings' && method === 'GET') {
    return result(200, {
      weights: await loadWeights(),
      anyTaskMode: await getSetting('any_task_mode', false),
      profile: await getSetting('profile', {}),
      env: { mode: config.discovery.mode, searchEnabled: config.discovery.searchEnabled },
    });
  }
  if (a === 'settings' && method === 'POST') {
    if (body.weights) await saveWeights(body.weights);
    if (body.anyTaskMode != null) await setSetting('any_task_mode', !!body.anyTaskMode);
    if (body.profile) await setSetting('profile', body.profile);
    return result(200, { ok: true });
  }

  if (a === 'discover' && method === 'POST') {
    const discoveryResult = await runDiscovery();
    await generateDailyReport();
    return result(200, discoveryResult);
  }

  if ((a === 'export' || a === 'export.csv' || a === 'export.json') && method === 'GET') {
    const fmt = a === 'export.json' ? 'json' : 'csv';
    const content = await exportContent(fmt);
    const contentType = fmt === 'json' ? 'application/json' : 'text/csv';
    return { status: 200, contentType: `${contentType}; charset=utf-8`, body: content, raw: true };
  }

  if (a === 'agent' && parts[1] && parts[2]) {
    const opp = await row(`SELECT ${oppSelect} FROM opportunities WHERE id=?`, [parts[2]]);
    if (!opp) return result(404, { error: 'not found' });
    const plan = await buildApplicationPlan(parseOpp(opp));
    if (parts[1] === 'plan') return result(200, plan);
  }

  if (a === 'admin' && parts[1] === 'reset' && method === 'POST') {
    const driver = await db();
    await driver.exec('DELETE FROM applications; DELETE FROM reports; DELETE FROM alerts; DELETE FROM discovery_runs; DELETE FROM opportunities; DELETE FROM settings; DELETE FROM meta;');
    const r = await seedAll({ refreshFx: false });
    return result(200, { ok: true, seeded: r.seeded });
  }

  if (a === 'queries' && method === 'GET') return result(200, await all('SELECT * FROM search_queries ORDER BY last_run DESC'));

  return result(404, { error: 'unknown route' });
}

function result(status, body) {
  return { status, body, contentType: 'application/json; charset=utf-8' };
}

export { parseOpp, oppSelect, queryOpportunities };