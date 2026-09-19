// HTTP server: dashboard static files + JSON API (§47).

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { db, all, row, run, getSetting, setSetting } from './db.js';
import { log } from './logger.js';
import { ROOT, config } from './config.js';
import { analytics, commandCenter } from './engines/analytics.js';
import { loadWeights, saveWeights } from './engine_utils.js';
import { generateDailyReport, latestReport } from './engines/report.js';
import { runDiscovery } from './discover/agents.js';
import { buildApplicationPlan, stageLabels, applicationsWithOpportunities } from './engines/application.js';
import { todayStr } from './engines/analytics.js';
import { serialize } from './export.js';
import { convert } from './data/exchange_rates.js';
import { gapAnalysis } from './engines/report.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC = path.join(__dirname, '..', 'public');

const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.svg': 'image/svg+xml', '.ico': 'image/x-icon' };

function json(res, code, obj) {
  const body = JSON.stringify(obj);
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve) => {
    let data = '';
    req.on('data', (c) => { data += c; if (data.length > 1e6) req.destroy(); });
    req.on('end', () => {
      try { resolve(data ? JSON.parse(data) : {}); } catch { resolve({}); }
    });
    req.on('error', () => resolve({}));
  });
}

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

function queryOpportunities(q = {}) {
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
  return all(`SELECT ${oppSelect} FROM opportunities ${w} ORDER BY ${sort} LIMIT ?`, [...params, limit]).map(parseOpp);
}

async function handle(req, res, url) {
  const parts = url.pathname.split('/').filter(Boolean);

  // Static dashboard
  if (parts.length === 0) return serveFile(res, 'index.html');
  if (parts.length === 1 && (parts[0] === 'app.js' || parts[0] === 'styles.css')) return serveFile(res, parts[0]);
  if (parts[0] === 'api') {
    return handleApi(req, res, parts.slice(1), url);
  }
  return serveFile(res, 'index.html');
}

