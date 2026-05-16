/**
 * Retrieves an OAuth token from Chrome Identity.
 * @param {boolean} [interactive=false]
 * @returns {Promise<string|null>}
 */
export async function getGoogleToken(interactive = false) {
  const result = await chrome.identity.getAuthToken({ interactive });
  return result?.token ?? null;
}

/**
 * Returns whether the extension still uses the placeholder OAuth client id.
 * @returns {boolean}
 */
export function isOauthConfigured() {
  return !chrome.runtime
    .getManifest()
    .oauth2?.client_id?.startsWith('REPLACE_WITH_YOUR_OAUTH_CLIENT_ID');
}
