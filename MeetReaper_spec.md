# MeetReaper — Chrome Extension Spec
> *"If it could've been an email, it should've been."*

---

## 1. Overview

**MeetReaper** is a Chrome extension for Google Meet that enforces meeting discipline through two hard rules:

1. **Auto-Kill** — A meeting auto-ends when it exceeds the calendar-blocked duration.
2. **Waste Vote** — Any participant can anonymously trigger a poll; if >50% vote it's a waste of time, all participants are ejected.

**Bonus Feature — Invite Guard**: When adding participants to a Google Meet/Calendar invite, MeetReaper asks the organizer to declare the *purpose* of each person added. This discourages reflexive CC-ing and unnecessary attendees.

---

## 2. Architecture Overview

```
MeetReaper/
├── manifest.json                  # Chrome MV3 manifest
├── background/
│   └── service_worker.js          # Background coordination, alarms, state
├── content/
│   ├── meet_injector.js           # Injected into meet.google.com/...
│   └── calendar_injector.js       # Injected into calendar.google.com
├── ui/
│   ├── overlay.html               # Floating timer + vote button UI
│   ├── overlay.css
│   ├── vote_modal.html            # Anonymous vote modal
│   └── invite_guard_modal.html    # Purpose-of-invite modal
├── modules/
│   ├── timer.js                   # SRP: meeting duration tracking
│   ├── voter.js                   # SRP: vote orchestration
│   ├── ejector.js                 # SRP: kicking participants / ending meeting
│   ├── overlay_renderer.js        # SRP: injecting and updating the UI overlay
│   ├── calendar_guard.js          # SRP: attendee purpose prompting
│   ├── storage.js                 # SRP: chrome.storage wrapper
│   └── messaging.js               # SRP: cross-context message bus
├── popup/
│   ├── popup.html                 # Extension popup (settings + status)
│   └── popup.js
└── utils/
    ├── dom_utils.js               # Safe DOM querying helpers
    ├── time_utils.js              # Duration parsing / formatting
    └── logger.js                  # Scoped debug logger
```

---

## 3. Data Models

### 3.1 MeetingSession
```js
/**
 * @typedef {Object} MeetingSession
 * @property {string}  meetingId         - GMeet room ID (from URL)
 * @property {string}  meetingCode       - Short code e.g. "abc-defg-hij"
 * @property {number}  scheduledDuration - Duration in ms from calendar event
 * @property {number}  joinedAt          - Unix timestamp (ms) when user joined
 * @property {number}  endsAt            - joinedAt + scheduledDuration
 * @property {boolean} autoKillEnabled   - Whether auto-kill is armed
 * @property {string}  status            - "active" | "voting" | "ended"
 */
```

### 3.2 VoteSession
```js
/**
 * @typedef {Object} VoteSession
 * @property {string}   voteId         - UUID
 * @property {string}   meetingId
 * @property {number}   startedAt      - Unix timestamp (ms)
 * @property {number}   timeoutMs      - Default 60000 (1 min)
 * @property {number}   totalParticipants
 * @property {number}   yesVotes       - Count of "waste" votes
 * @property {number}   noVotes        - Count of "useful" votes
 * @property {boolean}  triggered      - Has ejection been triggered
 * @property {string[]} votedTokens    - Anonymised voter tokens (for dedup)
 */
```

### 3.3 AttendeeRecord
```js
/**
 * @typedef {Object} AttendeeRecord
 * @property {string} email
 * @property {string} name
 * @property {string} purpose   - e.g. "Decision maker", "FYI only", "Presenter"
 * @property {boolean} required - Whether they need to be there
 */
```

---

## 4. Modules — Single Responsibility Functions

---

### 4.1 `modules/timer.js`
Responsible **only** for tracking meeting duration and firing expiry events.

```js
/**
 * Initialises the meeting countdown.
 * @param {MeetingSession} session
 * @returns {void}
 */
function initTimer(session) {}

/**
 * Returns the number of milliseconds remaining before auto-kill.
 * @param {MeetingSession} session
 * @returns {number} ms remaining (negative if overrun)
 */
function getRemainingMs(session) {}

/**
 * Returns elapsed time since joining as a formatted string.
 * @param {MeetingSession} session
 * @returns {string} e.g. "42:07"
 */
function getElapsedLabel(session) {}

/**
 * Returns remaining time as a formatted string.
 * @param {MeetingSession} session
 * @returns {string} e.g. "17:53" or "-02:10" if overrun
 */
function getRemainingLabel(session) {}

/**
 * Checks whether the meeting has exceeded the scheduled duration.
 * @param {MeetingSession} session
 * @returns {boolean}
 */
function isExpired(session) {}

/**
 * Registers a callback to fire when the meeting expires.
 * Only fires once. Returns a cancel function.
 * @param {MeetingSession} session
 * @param {Function} onExpiry
 * @returns {Function} cancel
 */
function onExpiry(session, onExpiry) {}

/**
 * Clears all timers associated with a session.
 * @param {string} meetingId
 * @returns {void}
 */
function clearTimer(meetingId) {}
```

