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
 * Returns the email from a node only if it is a confirmed guest chip.
 * A confirmed guest chip always has a sibling remove/delete button.
 * This filters out hover cards, autocomplete suggestions, and organizer cards.
 * @param {Element} node
 * @returns {string|null}
 */
function getChipEmail(node) {
  const email = getNodeEmail(node);
  if (!email) return null;
  // Walk up to find the chip's list item container
  const chip = node.closest('li, [role="listitem"], [data-chip-id]') || node.parentElement;
  // A real confirmed chip has a remove/delete button
  const hasRemoveBtn = chip?.querySelector(
    '[aria-label*="remove" i], [aria-label*="delete" i], [data-remove], [jsname]'
  ) !== null;
  // Also accept if the chip itself has aria-label containing 'remove'
  const chipAriaLabel = chip?.getAttribute('aria-label') || '';
  const isConfirmedChip = hasRemoveBtn || /remove/i.test(chipAriaLabel);
  return isConfirmedChip ? email : null;
}

/**
 * Returns all confirmed guest chip emails currently in the DOM.
 * @returns {string[]}
 */
function getConfirmedGuestEmails() {
  return [...document.querySelectorAll('[data-email], [email], [data-hovercard-id]')]
    .map(getChipEmail)
    .filter(Boolean);
}

/**
 * Checks if a given email is currently in the confirmed guest chip list.
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailInDOM(email) {
  return getConfirmedGuestEmails().includes(email);
}

/**
 * Watches only confirmed guest chips (those with a remove button) for newly-added attendees.
 * This prevents false positives from hovercard links, suggestions, and the organizer chip.
 * @param {Function} onAttendeeAdded - Callback called with the attendee email.
 * @returns {Function} A function to disconnect the observer.
 */
export function observeAttendeeList(onAttendeeAdded) {
  const seenEmails = new Set();
  let scanTimeout = null;

  const scan = (isPriming = false) => {
    scanTimeout = null;
    const emails = getConfirmedGuestEmails();
    for (const email of emails) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      if (isPriming) continue; // silently baseline existing guests
      onAttendeeAdded(email);
    }
  };

  const debouncedScan = () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(() => scan(false), 400);
  };

  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Prime the baseline after a delay so all existing chips (organizer, pre-existing
  // guests) are rendered and silently absorbed before we start reporting new ones.
  setTimeout(() => scan(true), 1500);

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
