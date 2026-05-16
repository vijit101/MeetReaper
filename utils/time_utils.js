/**
 * Parses a duration string (e.g. "30 min", "1 hour", "1h 30m") into milliseconds.
 * @param {string} raw - The raw duration string.
 * @returns {number} The parsed duration in milliseconds.
 */
export function parseDurationToMs(raw = '') {
  const text = raw.toLowerCase();
  const hours = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:h|hr|hour)/)?.[1] ?? 0);
  const mins = Number(text.match(/(\d+(?:\.\d+)?)\s*(?:m|min|minute)/)?.[1] ?? 0);
  return Math.round((hours * 60 + mins) * 60_000);
}

/**
 * Formats a duration in milliseconds to an "MM:SS" display string.
 * @param {number} ms - The duration in milliseconds.
 * @returns {string} The formatted duration string.
 */
export function formatMsToLabel(ms) {
  const sign = ms < 0 ? '-' : '';
  const totalSeconds = Math.floor(Math.abs(ms) / 1000);
  const minutes = String(Math.floor(totalSeconds / 60)).padStart(2, '0');
  const seconds = String(totalSeconds % 60).padStart(2, '0');
  return `${sign}${minutes}:${seconds}`;
}

/**
 * Returns a human-readable "X min remaining" string.
 * @param {number} ms - The remaining duration in milliseconds.
 * @returns {string} The humanized string.
 */
export function humanizeRemaining(ms) {
  if (ms <= 0) return 'time is up';
  const mins = Math.ceil(ms / 60_000);
  return `${mins} min${mins === 1 ? '' : 's'} remaining`;
}

/**
 * Formats a scheduled duration for compact UI labels such as "1 hr" or "1 hr 30 min".
 * @param {number} ms - Duration in milliseconds.
 * @returns {string}
 */
export function formatDurationSummary(ms) {
  const totalMinutes = Math.round(ms / 60_000);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  if (!hours) return `${minutes} min`;
  if (!minutes) return `${hours} hr${hours === 1 ? '' : 's'}`;
  return `${hours} hr${hours === 1 ? '' : 's'} ${minutes} min`;
}