---

### 4.2 `modules/voter.js`
Responsible **only** for vote state management. No UI, no ejection.

```js
/**
 * Creates a new VoteSession for the given meeting.
 * @param {string} meetingId
 * @param {number} participantCount
 * @returns {VoteSession}
 */
function createVoteSession(meetingId, participantCount) {}

/**
 * Generates an anonymous token for the current user (hashed from fingerprint).
 * Ensures one vote per user per session without storing identity.
 * @returns {string} anonymousToken
 */
function generateAnonymousToken() {}

/**
 * Records a single vote. Returns false if token already voted.
 * @param {VoteSession} session
 * @param {string}      anonymousToken
 * @param {'yes'|'no'}  vote
 * @returns {boolean} accepted
 */
function castVote(session, anonymousToken, vote) {}

/**
 * Returns current vote tally as percentages.
 * @param {VoteSession} session
 * @returns {{ yesPercent: number, noPercent: number, totalVoted: number }}
 */
function getVoteTally(session) {}

/**
 * Returns true if the >50% waste threshold is met.
 * @param {VoteSession} session
 * @returns {boolean}
 */
function isWasteThresholdMet(session) {}

/**
 * Returns true if the vote window has expired (timeout reached).
 * @param {VoteSession} session
 * @returns {boolean}
 */
function isVoteExpired(session) {}

/**
 * Closes the VoteSession as concluded (either threshold met or timed out).
 * @param {VoteSession} session
 * @returns {VoteSession} updated session with triggered=true or not
 */
function concludeVoteSession(session) {}
```

---

### 4.3 `modules/ejector.js`
Responsible **only** for ending the meeting / removing participants.

```js
/**
 * Ends the meeting for the current user by clicking GMeet's "Leave call" button.
 * @returns {Promise<void>}
 */
async function leaveMeeting() {}

/**
 * Attempts to end the meeting for all participants (host-only capability).
 * Falls back to leaveMeeting() if not host.
 * @returns {Promise<void>}
 */
async function endMeetingForAll() {}

/**
 * Checks whether the current user is the meeting host.
 * @returns {boolean}
 */
function isHost() {}

/**
 * Shows the pre-eject countdown toast ("Meeting ending in 5s...").
 * @param {number} countdownSecs
 * @param {Function} onConfirm  - Called when countdown completes
 * @param {Function} onCancel   - Called if user cancels (host only)
 * @returns {void}
 */
function showEjectCountdown(countdownSecs, onConfirm, onCancel) {}
```

---

### 4.4 `modules/overlay_renderer.js`
Responsible **only** for the floating HUD (timer bar + vote trigger button).

```js
/**
 * Injects the MeetReaper overlay into the GMeet DOM.
 * @param {MeetingSession} session
 * @returns {HTMLElement} overlayRoot
 */
function injectOverlay(session) {}

/**
 * Updates the timer display on the overlay.
 * @param {HTMLElement} overlayRoot
 * @param {string}      elapsedLabel
 * @param {string}      remainingLabel
 * @param {boolean}     isOverrun
 * @returns {void}
 */
function updateTimerDisplay(overlayRoot, elapsedLabel, remainingLabel, isOverrun) {}

/**
 * Updates the vote progress bar on the overlay.
 * @param {HTMLElement} overlayRoot
 * @param {{ yesPercent: number, noPercent: number, totalVoted: number }} tally
 * @returns {void}
 */
function updateVoteBar(overlayRoot, tally) {}

/**
 * Switches the overlay into "voting active" mode, showing live tally.
 * @param {HTMLElement} overlayRoot
 * @returns {void}
 */
function showVotingState(overlayRoot) {}

/**
 * Resets overlay to idle state (vote ended or not started).
 * @param {HTMLElement} overlayRoot
 * @returns {void}
 */
function showIdleState(overlayRoot) {}

/**
 * Removes the overlay from the DOM entirely.
 * @returns {void}
 */
function removeOverlay() {}
```

