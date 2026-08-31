function initHeroOrbs(orgs) {
  const wrap = document.getElementById("hero-orbs");
  if (!wrap) return;
  const palette = ["#2DE2E6", "#FFB627", "#A855F7", "#FF5D8F", "#7CFF6B", "#38BDF8", "#F97316"];
  const ORB_COUNT = 9;

  const orbs = Array.from({ length: ORB_COUNT }, (_, i) => {
    const orb = document.createElement("div");
    orb.className = "hero-orb";
    const size = 12 + Math.round(Math.random() * 20);
    const color = palette[i % palette.length];
    orb.style.width = `${size}px`;
    orb.style.height = `${size}px`;
    orb.style.left = `${5 + Math.random() * 82}%`;
    orb.style.top = `${6 + Math.random() * 72}%`;
    orb.style.setProperty("--drift-x", `${Math.round((Math.random() - 0.5) * 70)}px`);
    orb.style.setProperty("--drift-y", `${Math.round((Math.random() - 0.5) * 70)}px`);
    orb.style.animationDuration = `${9 + Math.random() * 7}s`;
    orb.style.animationDelay = `${(Math.random() * -8).toFixed(2)}s`;
    orb.style.background = `radial-gradient(circle, ${color}, transparent 70%)`;
    orb.style.boxShadow = `0 0 ${Math.round(size * 0.9)}px ${color}`;

    const img = document.createElement("img");
    img.alt = "";
    orb.appendChild(img);
    wrap.appendChild(orb);
    return orb;
  });

  const withLogo = orgs.filter((o) => o.logo);
  if (withLogo.length === 0) return;

  function revealRandomLogo() {
    const orb = orbs[Math.floor(Math.random() * orbs.length)];
    const org = withLogo[Math.floor(Math.random() * withLogo.length)];
    const img = orb.querySelector("img");
    img.src = org.logo;
    img.title = org.name;
    orb.classList.add("showing-logo");
    setTimeout(() => orb.classList.remove("showing-logo"), 3200);
  }

  revealRandomLogo();
  setInterval(revealRandomLogo, 2200);
}

function initJoinedTicker(orgs) {
  const ticker = document.getElementById("joined-ticker");
  const track = document.getElementById("joined-ticker-track");
  const withDates = orgs.filter((o) => o.joinedDate).slice().sort((a, b) => (a.joinedDate < b.joinedDate ? 1 : -1));
  if (withDates.length === 0) return;

  const itemHtml = withDates
    .map((org) => `
      <a class="joined-ticker-item" href="org.html?slug=${encodeURIComponent(org.slug)}">
        ${iconSvg("sparkle", 14)} Welcome <strong>${org.name}</strong> — joined ${formatDate(org.joinedDate)}
      </a>`)
    .join("");
  // Duplicated once so the scroll can loop seamlessly at -50% instead of
  // jumping. The second copy is aria-hidden so screen readers don't announce
  // every organisation twice.
  track.innerHTML = `<span>${itemHtml}</span><span aria-hidden="true">${itemHtml}</span>`;
  ticker.hidden = false;
}