async function handleApi(req, res, parts, url) {
  const method = req.method;
  const [a] = parts;

  if (a === 'overview' && method === 'GET') {
    const cc = commandCenter();
    const an = analytics();
    return json(res, 200, {
      cc,
      analytics: an,
      today: todayStr(),
      weights: loadWeights(),
      anyTaskMode: getSetting('any_task_mode', false),
      appName: config.appName,
    });
  }

  if (a === 'opportunities' && method === 'GET' && !parts[1]) {
    const q = Object.fromEntries(url.searchParams.entries());
    return json(res, 200, { total: queryOpportunities({ limit: 10000 }).length, items: queryOpportunities(q) });
  }

  if (a === 'opportunities' && method === 'GET' && parts[1]) {
    const opp = row(`SELECT ${oppSelect} FROM opportunities WHERE id=?`, [parts[1]]);
    if (!opp) return json(res, 404, { error: 'not found' });
    const plan = buildApplicationPlan(parseOpp(opp));
    return json(res, 200, { opportunity: parseOpp(opp), plan });
  }

  if (a === 'opportunities' && method === 'PATCH' && parts[1]) {
    const body = await readBody(req);
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
      run(`UPDATE opportunities SET ${sets.join(',')} WHERE id=?`, params);
    }
    return json(res, 200, { ok: true });
  }

  if (a === 'applications' && method === 'GET') {
    return json(res, 200, { items: applicationsWithOpportunities(), stages: stageLabels });
  }

  if (a === 'applications' && method === 'POST') {
    const b = await readBody(req);
    const id = randomUUID();
    const stage = b.stage || 'preparing';
    run(`INSERT INTO applications(id, opportunity_id, stage, applied_at, follow_up_at, contact, documents, notes, updated_at)
         VALUES(?,?,?,?,?,?,?,?,?)`,
      [id, b.opportunity_id, stage, b.applied_at || new Date().toISOString(), b.follow_up_at || null, b.contact || '', JSON.stringify(b.documents || []), b.notes || '', new Date().toISOString()]);
    if (stage && ['applied', 'interview', 'offer', 'won', 'paid'].includes(stage)) {
      run("UPDATE opportunities SET status=? WHERE id=?", [stage, b.opportunity_id]);
    }
    return json(res, 200, { ok: true, id });
  }

  if (a === 'applications' && method === 'PATCH' && parts[1]) {
    const b = await readBody(req);
    const allowed = ['stage', 'applied_at', 'follow_up_at', 'contact', 'notes', 'result', 'compensation_agreed', 'payment_method', 'proposal', 'cover_letter'];
    const sets = [];
    const params = [];
    for (const k of Object.keys(b)) {
      if (!allowed.includes(k)) continue;
      sets.push(`${k}=?`);
      params.push(b[k]);
    }
    sets.push('updated_at=?');
    params.push(new Date().toISOString());
    params.push(parts[1]);
    run(`UPDATE applications SET ${sets.join(',')} WHERE id=?`, params);
    return json(res, 200, { ok: true });
  }

  if (a === 'skills' && method === 'GET') return json(res, 200, all('SELECT * FROM skills ORDER BY market_demand DESC'));
  if (a === 'skills' && method === 'POST') {
    const b = await readBody(req);
    for (const { id, level, market_demand, learning_priority } of b.updates || []) {
      if (!id) continue;
      run('UPDATE skills SET level=?, market_demand=?, learning_priority=? WHERE id=?', [level, market_demand, learning_priority, id]);
    }
    return json(res, 200, { ok: true });
  }
  if (a === 'portfolio' && method === 'GET') return json(res, 200, all('SELECT * FROM portfolio'));

  if (a === 'payments' && method === 'GET') return json(res, 200, all('SELECT * FROM payment_providers ORDER BY status DESC, name'));
  if (a === 'sources' && method === 'GET') return json(res, 200, all('SELECT * FROM sources ORDER BY reliability DESC, name'));
  if (a === 'sources' && method === 'PATCH' && parts[1]) {
    const b = await readBody(req);
    const allowed = ['enabled', 'reliability', 'feed_url', 'access_method', 'notes'];
    const sets = []; const params = [];
    for (const k of Object.keys(b)) if (allowed.includes(k)) { sets.push(`${k}=?`); params.push(b[k]); }
    if (sets.length) { params.push(parts[1]); run(`UPDATE sources SET ${sets.join(',')} WHERE id=?`, params); }
    return json(res, 200, { ok: true });
  }

  if (a === 'analytics' && method === 'GET') {
    const gap = gapAnalysis();
    return json(res, 200, { ...analytics(), gap: { learningPriority: gap.learningPriority, results: gap.results }, fx: analytics().fx });
  }

  if (a === 'radar' && method === 'GET') {
    const hidden = all(`SELECT ${oppSelect} FROM opportunities WHERE competition<=2 AND match_score>=65 AND scam_risk != 'high risk' ORDER BY match_score DESC LIMIT 10`).map(parseOpp);
    const deadlines = all(`SELECT ${oppSelect} FROM opportunities WHERE deadline != '' AND deadline != 'n/a' AND (deadline LIKE ? OR deadline LIKE ? OR deadline LIKE ?) ORDER BY deadline ASC LIMIT 12`,
      ['%20__', '%/20__', '%2026%']).map(parseOpp);
    const today = queryOpportunities({ ghana: '1', minfit: '60', sort: 'fit', limit: 10 });
    const quickCash = queryOpportunities({ ghana: '1' }).filter((o) => o.application_effort <= 2).slice(0, 10);
    const highValue = all(`SELECT ${oppSelect} FROM opportunities WHERE estimated_usd >= 2000 ORDER BY estimated_usd DESC LIMIT 10`).map(parseOpp);
    const ai = queryOpportunities({ category: 'AI Economy', sort: 'fit', limit: 10 });
    const aec = all(`SELECT ${oppSelect} FROM opportunities WHERE category LIKE '%AEC%' OR category LIKE '%architecture%' OR skills LIKE '%AEC%' OR skills LIKE '%Architecture%' ORDER BY match_score DESC LIMIT 10`).map(parseOpp);
    const consulting = queryOpportunities({ category: 'Consulting', sort: 'fit', limit: 10 });
    const building = queryOpportunities({ category: 'Entrepreneurship', sort: 'fit', limit: 10 });
    const freelance = all(`SELECT ${oppSelect} FROM opportunities WHERE opp_type IN ('freelance','expert','ai') AND scam_risk != 'high risk' ORDER BY match_score DESC LIMIT 12`).map(parseOpp);
    const employment = all(`SELECT ${oppSelect} FROM opportunities WHERE opp_type IN ('employment') ORDER BY match_score DESC LIMIT 12`).map(parseOpp);
    return json(res, 200, { hidden, deadlines, today, quickCash, highValue, ai, aec, consulting, building, freelance, employment });
  }

  if (a === 'reports' && method === 'GET') {
    const daily = latestReport('daily');
    const weekly = latestReport('weekly');
    return json(res, 200, { daily: daily?.content || '', weekly: weekly?.content || '', generated: daily?.generated_at });
  }

  if (a === 'settings' && method === 'GET') {
    return json(res, 200, { weights: loadWeights(), anyTaskMode: getSetting('any_task_mode', false), profile: getSetting('profile', {}), env: { mode: config.discovery.mode, searchEnabled: config.discovery.searchEnabled } });
  }
  if (a === 'settings' && method === 'POST') {
    const b = await readBody(req);
    if (b.weights) saveWeights(b.weights);
    if (b.anyTaskMode != null) setSetting('any_task_mode', !!b.anyTaskMode);
    if (b.profile) setSetting('profile', b.profile);
    return json(res, 200, { ok: true });
  }

  if (a === 'discover' && method === 'POST') {
    const result = await runDiscovery();
    generateDailyReport();
    return json(res, 200, result);
  }

  if ((a === 'export' || a === 'export.csv' || a === 'export.json') && method === 'GET') {
    const fmt = a === 'export.json' ? 'json' : 'csv';
    const file = serialize(fmt);
    const data = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
    const type = fmt === 'json' ? 'application/json' : 'text/csv';
    res.writeHead(200, { 'content-type': `${type}; charset=utf-8`, 'content-disposition': `attachment; filename="${path.basename(file)}"` });
    return res.end(data);
  }

  if (a === 'agent' && parts[1] && parts[2]) {
    const opp = row(`SELECT ${oppSelect} FROM opportunities WHERE id=?`, [parts[2]]);
    if (!opp) return json(res, 404, { error: 'not found' });
    const plan = buildApplicationPlan(parseOpp(opp));
    if (parts[1] === 'plan') return json(res, 200, plan);
  }

  if (a === 'admin' && parts[1] === 'reset' && method === 'POST') {
    const { seedAll } = await import('./seed.js');
    db().exec('DELETE FROM applications; DELETE FROM reports; DELETE FROM alerts; DELETE FROM discovery_runs; DELETE FROM opportunities; DELETE FROM settings; DELETE FROM meta;');
    const r = await seedAll({ refreshFx: false });
    return json(res, 200, { ok: true, seeded: r.seeded });
  }

  if (a === 'queries' && method === 'GET') return json(res, 200, all('SELECT * FROM search_queries ORDER BY last_run DESC'));

  return json(res, 404, { error: 'unknown route' });
}

function serveFile(res, name) {
  const file = path.join(PUBLIC, name);
  if (!fs.existsSync(file)) return json(res, 404, { error: 'not found' });
  const ext = path.extname(file);
  res.writeHead(200, { 'content-type': MIME[ext] || 'application/octet-stream', 'cache-control': 'no-store' });
  fs.createReadStream(file).pipe(res);
}

export function startServer(port = config.port, host = config.host) {
  const server = http.createServer(async (req, res) => {
    try {
      const url = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
      await handle(req, res, url);
    } catch (e) {
      log.error('Request error', e);
      json(res, 500, { error: e.message });
    }
  });
  server.listen(port, host, () => {
    log.info(`${config.appName} listening on http://${host}:${port}`);
  });
  return server;
}

export { convert, todayStr };