---

### 4.5 `modules/calendar_guard.js`
Responsible **only** for the Invite Guard feature in Google Calendar.

```js
/**
 * Watches the Calendar event editor DOM for newly-added attendees.
 * Fires onAttendeeAdded callback whenever a new email chip appears.
 * Returns a disconnect function.
 * @param {Function} onAttendeeAdded - Called with (email: string)
 * @returns {Function} disconnect
 */
function observeAttendeeList(onAttendeeAdded) {}

/**
 * Renders the purpose-selection modal for a newly added attendee.
 * @param {string}   email
 * @param {Function} onConfirm  - Called with (AttendeeRecord)
 * @param {Function} onSkip     - Called when user dismisses
 * @returns {void}
 */
function showPurposeModal(email, onConfirm, onSkip) {}

/**
 * Stores the declared purpose for an attendee in session state.
 * @param {AttendeeRecord} record
 * @returns {void}
 */
function saveAttendeePurpose(record) {}

/**
 * Returns all attendee records for the current event being edited.
 * @returns {AttendeeRecord[]}
 */
function getAttendeeRecords() {}

/**
 * Injects a subtle purpose badge next to each attendee chip in the UI.
 * @param {string} email
 * @param {string} purpose
 * @returns {void}
 */
function renderAttendeeBadge(email, purpose) {}

/**
 * Clears all attendee records (called on editor close / new event).
 * @returns {void}
 */
function clearAttendeeRecords() {}
```

---

### 4.6 `modules/storage.js`
Responsible **only** for persisting and retrieving extension state via `chrome.storage`.

```js
/**
 * Saves a MeetingSession to storage.
 * @param {MeetingSession} session
 * @returns {Promise<void>}
 */
async function saveSession(session) {}

/**
 * Retrieves a MeetingSession by meetingId.
 * @param {string} meetingId
 * @returns {Promise<MeetingSession|null>}
 */
async function getSession(meetingId) {}

/**
 * Deletes a stored session.
 * @param {string} meetingId
 * @returns {Promise<void>}
 */
async function deleteSession(meetingId) {}

/**
 * Saves a VoteSession to storage.
 * @param {VoteSession} voteSession
 * @returns {Promise<void>}
 */
async function saveVoteSession(voteSession) {}

/**
 * Retrieves the active VoteSession for a meeting.
 * @param {string} meetingId
 * @returns {Promise<VoteSession|null>}
 */
async function getVoteSession(meetingId) {}

/**
 * Retrieves user-level settings (auto-kill on/off, vote sensitivity, etc.).
 * @returns {Promise<UserSettings>}
 */
async function getSettings() {}

/**
 * Saves user-level settings.
 * @param {Partial<UserSettings>} settings
 * @returns {Promise<void>}
 */
async function saveSettings(settings) {}
```

---

### 4.7 `modules/messaging.js`
Responsible **only** for the message bus between content scripts and the service worker.

```js
/**
 * Sends a message from a content script to the background service worker.
 * @param {{ type: string, payload: Object }} message
 * @returns {Promise<any>} response
 */
async function sendToBackground(message) {}

/**
 * Registers a handler in the background for a given message type.
 * @param {string}   type
 * @param {Function} handler  - Called with (payload, sender) => response
 * @returns {void}
 */
function onBackgroundMessage(type, handler) {}

/**
 * Broadcasts a message to all content scripts in all GMeet tabs.
 * Used to sync vote state across participants (via relay through background).
 * @param {{ type: string, payload: Object }} message
 * @returns {Promise<void>}
 */
async function broadcastToMeetTabs(message) {}

/**
 * Registers a listener in a content script for broadcasted messages.
 * @param {string}   type
 * @param {Function} handler
 * @returns {Function} unsubscribe
 */
function onBroadcast(type, handler) {}
```

---

### 4.8 `utils/time_utils.js`
```js
/**
 * Parses a duration string ("30 min", "1 hour", "1h 30m") into milliseconds.
 * @param {string} raw
 * @returns {number} ms
 */
function parseDurationToMs(raw) {}

/**
 * Formats milliseconds to MM:SS display string.
 * @param {number} ms
 * @returns {string}
 */
function formatMsToLabel(ms) {}

/**
 * Returns a human-readable "X min remaining" string.
 * @param {number} ms
 * @returns {string}
 */
function humanizeRemaining(ms) {}
```

---

