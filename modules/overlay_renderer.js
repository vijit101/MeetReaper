import { createElement } from '../utils/dom_utils.js';

/**
 * Injects the MeetReaper overlay into the Google Meet DOM.
 * @returns {HTMLElement} The injected overlay root element.
 */
export function injectOverlay() {
  document.getElementById('meetreaper-overlay')?.remove();
  const root = createElement(`
    <section id="meetreaper-overlay" class="meetreaper-overlay">
      <div class="meetreaper-overlay-body">
        <header class="meetreaper-overlay-header">
          <span>MeetReaper</span>
          <button data-toggle-overlay type="button" aria-expanded="true">Minimize</button>
        </header>
        <div class="meetreaper-time">
          <strong><span data-elapsed>00:00</span> / <span data-total>--:--</span></strong>
          <small><span data-remaining>--:--</span> remaining</small>
        </div>
        <button data-trigger-vote type="button">Vibe Check</button>
        <div class="meetreaper-vote" hidden>
          <div class="meetreaper-vote-bar"><span></span></div>
          <small data-vote-label>0% say waste</small>
        </div>
      </div>
      <button data-expand-overlay class="meetreaper-overlay-pill" type="button" aria-label="Expand MeetReaper panel">
        MeetReaper
      </button>
    </section>
  `);
  root.querySelector('[data-toggle-overlay]').addEventListener('click', () => {
    toggleCollapsed(root);
  });
  root.querySelector('[data-expand-overlay]').addEventListener('click', () => {
    toggleCollapsed(root);
  });
  document.body.append(root);
  return root;
}

/**
 * Updates the timer display on the overlay.
 * @param {HTMLElement} root - The overlay root element.
 * @param {string} elapsedLabel - The elapsed time string.
 * @param {string} totalLabel - The total scheduled meeting time string.
 * @param {string} remainingLabel - The remaining time string.
 * @param {boolean} isOverrun - Whether the meeting has overrun its duration.
 * @returns {void}
 */
export function updateTimerDisplay(root, elapsedLabel, totalLabel, remainingLabel, isOverrun) {
  root.querySelector('[data-elapsed]').textContent = elapsedLabel;
  root.querySelector('[data-total]').textContent = totalLabel;
  root.querySelector('[data-remaining]').textContent = remainingLabel;
  root.classList.toggle('is-overrun', isOverrun);
}

/**
 * Expands or collapses the overlay body to reduce distraction during calls.
 * @param {HTMLElement} root
 */
export function toggleCollapsed(root) {
  const isCollapsed = root.classList.toggle('is-collapsed');
  const button = root.querySelector('[data-toggle-overlay]');
  button.textContent = isCollapsed ? 'Expand' : 'Minimize';
  button.setAttribute('aria-expanded', String(!isCollapsed));
}

/**
 * Updates the vote progress bar on the overlay.
 * @param {HTMLElement} root - The overlay root element.
 * @param {Object} tally - The current vote tally.
 * @returns {void}
 */
export function updateVoteBar(root, tally) {
  root.querySelector('.meetreaper-vote-bar span').style.width = `${tally.yesPercent}%`;
  root.querySelector('[data-vote-label]').textContent = `${tally.yesPercent}% say waste (${tally.totalVoted} voted)`;
}

/**
 * Switches the overlay into "voting active" mode.
 * @param {HTMLElement} root - The overlay root element.
 * @returns {void}
 */
export function showVotingState(root) {
  root.querySelector('.meetreaper-vote').hidden = false;
  root.querySelector('[data-trigger-vote]').disabled = true;
}

/**
 * Resets the overlay to the idle state.
 * @param {HTMLElement} root - The overlay root element.
 * @returns {void}
 */
export function showIdleState(root) {
  root.querySelector('.meetreaper-vote').hidden = true;
  root.querySelector('[data-trigger-vote]').disabled = false;
}

/**
 * Removes the overlay from the DOM entirely.
 * @returns {void}
 */
export function removeOverlay() {
  document.getElementById('meetreaper-overlay')?.remove();
}
