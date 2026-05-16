/**
 * @fileoverview Background service worker coordinating cross-tab state and alarms.
 */
import { onBackgroundMessage, broadcastToMeetTabs } from '../modules/messaging.js';
import {
  getSession,
  getVoteSession,
  saveVoteSession,
  getSettings,
  saveSession,
} from '../modules/storage.js';
import {
  createVoteSession,
  castVote,
  getVoteTally,
  isWasteThresholdMet,
  concludeVoteSession,
} from '../modules/voter.js';
import { fetchMeetingSessionFromCalendar } from '../modules/calendar_api.js';
import { getGoogleToken } from '../modules/auth_service.js';
import { sendGmail } from '../modules/gmail_service.js';

/**
 * Arms the Chrome alarm for the auto-kill feature.
 * @param {Object} session - The MeetingSession to arm.
 * @returns {Promise<void>}
 */
async function armAutoKillAlarm(session) {
  if (!session?.autoKillEnabled || !session.endsAt) return;
  chrome.alarms.create(`autokill_${session.meetingId}`, { when: session.endsAt });
}

/**
 * Checks whether a cached session has enough Calendar timing data for the overlay.
 * @param {Object|null} session
 * @returns {boolean}
 */
function hasCalendarTiming(session) {
  return Boolean(
    session
    && Number.isFinite(session.startsAt)
    && Number.isFinite(session.scheduledEndsAt)
    && session.scheduledDuration > 0,
  );
}

onBackgroundMessage('GET_SESSION', async ({ meetingId }) => {
  const existing = await getSession(meetingId);
  if (hasCalendarTiming(existing)) return existing;
  const settings = await getSettings();
  if (!settings.autoKillEnabled) return null;
  try {
    const token = await getGoogleToken(false);
    if (!token) return { authRequired: true };
    const session = await fetchMeetingSessionFromCalendar(meetingId, token, settings);
    if (!session) return existing ?? null;
    await saveSession(session);
    await armAutoKillAlarm(session);
    return session;
  } catch {
    return { authRequired: true };
  }
});

onBackgroundMessage('AUTHORIZE_CALENDAR', async () => {
  const token = await getGoogleToken(true);
  return { authorized: Boolean(token) };
});

onBackgroundMessage('SEND_EMAIL', async ({ to, subject, body }) => {
  return sendGmail(to, subject, body);
});

onBackgroundMessage('START_VOTE', async ({ meetingId, participantCount = 1 }) => {
  const settings = await getSettings();
  const session = createVoteSession(meetingId, participantCount, settings.voteTimeoutMs);
  await saveVoteSession(session);
  chrome.alarms.create(`vote_timeout_${session.voteId}`, { when: session.startedAt + session.timeoutMs });
  await broadcastToMeetTabs({ type: 'VOTE_STARTED', payload: session });
  return session;
});

onBackgroundMessage('CAST_VOTE', async ({ meetingId, token, vote }) => {
  const session = await getVoteSession(meetingId);
  if (!session) return { accepted: false };
  const settings = await getSettings();
  const accepted = castVote(session, token, vote);
  await saveVoteSession(session);
  const tally = getVoteTally(session);
  await broadcastToMeetTabs({ type: 'VOTE_UPDATE', payload: { session, tally } });
  if (isWasteThresholdMet(session, settings.voteThresholdPercent)) {
    await broadcastToMeetTabs({
      type: 'MEETING_ENDED',
      payload: { meetingId, reason: 'vote', tally },
    });
  }
  return { accepted, tally };
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('vote_timeout_')) {
    const settings = await getSettings();
    const all = await chrome.storage.local.get(null);
    const vote = Object.values(all).find((value) => value?.voteId && `vote_timeout_${value.voteId}` === alarm.name);
    if (!vote) return;
    const concluded = concludeVoteSession(vote, settings.voteThresholdPercent);
    await saveVoteSession(concluded);
    await broadcastToMeetTabs({
      type: concluded.triggered ? 'MEETING_ENDED' : 'VOTE_ENDED',
      payload: {
        meetingId: concluded.meetingId,
        session: concluded,
        tally: getVoteTally(concluded),
      },
    });
  }
  if (alarm.name.startsWith('autokill_')) {
    await broadcastToMeetTabs({
      type: 'MEETING_EXPIRED',
      payload: { meetingId: alarm.name.replace('autokill_', '') },
    });
  }
});
