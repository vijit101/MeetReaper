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

/**
 * Retrieves the Google Calendar OAuth token.
 * @param {boolean} [interactive=false] - Whether to prompt the user if unauthenticated.
 * @returns {Promise<string|null>} The auth token, or null if unauthenticated.
 */
async function getCalendarToken(interactive = false) {
  const result = await chrome.identity.getAuthToken({ interactive });
  return result?.token ?? null;
}

/**
 * Arms the Chrome alarm for the auto-kill feature.
 * @param {Object} session - The MeetingSession to arm.
 * @returns {Promise<void>}
 */
async function armAutoKillAlarm(session) {
  if (!session?.autoKillEnabled || !session.endsAt) return;
  chrome.alarms.create(`autokill_${session.meetingId}`, { when: session.endsAt });
}

onBackgroundMessage('GET_SESSION', async ({ meetingId }) => {
  const existing = await getSession(meetingId);
  if (existing) return existing;
  const settings = await getSettings();
  if (!settings.autoKillEnabled) return null;
  try {
    const token = await getCalendarToken(false);
    if (!token) return { authRequired: true };
    const session = await fetchMeetingSessionFromCalendar(meetingId, token, settings);
    if (!session) return null;
    await saveSession(session);
    await armAutoKillAlarm(session);
    return session;
  } catch {
    return { authRequired: true };
  }
});

onBackgroundMessage('AUTHORIZE_CALENDAR', async () => {
  const token = await getCalendarToken(true);
  return { authorized: Boolean(token) };
});

/**
 * Sends a raw email using the Gmail API.
 * @param {string} to - Recipient email.
 * @param {string} subject - Email subject.
 * @param {string} body - Email body text.
 * @returns {Promise<boolean>} True if successful.
 */
async function sendGmail(to, subject, body) {
  try {
    if (
      chrome.runtime.getManifest().oauth2?.client_id?.startsWith('REPLACE_WITH_YOUR_OAUTH_CLIENT_ID')
    ) {
      return { success: false, reason: 'oauth_not_configured' };
    }
    let token = await getCalendarToken(false);
    if (!token) token = await getCalendarToken(true);
    if (!token) return { success: false, reason: 'authorization_required' };

    const emailLines = [
      `To: ${to}`,
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      body
    ];
    const emailStr = emailLines.join('\\r\\n');
    
    // Base64url encode the string
    const utf8Bytes = new TextEncoder().encode(emailStr);
    // Note: btoa only works with Latin-1 in browsers, but TextEncoder output requires manual char string construction for utf-8
    const binary = Array.from(utf8Bytes).map(byte => String.fromCharCode(byte)).join('');
    const base64 = btoa(binary);
    const base64Url = base64.replace(/\\+/g, '-').replace(/\\//g, '_').replace(/=+$/, '');

    const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ raw: base64Url })
    });

    if (response.status === 401 || response.status === 403) {
      await chrome.identity.removeCachedAuthToken({ token });
      token = await getCalendarToken(true);
      if (!token) return { success: false, reason: 'authorization_required' };
      const retryResponse = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ raw: base64Url })
      });
      return retryResponse.ok
        ? { success: true }
        : { success: false, reason: `gmail_api_${retryResponse.status}` };
    }
    return response.ok
      ? { success: true }
      : { success: false, reason: `gmail_api_${response.status}` };
  } catch (error) {
    console.error('[MeetReaper] Failed to send email via Gmail API', error);
    return { success: false, reason: 'unexpected_error' };
  }
}

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
  const accepted = castVote(session, token, vote);
  await saveVoteSession(session);
  const tally = getVoteTally(session);
  await broadcastToMeetTabs({ type: 'VOTE_UPDATE', payload: { session, tally } });
  if (isWasteThresholdMet(session)) {
    await broadcastToMeetTabs({
      type: 'MEETING_ENDED',
      payload: { meetingId, reason: 'vote', tally },
    });
  }
  return { accepted, tally };
});

chrome.alarms.onAlarm.addListener(async (alarm) => {
  if (alarm.name.startsWith('vote_timeout_')) {
    const all = await chrome.storage.local.get(null);
    const vote = Object.values(all).find((value) => value?.voteId && `vote_timeout_${value.voteId}` === alarm.name);
    if (!vote) return;
    const concluded = concludeVoteSession(vote);
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
