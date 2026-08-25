(async function initHome() {
  const bubbleGrid = document.getElementById("member-bubbles");
  const announceList = document.getElementById("announcements-list");
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
  } catch (err) {
    console.error(err);
    bubbleGrid.innerHTML = '<div class="empty-state">Could not load member organizations. If you are viewing this file directly, run a local server (see README) so the browser can fetch the data files.</div>';
  }
})();
