/**
 * @fileoverview Main content script injected into calendar.google.com to run Invite Guard.
 */
(async () => {
  const [calendarGuard, storage] = await Promise.all([
    import(chrome.runtime.getURL('modules/calendar_guard.js')),
    import(chrome.runtime.getURL('modules/storage.js')),
  ]);
  const settings = await storage.getSettings();
  if (!settings.inviteGuardEnabled) return;

  const pendingAttendees = [];
  const queuedEmails = new Set();
  let promptInFlight = false;

  /**
   * Finds Google Calendar's open description contenteditable field.
   * Selector sourced from real Calendar DOM: role=textbox + aria-label + contenteditable.
   * @returns {HTMLElement|null}
   */
  const findDescriptionField = () =>
    document.querySelector('[role="textbox"][aria-label="Add description"][contenteditable="true"]') ||
    document.querySelector('#xDescIn [contenteditable="true"]') ||
    document.querySelector('.hj99tb.editable[contenteditable="true"]');

  /**
   * Fires the full mouse event sequence on an element so React's synthetic
   * event system registers it as a real user click.
   * @param {HTMLElement} el
   */
  const reactClick = (el) => {
    ['mousedown', 'mouseup', 'click'].forEach((type) =>
      el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true })),
    );
  };

  /**
   * Expands a Google Calendar collapsible section only if currently collapsed.
   * Checks aria-expanded="false" before clicking to avoid toggling open sections shut.
   * @param {string} jsname - jsname of the button's parent wrapper element.
   */
  const expandIfCollapsed = (jsname) => {
    const btn = document.querySelector(`[jsname="${jsname}"] button`);
    if (btn && btn.getAttribute('aria-expanded') === 'false') {
      reactClick(btn);
      return true;
    }
    return false;
  };

  /**
   * Injects a text line into the open description contenteditable.
   * Uses execCommand so Google Calendar's native `input` handler (q3884e) fires
   * and syncs the value to its internal model.
   * @param {HTMLElement} field - The contenteditable element.
   * @param {string} line - The text line to append.
   */
  const injectIntoField = (field, line) => {
    const hasContent = field.innerText.trim().length > 0;
    field.focus();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    window.getSelection().removeAllRanges();
    window.getSelection().addRange(range);
    document.execCommand('insertText', false, hasContent ? `\n${line}` : line);
  };

  /**
   * Appends a reason line to the Calendar event description field.
   *
   * Strategy: "queue and watch"
   *   1. Attempt to programmatically open the description section (fire-and-forget).
   *   2. Immediately check if the field is already in the DOM — inject if so.
   *   3. If not, a MutationObserver watches the DOM and injects the moment the
   *      contenteditable appears, regardless of whether it was opened by our click
   *      or by the user manually. This fully bypasses lazy loading.
   *
   * @param {string} email - The attendee email.
   * @param {string} reason - The reason they were added.
   */
  const appendReasonToDescription = (email, reason) => {
    const line = `${email} - ${reason}`;

    // Attempt to open the description field — fire and forget, don't await.
    expandIfCollapsed('OXFAed');
    setTimeout(() => expandIfCollapsed('Zqjuqb'), 350);

    // Try to inject immediately in case field is already open.
    const existing = findDescriptionField();
    if (existing) {
      injectIntoField(existing, line);
      return;
    }

    // Field not open yet — watch for it to appear via lazy loading or manual click.
    const deadline = Date.now() + 15000; // up to 15s window
    const observer = new MutationObserver(() => {
      const field = findDescriptionField();
      if (field) {
        observer.disconnect();
        injectIntoField(field, line);
      } else if (Date.now() > deadline) {
        observer.disconnect();
        console.warn('[MeetReaper] Description field did not appear within 15s.');
      }
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  };


  /**
   * Shows a brief toast notification.
   * @param {string} message
   * @param {'info'|'success'|'error'} tone
   */
  const showToast = (message, tone = 'info') => {
    document.getElementById('meetreaper-toast')?.remove();
    const toast = document.createElement('div');
    toast.id = 'meetreaper-toast';
    toast.className = 'meetreaper-toast';
    toast.dataset.tone = tone;
    toast.textContent = message;
    document.body.append(toast);
    setTimeout(() => toast.remove(), 3000);
  };

  const showNextPurposePrompt = () => {
    if (promptInFlight || pendingAttendees.length === 0) return;
    const email = pendingAttendees.shift();
    // Skip if the guest was deleted from the event before the modal fired
    if (!calendarGuard.isEmailInDOM(email)) {
      queuedEmails.delete(email);
      showNextPurposePrompt();
      return;
    }
    promptInFlight = true;
    calendarGuard.showPurposeModal(
      email,
      (record) => {
        calendarGuard.saveAttendeePurpose(record);
        calendarGuard.renderAttendeeBadge(record.email, record.purpose);
        // Queue the reason for description injection — fires immediately if field
        // is already open, otherwise waits via MutationObserver (bypass lazy load).
        appendReasonToDescription(record.email, record.purpose);
        showToast(`Reason saved for ${record.email}`, 'success');
        queuedEmails.delete(record.email);
        promptInFlight = false;
        showNextPurposePrompt();
      },
      () => {
        queuedEmails.delete(email);
        promptInFlight = false;
        showNextPurposePrompt();
      },
    );
  };

  calendarGuard.observeAttendeeList((email) => {
    if (queuedEmails.has(email)) return;
    queuedEmails.add(email);
    pendingAttendees.push(email);
    showNextPurposePrompt();
  });

  window.addEventListener('beforeunload', calendarGuard.clearAttendeeRecords);
})();
