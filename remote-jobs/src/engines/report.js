// Daily / weekly intelligence reports (§22, §23) + alerts (§21) + gap analysis (§16).

import { all, row, run } from '../db.js';
import { convert, usdToGhs } from '../data/exchange_rates.js';
import { defaultWeights } from './matching.js';
import { loadWeights } from '../engine_utils.js';
import { todayStr } from './analytics.js';

export function createAlert(kind, headline, body = '', opportunityId = null, severity = 'info') {
  run('INSERT INTO alerts(kind,severity,headline,body,opportunity_id,created_at) VALUES(?,?,?,?,?,?)',
    [kind, severity, headline, body, opportunityId, new Date().toISOString()]);
}

function usdDisplay(n) {
  if (n == null) return '—';
  const ghs = convert(n, 'GHS');
  return `$${Number(n).toLocaleString()}${ghs?.rate ? ` (≈ GHS ${Number((n * ghs.rate).toFixed(0)).toLocaleString()})` : ''}`;
}

function topOpportunities(limit = 10) {
  return all(
    `SELECT id,title,company,opp_type,category,estimated_usd,deadline,match_score,ghana_eligible,
            scam_risk,ghana_payment_compat,source,url,skills,description
     FROM opportunities
     WHERE scam_risk != 'high risk' AND status != 'rejected'
     ORDER BY match_score DESC, ghana_eligible DESC LIMIT ?`,
    [limit],
  );
}

function fmtList(opp) {
  let esc = (s) => String(s || '').replace(/\n/g, ' ').slice(0, 220);
  let pay = JSON.parse(opp.ghana_payment_compat || '{}');
  const payNote = pay.channels ? pay.channels[0] : 'check payment route';
  return `- ${opp.title} (${opp.company || '—'})
    Fit: ${opp.match_score}/100 · Ghana eligible: ${opp.ghana_eligible ? 'YES' : 'no'}
    Compensation: ${usdDisplay(opp.estimated_usd)} · Deadline: ${opp.deadline || 'n/a'}
    Payment: ${esc(payNote)}
    ${opp.url || ''}`;
}

export function generateDailyReport() {
  const date = todayStr();
  const total = row('SELECT COUNT(*) c FROM opportunities');
  const ghana = row('SELECT COUNT(*) c FROM opportunities WHERE ghana_eligible=1');
  const highFit = row('SELECT COUNT(*) c FROM opportunities WHERE match_score >= 70');
  const highValue = row('SELECT COUNT(*) c FROM opportunities WHERE estimated_usd >= 2000');
  const ai = row("SELECT COUNT(*) c FROM opportunities WHERE opp_type='ai'");
  const aec = row("SELECT COUNT(*) c FROM opportunities WHERE category LIKE '%AEC%' OR category LIKE '%architecture%' OR skills LIKE '%AEC%'");
  const research = row("SELECT COUNT(*) c FROM opportunities WHERE opp_type='consulting' OR category LIKE '%Research%'");
  const grants = row("SELECT COUNT(*) c FROM opportunities WHERE opp_type IN ('building') ");

  const top = topOpportunities(10);
  let report = [];

  report.push('GLOBAL OPPORTUNITY REPORT');
  report.push(date);
  report.push('');
  report.push(`${total.c} opportunities tracked`);
  report.push(`${ghana.c} Ghana-compatible`);
  report.push(`${highFit.c} high-fit opportunities`);
  report.push(`${highValue.c} high-value opportunities (≥$2,000)`);
  report.push(`${ai.c} AI opportunities`);
  report.push(`${aec.c} AEC opportunities`);
  report.push(`${research.c} research/consulting opportunities`);
  report.push(`${grants.c} grants & building-your-own programmes`);
  report.push('');
  report.push('TOP 10 RIGHT NOW:');
  top.forEach((o, i) => report.push(`${i + 1}. ${fmtList(o)}`));

  const body = report.join('\n');
  const id = run('INSERT INTO reports(kind,period,generated_at,content,summary) VALUES(?,?,?,?,?)',
    ['daily', date, new Date().toISOString(), body, JSON.stringify({ total: total.c, ghana: ghana.c, highFit: highFit.c })]).lastInsertRowid;

  // Deadline alerts
  createAlert('deadlines', 'Deadlines closing soon', top.length ? 'see report' : '', null, 'info');

  return { id, body, date };
}

