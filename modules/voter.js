/**
 * Creates a new VoteSession for the given meeting.
 * @param {string} meetingId - The ID of the meeting.
 * @param {number} participantCount - The estimated number of participants.
 * @param {number} [timeoutMs=60000] - Duration in ms before the vote expires.
 * @returns {VoteSession} The newly created vote session.
 */
export function createVoteSession(meetingId, participantCount, timeoutMs = 60_000) {
  return {
    voteId: crypto.randomUUID(),
    meetingId,
    startedAt: Date.now(),
    timeoutMs,
    totalParticipants: Math.max(1, participantCount || 1),
    yesVotes: 0,
    noVotes: 0,
    triggered: false,
    votedTokens: [],
  };
}

/**
 * Generates an anonymous token for the current user (stored in sessionStorage).
 * @returns {string} The anonymous token.
 */
export function generateAnonymousToken() {
  const key = `meetreaper-token`;
  let token = sessionStorage.getItem(key);
  if (!token) {
    token = crypto.randomUUID();
    sessionStorage.setItem(key, token);
  }
  return token;
}

/**
 * Records a single vote if the token hasn't already voted.
 * @param {VoteSession} session - The current vote session.
 * @param {string} anonymousToken - The user's anonymous token.
 * @param {'yes'|'no'} vote - The vote cast.
 * @returns {boolean} True if the vote was accepted, false otherwise.
 */
export function castVote(session, anonymousToken, vote) {
  if (!['yes', 'no'].includes(vote) || session.votedTokens.includes(anonymousToken)) return false;
  session.votedTokens.push(anonymousToken);
  if (vote === 'yes') session.yesVotes += 1;
  else session.noVotes += 1;
  return true;
}

/**
 * Returns the current vote tally as percentages.
 * @param {VoteSession} session - The current vote session.
 * @returns {{ yesPercent: number, noPercent: number, totalVoted: number }} The calculated tally.
 */
export function getVoteTally(session) {
  const totalVoted = session.yesVotes + session.noVotes;
  const yesPercent = totalVoted ? Math.round((session.yesVotes / session.totalParticipants) * 100) : 0;
  const noPercent = totalVoted ? Math.round((session.noVotes / session.totalParticipants) * 100) : 0;
  return { yesPercent, noPercent, totalVoted };
}

/**
 * Checks whether the configured "waste of time" threshold is met.
 * @param {VoteSession} session - The current vote session.
 * @param {number} [thresholdPercent=50] - Percentage required to trigger the result.
 * @returns {boolean} True if the threshold is met.
 */
export function isWasteThresholdMet(session, thresholdPercent = 50) {
  return (session.yesVotes / session.totalParticipants) * 100 > thresholdPercent;
}

/**
 * Checks whether the vote window has expired.
 * @param {VoteSession} session - The current vote session.
 * @returns {boolean} True if the vote has expired.
 */
export function isVoteExpired(session) {
  return Date.now() >= session.startedAt + session.timeoutMs;
}

/**
 * Closes the VoteSession as concluded (evaluates threshold).
 * @param {VoteSession} session - The current vote session.
 * @param {number} [thresholdPercent=50] - Percentage required to trigger the result.
 * @returns {VoteSession} The updated session with the 'triggered' flag set.
 */
export function concludeVoteSession(session, thresholdPercent = 50) {
  return { ...session, triggered: isWasteThresholdMet(session, thresholdPercent) };
}
