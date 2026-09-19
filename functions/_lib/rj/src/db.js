// Async database adapter: D1 (Cloudflare) primary; node:sqlite fallback for local CLI/tests.

import { log } from './logger.js';

const SCHEMA = `
CREATE TABLE IF NOT EXISTS meta (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS skills (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  category TEXT,
  level INTEGER DEFAULT 1,
  evidence TEXT,
  market_demand INTEGER DEFAULT 50,
  avg_comp TEXT,
  learning_priority INTEGER DEFAULT 3,
  keywords TEXT DEFAULT '[]',
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS portfolio (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  skills TEXT DEFAULT '[]',
  industry TEXT,
  tools TEXT DEFAULT '[]',
  problem TEXT,
  outcome TEXT,
  url TEXT,
  case_study TEXT,
  categories TEXT DEFAULT '[]',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS sources (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  type TEXT,
  country TEXT,
  categories TEXT DEFAULT '[]',
  access_method TEXT DEFAULT 'manual',
  feed_url TEXT,
  update_freq TEXT,
  reliability TEXT DEFAULT 'needs verification',
  terms_status TEXT,
  enabled INTEGER DEFAULT 1,
  last_scanned TEXT,
  last_success TEXT,
  last_count INTEGER DEFAULT 0,
  notes TEXT
);

CREATE TABLE IF NOT EXISTS payment_providers (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  url TEXT,
  ghana_signup TEXT DEFAULT 'unknown',
  can_receive TEXT DEFAULT 'unknown',
  withdraw_bank TEXT DEFAULT 'unknown',
  mobile_money TEXT DEFAULT 'unknown',
  supported_currencies TEXT,
  fees TEXT,
  min_withdraw TEXT,
  kyc TEXT,
  tax_notes TEXT,
  restrictions TEXT,
  profile_type TEXT,
  verified_date TEXT,
  source TEXT,
  confidence TEXT DEFAULT 'unknown',
  status TEXT DEFAULT 'needs verification',
  notes TEXT
);

CREATE TABLE IF NOT EXISTS opportunities (
  id TEXT PRIMARY KEY,
  normalized_hash TEXT UNIQUE,
  duplicate_of TEXT,
  title TEXT NOT NULL,
  company TEXT,
  opp_type TEXT,
  category TEXT,
  description TEXT,
  url TEXT,
  apply_url TEXT,
  source TEXT,
  source_url TEXT,
  country TEXT,
  geo_eligibility TEXT DEFAULT 'Unknown',
  ghana_eligible INTEGER DEFAULT 0,
  ghana_eligibility_evidence TEXT,
  remote_status TEXT,
  skills TEXT DEFAULT '[]',
  experience_req TEXT,
  education_req TEXT,
  language_req TEXT,
  portfolio_req TEXT,
  deadline TEXT,
  opening_date TEXT,
  compensation_raw TEXT,
  currency TEXT,
  compensation_type TEXT DEFAULT 'unknown',
  estimated_usd REAL,
  payment_frequency TEXT,
  payment_methods TEXT DEFAULT '[]',
  ghana_payment_compat TEXT DEFAULT '{}',
  time_commitment TEXT,
  difficulty INTEGER DEFAULT 3,
  competition INTEGER DEFAULT 3,
  application_effort INTEGER DEFAULT 3,
  freshness INTEGER DEFAULT 50,
  source_reliability TEXT DEFAULT 'needs verification',
  scam_risk TEXT DEFAULT 'needs verification',
  verification_status TEXT DEFAULT 'Unknown',
  scam_reasons TEXT DEFAULT '[]',
  match_score INTEGER DEFAULT 0,
  score_breakdown TEXT DEFAULT '{}',
  income_potential INTEGER DEFAULT 0,
  strategic_value INTEGER DEFAULT 0,
  skill_growth INTEGER DEFAULT 0,
  recurring INTEGER DEFAULT 0,
  long_term INTEGER DEFAULT 0,
  strategy_tags TEXT DEFAULT '[]',
  portfolio_match TEXT DEFAULT '[]',
  application_assistant TEXT DEFAULT '{}',
  economics TEXT DEFAULT '{}',
  notes TEXT,
  discovered_at TEXT,
  last_verified TEXT,
  status TEXT DEFAULT 'new',
  matched_queries TEXT DEFAULT '[]'
);

CREATE TABLE IF NOT EXISTS applications (
  id TEXT PRIMARY KEY,
  opportunity_id TEXT REFERENCES opportunities(id),
  stage TEXT DEFAULT 'discovered',
  applied_at TEXT,
  follow_up_at TEXT,
  contact TEXT,
  documents TEXT DEFAULT '[]',
  proposal TEXT,
  cover_letter TEXT,
  compensation_agreed TEXT,
  payment_method TEXT,
  result TEXT,
  notes TEXT,
  updated_at TEXT
);

CREATE TABLE IF NOT EXISTS search_queries (
  id TEXT PRIMARY KEY,
  query TEXT NOT NULL,
  status TEXT DEFAULT 'active',
  last_run TEXT,
  runs INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS discovery_runs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  started_at TEXT,
  finished_at TEXT,
  mode TEXT,
  sources_attempted INTEGER DEFAULT 0,
  sources_succeeded INTEGER DEFAULT 0,
  items_fetched INTEGER DEFAULT 0,
  items_new INTEGER DEFAULT 0,
  items_duplicate INTEGER DEFAULT 0,
  items_rejected INTEGER DEFAULT 0,
  errors TEXT DEFAULT '[]',
  raw_items INTEGER DEFAULT 0,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS reports (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,
  period TEXT,
  generated_at TEXT,
  content TEXT,
  summary TEXT
);

CREATE TABLE IF NOT EXISTS alerts (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,
  severity TEXT DEFAULT 'info',
  headline TEXT,
  body TEXT,
  opportunity_id TEXT,
  created_at TEXT,
  read INTEGER DEFAULT 0
);

CREATE TABLE IF NOT EXISTS settings (
  key TEXT PRIMARY KEY,
  value TEXT
);

CREATE TABLE IF NOT EXISTS exchange_rates (
  base TEXT,
  quote TEXT,
  rate REAL,
  source TEXT,
  fetched_at TEXT,
  PRIMARY KEY (base, quote)
);

CREATE TABLE IF NOT EXISTS discovery_notes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  kind TEXT,
  payload TEXT DEFAULT '{}',
  created_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_opp_status ON opportunities(status);
CREATE INDEX IF NOT EXISTS idx_opp_type ON opportunities(opp_type);
CREATE INDEX IF NOT EXISTS idx_opp_ghana ON opportunities(ghana_eligible);
CREATE INDEX IF NOT EXISTS idx_opp_match ON opportunities(match_score);
CREATE INDEX IF NOT EXISTS idx_opp_deadline ON opportunities(deadline);
`;

