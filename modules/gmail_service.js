import { getGoogleToken, isOauthConfigured } from './auth_service.js';

/**
 * Encodes a plain-text email for the Gmail API.
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 * @returns {string}
 */
function buildRawEmail(to, subject, body) {
  const email = [
    `To: ${to}`,
    `Subject: ${subject}`,
    'Content-Type: text/plain; charset=utf-8',
    '',
    body,
  ].join('\r\n');
  const bytes = new TextEncoder().encode(email);
  const binary = Array.from(bytes, (byte) => String.fromCharCode(byte)).join('');
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

/**
 * Sends a Gmail API request with the provided token.
 * @param {string} token
 * @param {string} raw
 * @returns {Promise<Response>}
 */
function postEmail(token, raw) {
  return fetch('https://gmail.googleapis.com/gmail/v1/users/me/messages/send', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ raw }),
  });
}

/**
 * Sends a plain-text Gmail message through the authenticated user's account.
 * @param {string} to
 * @param {string} subject
 * @param {string} body
 * @returns {Promise<{ success: boolean, reason?: string }>}
 */
export async function sendGmail(to, subject, body) {
  try {
    if (!isOauthConfigured()) return { success: false, reason: 'oauth_not_configured' };
    let token = await getGoogleToken(false);
    if (!token) token = await getGoogleToken(true);
    if (!token) return { success: false, reason: 'authorization_required' };

    const raw = buildRawEmail(to, subject, body);
    let response = await postEmail(token, raw);
    if (response.status === 401 || response.status === 403) {
      await chrome.identity.removeCachedAuthToken({ token });
      token = await getGoogleToken(true);
      if (!token) return { success: false, reason: 'authorization_required' };
      response = await postEmail(token, raw);
    }
    return response.ok
      ? { success: true }
      : { success: false, reason: `gmail_api_${response.status}` };
  } catch (error) {
    console.error('[MeetReaper] Failed to send email via Gmail API', error);
    return { success: false, reason: 'unexpected_error' };
  }
}
