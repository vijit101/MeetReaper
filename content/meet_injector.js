/**
 * @fileoverview Main content script injected into meet.google.com to orchestrate MeetReaper features.
 */
(async () => {
  const [
    messaging,
    timer,
    overlayRenderer,
    ejector,
  ] = await Promise.all([
    import(chrome.runtime.getURL('modules/messaging.js')),
    import(chrome.runtime.getURL('modules/timer.js')),
    import(chrome.runtime.getURL('modules/overlay_renderer.js')),
    import(chrome.runtime.getURL('modules/ejector.js')),
  ]);

  const meetingId = location.pathname.split('/').filter(Boolean)[0];
  let session = await messaging.sendToBackground({ type: 'GET_SESSION', payload: { meetingId } });
  const authRequired = Boolean(session?.authRequired);
  if (authRequired) session = null;
  session ??= {
    meetingId,
    meetingCode: meetingId,
    scheduledDuration: 0,
    joinedAt: Date.now(),
    endsAt: null,
    autoKillEnabled: false,
    status: 'active',
  };
  const overlay = overlayRenderer.injectOverlay(session);
  if (authRequired) {
    overlay.querySelector('.meetreaper-time').insertAdjacentHTML(
      'afterend',
      '<small class="meetreaper-auth-note">Connect Calendar from the MeetReaper popup to arm Auto-Kill.</small>',
    );
  }

  /**
   * Estimates the current number of participants in the meeting.
   * @returns {number} The estimated participant count.
   */
  const participantCountEstimate = () =>
    Math.max(1, document.querySelectorAll('[data-participant-id]').length || 1);

  /**
   * Shows the anonymous voting modal.
   */
  const getReactionEmoji = (node) =>
    node.getAttribute('aria-label') ||
    node.textContent ||
    '';

  const clickReactionButton = async (emojiLabel) => {
    const reactionToggle = [...document.querySelectorAll('button')].find((button) =>
      /reaction/i.test(button.getAttribute('aria-label') || button.textContent || ''),
    );
    reactionToggle?.click();
    await new Promise((resolve) => setTimeout(resolve, 250));
    const emojiButton = [...document.querySelectorAll('button')].find((button) =>
      (button.getAttribute('aria-label') || button.textContent || '').includes(emojiLabel),
    );
    emojiButton?.click();
  };

  const showVoteModal = () => {
    document.getElementById('meetreaper-vote-modal')?.remove();
    const modal = document.createElement('div');
    modal.id = 'meetreaper-vote-modal';
    modal.className = 'meetreaper-modal';
    modal.innerHTML = `
      <strong>Emergency vibe check</strong>
      <p>Vote with Meet reactions in the next 10 seconds.</p>
      <button data-vote="yes">👍 Waste</button>
      <button data-vote="no">👎 Worth it</button>
    `;
    modal.addEventListener('click', async (event) => {
      const vote = event.target.dataset.vote;
      if (!vote) return;
      await clickReactionButton(vote === 'yes' ? '👍' : '👎');
      modal.remove();
    });
    document.body.append(modal);
    overlayRenderer.showVotingState(overlay);
    overlayRenderer.updateVoteBar(overlay, { yesPercent: 0, noPercent: 0, totalVoted: 0 });
  };

  /**
   * Initiates the end meeting sequence with a countdown.
   */
  const endMeeting = () => {
    if (timerIntervalId) clearInterval(timerIntervalId);
    ejector.showEjectCountdown(
      5,
      () => (ejector.isHost() ? ejector.endMeetingForAll() : ejector.leaveMeeting()),
      () => {},
    );
  };

  /**
   * Shows the vote result to all participants before the meeting closes.
   * @param {{ yesPercent: number, totalVoted: number }} tally - Final vote tally.
   */
  const showVoteResult = (tally) => {
    document.getElementById('meetreaper-vote-modal')?.remove();
    document.getElementById('meetreaper-vote-result')?.remove();
    const modal = document.createElement('div');
    modal.id = 'meetreaper-vote-result';
    modal.className = 'meetreaper-modal';
    modal.innerHTML = `
      <strong>Vote result</strong>
      <p>${tally.yesPercent}% say this meeting is a waste of time.</p>
      <div class="meetreaper-vote">
        <div class="meetreaper-vote-bar"><span style="width:${tally.yesPercent}%"></span></div>
        <small>${tally.totalVoted} participant${tally.totalVoted === 1 ? '' : 's'} voted</small>
      </div>
      <p class="meetreaper-result-countdown">Meeting closes in <span>5</span>s.</p>
    `;
    document.body.append(modal);
    let remaining = 5;
    const label = modal.querySelector('.meetreaper-result-countdown span');
    const interval = setInterval(() => {
      remaining -= 1;
      label.textContent = remaining;
      if (remaining <= 0) {
        clearInterval(interval);
        modal.remove();
      }
    }, 1000);
  };

  const startReactionVote = () => {
    showVoteModal();
    const startedAt = Date.now();
    const yesSeen = new Set();
    const noSeen = new Set();
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.addedNodes) {
          if (!(node instanceof HTMLElement)) continue;
          const text = getReactionEmoji(node);
          if (!text.includes('👍') && !text.includes('👎')) continue;
          const fingerprint = `${text}-${node.textContent}-${node.outerHTML.slice(0, 120)}`;
          if (text.includes('👍')) yesSeen.add(fingerprint);
          if (text.includes('👎')) noSeen.add(fingerprint);
          overlayRenderer.showVotingState(overlay);
          overlayRenderer.updateVoteBar(overlay, {
            yesPercent: Math.round((yesSeen.size / participantCountEstimate()) * 100),
            noPercent: Math.round((noSeen.size / participantCountEstimate()) * 100),
            totalVoted: yesSeen.size + noSeen.size,
          });
        }
      }
    });
    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      const participantCount = participantCountEstimate();
      const tally = {
        yesPercent: Math.round((yesSeen.size / participantCount) * 100),
        noPercent: Math.round((noSeen.size / participantCount) * 100),
        totalVoted: yesSeen.size + noSeen.size,
      };
      showVoteResult(tally);
      if (yesSeen.size / participantCount > 0.5) endMeeting();
      else overlayRenderer.showIdleState(overlay);
    }, Math.max(0, 10_000 - (Date.now() - startedAt)));
  };

  overlay.querySelector('[data-trigger-vote]').addEventListener('click', () => {
    startReactionVote();
  });

  let timerIntervalId = setInterval(() => {
    overlayRenderer.updateTimerDisplay(
      overlay,
      timer.getElapsedLabel(session),
      timer.getRemainingLabel(session),
      timer.isExpired(session),
    );
  }, 1000);

  messaging.onBroadcast('MEETING_EXPIRED', ({ meetingId: expiredMeetingId }) => {
    if (expiredMeetingId === meetingId) endMeeting();
  });
})();