export function generateWeeklyReport() {
  const date = todayStr();
  const since = new Date(Date.now() - 7 * 86400000).toISOString();
  const discovered = row('SELECT COUNT(*) c FROM opportunities WHERE discovered_at >= ?', [since]);
  const apps = row('SELECT COUNT(*) c FROM applications WHERE applied_at >= ?', [since]);
  const won = row("SELECT COUNT(*) c FROM applications WHERE stage IN ('won','paid')");
  const lost = all('SELECT o.title, a.stage FROM applications a JOIN opportunities o ON o.id=a.opportunity_id WHERE a.stage IN (?,?)',
    ['lost', 'rejected']);
  const newSources = all('SELECT count(*) c FROM sources WHERE last_success >= ?', [since]);
  const skills = all('SELECT * FROM skills ORDER BY market_demand DESC');

  const gaps = gapAnalysis();
  const trends = patterns();

  const lines = [];
  lines.push('WEEKLY STRATEGIC REPORT');
  lines.push(date);
  lines.push('');
  lines.push(`Opportunities discovered this week: ${discovered.c}`);
  lines.push(`Applications submitted: ${apps.c}`);
  lines.push(`Wins: ${won.c}`);
  lines.push(`Missed/Lost: ${lost.length}`);
  lines.push(`New platforms discovered/verified: ${newSources.c}`);
  lines.push('');
  lines.push('SKILL GAPS (highest-demand first):');
  for (const s of skills.slice(0, 5)) {
    const gap = s.market_demand - s.level * 20;
    if (gap > 20) lines.push(`  - Learn ${s.name}: demand ${s.market_demand}/100 vs your level ${s.level}/5 → could unlock opportunity categories.`);
  }
  lines.push('');
  lines.push('MARKET PATTERNS / OPPORTUNITY → SERVICE IDEAS:');
  for (const t of trends.slice(0, 5)) {
    lines.push(`  - ${t.pattern}: ${t.count} times in tracked opportunities`);
  }
  lines.push('');
  lines.push('Portfolio recommendations: ensure your documented case studies are public and dated (BIM/5D, AI-automated WordPress, Ghana market brief, LLM evaluation pack).');
  lines.push('');
  lines.push('Recurring income candidates: expert networks (GLG/Guidepoint), Retainer-style AI automation services, digital products (templates/AI workflows), online course content.');

  const body = lines.join('\n');
  const id = run('INSERT INTO reports(kind,period,generated_at,content,summary) VALUES(?,?,?,?,?)',
    ['weekly', date, new Date().toISOString(), body, JSON.stringify({ discovered: discovered.c, apps: apps.c, wins: won.c })]).lastInsertRowid;
  createAlert('weekly', 'Weekly strategic report ready', `${discovered.c} opportunities, ${apps.c} applications, ${won.c} wins`, null, 'info');
  return { id, body, date, gaps };
}

export function gapAnalysis() {
  const skills = all('SELECT * FROM skills ORDER BY market_demand DESC');
  const results = skills.map((s) => {
    const strength = (s.level || 0) * 20;
    const gap = (s.market_demand || 50) - strength;
    return {
      skill: s.name,
      category: s.category,
      level: s.level,
      market_demand: s.market_demand,
      gap,
      action: gap >= 30 ? 'learning priority' : gap >= 10 ? 'consider portfolio evidence' : 'satisfied',
    };
  });
  const learningPriority = results.filter((r) => r.action === 'learning priority').slice(0, 6);
  return { results, learningPriority };
}

export function patterns() {
  // Opportunity → Business engine (§32): cluster recurring phrases in discovered titles/descriptions.
  const allText = all('SELECT title, description FROM opportunities');
  const wordCount = new Map();
  const patterns = [];
  for (const t of allText) {
    const txt = `${t.title} ${t.description || ''}`;
    const terms = ['AI automation', 'WordPress', 'BIM', 'data annotation', 'virtual assistant', 'customer support', 'lead generation', 'content writing', 'web development', '3D visualization', 'architectural', 'research assistant', 'contract', 'consultant', 'evaluation', 'proofreading', 'translation', 'community manager', 'sales'];
    for (const term of terms) {
      if (new RegExp(term, 'i').test(txt)) {
        const key = term.toLowerCase();
        wordCount.set(key, (wordCount.get(key) || 0) + 1);
      }
    }
  }
  for (const [k, v] of wordCount) patterns.push({ pattern: k, count: v });
  patterns.sort((a, b) => b.count - a.count);
  return patterns.slice(0, 12);
}

export function latestReport(kind = 'daily') {
  return row('SELECT * FROM reports WHERE kind=? ORDER BY id DESC LIMIT 1', [kind]);
}