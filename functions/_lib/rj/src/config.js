// Worker-safe config: no node:fs / node:path imports. Env-driven with sensible defaults.

function env(key) {
  if (typeof process !== 'undefined' && process.env) return process.env[key];
  return undefined;
}

const toInt = (v, d) => (Number.isFinite(Number(v)) && v !== '' && v != null ? Number(v) : d);
const toBool = (v, d) => (v == null || v === '' ? d : String(v).toLowerCase() === 'true');

export const config = {
  appName: env('APP_NAME') || 'Remote Jobs',
  port: toInt(env('PORT'), 8787),
  host: env('HOST') || '127.0.0.1',
  dataDir: env('DATA_DIR') || '',
  dbPath: env('DB_PATH') || '',
  timezone: env('TIMEZONE') || 'Africa/Accra',
  discovery: {
    mode: env('DISCOVERY_MODE') || 'http',
    maxPerSource: toInt(env('MAX_PER_SOURCE'), 50),
    fetchTimeoutMs: toInt(env('FETCH_TIMEOUT_MS'), 20000),
    politeDelayMs: toInt(env('POLITE_DELAY_MS'), 800),
    searchEnabled: toBool(env('SEARCH_ENABLED'), false),
    searchFeedUrl: env('SEARCH_FEED_URL') || '',
  },
  ai: {
    provider: env('AI_PROVIDER') || '',
    apiKey: env('AI_API_KEY') || '',
    model: env('AI_MODEL') || '',
  },
  alerts: {
    emailCmd: env('ALERT_EMAIL_CMD') || '',
  },
};

export function resolveDbPath() {
  if (config.dbPath) return config.dbPath;
  if (config.dataDir) return config.dataDir + '/radar.db';
  const cwd = typeof process !== 'undefined' && process.cwd ? process.cwd() : '.';
  return cwd + '/data/radar.db';
}