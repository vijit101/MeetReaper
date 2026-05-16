/**
 * Finds a visible button whose accessible text matches one of the patterns.
 * @param {RegExp[]} patterns
 * @returns {HTMLButtonElement|null}
 */
function findButton(patterns) {
  return [...document.querySelectorAll('button')].find((button) => {
    const label = `${button.getAttribute('aria-label') ?? ''} ${button.textContent ?? ''}`;
    return patterns.some((pattern) => pattern.test(label));
  }) ?? null;
}

/**
 * Tries to post a system-style explanation into Google Meet chat.
 * This is intentionally best-effort because Meet's DOM can vary by account/UI version.
 * @param {string} message
 * @returns {Promise<boolean>} Whether a send action was attempted successfully.
 */
export async function sendChatMessage(message) {
  const chatButton = findButton([/chat with everyone/i, /^chat$/i]);
  chatButton?.click();
  await new Promise((resolve) => setTimeout(resolve, 350));

  const input = document.querySelector(
    'textarea[aria-label*="message" i], textarea, [contenteditable="true"][role="textbox"]',
  );
  if (!input) return false;

  input.focus();
  if (input instanceof HTMLTextAreaElement) {
    input.value = message;
    input.dispatchEvent(new Event('input', { bubbles: true }));
  } else {
    input.textContent = message;
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
  }

  const sendButton = findButton([/send a message/i, /^send$/i]);
  if (!sendButton) return false;
  sendButton.click();
  return true;
}
