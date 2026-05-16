# MeetReaper

MeetReaper is a Chrome extension that helps people make meetings shorter, clearer, and more useful.

## The very simple story

Imagine MeetReaper as a small robot helper for meetings:

1. **Before the meeting**  
   When you add a person to Google Calendar, the robot asks:  
   **“Why does this person need to come?”**

2. **During the meeting**  
   The robot watches the meeting clock and shows how much time is left.

3. **If the meeting feels useless**  
   People can vote:
   - `👍` means “this meeting is a waste”
   - `👎` means “this meeting is useful”

4. **If the meeting goes too long, or enough people vote against it**  
   MeetReaper can help end the meeting.

That is the whole idea.

---

## Where the app starts

This is not a normal website with one `index.js` file.

Because it is a Chrome extension, Chrome starts from:

```text
manifest.json
```

`manifest.json` is like the project’s **map**. It tells Chrome:

- what pages the extension can run on
- which scripts to load
- which permissions it needs

From there, Chrome starts these main files:

| File | Simple meaning |
| --- | --- |
| `background/service_worker.js` | The brain that keeps working in the background |
| `content/calendar_injector.js` | The helper that runs inside Google Calendar |
| `content/meet_injector.js` | The helper that runs inside Google Meet |
| `popup/popup.html` + `popup/popup.js` | The tiny settings window when you click the extension icon |

---

## Big picture flow

```text
manifest.json
  |
  |-- starts background/service_worker.js
  |
  |-- on Google Calendar:
  |     content/calendar_injector.js
  |
  |-- on Google Meet:
        content/meet_injector.js
```

---

## Google Calendar flow: adding guests

```text
You add a guest email
  -> calendar_guard.js notices the new guest
  -> calendar_injector.js puts that guest into a queue
  -> calendar_guard.js shows the "Why is this person needed?" box
  -> calendar_description.js writes the answer into the event description
  -> toast_renderer.js shows "Reason saved"
```

### Files involved

| File | Job |
| --- | --- |
| `content/calendar_injector.js` | Coordinates the whole Calendar flow |
| `modules/calendar_guard.js` | Watches guests and shows the reason popup |
| `modules/calendar_description.js` | Opens the description box and writes guest reasons into it |
| `modules/toast_renderer.js` | Shows small success messages |

### Why this is split

Each file does one main job:

- one file watches guests
- one file edits the description box
- one file shows messages
- one file coordinates them

That makes the code easier to read and safer to change.

---

## Google Meet flow: timer and voting

```text
You open a Google Meet call
  -> meet_injector.js asks the background brain for meeting info
  -> service_worker.js looks up the matching Calendar event
  -> calendar_api.js gets the scheduled end time
  -> overlay_renderer.js shows the timer on the Meet page

If someone starts a vote:
  -> vote_modal_renderer.js shows the vote popup
  -> reaction_vote.js watches 👍 and 👎 reactions
  -> overlay_renderer.js updates the vote bar
  -> if enough people vote "waste", ejector.js helps end the call
```

### Files involved

| File | Job |
| --- | --- |
| `content/meet_injector.js` | Coordinates the Meet page |
| `modules/calendar_api.js` | Finds the matching Google Calendar event |
| `modules/overlay_renderer.js` | Draws the floating timer box |
| `modules/reaction_vote.js` | Watches vote reactions and counts them |
| `modules/vote_modal_renderer.js` | Draws vote popups |
| `modules/ejector.js` | Leaves or ends the meeting |
| `modules/timer.js` | Calculates time left |

---

## Background flow: the hidden brain

`background/service_worker.js` is like the teacher’s desk in the classroom.  
It does not show much on screen, but it coordinates important work:

- gets Google login tokens through `auth_service.js`
- asks Google Calendar for meeting data
- sends emails through `gmail_service.js`
- saves settings and meeting state through `storage.js`
- listens for alarms when time is up
- handles the shared vote logic

### Files involved

| File | Job |
| --- | --- |
| `background/service_worker.js` | Main background coordinator |
| `modules/auth_service.js` | Gets Google OAuth tokens |
| `modules/gmail_service.js` | Sends Gmail messages |
| `modules/storage.js` | Saves settings and sessions |
| `modules/voter.js` | Stores and checks vote results |
| `modules/messaging.js` | Sends messages between files |

---

## Folder guide

| Folder | What lives there |
| --- | --- |
| `background/` | The always-ready background brain |
| `content/` | Scripts that run inside Google pages |
| `modules/` | Small reusable pieces, each with one main job |
| `popup/` | The little settings window |
| `ui/` | Shared styles and small UI placeholders |
| `utils/` | Tiny helper tools used by other files |

---

## Easy way to understand the code

If you are reading the project for the first time, use this order:

1. `manifest.json`  
   See what Chrome starts.

2. `content/calendar_injector.js`  
   Learn the guest-purpose flow.

3. `modules/calendar_guard.js`  
   See how new guests are detected.

4. `modules/calendar_description.js`  
   See how reasons are written into the Calendar description.

5. `content/meet_injector.js`  
   Learn the Meet page flow.

6. `modules/reaction_vote.js` and `modules/vote_modal_renderer.js`  
   See how the voting works.

7. `background/service_worker.js`  
   Understand how the background brain connects everything.

---

## Why the code is split this way

The project now follows a simple rule:

> **One file should have one main reason to change.**

Examples:

- If the vote popup design changes, edit `vote_modal_renderer.js`
- If Google Calendar changes its description box, edit `calendar_description.js`
- If Gmail sending changes, edit `gmail_service.js`
- If the Calendar guest flow changes, edit `calendar_injector.js`

This is called **Single Responsibility Principle**, but the child-friendly version is:

> **Each helper should have one clear job.**

---

## Run locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.

You can also run:

```bash
./setup.command
```

---

## Google setup needed

For Calendar lookup and Gmail sending to work, you need your own Google setup:

1. Create a Google Cloud project.
2. Enable the Google Calendar API.
3. Enable the Gmail API.
4. Create an OAuth client for a Chrome extension.
5. Replace the placeholder `client_id` in `manifest.json`.
6. Reload the extension in Chrome.
7. Open the extension popup and click **Connect Calendar**.

---

## Important note

MeetReaper works by looking at Google Meet and Google Calendar pages.  
If Google changes how those pages are built, some selectors may need to be updated later.
