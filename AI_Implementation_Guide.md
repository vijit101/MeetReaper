# MeetReaper AI Implementation Guide

This guide is optimized for an AI coding assistant (like Gemini, Claude, or GPT) to build the MeetReaper Chrome extension step-by-step. 

## 1. Chosen Tech Stack
The best stack for this extension, especially when optimized for AI generation, is **Vanilla JavaScript with Chrome Extension Manifest V3 (MV3)**.
* **Why?** It avoids complex bundler setups (Webpack/Vite), maps 1:1 with Chrome's native API documentation, and ensures the AI doesn't hallucinate build-step dependencies. The Single Responsibility Principle (SRP) module structure defined in the spec is perfectly suited for Vanilla JS ES modules.

## 2. Core Features to Implement
The extension consists of 3 primary features:
1. **Invite Guard (Google Calendar):** Prompts the organizer to declare the purpose of each added attendee to prevent unnecessary invites.
2. **Auto-Kill (Google Meet):** Automatically tracks meeting duration against calendar schedules and ends the meeting for everyone when time expires.
3. **Waste Vote (Google Meet):** A floating UI allowing any participant to trigger an anonymous vote. If >50% agree it's a waste of time, the meeting ends.

---

## 3. Step-by-Step AI Implementation Plan

To prevent context window overflow and ensure high-quality code generation, feed the AI the following steps sequentially. **Do not move to the next step until the current one is verified.**

### Phase 1: Foundation & Utilities
**Prompt the AI:** "Let's build the utility modules for the MeetReaper extension based on the spec. Please implement the following files using ES modules and vanilla JS:"
* `utils/logger.js`: A scoped console logger (e.g., `[MeetReaper] ...`) for debugging.
* `utils/time_utils.js`: Functions for parsing calendar durations (`parseDurationToMs`) and formatting time (`formatMsToLabel`, `humanizeRemaining`).
* `utils/dom_utils.js`: Helpers for safe DOM querying (`waitForElement`, `safeClick`, `createElement`, `prependOnce`).

### Phase 2: State & Storage Management
**Prompt the AI:** "Now, let's implement the `chrome.storage` wrappers to handle the session states for Auto-Kill and Waste Vote."
* `modules/storage.js`: Implement `saveSession`, `getSession`, `deleteSession`, `saveVoteSession`, `getVoteSession`, `getSettings`, and `saveSettings` using `chrome.storage.local`.

### Phase 3: Background Service Worker & Messaging
**Prompt the AI:** "Implement the cross-context messaging bus and the background service worker for Chrome MV3."
* `modules/messaging.js`: Implement `sendToBackground`, `onBackgroundMessage`, `broadcastToMeetTabs`, and `onBroadcast` (using `chrome.runtime.sendMessage` and `chrome.tabs.sendMessage`).
* `background/service_worker.js`: Set up message listeners (`GET_SESSION`, `START_VOTE`, `CAST_VOTE`) and Chrome Alarms for auto-kill and vote timeouts.

### Phase 4: Feature 1 - Invite Guard (Google Calendar)
**Prompt the AI:** "Let's build the Invite Guard feature for Google Calendar. This intercepts attendee additions."
* `modules/calendar_guard.js`: Implement the observer for the attendee list (`observeAttendeeList`), the UI for the purpose modal (`showPurposeModal`), and injecting the subtle purpose badge (`renderAttendeeBadge`).
* `content/calendar_injector.js`: The content script entry point that initializes `calendar_guard.js` on `calendar.google.com`.
* `ui/invite_guard_modal.html`: The HTML structure for the dropdown-first purpose selection UI.

### Phase 5: Feature 2 - Auto-Kill Timer & Ejector
**Prompt the AI:** "Implement the business logic for tracking meeting time and ejecting users for Google Meet."
* `modules/timer.js`: Implement duration tracking (`initTimer`, `getRemainingMs`, `isExpired`).
* `modules/ejector.js`: Implement DOM manipulation to click the 'Leave call' button (`leaveMeeting`, `endMeetingForAll`, `showEjectCountdown`).

### Phase 6: Feature 3 - Waste Vote Logic
**Prompt the AI:** "Implement the headless vote state management."
* `modules/voter.js`: Implement `createVoteSession`, `generateAnonymousToken`, `castVote`, `getVoteTally`, `isWasteThresholdMet`, and `concludeVoteSession`. Ensure it enforces one-vote-per-user.

### Phase 7: Google Meet UI Overlay
**Prompt the AI:** "Build the floating HUD and voting modals for Google Meet."
* `modules/overlay_renderer.js`: Logic to inject the timer and the 'Waste Vote' button into the Meet DOM (`injectOverlay`, `updateTimerDisplay`, `updateVoteBar`).
* `ui/overlay.html` & `ui/overlay.css`: The styling for the floating pill and live vote progress bar (matching the dark theme from the design).
* `ui/vote_modal.html`: The anonymous voting modal (`🗑 Waste of Time` vs `✅ Worth It`).

### Phase 8: Google Meet Content Script
**Prompt the AI:** "Tie the Auto-Kill and Waste Vote features together in the main Google Meet content script."
* `content/meet_injector.js`: Bootstraps the session, starts the 1-second timer loop, updates the overlay, listens for 'Waste Vote' button clicks, and reacts to background messaging broadcasts.

### Phase 9: Settings Popup & Manifest
**Prompt the AI:** "Finish the extension by building the popup UI and the MV3 manifest."
* `popup/popup.html` & `popup/popup.js`: The extension status and toggle switches (Enable Auto-Kill, Enable Waste Vote, Invite Guard).
* `manifest.json`: Configure permissions (`storage`, `alarms`, `scripting`), background service worker, and content scripts matches.

---

## 4. Best Practices for AI Prompting
* **Strict Adherence:** Remind the AI to stick to the Single Responsibility Principle (SRP) as outlined in the spec.
* **UI/UX Consistency:** Provide the AI with descriptions of the provided image so it generates CSS that matches the dark-themed, sleek UI with orange/red alert accents.
* **Error Handling:** Explicitly ask the AI to wrap DOM queries (`waitForElement`) in `try/catch` blocks since Google Meet/Calendar DOM structures change frequently.
