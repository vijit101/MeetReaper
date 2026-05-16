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
 * Returns the guest list tree container element.
 * Google Calendar renders all guest chips inside [aria-label="Guests invited to this event."]
 * @returns {Element|null}
 */
function getGuestTree() {
  return document.querySelector('[aria-label="Guests invited to this event."]');
}

/**
 * Returns emails only from confirmed guest chips inside the guest list tree.
 * Excludes the organizer chip (id=xDtlDlgOrg) which is always pre-present.
 * @returns {string[]}
 */
function getGuestEmails() {
  const tree = getGuestTree();
  if (!tree) return [];
  return [...tree.querySelectorAll('[data-email]')]
    .filter((node) => node.closest('#xDtlDlgOrg') === null) // exclude organizer
    .map(getNodeEmail)
    .filter(Boolean);
}

/**
 * Checks if a given email is currently in the guest list (excluding organizer).
 * @param {string} email
 * @returns {boolean}
 */
export function isEmailInDOM(email) {
  return getGuestEmails().includes(email);
}

/**
 * Watches the Google Calendar event editor for newly added guests.
 *
 * Strategy: Run three priming scans at 500ms, 1500ms, and 2500ms to silently
 * absorb ALL pre-existing email attributes (organizer chip, existing guests,
 * hover cards, etc). Only AFTER 2500ms does the MutationObserver start
 * reporting new emails. This eliminates false-positives on page load.
 *
 * @param {Function} onAttendeeAdded - Callback called with the attendee email.
 * @returns {Function} A function to disconnect the observer.
 */
export function observeAttendeeList(onAttendeeAdded) {
  const seenEmails = new Set();
  let scanTimeout = null;
  let primingDone = false;

  // Absorb every guest email currently in the list (silently).
  const prime = () => {
    getGuestEmails().forEach((email) => seenEmails.add(email));
  };

  // Check for new guest emails not in the primed baseline.
  const scan = () => {
    scanTimeout = null;
    if (!primingDone) return;
    for (const email of getGuestEmails()) {
      if (seenEmails.has(email)) continue;
      seenEmails.add(email);
      onAttendeeAdded(email);
    }
  };

  const debouncedScan = () => {
    if (scanTimeout) clearTimeout(scanTimeout);
    scanTimeout = setTimeout(scan, 400);
  };

  const observer = new MutationObserver(debouncedScan);
  observer.observe(document.documentElement, { childList: true, subtree: true });

  // Three priming passes to catch progressively lazy-rendered chips.
  // The guest tree itself may not exist on initial load.
  setTimeout(prime, 500);
  setTimeout(prime, 1500);
  setTimeout(() => {
    prime();
    primingDone = true; // Only start reporting after all priming passes complete.
  }, 2500);

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
