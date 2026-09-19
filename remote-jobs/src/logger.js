const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };
const level = LEVELS[(process.env.LOG_LEVEL || 'info').toLowerCase()] || LEVELS.info;

function ts() {
  return new Date().toISOString();
}

function emit(lvl, args) {
  const prefix = `[${ts()}] ${lvl.toUpperCase().padEnd(5)}`;
  if (args.length === 1 && typeof args[0] === 'string') {
    console.log(`${prefix} ${args[0]}`);
  } else {
    console.log(prefix, ...args);
  }
}

export const log = {
  debug(...a) { if (level <= LEVELS.debug) emit('debug', a); },
  info(...a) { if (level <= LEVELS.info) emit('info', a); },
  warn(...a) { if (level <= LEVELS.warn) emit('warn', a); },
  error(...a) { if (level <= LEVELS.error) emit('error', a); },
};