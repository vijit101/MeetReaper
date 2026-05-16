import { createElement } from '../utils/dom_utils.js';

/**
 * Renders the reaction-vote choice modal.
 * @param {(vote: 'yes'|'no') => void|Promise<void>} onVote
 */
export function showVoteModal(onVote) {
  document.getElementById('meetreaper-vote-modal')?.remove();
  const modal = createElement(`
    <div id="meetreaper-vote-modal" class="meetreaper-modal">
      <strong>Emergency vibe check</strong>
      <p>
        A quick vote on whether the meeting is still helping the agenda move forward.
        If most people feel the vibe is no longer productive, MeetReaper may close the call.
      </p>
      <p>Use Meet reactions in the next 10 seconds.</p>
      <button data-vote="yes">👍 Waste</button>
      <button data-vote="no">👎 Worth it</button>
    </div>
  `);
  modal.addEventListener('click', async (event) => {
    const vote = event.target.dataset.vote;
    if (!vote) return;
    await onVote(vote);
    modal.remove();
  });
  document.body.append(modal);
}

/**
 * Shows the final vote tally before the meeting closes or returns to idle state.
 * @param {{ yesPercent: number, totalVoted: number }} tally
 * @param {Object} options
 * @param {boolean} options.isEnding - Whether this result will end the meeting.
 * @param {number} [options.countdownSecs=10] - Seconds before the call closes.
 * @param {Function} [options.onCancel] - Called when the user cancels the close flow.
 */
export function showVoteResult(tally, { isEnding, countdownSecs = 10, onCancel } = {}) {
  document.getElementById('meetreaper-vote-modal')?.remove();
  document.getElementById('meetreaper-vote-result')?.remove();
  const modal = createElement(`
    <div id="meetreaper-vote-result" class="meetreaper-modal">
      <strong>Vote result</strong>
      <p>${tally.yesPercent}% say this meeting is a waste of time.</p>
      <div class="meetreaper-vote">
        <div class="meetreaper-vote-bar"><span style="width:${tally.yesPercent}%"></span></div>
        <small>${tally.totalVoted} participant${tally.totalVoted === 1 ? '' : 's'} voted</small>
      </div>
      <p class="meetreaper-result-countdown">
        ${
          isEnding
            ? `Majority voted to close this meeting. Closing in <span>${countdownSecs}</span>s.`
            : 'The meeting keeps its vibe for now.'
        }
      </p>
      ${isEnding ? '<button data-cancel-close type="button">Cancel close</button>' : ''}
    </div>
  `);
  document.body.append(modal);
  if (!isEnding) {
    setTimeout(() => modal.remove(), 3000);
    return;
  }

  let remaining = countdownSecs;
  const label = modal.querySelector('.meetreaper-result-countdown span');
  const interval = setInterval(() => {
    remaining -= 1;
    label.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(interval);
      modal.remove();
    }
  }, 1000);
  modal.querySelector('[data-cancel-close]').addEventListener('click', () => {
    clearInterval(interval);
    modal.remove();
    onCancel?.();
  });
}
