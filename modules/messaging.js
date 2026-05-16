/**
 * Sends a message from a content script to the background service worker.
 * @param {{ type: string, payload: Object }} message - The message object.
 * @returns {Promise<any>} The response from the background script.
 */
export function sendToBackground(message) {
  return chrome.runtime.sendMessage(message);
}

/**
 * Registers a handler in the background script for a specific message type.
 * @param {string} type - The message type to listen for.
 * @param {Function} handler - The function to call when the message is received.
 * @returns {void}
 */
export function onBackgroundMessage(type, handler) {
  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message?.type !== type) return undefined;
    Promise.resolve(handler(message.payload ?? {}, sender))
      .then(sendResponse)
      .catch((error) => sendResponse({ error: error.message }));
    return true;
  });
}

/**
 * Broadcasts a message to all Google Meet tabs.
 * @param {{ type: string, payload: Object }} message - The message to broadcast.
 * @returns {Promise<void>}
 */
export async function broadcastToMeetTabs(message) {
  const tabs = await chrome.tabs.query({ url: 'https://meet.google.com/*' });
  await Promise.allSettled(tabs.map((tab) => chrome.tabs.sendMessage(tab.id, message)));
}

/**
 * Registers a listener in a content script for broadcasted messages.
 * @param {string} type - The broadcast type to listen for.
 * @param {Function} handler - The function to call when the broadcast is received.
 * @returns {Function} An unsubscribe function to remove the listener.
 */
export function onBroadcast(type, handler) {
  const listener = (message) => {
    if (message?.type === type) handler(message.payload ?? {});
  };
  chrome.runtime.onMessage.addListener(listener);
  return () => chrome.runtime.onMessage.removeListener(listener);
}
