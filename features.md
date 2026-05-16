# MeetReaper: Future Features Roadmap

To make **MeetReaper** a truly polished, production-ready product, we should focus on features that enhance its core mission: **saving time and making meetings intentional.** 

Here are the top features proposed for the next development phases:

### 1. Settings & Customization (The Popup)
Right now, the extension assumes a lot of defaults. We should build out the `popup.html` to allow users to configure:
* **Vote Thresholds:** Let users decide if it takes a 50% majority or a 75% supermajority to kill a meeting.
* **Grace Periods:** Allow users to set a custom buffer (e.g., auto-kill 5 minutes *after* the scheduled end time).
* **Feature Toggles:** Let users easily toggle the "Invite Guard" (Calendar) or "Auto-Kill" (Meet) features on and off.

### 2. "Extend Meeting" Voting
If a meeting is about to hit the Auto-Kill timer, the overlay should flash red and provide an **"Extend by 5 minutes"** button. If the majority votes to extend, the meeting survives; otherwise, the Reaper takes it. This adds flexibility for meetings that are actually productive.

### 3. Agenda Tracking & Enforcement
* Pull the agenda directly from the Google Calendar description.
* Display the current agenda item on the Meet overlay.
* If an agenda item is taking too long, the overlay subtly pulses orange to remind the speaker to move on.

### 4. Meeting Cost Calculator & Dashboard
A great way to discourage useless meetings is to show their financial cost.
* Add a simple setting where users input an "Average Hourly Rate" for their team.
* When you add attendees in Google Calendar, a live ticker shows the estimated dollar cost of the meeting.
* Build a dashboard in the extension showing **"Time & Money Saved"** across the week by meetings that were voted down or ended early.

### 5. Soft Audio/Visual Nudges
Instead of a harsh auto-kill out of nowhere, the extension should inject a subtle "ding" or visual pulse at the 5-minute warning mark, and a more aggressive countdown timer in the final 60 seconds so people can wrap up their sentences.

### 6. Anonymous "Speed Up" Nudges
In addition to the nuclear "Vote to Kill" button, add a softer **"Speed Up"** button. If multiple people click it anonymously, a subtle 🐌 snail or "Wrap it up" icon flashes on everyone's screen, signaling the speaker is rambling without ending the call.

### 7. Attendee Purpose Ledger
Invite Guard should build a lightweight purpose map while the organizer adds guests:
* Prompt once for each newly added attendee, in the same order they were added.
* Ignore Calendar page noise and pre-existing email-like DOM values so new events do not start with bogus attendee prompts.
* Surface each attendee's declared role beside their chip so the organizer can quickly see who is required, optional, or redundant before sending the invite.

### 8. "My Agenda Is Done" Host Nudge
Sometimes a participant has already finished the part they were invited for and no longer needs to stay for the rest of the meeting.
* Add a polite **"My agenda is done"** action that lets a participant nudge the host without interrupting the room.
* The host should receive a quiet prompt showing who is asking to leave and why they were originally invited.
* This helps people bounce once their contribution is complete instead of staying trapped in a meeting that no longer needs them.
