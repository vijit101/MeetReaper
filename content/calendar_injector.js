/**
 * @fileoverview Main content script injected into calendar.google.com to run Invite Guard.
 */
(async () => {
  const [calendarGuard, calendarDescription, toastRenderer, storage] = await Promise.all([
    import(chrome.runtime.getURL('modules/calendar_guard.js')),
    import(chrome.runtime.getURL('modules/calendar_description.js')),
    import(chrome.runtime.getURL('modules/toast_renderer.js')),
    import(chrome.runtime.getURL('modules/storage.js')),
  ]);
  const settings = await storage.getSettings();
  if (!settings.inviteGuardEnabled) return;

  const pendingAttendees = [];
  const queuedEmails = new Set();
  let promptInFlight = false;

  /**
   * Prompts the next queued attendee, if one is still present in the event.
   */
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
        calendarDescription.appendReasonToDescription(record.email, record.purpose);
        toastRenderer.showToast(`Reason saved for ${record.email}`, 'success');
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

  calendarDescription.watchAndOpenDescriptionEditor();

  window.addEventListener('beforeunload', calendarGuard.clearAttendeeRecords);
})();
