// Analytics (§40) + Command Center (§38).

import { all, row } from '../db.js';
import { convert } from '../data/exchange_rates.js';

export const todayStr = () => new Date().toISOString().slice(0, 10);

export async function commandCenter() {
  const applyToday = await all(
    `SELECT * FROM opportunities
     WHERE status='new' AND scam_risk != 'high risk' AND ghana_eligible=1
       AND match_score >= 60
     ORDER BY match_score DESC LIMIT 8`,
  );
  const fastest = await all(
    `SELECT * FROM opportunities
     WHERE status='new' AND scam_risk != 'high risk' AND ghana_eligible=1
       AND (opp_type IN ('micro','service','any') OR application_effort <= 2)
     ORDER BY match_score DESC LIMIT 6`,
  );
  const most = await all(
    `SELECT * FROM opportunities
     WHERE status='new' AND estimated_usd > 0
     ORDER BY estimated_usd DESC LIMIT 6`,
  );
  const skillBest = await all(
    `SELECT * FROM opportunities
     WHERE status='new' AND match_score >= 70
     ORDER BY match_score DESC LIMIT 6`,
  );
  const recurring = await all(
    `SELECT * FROM opportunities
     WHERE status='new' AND recurring >= 60
     ORDER BY recurring DESC LIMIT 6`,
  );
  return { applyToday, fastest, most, skillBest, recurring };
}

export async function analytics() {
  const total = await row('SELECT COUNT(*) c FROM opportunities');
  const ghana = await row('SELECT COUNT(*) c FROM opportunities WHERE ghana_eligible=1');
  const byType = await all('SELECT opp_type, COUNT(*) c FROM opportunities GROUP BY opp_type ORDER BY c DESC');
  const bySource = await all('SELECT source, COUNT(*) c FROM opportunities GROUP BY source ORDER BY c DESC LIMIT 8');
  const highFit = await row('SELECT COUNT(*) c FROM opportunities WHERE match_score >= 70');
  const risky = await row('SELECT COUNT(*) c FROM opportunities WHERE scam_risk = ?', ['high risk']);
  const apps = await all('SELECT stage, COUNT(*) c FROM applications GROUP BY stage');
  const won = await row("SELECT COUNT(*) c FROM applications WHERE stage IN ('won','paid')");
  const interviews = await row("SELECT COUNT(*) c FROM applications WHERE stage IN ('interview','offer')");
  const applicationsTotal = await row('SELECT COUNT(*) c FROM applications');

  const ghs = await convert(1, 'GHS');
  return {
    totals: {
      opportunities: total.c,
      ghanaEligible: ghana.c,
      highFit: highFit.c,
      risky: risky.c,
      applications: applicationsTotal.c,
      interviews: interviews.c,
      wins: won.c,
    },
    byType,
    bySource,
    appStages: apps,
    conversion: {
      applicationToInterviewPct: applicationsTotal.c ? Math.round((interviews.c / applicationsTotal.c) * 100) : null,
      interviewToWinPct: interviews.c ? Math.round((won.c / interviews.c) * 100) : null,
    },
    fx: { usdToGhs: ghs.amount, rate: ghs.rate, source: ghs.source, at: ghs.fetched_at },
  };
}

export async function discoverTrends(days = 30) {
  const since = new Date(Date.now() - days * 86400000).toISOString();
  return all('SELECT date(discovered_at) d, COUNT(*) c FROM opportunities WHERE discovered_at >= ? GROUP BY d ORDER BY d DESC LIMIT 14', [since]);
}