const DEFAULT_SETTINGS = {
  autoKillEnabled: true,
  autoKillGraceSecs: 30,
  voteEnabled: true,
  voteTimeoutMs: 60_000,
  voteThresholdPercent: 50,
  inviteGuardEnabled: true,
  overlayVisible: true,
};

const getLocal = (keys) => chrome.storage.local.get(keys);
const setLocal = (value) => chrome.storage.local.set(value);

/**
 * Saves a MeetingSession to local storage.
 * @param {MeetingSession} session - The meeting session to save.
 * @returns {Promise<void>}
 */
export async function saveSession(session) {
  await setLocal({ [`session:${session.meetingId}`]: session });
}

/**
 * Retrieves a MeetingSession by its meeting ID.
 * @param {string} meetingId - The ID of the meeting.
 * @returns {Promise<MeetingSession|null>} The stored session, or null if not found.
 */
export async function getSession(meetingId) {
  const key = `session:${meetingId}`;
  return (await getLocal(key))[key] ?? null;
}

/**
 * Deletes a stored MeetingSession.
 * @param {string} meetingId - The ID of the meeting.
 * @returns {Promise<void>}
 */
export async function deleteSession(meetingId) {
  await chrome.storage.local.remove(`session:${meetingId}`);
}

/**
 * Saves a VoteSession to local storage.
 * @param {VoteSession} voteSession - The vote session to save.
 * @returns {Promise<void>}
 */
export async function saveVoteSession(voteSession) {
  await setLocal({ [`vote:${voteSession.meetingId}`]: voteSession });
}

/**
 * Retrieves the active VoteSession for a meeting.
 * @param {string} meetingId - The ID of the meeting.
 * @returns {Promise<VoteSession|null>} The stored vote session, or null if not found.
 */
export async function getVoteSession(meetingId) {
  const key = `vote:${meetingId}`;
  return (await getLocal(key))[key] ?? null;
}

/**
 * Retrieves user-level settings, falling back to defaults if not set.
 * @returns {Promise<UserSettings>} The current user settings.
 */
export async function getSettings() {
  const { settings = {} } = await getLocal('settings');
  return { ...DEFAULT_SETTINGS, ...settings };
}

/**
 * Saves user-level settings.
 * @param {Partial<UserSettings>} settings - The settings to update.
 * @returns {Promise<void>}
 */
export async function saveSettings(settings) {
  await setLocal({ settings: { ...(await getSettings()), ...settings } });
}
