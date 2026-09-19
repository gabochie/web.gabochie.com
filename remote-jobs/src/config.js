import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');

// Minimal .env loader (no external deps). Overrides process env only when not already set.
function loadEnv() {
  const envFile = path.join(ROOT, '.env');
  if (!fs.existsSync(envFile)) return;
  const lines = fs.readFileSync(envFile, 'utf8').split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf('=');
    if (idx === -1) continue;
    const key = line.slice(0, idx).trim();
    let value = line.slice(idx + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}
loadEnv();

const toInt = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const toBool = (v, d) => (v == null || v === '' ? d : String(v).toLowerCase() === 'true');

export const config = {
  appName: process.env.APP_NAME || 'Global Opportunity Radar',
  port: toInt(process.env.PORT, 8787),
  host: process.env.HOST || '127.0.0.1',
  dataDir: process.env.DATA_DIR || path.join(ROOT, 'data'),
  dbPath: process.env.DB_PATH || '',
  timezone: process.env.TIMEZONE || 'Africa/Accra',
  discovery: {
    mode: process.env.DISCOVERY_MODE || 'http',
    maxPerSource: toInt(process.env.MAX_PER_SOURCE, 50),
    fetchTimeoutMs: toInt(process.env.FETCH_TIMEOUT_MS, 20000),
    politeDelayMs: toInt(process.env.POLITE_DELAY_MS, 800),
    searchEnabled: toBool(process.env.SEARCH_ENABLED, false),
    searchFeedUrl: process.env.SEARCH_FEED_URL || '',
  },
  ai: {
    provider: process.env.AI_PROVIDER || '',
    apiKey: process.env.AI_API_KEY || '',
    model: process.env.AI_MODEL || '',
  },
  alerts: {
    emailCmd: process.env.ALERT_EMAIL_CMD || '',
  },
};

export function resolveDbPath() {
  if (config.dbPath) return config.dbPath;
  return path.join(config.dataDir, 'radar.db');
}

export function ensureDataDir() {
  fs.mkdirSync(config.dataDir, { recursive: true });
}