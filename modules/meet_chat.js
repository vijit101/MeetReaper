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
 * Updates a textarea using the browser's native setter so React notices the change.
 * @param {HTMLTextAreaElement} input
 * @param {string} value
 */
function setTextareaValue(input, value) {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')?.set;
  setter.call(input, value);
  input.dispatchEvent(new Event('input', { bubbles: true }));
}

/**
 * Sends an Enter key sequence to inputs that submit on Enter.
 * @param {HTMLElement} input
 */
function pressEnter(input) {
  ['keydown', 'keypress', 'keyup'].forEach((type) => {
    input.dispatchEvent(new KeyboardEvent(type, {
      key: 'Enter',
      code: 'Enter',
      keyCode: 13,
      which: 13,
      bubbles: true,
      cancelable: true,
    }));
  });
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
    setTextareaValue(input, message);
  } else {
    document.execCommand('insertText', false, message);
    input.dispatchEvent(new InputEvent('input', { bubbles: true, inputType: 'insertText', data: message }));
  }

  await new Promise((resolve) => setTimeout(resolve, 150));
  const sendButton = findButton([/send a message/i, /^send$/i]);
  if (sendButton && !sendButton.disabled) {
    sendButton.click();
    return true;
  }
  pressEnter(input);
  return true;
}
