// Renders a grid of gallery photos and wires the lightbox that opens on
// click. Broken tiles (a link that stops working, or was never a real
// direct image) just remove themselves rather than showing a broken-image
// icon. Hides the whole section when there are no photos.
function initGallery(org) {
  const section = document.getElementById("org-gallery-section");
  const grid = document.getElementById("org-gallery");
  if (!section || !grid) return;

  const urls = (org.gallery || []).filter(Boolean);
  if (urls.length === 0) {
    section.hidden = true;
    return;
  }
  section.hidden = false;
  grid.innerHTML = "";

  const lightbox = document.getElementById("gallery-lightbox");
  const lightboxImg = document.getElementById("gallery-lightbox-img");
  let liveUrls = urls.slice();
  let activeIndex = 0;

  function openAt(i) {
    if (liveUrls.length === 0) return;
    activeIndex = (i + liveUrls.length) % liveUrls.length;
    lightboxImg.src = liveUrls[activeIndex];
    lightboxImg.alt = `${org.name} photo ${activeIndex + 1} of ${liveUrls.length}`;
    if (!lightbox.open) lightbox.showModal();
  }

  urls.forEach((url) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "gallery-thumb";
    const img = document.createElement("img");
    img.src = url;
    img.alt = `${org.name} photo`;
    img.loading = "lazy";
    img.onerror = () => {
      btn.remove();
      liveUrls = liveUrls.filter((u) => u !== url);
    };
    btn.appendChild(img);
    btn.addEventListener("click", () => openAt(liveUrls.indexOf(url)));
    grid.appendChild(btn);
  });

  document.getElementById("gallery-prev").onclick = () => openAt(activeIndex - 1);
  document.getElementById("gallery-next").onclick = () => openAt(activeIndex + 1);
  document.getElementById("gallery-lightbox-close").onclick = () => lightbox.close();
  lightbox.onclick = (e) => { if (e.target === lightbox) lightbox.close(); };
}

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

    const hasTheme = (org.themeColor && /^#[0-9a-fA-F]{6}$/.test(org.themeColor))
      || (org.themeColor2 && /^#[0-9a-fA-F]{6}$/.test(org.themeColor2));
    if (org.themeColor && /^#[0-9a-fA-F]{6}$/.test(org.themeColor)) {
      document.documentElement.style.setProperty("--org-accent", org.themeColor);
    }
    if (org.themeColor2 && /^#[0-9a-fA-F]{6}$/.test(org.themeColor2)) {
      document.documentElement.style.setProperty("--org-accent-2", org.themeColor2);
    }
    // Lets the ambient aurora, nav and footer adopt the org's colours.
    if (hasTheme) document.body.classList.add("is-themed");

    const editLink = `edit.html?slug=${encodeURIComponent(slug)}`;
    document.getElementById("nav-edit-link").href = editLink;
    if (org.hasLocalEdit) {
      document.getElementById("org-local-notice-link").href = editLink;
      document.getElementById("org-local-notice").hidden = false;
    }

    fillAvatar(document.getElementById("org-avatar"), org);
    document.getElementById("org-name").textContent = org.name;
    const badgeEl = document.getElementById("org-badge");
    badgeEl.textContent = orgCategoryLabel(categories, org.categoryId, org.categoryOther);
    // Secondary categories sit beside the primary badge, visibly subordinate
    // to it, so the org still reads as one clear thing.
    const alsoWrap = document.getElementById("org-also");
    (org.alsoServes || []).forEach((id) => {
      const chip = document.createElement("span");
      chip.className = "badge badge-also";
      chip.textContent = categoryLabel(categories, id);
      alsoWrap.appendChild(chip);
    });
    document.getElementById("org-tagline").textContent = org.tagline || "";
    renderTextWithPhotoLinks(document.getElementById("org-description"), org.description || "");

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

    renderShare(document.getElementById("org-share"), {
      url: window.location.href,
      kind: "org",
      data: { name: org.name, tagline: org.tagline },
      variant: "icons",
    });

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
    } else if (org.email || org.phone) {
      // No donate or get-involved link on file. Point people at the org
      // itself — "Join the Collective" belongs to orgs applying to join,
      // not to a supporter reading this org's page.
      supportText.textContent = `${org.name} hasn't listed a donation link yet — reach out to them directly to find out how to help.`;
      if (org.email) {
        const a = document.createElement("a");
        a.className = "btn btn-gold btn-sm";
        a.href = `mailto:${org.email}`;
        a.innerHTML = `${iconSvg("mail", 16)} Email ${org.name}`;
        supportActions.appendChild(a);
      }
      if (org.phone) {
        const a = document.createElement("a");
        a.className = org.email ? "btn btn-outline btn-sm" : "btn btn-gold btn-sm";
        a.href = `tel:${org.phone.replace(/[^\d+]/g, "")}`;
        a.innerHTML = `${iconSvg("phone", 16)} ${org.phone}`;
        supportActions.appendChild(a);
      }
    } else {
      supportText.textContent = `${org.name} hasn't listed a way to support them yet.`;
    }

    // Only add the plain contact link when the buttons above aren't already
    // the contact details — otherwise it's the same action twice.
    if (org.email && hasOwnLinks) {
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

    initGallery(org);

    orgContent.hidden = false;
    stagger(eventListEl.children);
    stagger(announceList.children);
    initReveal();
  } catch (err) {
    console.error(err);
    errorState.hidden = false;
  }
})();
