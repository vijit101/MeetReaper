import { createElement, safeClick } from '../utils/dom_utils.js';
import { logger } from '../utils/logger.js';

/**
 * Ends the meeting for the current user by clicking the "Leave call" button.
 * @returns {Promise<void>}
 */
export async function leaveMeeting() {
  try {
    await safeClick('[aria-label*="Leave call"], [data-tooltip*="Leave call"]');
  } catch (error) {
    logger.warn('Could not find leave button', error);
  }
}

/**
 * Attempts to end the meeting for all participants (host-only capability).
 * Falls back to leaveMeeting() if not host or if the button is not found.
 * @returns {Promise<void>}
 */
export async function endMeetingForAll() {
  try {
    await safeClick('[aria-label*="Leave call"], [data-tooltip*="Leave call"]');
    
    // Wait for the modal and click "End call for everyone"
    const endForAllButton = await new Promise((resolve, reject) => {
      let interval;
      const timeout = setTimeout(() => {
        clearInterval(interval);
        reject(new Error('Timeout finding End call for everyone button'));
      }, 3000);
      
      interval = setInterval(() => {
        const btn = [...document.querySelectorAll('button')].find((node) =>
          /end call for everyone/i.test(node.textContent || ''),
        );
        if (btn) {
          clearTimeout(timeout);
          clearInterval(interval);
          resolve(btn);
        }
      }, 100);
    });
    
    endForAllButton.click();
  } catch (error) {
    logger.warn('Could not end meeting for everyone, falling back to leave', error);
    await leaveMeeting();
  }
}

/**
 * Checks whether the current user is the meeting host.
 * @returns {boolean} True if the user is a host.
 */
export function isHost() {
  return [...document.querySelectorAll('button')].some((node) =>
    /host controls/i.test(node.getAttribute('aria-label') || node.textContent || ''),
  );
}

/**
 * Shows the pre-eject countdown toast ("Meeting ending in X s...").
 * @param {number} countdownSecs - Number of seconds to countdown.
 * @param {Function} onConfirm - Called when the countdown completes.
 * @param {Function} [onCancel] - Called if the user cancels the countdown.
 * @returns {void}
 */
export function showEjectCountdown(countdownSecs, onConfirm, onCancel) {
  document.getElementById('meetreaper-countdown')?.remove();
  const toast = createElement(`
    <div id="meetreaper-countdown" class="meetreaper-toast">
      <strong>Meeting ending in <span>${countdownSecs}</span>s…</strong>
      ${onCancel ? '<button type="button">Cancel</button>' : ''}
    </div>
  `);
  document.body.append(toast);
  const label = toast.querySelector('span');
  let remaining = countdownSecs;
  const interval = setInterval(() => {
    remaining -= 1;
    label.textContent = remaining;
    if (remaining <= 0) {
      clearInterval(interval);
      toast.remove();
      onConfirm();
    }
  }, 1000);
  toast.querySelector('button')?.addEventListener('click', () => {
    clearInterval(interval);
    toast.remove();
    onCancel?.();
  });
}
