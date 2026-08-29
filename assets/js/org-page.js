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
    fb.textContent = "f";
    const x = document.createElement("a");
    x.href = `https://twitter.com/intent/tweet?url=${encodeURIComponent(pageUrl)}&text=${encodeURIComponent(`Check out ${org.name} in the 209 Nonprofit Collective:`)}`;
    x.target = "_blank";
    x.rel = "noopener";
    x.title = "Share on X";
    x.textContent = "X";
    shareWrap.appendChild(fb);
    shareWrap.appendChild(x);

    const metaRow = document.getElementById("org-meta-row");
    metaRow.innerHTML = "";
    if (org.serviceArea) {
      const span = document.createElement("span");
      span.textContent = `📍 ${org.serviceArea}`;
      metaRow.appendChild(span);
    }
    if (org.website) {
      const a = document.createElement("a");
      a.href = org.website;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Website ↗";
      metaRow.appendChild(a);
    }
    if (org.email) {
      const a = document.createElement("a");
      a.href = `mailto:${org.email}`;
      a.textContent = "Email";
      metaRow.appendChild(a);
    }
    if (org.phone) {
      const a = document.createElement("a");
      a.href = `tel:${org.phone.replace(/[^\d+]/g, "")}`;
      a.textContent = `📞 ${org.phone}`;
      metaRow.appendChild(a);
    }
    if (org.ein) {
      const span = document.createElement("span");
      span.textContent = `EIN ${org.ein}`;
      metaRow.appendChild(span);
    }
    if (org.joinedDate) {
      const span = document.createElement("span");
      span.textContent = `Member since ${formatDate(org.joinedDate)}`;
      metaRow.appendChild(span);
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
    const today = new Date().toISOString().slice(0, 10);
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
  } catch (err) {
    console.error(err);
    errorState.hidden = false;
  }
})();
