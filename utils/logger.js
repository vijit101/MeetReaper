const PREFIX = '[MeetReaper]';

function write(level, ...args) {
  console[level](PREFIX, ...args);
}

/**
 * Scoped console logger for the MeetReaper extension.
 * @namespace logger
 */
export const logger = {
  debug: (...args) => write('debug', ...args),
  info: (...args) => write('info', ...args),
  warn: (...args) => write('warn', ...args),
  error: (...args) => write('error', ...args),
};
