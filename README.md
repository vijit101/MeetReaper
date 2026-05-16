# MeetReaper

MeetReaper is a small Chrome extension that helps meetings stay useful.

It does three main things:

1. **Invite Guard**  
   When you add people to a Google Calendar meeting, it asks why each person is needed.

2. **Meeting Timer**  
   When you join a Google Meet call, it can read the matching Calendar event and show how much time is left.

3. **Vibe Check Vote**  
   People in the meeting can vote with reactions:
   - `👍` = this meeting is a waste
   - `👎` = this meeting is worth it

   If more than half say it is a waste, MeetReaper can end the meeting.

## Very simple explanation

Think of MeetReaper like a polite meeting helper:

- Before a meeting, it asks: **“Why is this person invited?”**
- During a meeting, it watches the clock.
- If people think the meeting is not useful, they can vote.
- If the meeting runs too long or enough people vote against it, MeetReaper helps close it.

## How the project starts

This is a Chrome extension, so the first file Chrome reads is:

```text
manifest.json
```

That file tells Chrome which parts to start:

| File | What it does |
| --- | --- |
| `background/service_worker.js` | Handles storage, alarms, Google Calendar lookup, Gmail sending, and shared messages |
| `content/meet_injector.js` | Runs on Google Meet pages and shows the timer + voting UI |
| `content/calendar_injector.js` | Runs on Google Calendar pages and asks the purpose of each newly added attendee |
| `popup/popup.html` + `popup/popup.js` | Small extension popup for settings and Google authorization |

## How the logic works

```text
Google Calendar
  -> you add a guest
  -> Invite Guard asks why they are needed
  -> purpose is shown beside that guest

Google Meet
  -> MeetReaper checks the matching Calendar event
  -> timer shows how much time is left
  -> people can start a quick vote
  -> if time is over or most people vote "waste", the meeting can end
```

## Main folders

| Folder | Purpose |
| --- | --- |
| `background/` | Long-running extension logic |
| `content/` | Scripts injected into Google Meet and Google Calendar |
| `modules/` | Reusable logic such as timers, voting, storage, and calendar helpers |
| `ui/` | Shared styles and UI fragments |
| `popup/` | The small extension popup |
| `utils/` | Small helper functions |

## Run locally

1. Open Chrome.
2. Go to `chrome://extensions`.
3. Turn on **Developer mode**.
4. Click **Load unpacked**.
5. Select this project folder.

You can also use:

```bash
./setup.command
```

## Google setup needed

For Calendar lookup and Gmail sending to work, you still need your own Google OAuth setup:

1. Create a Google Cloud project.
2. Enable the Google Calendar API.
3. Enable the Gmail API.
4. Create an OAuth client for a Chrome extension.
5. Replace the placeholder `client_id` in `manifest.json`.
6. Reload the extension in Chrome.
7. Open the extension popup and click **Connect Calendar**.

## Important note

MeetReaper depends on Google Meet and Google Calendar page structure. If Google changes their HTML, some selectors may need updating later.
