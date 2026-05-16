import { createElement } from '../utils/dom_utils.js';

const records = new Map();
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function getNodeEmail(node) {
  const rawEmail = node.getAttribute('data-email')
    || node.getAttribute('email')
    || node.getAttribute('data-hovercard-id');
  const email = rawEmail?.trim().toLowerCase();
  return EMAIL_PATTERN.test(email ?? '') ? email : null;
}

/**
 * Checks if a given email is currently present as an attendee chip in the DOM.
 * Used to verify a guest wasn't deleted before the modal fires.
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailInDOM(email) {
  return [...document.querySelectorAll('[data-email], [email], [data-hovercard-id]')]
    .some((node) => getNodeEmail(node) === email);
}

/**
 * Watches the Calendar event editor DOM for newly-added attendees using a debounced observer.
 * @param {Function} onAttendeeAdded - Callback called with the attendee email.
 * @returns {Function} A function to disconnect the observer.
 */
export function observeAttendeeList(onAttendeeAdded) {
  const seenEmails = new Set();
  let scanTimeout = null;
  let isPrimingScan = true;
  
  const scan = () => {
    scanTimeout = null;
    const candidates = [...document.querySelectorAll('[data-email], [email], [data-hovercard-id]')];
    for (const node of candidates) {
      const email = getNodeEmail(node);
      if (!email || seenEmails.has(email)) continue;
      seenEmails.add(email);
      if (isPrimingScan) continue;
      onAttendeeAdded(email);
    }
    isPrimingScan = false;
  };
  
  const debouncedScan = () => {
    if (!scanTimeout) {
      scanTimeout = setTimeout(scan, 300);
    }
  };
  
  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });
  // Delay the priming scan to ensure the organizer's own chip
  // (and any pre-existing guests) are fully rendered before we
  // establish the baseline. This prevents own-email false positives.
  setTimeout(scan, 1500);
  return () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    observer.disconnect();
  };
}

/**
 * Renders the purpose-selection modal for a newly added attendee.
 * @param {string} email - The email of the attendee.
 * @param {Function} onConfirm - Callback called with the generated AttendeeRecord.
 * @param {Function} [onSkip] - Callback called when the user skips the prompt.
 * @returns {void}
 */
export function showPurposeModal(email, onConfirm, onSkip) {
  document.getElementById('meetreaper-invite-modal')?.remove();
  const modal = createElement(`
    <aside id="meetreaper-invite-modal" class="meetreaper-card">
      <strong>Why is ${email} in this meeting?</strong>
      <select>
        <option>Decision maker</option>
        <option>Presenter / facilitator</option>
        <option>Subject matter input</option>
        <option>FYI / optional</option>
        <option>Other</option>
      </select>
      <input type="text" id="meetreaper-custom-reason" placeholder="Enter custom reason..." style="display: none; margin-top: 8px; width: 100%; box-sizing: border-box;" />
      <label style="display: block; margin-top: 8px;"><input type="checkbox" checked> They need to be there</label>
      <div style="margin-top: 12px;"><button data-skip>Skip</button><button data-confirm>Confirm</button></div>
    </aside>
  `);
  document.body.append(modal);
  
  const select = modal.querySelector('select');
  const customInput = modal.querySelector('#meetreaper-custom-reason');
  
  select.addEventListener('change', () => {
    if (select.value === 'Other') {
      customInput.style.display = 'block';
      customInput.focus();
    } else {
      customInput.style.display = 'none';
    }
  });

  modal.querySelector('[data-confirm]').addEventListener('click', () => {
    let purpose = select.value;
    if (purpose === 'Other' && customInput.value.trim()) {
      purpose = customInput.value.trim();
    }
    
    const record = {
      email,
      name: email.split('@')[0],
      purpose,
      required: modal.querySelector('input[type="checkbox"]').checked,
    };
    
    onConfirm(record);
    modal.remove();
  });
  
  modal.querySelector('[data-skip]').addEventListener('click', () => {
    onSkip?.();
    modal.remove();
  });
}

/**
 * Stores the declared purpose for an attendee in memory.
 * @param {Object} record - The AttendeeRecord.
 * @returns {void}
 */
export function saveAttendeePurpose(record) {
  records.set(record.email, record);
}

/**
 * Returns all saved attendee records for the current event being edited.
 * @returns {Object[]} Array of AttendeeRecords.
 */
export function getAttendeeRecords() {
  return [...records.values()];
}

/**
 * Injects a subtle purpose badge next to each attendee chip in the UI.
 * @param {string} email - The attendee's email.
 * @param {string} purpose - The declared purpose.
 * @returns {void}
 */
export function renderAttendeeBadge(email, purpose) {
  const target = [...document.querySelectorAll('[data-email], [email], [data-hovercard-id]')].find(
    (node) => getNodeEmail(node) === email,
  );
  if (!target || target.querySelector('.meetreaper-badge')) return;
  target.append(createElement(`<small class="meetreaper-badge">${purpose}</small>`));
}

/**
 * Clears all stored attendee records.
 * @returns {void}
 */
export function clearAttendeeRecords() {
  records.clear();
}
