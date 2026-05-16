/**
 * Waits for a DOM element matching `selector` to appear, with a timeout.
 * @param {string} selector - The CSS selector to wait for.
 * @param {number} [timeoutMs=10000] - Timeout in milliseconds.
 * @returns {Promise<Element>} Resolves with the found element.
 * @throws {Error} If the timeout is reached before the element is found.
 */
export async function waitForElement(selector, timeoutMs = 10_000) {
  const existing = document.querySelector(selector);
  if (existing) return existing;

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timed out waiting for ${selector}`));
    }, timeoutMs);
    const observer = new MutationObserver(() => {
      const element = document.querySelector(selector);
      if (!element) return;
      clearTimeout(timer);
      observer.disconnect();
      resolve(element);
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  });
}

/**
 * Safely waits for an element and clicks it.
 * @param {string} selector - The CSS selector of the element to click.
 * @returns {Promise<void>}
 */
export async function safeClick(selector) {
  const element = await waitForElement(selector, 3_000);
  element.click();
}

/**
 * Creates a DOM element from an HTML string.
 * @param {string} html - The HTML string.
 * @returns {HTMLElement} The created element.
 */
export function createElement(html) {
  const template = document.createElement('template');
  template.innerHTML = html.trim();
  return template.content.firstElementChild;
}

/**
 * Inserts `child` as the first child of `parent` if it is not already a descendant.
 * @param {HTMLElement} parent - The parent element.
 * @param {HTMLElement} child - The child element to insert.
 * @returns {void}
 */
export function prependOnce(parent, child) {
  if (!parent.contains(child)) parent.prepend(child);
}