### 4.9 `utils/dom_utils.js`
```js
/**
 * Waits for a DOM element matching `selector` to appear, with timeout.
 * @param {string} selector
 * @param {number} timeoutMs
 * @returns {Promise<Element>}
 */
async function waitForElement(selector, timeoutMs) {}

/**
 * Safely clicks an element; throws if element not found.
 * @param {string} selector
 * @returns {Promise<void>}
 */
async function safeClick(selector) {}

/**
 * Creates a DOM element from an HTML string.
 * @param {string} html
 * @returns {HTMLElement}
 */
function createElement(html) {}

/**
 * Inserts `child` as the first child of `parent` if not already present.
 * @param {HTMLElement} parent
 * @param {HTMLElement} child
 * @returns {void}
 */
function prependOnce(parent, child) {}
```

---

## 5. Content Scripts

### 5.1 `content/meet_injector.js`
Entry point for `meet.google.com`. Orchestrates all in-meeting features.

```
Flow:
1. Extract meetingId from URL
2. sendToBackground({ type: 'GET_SESSION', payload: { meetingId } })
3. If session found → initTimer(session) → injectOverlay(session)
4. Start 1s tick loop:
   a. updateTimerDisplay with getElapsedLabel / getRemainingLabel
   b. If isExpired → showEjectCountdown → endMeetingForAll / leaveMeeting
5. On "Trigger Vote" button click:
   a. sendToBackground({ type: 'START_VOTE', payload: { meetingId } })
6. Listen for VOTE_UPDATE broadcasts:
   a. updateVoteBar with tally
   b. If isWasteThresholdMet → showEjectCountdown → leaveMeeting
```

### 5.2 `content/calendar_injector.js`
Entry point for `calendar.google.com`. Runs Invite Guard.

```
Flow:
1. observeAttendeeList(email => {
     showPurposeModal(email,
       record => { saveAttendeePurpose(record); renderAttendeeBadge(...) },
       ()     => { /* skip silently */ }
     )
   })
2. On editor close: clearAttendeeRecords()
```

---

## 6. Background Service Worker (`background/service_worker.js`)

Handles all cross-tab coordination and calendar API calls.

### Message Handlers

| Message Type       | Action |
|--------------------|--------|
| `GET_SESSION`      | Look up session from storage, return it |
| `START_VOTE`       | Create VoteSession, broadcast `VOTE_STARTED` to all Meet tabs |
| `CAST_VOTE`        | castVote → update storage → broadcast `VOTE_UPDATE` |
| `END_MEETING`      | Broadcast `MEETING_ENDED` to all Meet tabs |
| `FETCH_DURATION`   | Hit Google Calendar API to get event duration for this meeting |

### Alarms

| Alarm Name            | Fires When         | Action |
|-----------------------|--------------------|--------|
| `autokill_{meetingId}`| Session.endsAt     | Broadcast `MEETING_EXPIRED` |
| `vote_timeout_{voteId}`| VoteSession timeout| concludeVoteSession → if threshold met: broadcast `MEETING_ENDED` |

---

## 7. Permissions (`manifest.json`)

```json
{
  "manifest_version": 3,
  "name": "MeetReaper",
  "version": "1.0.0",
  "description": "Kill meetings that kill your time.",
  "permissions": [
    "storage",
    "alarms",
    "tabs",
    "scripting"
  ],
  "host_permissions": [
    "https://meet.google.com/*",
    "https://calendar.google.com/*",
    "https://www.googleapis.com/*"
  ],
  "background": {
    "service_worker": "background/service_worker.js"
  },
  "content_scripts": [
    {
      "matches": ["https://meet.google.com/*"],
      "js": ["content/meet_injector.js"],
      "run_at": "document_idle"
    },
    {
      "matches": ["https://calendar.google.com/*"],
      "js": ["content/calendar_injector.js"],
      "run_at": "document_idle"
    }
  ],
  "action": {
    "default_popup": "popup/popup.html"
  }
}
```

---

## 8. Feature Flows

### 8.1 Auto-Kill Flow

```
User joins GMeet
      │
      ▼
meet_injector.js boots
      │
      ▼
GET_SESSION → background fetches from storage (or Calendar API fallback)
      │
      ├─ No duration found? → Overlay shows timer (no auto-kill arm)
      │
      └─ Duration found?
            │
            ▼
        initTimer(session)
        Set alarm: autokill_{meetingId} at session.endsAt
            │
            ▼ (alarm fires)
        broadcastToMeetTabs MEETING_EXPIRED
            │
            ▼
        showEjectCountdown(10s)
            │
            ├─ Host → endMeetingForAll()
            └─ Guest → leaveMeeting()
```

