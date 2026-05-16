const DESCRIPTION_SELECTORS = [
  '[role="textbox"][aria-label="Add description"][contenteditable="true"]',
  '#xDescIn [contenteditable="true"]',
  '.hj99tb.editable[contenteditable="true"]',
];

/**
 * Finds the currently open Google Calendar description editor.
 * @returns {HTMLElement|null}
 */
export function findDescriptionField() {
  return document.querySelector(DESCRIPTION_SELECTORS.join(', '));
}

/**
 * Fires the mouse sequence Google Calendar expects for synthetic clicks.
 * @param {HTMLElement} element
 */
function reactClick(element) {
  ['mousedown', 'mouseup', 'click'].forEach((type) =>
    element.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })),
  );
}

/**
 * Expands a collapsible Google Calendar section if it is closed.
 * @param {string} jsname
 * @returns {boolean} Whether a click was dispatched.
 */
function expandIfCollapsed(jsname) {
  const button = document.querySelector(`[jsname="${jsname}"] button`);
  if (!button || button.getAttribute('aria-expanded') !== 'false') return false;
  reactClick(button);
  return true;
}

/**
 * Opens the Calendar description UI when the event editor has rendered it.
 */
export function openDescriptionEditor() {
  if (findDescriptionField()) return;
  const outerButton = document.querySelector('[jsname="OXFAed"] button');
  if (!outerButton) return;
  if (outerButton.getAttribute('aria-expanded') === 'false') reactClick(outerButton);
  setTimeout(() => expandIfCollapsed('Zqjuqb'), 400);
}

/**
 * Starts watching for the description section and opens it once available.
 * @returns {Function} Disconnect function.
 */
export function watchAndOpenDescriptionEditor() {
  openDescriptionEditor();
  const observer = new MutationObserver(() => {
    if (findDescriptionField()) {
      observer.disconnect();
      return;
    }
    if (document.querySelector('[jsname="OXFAed"] button')) {
      observer.disconnect();
      openDescriptionEditor();
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
  return () => observer.disconnect();
}

/**
 * Appends text through Calendar's contenteditable path so its internal model updates.
 * @param {HTMLElement} field
 * @param {string} line
 */
function injectLine(field, line) {
  const hasContent = field.innerText.trim().length > 0;
  field.focus();
  const range = document.createRange();
  range.selectNodeContents(field);
  range.collapse(false);
  window.getSelection().removeAllRanges();
  window.getSelection().addRange(range);
  document.execCommand('insertText', false, hasContent ? `\n${line}` : line);
}

/**
 * Adds a line and retries once only when Calendar drops the first write while mounting.
 * @param {HTMLElement} field
 * @param {string} line
 */
function injectLineWithRetry(field, line) {
  injectLine(field, line);
  setTimeout(() => {
    const liveField = findDescriptionField();
    if (!liveField) return;
    const lines = liveField.innerText.split('\n').map((value) => value.trim());
    if (!lines.includes(line)) injectLine(liveField, line);
  }, 500);
}

/**
 * Appends an attendee purpose line to the event description.
 * @param {string} email
 * @param {string} reason
 */
export function appendReasonToDescription(email, reason) {
  const line = `${email} - ${reason}`;
  expandIfCollapsed('OXFAed');
  setTimeout(() => expandIfCollapsed('Zqjuqb'), 350);

  const existingField = findDescriptionField();
  if (existingField) {
    injectLineWithRetry(existingField, line);
    return;
  }

  const deadline = Date.now() + 15_000;
  const observer = new MutationObserver(() => {
    const field = findDescriptionField();
    if (field) {
      observer.disconnect();
      injectLineWithRetry(field, line);
      return;
    }
    if (Date.now() > deadline) {
      observer.disconnect();
      console.warn('[MeetReaper] Description field did not appear within 15s.');
    }
  });
  observer.observe(document.documentElement, { childList: true, subtree: true });
}
