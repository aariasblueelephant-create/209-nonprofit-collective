(async function initOrgPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  const errorState = document.getElementById("error-state");
  const orgContent = document.getElementById("org-content");

  if (!slug) {
    errorState.hidden = false;
    return;
  }

  try {
    const [categories, org] = await Promise.all([loadCategories(), loadOrg(slug)]);

    document.title = `${org.name} · 209 Nonprofit Collective`;

    if (org.themeColor && /^#[0-9a-fA-F]{6}$/.test(org.themeColor)) {
      document.documentElement.style.setProperty("--org-accent", org.themeColor);
    }
    if (org.themeColor2 && /^#[0-9a-fA-F]{6}$/.test(org.themeColor2)) {
      document.documentElement.style.setProperty("--org-accent-2", org.themeColor2);
    }

    const editLink = `edit.html?slug=${encodeURIComponent(slug)}`;
    document.getElementById("nav-edit-link").href = editLink;
    if (org.hasLocalEdit) {
      document.getElementById("org-local-notice-link").href = editLink;
      document.getElementById("org-local-notice").hidden = false;
    }

    fillAvatar(document.getElementById("org-avatar"), org);
    document.getElementById("org-name").textContent = org.name;
    document.getElementById("org-badge").textContent = orgCategoryLabel(categories, org.categoryId, org.categoryOther);
    document.getElementById("org-tagline").textContent = org.tagline || "";
    document.getElementById("org-description").textContent = org.description || "";

    const bannerEl = document.getElementById("org-banner");
    if (org.banner) {
      bannerEl.innerHTML = "";
      const img = document.createElement("img");
      img.src = org.banner;
      img.alt = `${org.name} banner photo`;
      img.onerror = () => { bannerEl.innerHTML = ""; };
      bannerEl.appendChild(img);
    }

    const donateLink = document.getElementById("org-donate");
    if (org.donateUrl) {
      donateLink.href = org.donateUrl;
      donateLink.hidden = false;
    }

    const shareWrap = document.getElementById("org-share");
    const pageUrl = window.location.href;
    const fb = document.createElement("a");
    fb.href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(pageUrl)}`;
    fb.target = "_blank";
    fb.rel = "noopener";
    fb.title = "Share on Facebook";
    fb.innerHTML = iconSvg("facebook", 18);
    const x = document.createElement("a");
    x.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`Check out ${org.name} in the 209 Nonprofit Collective:`)}`;
    x.target = "_blank";
    x.rel = "noopener";
    x.title = "Share on X";
    x.innerHTML = iconSvg("x", 18);
    shareWrap.appendChild(fb);
    shareWrap.appendChild(x);

    const metaRow = document.getElementById("org-meta-row");
    metaRow.innerHTML = "";
    if (org.serviceArea) {
      const span = document.createElement("span");
      span.innerHTML = `${iconSvg("pin", 16)} ${org.serviceArea}`;
      metaRow.appendChild(span);
    }
    if (org.website) {
      const a = document.createElement("a");
      a.href = org.website;
      a.target = "_blank";
      a.rel = "noopener";
      a.innerHTML = `${iconSvg("globe", 16)} Website`;
      metaRow.appendChild(a);
    }
    if (org.email) {
      const a = document.createElement("a");
      a.href = `mailto:${org.email}`;
      a.innerHTML = `${iconSvg("mail", 16)} Email`;
      metaRow.appendChild(a);
    }
    if (org.phone) {
      const a = document.createElement("a");
      a.href = `tel:${org.phone.replace(/[^\d+]/g, "")}`;
      a.innerHTML = `${iconSvg("phone", 16)} ${org.phone}`;
      metaRow.appendChild(a);
    }
    if (org.ein) {
      const span = document.createElement("span");
      span.innerHTML = `${iconSvg("shield", 16)} EIN ${org.ein}`;
      metaRow.appendChild(span);
    }
    if (org.joinedDate) {
      const span = document.createElement("span");
      span.innerHTML = `${iconSvg("calendar", 16)} Member since ${formatDate(org.joinedDate)}`;
      metaRow.appendChild(span);
    }

    // "Support this org" — driven by the org's own links when they've set
    // them, otherwise falls back to the generic collective-level copy.
    const supportText = document.getElementById("support-text");
    const supportActions = document.getElementById("support-actions");
    supportActions.innerHTML = "";
    const hasOwnLinks = Boolean(org.supportUrl || org.donateUrl);

    if (hasOwnLinks) {
      supportText.textContent = `Back ${org.name} directly — every bit helps them keep this work going.`;
      if (org.donateUrl) {
        const a = document.createElement("a");
        a.className = "btn btn-gold btn-sm";
        a.href = org.donateUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = `${iconSvg("heart", 16)} Donate`;
        supportActions.appendChild(a);
      }
      if (org.supportUrl) {
        const a = document.createElement("a");
        a.className = org.donateUrl ? "btn btn-outline btn-sm" : "btn btn-gold btn-sm";
        a.href = org.supportUrl;
        a.target = "_blank";
        a.rel = "noopener";
        a.innerHTML = `${iconSvg("external", 16)} Get Involved`;
        supportActions.appendChild(a);
      }
    } else {
      supportText.textContent = "Interested sponsors can reach out directly, or join the collective to explore matching with a cause you believe in.";
      const a = document.createElement("a");
      a.className = "btn btn-gold btn-sm";
      a.href = "apply.html";
      a.textContent = "Join the Collective";
      supportActions.appendChild(a);
    }

    if (org.email) {
      const a = document.createElement("a");
      a.className = "support-contact";
      a.href = `mailto:${org.email}`;
      a.innerHTML = `${iconSvg("mail", 15)} Contact ${org.name}`;
      supportActions.appendChild(a);
    }

    const programList = document.getElementById("program-list");
    programList.innerHTML = "";
    (org.programs || []).forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p;
      programList.appendChild(li);
    });
    document.getElementById("programs-card").hidden = (org.programs || []).length === 0;

    const eventListEl = document.getElementById("org-events");
    eventListEl.innerHTML = "";
    const today = todayISO();
    const upcoming = (org.events || [])
      .filter((e) => e.date >= today)
      .sort((a, b) => (a.date > b.date ? 1 : -1));
    if (upcoming.length === 0) {
      eventListEl.innerHTML = '<div class="empty-state">No upcoming events posted yet.</div>';
    } else {
      upcoming.forEach((e) => eventListEl.appendChild(createEventItem(org, e, { showOrg: false })));
    }

    const announceList = document.getElementById("org-announcements");
    announceList.innerHTML = "";
    const announcements = [...(org.announcements || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (announcements.length === 0) {
      announceList.innerHTML = '<div class="empty-state">No announcements yet.</div>';
    } else {
      announcements.forEach((a) => announceList.appendChild(createAnnouncementItem(org, a)));
    }

    orgContent.hidden = false;
    stagger(eventListEl.children);
    stagger(announceList.children);
    initReveal();
  } catch (err) {
    console.error(err);
    errorState.hidden = false;
  }
})();