// Month grid of every member's events. Dots are coloured by each org's own
// theme, so at a glance you can see who is active on which day.
function initCalendar(orgs, onSelectDate) {
  const grid = document.getElementById("cal-grid");
  const label = document.getElementById("cal-month");
  const prevBtn = document.getElementById("cal-prev");
  const nextBtn = document.getElementById("cal-next");
  if (!grid) return;

  // date string -> [{org, event}]
  const byDate = new Map();
  orgs.forEach((org) => {
    (org.events || []).forEach((event) => {
      if (!event.date) return;
      if (!byDate.has(event.date)) byDate.set(event.date, []);
      byDate.get(event.date).push({ org, event });
    });
  });

  const today = todayISO();
  const [ty, tm] = today.split("-").map(Number);
  let viewYear = ty;
  let viewMonth = tm - 1; // 0-indexed
  let selected = null;

  // If nothing is on this month, open on the month of the next upcoming
  // event instead — landing on an empty grid reads as "nothing ever happens".
  const thisMonthPrefix = `${ty}-${String(tm).padStart(2, "0")}`;
  const hasThisMonth = [...byDate.keys()].some((d) => d.startsWith(thisMonthPrefix));
  if (!hasThisMonth) {
    const nextDate = [...byDate.keys()].filter((d) => d >= today).sort()[0];
    if (nextDate) {
      const [ny, nm] = nextDate.split("-").map(Number);
      viewYear = ny;
      viewMonth = nm - 1;
    }
  }

  const pad = (n) => String(n).padStart(2, "0");
  const iso = (y, m, d) => `${y}-${pad(m + 1)}-${pad(d)}`;

  function render() {
    label.textContent = new Date(viewYear, viewMonth, 1)
      .toLocaleDateString("en-US", { month: "long", year: "numeric" });

    grid.innerHTML = "";
    ["S", "M", "T", "W", "T", "F", "S"].forEach((d) => {
      const el = document.createElement("div");
      el.className = "cal-dow";
      el.textContent = d;
      grid.appendChild(el);
    });

    const firstWeekday = new Date(viewYear, viewMonth, 1).getDay();
    const daysInMonth = new Date(viewYear, viewMonth + 1, 0).getDate();

    for (let i = 0; i < firstWeekday; i++) {
      const cell = document.createElement("div");
      cell.className = "cal-day cal-empty";
      grid.appendChild(cell);
    }

    for (let day = 1; day <= daysInMonth; day++) {
      const dateStr = iso(viewYear, viewMonth, day);
      const entries = byDate.get(dateStr) || [];
      const cell = document.createElement(entries.length ? "button" : "div");
      cell.className = "cal-day";
      if (dateStr === today) cell.classList.add("is-today");
      if (dateStr < today) cell.classList.add("is-past");
      if (entries.length) cell.classList.add("has-events");
      if (selected === dateStr) cell.classList.add("is-selected");

      const num = document.createElement("span");
      num.className = "cal-num";
      num.textContent = day;
      cell.appendChild(num);

      if (entries.length) {
        cell.type = "button";
        const dots = document.createElement("span");
        dots.className = "cal-dots";
        // Cap the dots so a busy day doesn't overflow its cell.
        entries.slice(0, 4).forEach(({ org }) => {
          const dot = document.createElement("span");
          dot.className = "cal-dot";
          dot.style.background = org.themeColor && /^#[0-9a-fA-F]{6}$/.test(org.themeColor)
            ? org.themeColor : "var(--aqua)";
          dots.appendChild(dot);
        });
        cell.appendChild(dots);
        cell.title = entries.map(({ org, event }) => `${org.name}: ${event.title}`).join("\n");
        cell.setAttribute("aria-label",
          `${formatDate(dateStr)} — ${entries.length} event${entries.length > 1 ? "s" : ""}`);
        cell.addEventListener("click", () => {
          selected = selected === dateStr ? null : dateStr;
          render();
          onSelectDate(selected);
        });
      }

      grid.appendChild(cell);
    }
  }

  prevBtn.addEventListener("click", () => {
    viewMonth -= 1;
    if (viewMonth < 0) { viewMonth = 11; viewYear -= 1; }
    render();
  });
  nextBtn.addEventListener("click", () => {
    viewMonth += 1;
    if (viewMonth > 11) { viewMonth = 0; viewYear += 1; }
    render();
  });

  render();
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
    link.innerHTML = `View Profile ${iconSvg("arrowRight", 16)}`;
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

    attachTilt(card, 8);
    stack.appendChild(card);
    return card;
  });

  const dots = orgs.length > 1
    ? orgs.map((_, i) => {
        const dot = document.createElement("button");
        dot.type = "button";
        dot.className = "spotlight-dot";
        dot.setAttribute("aria-label", `Show ${orgs[i].name}`);
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

    renderShare(document.getElementById("site-share"), { kind: "site" });
    initHeroOrbs(orgs);
    initJoinedTicker(orgs);
    initSpotlight(categories, orgs);

    // Member bubbles
    bubbleGrid.innerHTML = "";
    orgs.forEach((org) => bubbleGrid.appendChild(createBubble(org)));

    const addBubble = document.createElement("a");
    addBubble.className = "bubble bubble-add";
    addBubble.href = "apply.html";
    addBubble.innerHTML = `<div class="bubble-avatar">${iconSvg("plus", 22)}</div><div class="bubble-name">Join Us</div>`;
    bubbleGrid.appendChild(addBubble);

    // Stats — animate up once scrolled into view
    const usedCategories = new Set(orgs.map((o) => o.categoryId));
    countUpOnView(statMembers, orgs.length);
    countUpOnView(statCategories, usedCategories.size);

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
      stagger(announceList.children);
    }

    // Shared calendar + the event list beneath it
    const today = todayISO();
    const allEvents = orgs.flatMap((org) => (org.events || []).map((e) => ({ org, event: e })));
    const eventHeading = document.getElementById("events-heading");
    const clearBtn = document.getElementById("cal-clear");

    function renderEvents(dateFilter) {
      // A specific day shows everything on it (including past days you clicked
      // back to); with no filter we show what's still ahead.
      const list = (dateFilter
        ? allEvents.filter(({ event }) => event.date === dateFilter)
        : allEvents.filter(({ event }) => event.date >= today)
      ).sort((a, b) => (a.event.date > b.event.date ? 1 : -1));

      eventHeading.textContent = dateFilter ? formatDate(dateFilter) : "Coming up next";
      clearBtn.hidden = !dateFilter;

      eventList.innerHTML = "";
      if (list.length === 0) {
        eventList.innerHTML = dateFilter
          ? '<div class="empty-state">Nothing scheduled on this day.</div>'
          : '<div class="empty-state">No upcoming events yet. Members can add their own to claim a spot on the shared calendar.</div>';
        return;
      }
      list.slice(0, dateFilter ? 20 : 6).forEach(({ org, event }) => {
        eventList.appendChild(createEventItem(org, event));
      });
      stagger(eventList.children);
      initReveal();
    }

    initCalendar(orgs, renderEvents);
    renderEvents(null);
    clearBtn.addEventListener("click", () => {
      // Re-render the calendar without a selection by simulating a clear.
      document.querySelectorAll(".cal-day.is-selected").forEach((el) => el.click());
    });

    initReveal();
  } catch (err) {
    console.error(err);
    const msg = '<div class="empty-state">Could not load member organizations. If you are viewing this file directly, run a local server (see README) so the browser can fetch the data files.</div>';
    bubbleGrid.innerHTML = msg;
    eventList.innerHTML = msg;
  }
})();