### 8.2 Waste Vote Flow

```
Participant clicks "🔪 Waste Vote"
      │
      ▼
sendToBackground START_VOTE
      │
      ▼
background: createVoteSession → save → broadcastToMeetTabs VOTE_STARTED
      │
      ▼
Each participant sees vote_modal (anonymous)
      │
      ▼
On vote: sendToBackground CAST_VOTE { token, vote }
      │
      ▼
background: castVote → update VoteSession → broadcastToMeetTabs VOTE_UPDATE
      │
      ▼
All overlays update live tally bar
      │
      ├─ isWasteThresholdMet? → showEjectCountdown → leaveMeeting (all)
      └─ isVoteExpired (1 min)? → concludeVoteSession (no ejection, log result)
```

### 8.3 Invite Guard Flow

```
User opens Calendar, creates/edits event
      │
      ▼
calendar_injector observeAttendeeList
      │
      ▼
User adds attendee email chip
      │
      ▼
showPurposeModal(email)
  ┌───────────────────────────────────────────┐
  │ Why is [name@co.com] in this meeting?     │
  │                                           │
  │ ○ Decision maker                          │
  │ ○ Presenter / facilitator                 │
  │ ○ Subject matter input                    │
  │ ○ FYI / optional                          │
  │ ○ Other: [text input]                     │
  │                                           │
  │         [Skip]        [Confirm]           │
  └───────────────────────────────────────────┘
      │
      ▼
saveAttendeePurpose(record)
renderAttendeeBadge(email, purpose) — subtle chip label
```

---

## 9. UI Components

### 9.1 MeetReaper Overlay (HUD)
- Floating pill in top-right of GMeet, above controls
- Shows: `⏱ 23:04 elapsed | ⏳ 06:56 remaining`
- Red pulsing border when `isExpired`
- `🔪 Waste Vote` button — disabled if vote already active
- Live vote bar: `[██████░░░░] 60% say waste (3/5 voted)`

### 9.2 Vote Modal
- Appears center-screen for all participants when vote is triggered
- Anonymous — no indication of who triggered it
- Two buttons: `🗑 Waste of Time` / `✅ Worth It`
- 60s countdown
- "Waiting for others..." state while vote is live

### 9.3 Invite Guard Modal
- Appears inline below the attendee chip
- Dropdown-first design (fast to fill)
- Non-blocking — can be skipped

---

## 10. UserSettings

```js
/**
 * @typedef {Object} UserSettings
 * @property {boolean} autoKillEnabled      - Default: true
 * @property {number}  autoKillGraceSecs    - Grace period before kill. Default: 30
 * @property {boolean} voteEnabled          - Default: true
 * @property {number}  voteTimeoutMs        - Default: 60000
 * @property {number}  voteThresholdPercent - Default: 50
 * @property {boolean} inviteGuardEnabled   - Default: true
 * @property {boolean} overlayVisible       - Default: true
 */
```

---

## 11. Edge Cases & Notes for AI Implementation

| Scenario | Handling |
|---|---|
| No calendar event linked to meet | Auto-kill disarmed; overlay shows elapsed only |
| User is a guest (non-host) | Can still vote and leave; cannot `endMeetingForAll` |
| Vote triggered, then meeting expires | Auto-kill takes precedence; vote session closed |
| User rejoins after leaving | New session init; old vote session ignored |
| Multiple MeetReaper users in same call | Votes are synced via background relay (shared voteId) |
| Calendar attendee has no Google account | Invite Guard skips non-Google email chips gracefully |
| GMeet DOM changes (Google updates) | `waitForElement` with timeout + error logging; fail silently |

---

## 12. File Build Order for AI

Recommended implementation order for an AI agent building this:

1. `utils/logger.js`
2. `utils/time_utils.js`
3. `utils/dom_utils.js`
4. `modules/storage.js`
5. `modules/messaging.js`
6. `modules/timer.js`
7. `modules/voter.js`
8. `modules/ejector.js`
9. `modules/overlay_renderer.js` + `ui/overlay.html` + `ui/overlay.css`
10. `modules/calendar_guard.js` + `ui/invite_guard_modal.html`
11. `background/service_worker.js`
12. `content/meet_injector.js`
13. `content/calendar_injector.js`
14. `popup/popup.html` + `popup/popup.js`
15. `manifest.json`

---

*MeetReaper — Because your time is not a tragedy of the commons.*
