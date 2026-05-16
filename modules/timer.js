import { formatDurationSummary, formatMsToLabel } from '../utils/time_utils.js';

const timers = new Map();

/**
 * Initializes the meeting countdown (returns the session, mostly for tracking).
 * @param {MeetingSession} session - The current session.
 * @returns {MeetingSession} The initialized session.
 */
export function initTimer(session) {
  return session;
}

/**
 * Returns the number of milliseconds remaining before auto-kill.
 * @param {MeetingSession} session - The current session.
 * @returns {number|null} Milliseconds remaining, or null if endsAt is not set.
 */
export function getRemainingMs(session) {
  if (!session?.endsAt) return null;
  return session.endsAt - Date.now();
}

/**
 * Returns elapsed time since the scheduled meeting start when known,
 * otherwise falls back to time since the user joined.
 * @param {MeetingSession} session - The current session.
 * @returns {string} Elapsed time string.
 */
export function getElapsedLabel(session) {
  return formatMsToLabel(Date.now() - (session.startsAt ?? session.joinedAt));
}

/**
 * Returns the scheduled meeting duration as a formatted string.
 * @param {MeetingSession} session - The current session.
 * @returns {string} Total scheduled duration, or "--:--" when unknown.
 */
export function getTotalLabel(session) {
  return session?.scheduledDuration ? formatDurationSummary(session.scheduledDuration) : '--:--';
}

/**
 * Returns remaining time as a formatted string.
 * @param {MeetingSession} session - The current session.
 * @returns {string} Remaining time string.
 */
export function getRemainingLabel(session) {
  const remaining = getRemainingMs(session);
  return remaining == null ? '--:--' : formatMsToLabel(remaining);
}

/**
 * Checks whether the meeting has exceeded its scheduled duration.
 * @param {MeetingSession} session - The current session.
 * @returns {boolean} True if the meeting is expired.
 */
export function isExpired(session) {
  if (!session?.endsAt) return false;
  const remaining = getRemainingMs(session);
  return remaining != null && remaining <= 0;
}

/**
 * Registers a callback to fire when the meeting expires.
 * @param {MeetingSession} session - The current session.
 * @param {Function} callback - The function to call on expiry.
 * @returns {Function} A cancellation function.
 */
export function onExpiry(session, callback) {
  if (!session?.endsAt) return () => {};
  clearTimer(session.meetingId);
  const delay = Math.max(0, getRemainingMs(session));
  const id = setTimeout(() => {
    timers.delete(session.meetingId);
    callback();
  }, delay);
  timers.set(session.meetingId, id);
  return () => clearTimer(session.meetingId);
}

/**
 * Clears all timers associated with a session ID.
 * @param {string} meetingId - The ID of the meeting.
 * @returns {void}
 */
export function clearTimer(meetingId) {
  const id = timers.get(meetingId);
  if (id) clearTimeout(id);
  timers.delete(meetingId);
}
