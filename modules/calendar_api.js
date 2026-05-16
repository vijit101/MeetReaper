/**
 * Checks if a calendar event matches a Google Meet meeting code.
 * @param {Object} event - The Google Calendar event.
 * @param {string} meetingCode - The meeting code.
 * @returns {boolean} True if the event matches the meeting code.
 */
function eventMatchesMeeting(event, meetingCode) {
  const normalized = meetingCode.toLowerCase();
  if (event.hangoutLink?.toLowerCase().includes(normalized)) return true;
  return (event.conferenceData?.entryPoints ?? []).some((entryPoint) =>
    [entryPoint.meetingCode, entryPoint.uri, entryPoint.label]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(normalized)),
  );
}

/**
 * Converts a Google Calendar event to a MeetReaper MeetingSession.
 * @param {Object} event - The Google Calendar event.
 * @param {string} meetingId - The ID of the meeting.
 * @param {Object} settings - The user settings.
 * @returns {Object|null} The MeetingSession, or null if invalid dates.
 */
function toMeetingSession(event, meetingId, settings) {
  const start = new Date(event.start?.dateTime ?? event.start?.date).getTime();
  const end = new Date(event.end?.dateTime ?? event.end?.date).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end <= start) return null;
  return {
    meetingId,
    meetingCode: meetingId,
    startsAt: start,
    scheduledEndsAt: end,
    scheduledDuration: end - start,
    joinedAt: Date.now(),
    endsAt: end + settings.autoKillGraceSecs * 1000,
    autoKillEnabled: settings.autoKillEnabled,
    status: 'active',
    calendarEventId: event.id,
    calendarSummary: event.summary ?? '',
  };
}

/**
 * Fetches the calendar event matching the given meeting ID to extract duration.
 * @param {string} meetingId - The ID of the meeting.
 * @param {string} token - The OAuth token for Google Calendar API.
 * @param {Object} settings - The user settings.
 * @returns {Promise<Object|null>} The constructed MeetingSession, or null if not found.
 */
export async function fetchMeetingSessionFromCalendar(meetingId, token, settings) {
  const now = Date.now();
  const params = new URLSearchParams({
    timeMin: new Date(now - 12 * 60 * 60 * 1000).toISOString(),
    timeMax: new Date(now + 12 * 60 * 60 * 1000).toISOString(),
    singleEvents: 'true',
    orderBy: 'startTime',
    maxResults: '50',
  });
  const response = await fetch(
    `https://www.googleapis.com/calendar/v3/calendars/primary/events?${params}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );
  if (!response.ok) {
    throw new Error(`Calendar API request failed with ${response.status}`);
  }
  const data = await response.json();
  const event = (data.items ?? []).find((item) => eventMatchesMeeting(item, meetingId));
  return event ? toMeetingSession(event, meetingId, settings) : null;
}
