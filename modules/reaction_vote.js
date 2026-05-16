const YES_EMOJI = '👍';
const NO_EMOJI = '👎';

/**
 * Estimates the number of participants currently visible in Meet.
 * @returns {number}
 */
export function estimateParticipantCount() {
  return Math.max(1, document.querySelectorAll('[data-participant-id]').length || 1);
}

/**
 * Clicks one of Meet's built-in reaction buttons.
 * @param {string} emojiLabel
 * @returns {Promise<void>}
 */
export async function clickReactionButton(emojiLabel) {
  const reactionToggle = [...document.querySelectorAll('button')].find((button) =>
    /reaction/i.test(button.getAttribute('aria-label') || button.textContent || ''),
  );
  reactionToggle?.click();
  await new Promise((resolve) => setTimeout(resolve, 250));
  const emojiButton = [...document.querySelectorAll('button')].find((button) =>
    (button.getAttribute('aria-label') || button.textContent || '').includes(emojiLabel),
  );
  emojiButton?.click();
}

/**
 * Converts observed reaction counts into percentage values for the UI.
 * @param {number} yesCount
 * @param {number} noCount
 * @param {number} participantCount
 * @returns {{ yesPercent: number, noPercent: number, totalVoted: number }}
 */
function buildTally(yesCount, noCount, participantCount) {
  return {
    yesPercent: Math.round((yesCount / participantCount) * 100),
    noPercent: Math.round((noCount / participantCount) * 100),
    totalVoted: yesCount + noCount,
  };
}

/**
 * Returns every element that may contain a newly rendered Meet reaction.
 * Meet sometimes inserts a wrapper first and the emoji deeper inside it.
 * @param {Node} node
 * @returns {HTMLElement[]}
 */
function getReactionCandidates(node) {
  if (!(node instanceof HTMLElement)) return [];
  return [node, ...node.querySelectorAll('*')];
}

/**
 * Observes Meet reactions for a short voting window.
 * @param {Object} options
 * @param {number} [options.durationMs=10000]
 * @param {(tally: { yesPercent: number, noPercent: number, totalVoted: number }) => void} options.onUpdate
 * @param {(result: { tally: Object, yesCount: number, participantCount: number }) => void} options.onComplete
 */
export function startReactionVote({ durationMs = 10_000, onUpdate, onComplete }) {
  const startedAt = Date.now();
  const yesSeen = new Set();
  const noSeen = new Set();

  const observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      for (const node of mutation.addedNodes) {
        for (const candidate of getReactionCandidates(node)) {
          const text = candidate.getAttribute('aria-label') || candidate.textContent || '';
          if (!text.includes(YES_EMOJI) && !text.includes(NO_EMOJI)) continue;
          const fingerprint = `${text}-${candidate.textContent}-${candidate.outerHTML.slice(0, 120)}`;
          if (text.includes(YES_EMOJI)) yesSeen.add(fingerprint);
          if (text.includes(NO_EMOJI)) noSeen.add(fingerprint);
          onUpdate(buildTally(yesSeen.size, noSeen.size, estimateParticipantCount()));
        }
      }
    }
  });
  observer.observe(document.body, { childList: true, subtree: true });

  setTimeout(() => {
    observer.disconnect();
    const participantCount = estimateParticipantCount();
    onComplete({
      tally: buildTally(yesSeen.size, noSeen.size, participantCount),
      yesCount: yesSeen.size,
      participantCount,
    });
  }, Math.max(0, durationMs - (Date.now() - startedAt)));
}
