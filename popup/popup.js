import { getSettings, saveSettings } from '../modules/storage.js';

(async () => {
  const settings = await getSettings();
  for (const input of document.querySelectorAll('[data-setting]')) {
    input.checked = settings[input.dataset.setting];
    input.addEventListener('change', () => {
      saveSettings({ [input.dataset.setting]: input.checked });
    });
  }
  const button = document.getElementById('connect-calendar');
  const status = document.getElementById('auth-status');
  button.addEventListener('click', async () => {
    status.textContent = 'Opening Google sign-in…';
    const result = await chrome.runtime.sendMessage({ type: 'AUTHORIZE_CALENDAR', payload: {} });
    status.textContent = result?.authorized
      ? 'Google access connected.'
      : 'Authorization was not completed.';
  });
})();
