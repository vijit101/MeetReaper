/**
 * Renders a temporary MeetReaper toast message.
 * @param {string} message - Text to display.
 * @param {'info'|'success'|'error'} [tone='info'] - Visual treatment.
 * @param {number} [durationMs=3000] - How long the toast should remain visible.
 */
export function showToast(message, tone = 'info', durationMs = 3000) {
  document.getElementById('meetreaper-toast')?.remove();
  const toast = document.createElement('div');
  toast.id = 'meetreaper-toast';
  toast.className = 'meetreaper-toast';
  toast.dataset.tone = tone;
  toast.textContent = message;
  document.body.append(toast);
  setTimeout(() => toast.remove(), durationMs);
}