class D1Driver {
  constructor(d1) {
    this.d1 = d1;
  }

  async exec(sql) {
    await this.d1.exec(sql);
  }

  async run(sql, params = []) {
    const r = await this.d1.prepare(sql).bind(...params).run();
    return { changes: r.meta?.changes ?? 0, lastInsertRowid: r.meta?.last_row_id ?? 0 };
  }

  async all(sql, params = []) {
    const r = await this.d1.prepare(sql).bind(...params).all();
    return r.results ?? [];
  }

  async row(sql, params = []) {
    return this.d1.prepare(sql).bind(...params).first();
  }
}

class SqliteDriver {
  constructor(handle) {
    this.handle = handle;
  }

  async exec(sql) {
    this.handle.exec(sql);
  }

  async run(sql, params = []) {
    const stmt = this.handle.prepare(sql);
    const out = stmt.run(...params);
    stmt.finalize();
    return { changes: out.changes, lastInsertRowid: Number(out.lastInsertRowid) };
  }

  async all(sql, params = []) {
    const stmt = this.handle.prepare(sql);
    const rows = stmt.all(...params);
    stmt.finalize();
    return rows;
  }

  async row(sql, params = []) {
    const stmt = this.handle.prepare(sql);
    const out = stmt.get(...params);
    stmt.finalize();
    return out;
  }
}

let _driverPromise = null;

export function bindD1(d1) {
  if (d1) _driverPromise = Promise.resolve(new D1Driver(d1));
}

async function createSqliteDriver() {
  const { DatabaseSync } = await import('node:sqlite');
  const { resolveDbPath } = await import('./config.js');
  log.debug('Initialising SQLite database', resolveDbPath());
  const handle = new DatabaseSync(resolveDbPath());
  handle.exec('PRAGMA journal_mode = WAL;');
  handle.exec('PRAGMA foreign_keys = ON;');
  return new SqliteDriver(handle);
}

export async function db() {
  if (!_driverPromise) {
    _driverPromise = (async () => {
      const driver = await createSqliteDriver();
      await driver.exec(SCHEMA);
      return driver;
    })();
  }
  const driver = await _driverPromise;
  return driver;
}

export async function run(sql, params = []) {
  const driver = await db();
  return driver.run(sql, params);
}

export async function all(sql, params = []) {
  const driver = await db();
  return driver.all(sql, params);
}

export async function row(sql, params = []) {
  const driver = await db();
  return driver.row(sql, params);
}

export async function setMeta(key, value) {
  await run('INSERT INTO meta(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, value]);
}

export async function getMeta(key) {
  const r = await row('SELECT value FROM meta WHERE key=?', [key]);
  return r ? r.value : null;
}

export async function getSetting(key, fallback = null) {
  const r = await row('SELECT value FROM settings WHERE key=?', [key]);
  if (!r) return fallback;
  try { return JSON.parse(r.value); } catch { return r.value; }
}

export async function setSetting(key, value) {
  await run('INSERT INTO settings(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value', [key, JSON.stringify(value)]);
}

export async function migrate(driver) {
  await driver.exec(SCHEMA);
}