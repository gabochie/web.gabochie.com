// Command-line interface: seed / discover / report / export / analytics / serve / reset.

import { db, all, row, run } from './db.js';
import { log } from './logger.js';
import { seedAll, SEED_DATE } from './seed.js';
import { runDiscovery } from './discover/agents.js';
import { generateDailyReport, generateWeeklyReport, latestReport } from './engines/report.js';
import { analytics } from './engines/analytics.js';
import { loadWeights, saveWeights } from './engine_utils.js';
import { startServer } from './server.js';
import { config } from './config.js';
import { refreshRates } from './data/exchange_rates.js';

const cmd = process.argv[2];
const arg2 = process.argv[3];

async function main() {
  switch (cmd) {
    case 'seed': {
      const r = await seedAll();
      console.log(`Seeded database. Opportunities seeded: ${r.seeded}. FX: ${r.fx.ok ? 'live' : 'fallback+offline'}.`);
      break;
    }
    case 'discover': {
      await seedAll({ refreshFx: false });
      const r = await runDiscovery();
      console.log(`Discovery run #${r.runId}: attempted ${r.sourcesAttempted} sources, succeeded ${r.sourcesSucceeded}, fetched ${r.fetched}, new ${r.added}, dupes ${r.dupes}, rejected ${r.rejected}`);
      if (r.errors.length) console.log('Errors:', r.errors.map((e) => `${e.source}: ${e.error}`).join(' | '));
      break;
    }
    case 'report': {
      await ensureSeed();
      const kind = arg2 || 'daily';
      const out = kind === 'weekly' ? generateWeeklyReport() : generateDailyReport();
      console.log(out.body);
      break;
    }
    case 'export': {
      await ensureSeed();
      const format = arg2 || 'csv';
      const { serialize } = await import('./export.js');
      const file = serialize(format);
      console.log('Wrote', file);
      break;
    }
    case 'analytics': {
      await ensureSeed();
      console.log(JSON.stringify(analytics(), null, 2));
      break;
    }
    case 'gap': {
      await ensureSeed();
      const { gapAnalysis, patterns } = await import('./engines/report.js');
      const g = gapAnalysis();
      console.log('SKILL GAPS');
      for (const r of g.learningPriority) console.log(` - ${r.skill} [${r.category}] demand ${r.market_demand}/100 vs level ${r.level}/5 => gap ${r.gap}`);
      console.log('\nMARKET PATTERNS');
      for (const p of patterns().slice(0, 8)) console.log(` - "${p.pattern}": ${p.count} mentions`);
      break;
    }
    case 'payments': {
      await ensureSeed();
      console.table(all('SELECT name, ghana_signup, can_receive, withdraw_bank, mobile_money, status, confidence, verified_date FROM payment_providers'));
      break;
    }
    case 'sources': {
      await ensureSeed();
      console.table(all('SELECT name, type, access_method, reliability, enabled, last_count FROM sources'));
      break;
    }
    case 'weights': {
      await ensureSeed();
      if (arg2 === 'reset') {
        saveWeights(loadWeights());
        console.log('Weights reset to defaults');
      } else {
        console.log(loadWeights());
      }
      break;
    }
    case 'serve': {
      await ensureSeed();
      console.log(`Starting ${config.appName} on http://${config.host}:${config.port}`);
      startServer(config.port, config.host);
      break;
    }
    case 'reset': {
      db().exec('DELETE FROM applications; DELETE FROM reports; DELETE FROM alerts; DELETE FROM discovery_runs; DELETE FROM opportunities; DELETE FROM settings; DELETE FROM meta;');
      const r = await seedAll();
      console.log('Reset + reseeded. Opportunities:', r.seeded);
      break;
    }
    case 'inspect': {
      await ensureSeed();
      const n = row('SELECT COUNT(*) c FROM opportunities');
      console.log('opportunities:', n.c);
      console.log('sources:', row('SELECT COUNT(*) c FROM sources').c);
      console.log('payments:', row('SELECT COUNT(*) c FROM payment_providers').c);
      console.log('skills:', row('SELECT COUNT(*) c FROM skills').c);
      console.log('applications:', row('SELECT COUNT(*) c FROM applications').c);
      break;
    }
    case 'alert-test': {
      const { createAlert } = await import('./engines/report.js');
      createAlert('test', 'Alert system OK', 'Config check', null, 'info');
      console.log('skipped');
      break;
    }
    case 'fx': {
      const r = await refreshRates();
      console.log(r.ok ? `FX refreshed at ${r.at}` : `FX refresh failed: ${r.error}`);
      break;
    }
    default:
      console.log(`Commands:
  seed          Seed registries with researched data
  discover      Run a discovery pass over enabled sources
  report [d|weekly]  Generate daily (default) or weekly intelligence report
  export [csv|json]  Export opportunities data
  analytics     Show dashboard metrics
  gap           Show skill-gap analysis + market patterns
  payments      Show payment compatibility matrix
  sources       Show source registry
  weights [reset]   Show or reset scoring weights
  serve         Start the dashboard server
  reset         Wipe opportunities/applications/reports and reseed
  inspect       Show data counts
  fx            Refresh exchange rates`);
  }
}

async function ensureSeed() {
  const n = row('SELECT COUNT(*) c FROM opportunities');
  if (n.c === 0) {
    log.info('Empty DB - seeding');
    await seedAll({ refreshFx: false });
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});