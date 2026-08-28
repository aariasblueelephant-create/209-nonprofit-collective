(async function initHome() {
  const bubbleGrid = document.getElementById("member-bubbles");
  const announceList = document.getElementById("announcements-list");
  const eventList = document.getElementById("events-list");
  const statMembers = document.getElementById("stat-members");
  const statCategories = document.getElementById("stat-categories");

  try {
    const [categories, orgs] = await Promise.all([loadCategories(), loadAllOrgs()]);

    // Member bubbles
    bubbleGrid.innerHTML = "";
    orgs.forEach((org) => bubbleGrid.appendChild(createBubble(org)));

    const addBubble = document.createElement("a");
    addBubble.className = "bubble bubble-add";
    addBubble.href = "apply.html";
    addBubble.innerHTML = `<div class="bubble-avatar">+</div><div class="bubble-name">Join Us</div>`;
    bubbleGrid.appendChild(addBubble);

    // Stats
    statMembers.textContent = orgs.length;
    const usedCategories = new Set(orgs.map((o) => o.categoryId));
    statCategories.textContent = usedCategories.size;

    // Announcements
    const all = orgs.flatMap((org) => (org.announcements || []).map((a) => ({ org, announcement: a })));
    all.sort((a, b) => (a.announcement.date < b.announcement.date ? 1 : -1));
    announceList.innerHTML = "";
    if (all.length === 0) {
      announceList.innerHTML = '<div class="empty-state">No announcements yet.</div>';
    } else {
      all.slice(0, 6).forEach(({ org, announcement }) => {
        announceList.appendChild(createAnnouncementItem(org, announcement));
      });
    }

    // Upcoming events
    const today = new Date().toISOString().slice(0, 10);
    const events = orgs
      .flatMap((org) => (org.events || []).map((e) => ({ org, event: e })))
      .filter(({ event }) => event.date >= today)
      .sort((a, b) => (a.event.date > b.event.date ? 1 : -1));

    eventList.innerHTML = "";
    if (events.length === 0) {
      eventList.innerHTML = '<div class="empty-state">No events scheduled yet. Member orgs can add their own to claim a spot on the shared calendar — see the README for how.</div>';
    } else {
      events.slice(0, 8).forEach(({ org, event }) => {
        eventList.appendChild(createEventItem(org, event));
      });
    }
  } catch (err) {
    console.error(err);
    const msg = '<div class="empty-state">Could not load member organizations. If you are viewing this file directly, run a local server (see README) so the browser can fetch the data files.</div>';
    bubbleGrid.innerHTML = msg;
    eventList.innerHTML = msg;
  }
})();
