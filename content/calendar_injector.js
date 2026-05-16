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
   * Finds Google Calendar's event description contenteditable field.
   * @returns {HTMLElement|null}
   */
  const findDescriptionField = () =>
    document.querySelector('[aria-label="Description"]') ||
    document.querySelector('[data-tab-id="description"] [contenteditable]') ||
    document.querySelector('[contenteditable][aria-multiline="true"]');

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
   * Finds the 'Add description' placeholder button and clicks it to open the field.
   * @returns {boolean} True if the button was found and clicked.
   */
  const openDescriptionField = () => {
    const btn = [...document.querySelectorAll('button, [role="button"], [contenteditable="false"]')].find(
      (el) => /add description/i.test(el.getAttribute('aria-label') || el.getAttribute('placeholder') || el.textContent || ''),
    );
    if (btn) { reactClick(btn); return true; }
    return false;
  };

  /**
   * Polls for the description contenteditable field to appear in the DOM.
   * @param {number} [timeoutMs=3000]
   * @returns {Promise<HTMLElement|null>}
   */
  const waitForDescriptionField = (timeoutMs = 3000) =>
    new Promise((resolve) => {
      const start = Date.now();
      const check = () => {
        const field = findDescriptionField();
        if (field) return resolve(field);
        if (Date.now() - start > timeoutMs) return resolve(null);
        setTimeout(check, 100);
      };
      check();
    });

  /**
   * Appends a reason line to the Calendar event description field via DOM injection.
   * Automatically opens the description field if it hasn't been clicked yet.
   * @param {string} email - The attendee email.
   * @param {string} reason - The reason they were added.
   * @returns {Promise<void>}
   */
  const appendReasonToDescription = async (email, reason) => {
    let field = findDescriptionField();
    if (!field) {
      const clicked = openDescriptionField();
      if (!clicked) {
        console.warn('[MeetReaper] Could not find or open description field.');
        return;
      }
      field = await waitForDescriptionField();
      if (!field) {
        console.warn('[MeetReaper] Description field did not appear after clicking.');
        return;
      }
    }
    const line = `${email} - ${reason}`;
    const currentText = field.innerText.trim();
    const separator = currentText ? '\n' : '';
    // Move cursor to end and insert text
    field.focus();
    const sel = window.getSelection();
    const range = document.createRange();
    range.selectNodeContents(field);
    range.collapse(false);
    sel.removeAllRanges();
    sel.addRange(range);
    // Use execCommand so Google Calendar registers the change as user input
    document.execCommand('insertText', false, `${separator}${line}`);
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
      async (record) => {
        calendarGuard.saveAttendeePurpose(record);
        calendarGuard.renderAttendeeBadge(record.email, record.purpose);
        // Auto-open description field if needed, then inject reason
        await appendReasonToDescription(record.email, record.purpose);
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
