/**
 * @fileoverview Main content script injected into meet.google.com to orchestrate MeetReaper features.
 */
(async () => {
  const [
    messaging,
    timer,
    overlayRenderer,
    ejector,
    reactionVote,
    voteModalRenderer,
    storage,
    meetChat,
  ] = await Promise.all([
    import(chrome.runtime.getURL('modules/messaging.js')),
    import(chrome.runtime.getURL('modules/timer.js')),
    import(chrome.runtime.getURL('modules/overlay_renderer.js')),
    import(chrome.runtime.getURL('modules/ejector.js')),
    import(chrome.runtime.getURL('modules/reaction_vote.js')),
    import(chrome.runtime.getURL('modules/vote_modal_renderer.js')),
    import(chrome.runtime.getURL('modules/storage.js')),
    import(chrome.runtime.getURL('modules/meet_chat.js')),
  ]);

  const meetingId = location.pathname.split('/').filter(Boolean)[0];
  let session = await messaging.sendToBackground({ type: 'GET_SESSION', payload: { meetingId } });
  const authRequired = Boolean(session?.authRequired);
  if (authRequired) session = null;
  session ??= {
    meetingId,
    meetingCode: meetingId,
    startsAt: null,
    scheduledEndsAt: null,
    scheduledDuration: 0,
    joinedAt: Date.now(),
    endsAt: null,
    autoKillEnabled: false,
    status: 'active',
  };
  const overlay = overlayRenderer.injectOverlay(session);
  const settings = await storage.getSettings();
  if (authRequired) {
    overlay.querySelector('.meetreaper-time').insertAdjacentHTML(
      'afterend',
      '<small class="meetreaper-auth-note">Connect Calendar from the MeetReaper popup to arm Auto-Kill.</small>',
    );
  }

  /**
   * Initiates the end meeting sequence with a countdown.
   * @param {boolean} [announce=false] - Whether to explain the decision in Meet chat.
   */
  const endMeeting = async (announce = false) => {
    if (announce) {
      await meetChat.sendChatMessage(
        'MeetReaper: This meeting is being closed because the majority sees no value in continuing the current agenda, or feels the discussion is no longer aligned with the room.',
      );
    }
    ejector.showEjectCountdown(
      5,
      () => {
        if (timerIntervalId) clearInterval(timerIntervalId);
        ejector.endMeetingForAll();
      },
      () => overlayRenderer.showIdleState(overlay),
    );
  };

  /**
   * Starts the local reaction-based voting flow for this Meet page.
   */
  const startReactionVote = () => {
    voteModalRenderer.showVoteModal(async (vote) => {
      await reactionVote.clickReactionButton(vote === 'yes' ? '👍' : '👎');
    });
    overlayRenderer.showVotingState(overlay);
    overlayRenderer.updateVoteBar(overlay, { yesPercent: 0, noPercent: 0, totalVoted: 0 });
    reactionVote.startReactionVote({
      onUpdate: (tally) => {
        overlayRenderer.showVotingState(overlay);
        overlayRenderer.updateVoteBar(overlay, tally);
      },
      onComplete: ({ tally, yesCount, participantCount }) => {
        const shouldEnd = (yesCount / participantCount) * 100 > settings.voteThresholdPercent;
        voteModalRenderer.showVoteResult(tally, shouldEnd);
        if (shouldEnd) endMeeting(true);
        else overlayRenderer.showIdleState(overlay);
      },
    });
  };

  overlay.querySelector('[data-trigger-vote]').addEventListener('click', () => {
    startReactionVote();
  });

  let timerIntervalId = setInterval(() => {
    overlayRenderer.updateTimerDisplay(
      overlay,
      timer.getElapsedLabel(session),
      timer.getTotalLabel(session),
      timer.getRemainingLabel(session),
      timer.isExpired(session),
    );
  }, 1000);

  messaging.onBroadcast('MEETING_EXPIRED', ({ meetingId: expiredMeetingId }) => {
    if (expiredMeetingId === meetingId) endMeeting();
  });
})();
