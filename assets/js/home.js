function initJoinedTicker(orgs) {
  const ticker = document.getElementById("joined-ticker");
  const track = document.getElementById("joined-ticker-track");
  const withDates = orgs.filter((o) => o.joinedDate).slice().sort((a, b) => (a.joinedDate < b.joinedDate ? 1 : -1));
  if (withDates.length === 0) return;

  const itemHtml = withDates
    .map((org) => `
      <a class="joined-ticker-item" href="org.html?slug=${encodeURIComponent(org.slug)}">
        <span class="dot">●</span> Welcome ${org.name} <span class="date">— joined ${formatDate(org.joinedDate)}</span>
      </a>`)
    .join("");
  // Duplicated once so the scroll can loop seamlessly at -50% instead of jumping.
  track.innerHTML = itemHtml + itemHtml;
  ticker.hidden = false;
}

function initSpotlight(categories, orgs) {
  const stack = document.getElementById("spotlight-stack");
  const dotsWrap = document.getElementById("spotlight-dots");
  if (orgs.length === 0) {
    stack.innerHTML = '<div class="empty-state">No members yet — be the first to <a href="apply.html">apply</a>.</div>';
    return;
  }

  let activeIndex = 0;
  const cards = orgs.map((org) => {
    const card = document.createElement("div");
    card.className = "spotlight-card";
    if (org.themeColor && /^#[0-9a-fA-F]{6}$/.test(org.themeColor)) {
      card.style.setProperty("--spotlight-accent", org.themeColor);
    }

    const avatar = document.createElement("div");
    avatar.className = "spotlight-avatar";
    fillAvatar(avatar, org);

    const badge = document.createElement("div");
    badge.className = "badge spotlight-badge";
    badge.textContent = orgCategoryLabel(categories, org.categoryId, org.categoryOther);

    const name = document.createElement("div");
    name.className = "spotlight-name";
    name.textContent = org.name;

    const tagline = document.createElement("div");
    tagline.className = "spotlight-tagline";
    tagline.textContent = org.tagline || "";

    const link = document.createElement("a");
    link.className = "spotlight-link";
    link.href = `org.html?slug=${encodeURIComponent(org.slug)}`;
    link.textContent = "View Profile →";
    link.addEventListener("click", (e) => e.stopPropagation());

    card.appendChild(avatar);
    card.appendChild(badge);
    card.appendChild(name);
    card.appendChild(tagline);
    card.appendChild(link);

    if (orgs.length > 1) {
      const hint = document.createElement("div");
      hint.className = "spotlight-hint";
      hint.textContent = "Click card for next →";
      card.appendChild(hint);
      card.addEventListener("click", () => {
        activeIndex = (activeIndex + 1) % orgs.length;
        render();
      });
    }

    stack.appendChild(card);
    return card;
  });

  const dots = orgs.length > 1
    ? orgs.map((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "spotlight-dot";
        dot.addEventListener("click", () => {
          activeIndex = i;
          render();
        });
        dotsWrap.appendChild(dot);
        return dot;
      })
    : [];

  function render() {
    cards.forEach((card, i) => {
      const offset = (i - activeIndex + orgs.length) % orgs.length;
      card.className = `spotlight-card ${offset === 0 ? "pos-0" : offset === 1 ? "pos-1" : offset === 2 ? "pos-2" : "pos-hidden"}`;
    });
    dots.forEach((dot, i) => dot.classList.toggle("active", i === activeIndex));
  }
  render();

  if (orgs.length > 1) {
    let timer = setInterval(() => { activeIndex = (activeIndex + 1) % orgs.length; render(); }, 5000);
    stack.addEventListener("mouseenter", () => clearInterval(timer));
    stack.addEventListener("mouseleave", () => {
      timer = setInterval(() => { activeIndex = (activeIndex + 1) % orgs.length; render(); }, 5000);
    });
  }
}

(async function initHome() {
  const bubbleGrid = document.getElementById("member-bubbles");
  const announceList = document.getElementById("announcements-list");
  const eventList = document.getElementById("events-list");
  const statMembers = document.getElementById("stat-members");
  const statCategories = document.getElementById("stat-categories");

  try {
    const [categories, orgs] = await Promise.all([loadCategories(), loadAllOrgs()]);

    initJoinedTicker(orgs);
    initSpotlight(categories, orgs);

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
