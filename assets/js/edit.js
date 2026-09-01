const EDIT_EMAIL = "contact@aariasblueelephant.org";
const DEFAULT_COLOR = "#22D3EE";
const DEFAULT_COLOR2 = "#FBBF24";
// Real SVG icons, not emoji — emoji render differently on every platform
// and read as clip art next to the rest of the UI.
const THEMES = [
  { id: "default", label: "Default", icon: "sparkle", accent: "#22D3EE", accent2: "#FBBF24" },
  { id: "fire", label: "Fire", icon: "flame", accent: "#F97316", accent2: "#DC2626" },
  { id: "water", label: "Water", icon: "droplet", accent: "#0EA5E9", accent2: "#06B6D4" },
  { id: "earth", label: "Earth", icon: "leaf", accent: "#84CC16", accent2: "#A16207" },
  { id: "sky", label: "Sky", icon: "cloud", accent: "#38BDF8", accent2: "#C4B5FD" },
];
const MAX_UPLOAD_BYTES = 10 * 1024 * 1024;
const LOGO_TARGET_BYTES = 300 * 1024;
const BANNER_TARGET_BYTES = 400 * 1024;
// Fill these in once the Google OAuth client and Cloudflare Worker exist (see README).
// Left blank, the page falls back to the local-preview + email flow for everyone.
const GOOGLE_CLIENT_ID = "398008125353-778m6602c8jbo02pe6u2pjase5hduj28.apps.googleusercontent.com";
const WORKER_URL = "https://collective-editor.aariasblueelephant.workers.dev";

function decodeJwtPayload(token) {
  try {
    const base64 = token.split(".")[1].replace(/-/g, "+").replace(/_/g, "/");
    const json = decodeURIComponent(
      atob(base64).split("").map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0")).join("")
    );
    return JSON.parse(json);
  } catch {
    return null;
  }
}

(async function initEdit() {
  document.getElementById("edit-email").textContent = EDIT_EMAIL;
  document.getElementById("edit-email").href = `mailto:${EDIT_EMAIL}`;
  document.getElementById("signin-email").textContent = EDIT_EMAIL;
  document.getElementById("signin-email").href = `mailto:${EDIT_EMAIL}`;

  const params = new URLSearchParams(window.location.search);
  const initialSlug = params.get("slug");

  const orgSelect = document.getElementById("edit-org");
  const categorySelect = document.getElementById("edit-category");
  const categoryOtherField = document.getElementById("category-other-field");
  const categoryOtherInput = document.getElementById("edit-category-other");
  const alsoServesWrap = document.getElementById("also-serves");
  const taglineInput = document.getElementById("edit-tagline");
  const descriptionInput = document.getElementById("edit-description");
  const websiteInput = document.getElementById("edit-website");
  const orgEmailInput = document.getElementById("edit-org-email");
  const phoneInput = document.getElementById("edit-phone");
  const einInput = document.getElementById("edit-ein");
  const locationInput = document.getElementById("edit-location");
  const donateInput = document.getElementById("edit-donate");
  const supportInput = document.getElementById("edit-support");
  const programsInput = document.getElementById("edit-programs");
  const colorPicker = document.getElementById("edit-color");
  const colorHex = document.getElementById("edit-color-hex");
  const colorPicker2 = document.getElementById("edit-color2");
  const eventsEditor = document.getElementById("events-editor");
  const addEventBtn = document.getElementById("add-event");
  const themeGrid = document.getElementById("theme-grid");
  const logoInput = document.getElementById("edit-logo");
  const bannerInput = document.getElementById("edit-banner");
  const logoThumb = document.getElementById("logo-thumb");
  const bannerThumb = document.getElementById("banner-thumb");
  const logoDownload = document.getElementById("logo-download");
  const bannerDownload = document.getElementById("banner-download");
  const form = document.getElementById("edit-form");
  const status = document.getElementById("save-status");
  const resetBtn = document.getElementById("reset-btn");

  const previewBanner = document.getElementById("preview-banner");
  const previewAvatar = document.getElementById("preview-avatar");
  const previewBadge = document.getElementById("preview-badge");
  const previewName = document.getElementById("preview-name");
  const previewTagline = document.getElementById("preview-tagline");

  const signinStatus = document.getElementById("signin-status");
  const signinStrip = document.getElementById("signin-strip");
  const signinDialog = document.getElementById("signin-dialog");
  const signinOpenBtn = document.getElementById("signin-open");
  const signinCloseBtn = document.getElementById("signin-dialog-close");
  const signinUnconfigured = document.getElementById("signin-unconfigured");
  const submitBtn = document.getElementById("submit-btn");

  let categories = [];
  let orgs = [];
  let editors = [];
  let current = null;
  let googleIdToken = null;
  let googleEmail = null;

  // Mirrors the Worker's rule: an explicit allowlist entry, or an email at
  // the organisation's own website domain. Returns "allowlist" | "domain" | null.
  function grantFor(slug) {
    if (!googleEmail) return null;
    if (editors.some((e) => String(e.email || "").toLowerCase() === googleEmail && e.slug === slug)) {
      return "allowlist";
    }
    const org = orgs.find((o) => o.slug === slug);
    if (org && emailMatchesOrgDomain(googleEmail, org.website)) return "domain";
    return null;
  }

  function isAuthorizedFor(slug) {
    return grantFor(slug) !== null;
  }

  function updateSigninUI() {
    const slug = current ? current.slug : null;
    const authorized = Boolean(slug && isAuthorizedFor(slug));
    signinStrip.classList.toggle("is-authorized", authorized);
    signinOpenBtn.hidden = authorized;
    if (googleEmail) {
      const grant = slug ? grantFor(slug) : null;
      if (grant === "domain") {
        signinStatus.textContent = `Signed in as ${googleEmail} — recognised as ${current.name}. You can publish live.`;
      } else if (grant === "allowlist") {
        signinStatus.textContent = `Signed in as ${googleEmail} — authorized to publish live for ${current.name}.`;
      } else {
        signinStatus.textContent = `Signed in as ${googleEmail} — we can't match this address to ${current ? current.name : "this organization"}; changes will preview locally and go out by email instead.`;
      }
    } else {
      signinStatus.textContent = "Not signed in — changes will preview locally and go out by email.";
    }
    submitBtn.textContent = authorized && WORKER_URL ? "Publish Live" : "Save & Email Us";
  }
  // currentLogo/currentBanner: what's actually on file for this org right now
  // (a real asset path, or a previously-saved local-preview data: URL).
  // pendingLogo/pendingBanner: a new file chosen THIS session — the only ones
  // that need downloading/attaching, so we don't ask members to re-send files
  // that are already live.
  const state = {
    themeColor: DEFAULT_COLOR,
    themeColor2: DEFAULT_COLOR2,
    currentLogo: null,
    currentBanner: null,
    pendingLogo: null,
    pendingBanner: null,
    categoryId: "",
    categoryOther: "",
    alsoServes: [],
    tagline: "",
    description: "",
    website: "",
    orgEmail: "",
    phone: "",
    ein: "",
    serviceArea: "",
    donateUrl: "",
    supportUrl: "",
    programs: [],
    events: [],
  };

  function displayLogo() { return state.pendingLogo || state.currentLogo; }
  function displayBanner() { return state.pendingBanner || state.currentBanner; }

  function setStatus(text, isSuccess) {
    status.textContent = text;
    status.className = isSuccess ? "save-status success" : "save-status";
  }

  function setActiveThemeCard() {
    [...themeGrid.children].forEach((btn) => {
      const theme = THEMES.find((t) => t.id === btn.dataset.themeId);
      const matches = theme
        && theme.accent.toLowerCase() === state.themeColor.toLowerCase()
        && theme.accent2.toLowerCase() === state.themeColor2.toLowerCase();
      btn.classList.toggle("active", matches);
    });
  }

  function applyThemeVars() {
    document.documentElement.style.setProperty("--org-accent", state.themeColor);
    document.documentElement.style.setProperty("--org-accent-2", state.themeColor2);
    // Same flag the org page sets, so the edit screen previews the full
    // ambient wash rather than just recolouring a badge.
    document.body.classList.add("is-themed");
    colorPicker.value = state.themeColor;
    colorPicker2.value = state.themeColor2;
    colorHex.value = state.themeColor;
    setActiveThemeCard();
  }

  // Picking a named theme sets both colors as a coordinated pair. Typing a
  // custom hex only fine-tunes the primary color — the secondary stays
  // whatever it was, which is how a preset naturally becomes "custom".
  function setTheme(accent, accent2) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(accent)) return;
    state.themeColor = accent;
    if (accent2 && /^#[0-9A-Fa-f]{6}$/.test(accent2)) state.themeColor2 = accent2;
    applyThemeVars();
  }

  // Additional categories this org serves. The primary category is shown as
  // a locked, checked row so it's obvious it already counts and can't be
  // duplicated here.
  function renderAlsoServes() {
    if (!alsoServesWrap) return;
    alsoServesWrap.innerHTML = "";
    categories.forEach((c) => {
      const isPrimary = c.id === state.categoryId;
      const label = document.createElement("label");
      label.className = "checkbox-row" + (isPrimary ? " is-primary" : "");

      const box = document.createElement("input");
      box.type = "checkbox";
      box.value = c.id;
      box.checked = isPrimary || state.alsoServes.includes(c.id);
      box.disabled = isPrimary;
      box.addEventListener("change", () => {
        state.alsoServes = box.checked
          ? [...state.alsoServes, c.id]
          : state.alsoServes.filter((id) => id !== c.id);
      });

      const text = document.createElement("span");
      text.textContent = c.label + (isPrimary ? " — your main category" : "");

      label.appendChild(box);
      label.appendChild(text);
      alsoServesWrap.appendChild(label);
    });
  }

  // --- Tabs -----------------------------------------------------------
  const tabs = [...document.querySelectorAll(".tab")];
  const panels = [...document.querySelectorAll(".tab-panel")];
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      tabs.forEach((t) => {
        const on = t === tab;
        t.classList.toggle("is-active", on);
        t.setAttribute("aria-selected", String(on));
      });
      panels.forEach((p) => p.classList.toggle("is-active", p.dataset.panel === tab.dataset.tab));
    });
  });

  // --- Events editor ---------------------------------------------------
  // Each event is a collapsible row so a long list stays scannable.
  function renderEvents() {
    if (!eventsEditor) return;
    eventsEditor.innerHTML = "";

    if (state.events.length === 0) {
      const empty = document.createElement("p");
      empty.className = "field-hint";
      empty.textContent = "No events yet. Add one and it'll show on the shared calendar.";
      eventsEditor.appendChild(empty);
      return;
    }

    const sorted = state.events
      .map((ev, i) => ({ ev, i }))
      .sort((a, b) => String(a.ev.date).localeCompare(String(b.ev.date)));

    sorted.forEach(({ ev, i }) => {
      const row = document.createElement("div");
      row.className = "event-edit";

      const head = document.createElement("div");
      head.className = "event-edit-head";
      const isPast = ev.date && ev.date < todayISO();
      head.innerHTML = `
        <div class="event-edit-title">
          <strong>${ev.title || "Untitled event"}</strong>
          <span>${ev.date ? formatDate(ev.date) : "No date set"}${isPast ? " · past" : ""}</span>
        </div>`;

      const del = document.createElement("button");
      del.type = "button";
      del.className = "event-edit-del";
      del.setAttribute("aria-label", `Delete ${ev.title || "event"}`);
      del.innerHTML = iconSvg("x", 16);
      del.addEventListener("click", () => {
        // Deleting an event is destructive and can't be undone from here,
        // so make the user confirm rather than losing it on a stray click.
        if (!window.confirm(`Delete "${ev.title || "this event"}"? This can't be undone.`)) return;
        state.events.splice(i, 1);
        renderEvents();
      });
      head.appendChild(del);
      row.appendChild(head);

      const body = document.createElement("div");
      body.className = "event-edit-body";
      const fields = [
        { key: "title", label: "Title", type: "text", ph: "Community Food Drive" },
        { key: "date", label: "Date", type: "date", ph: "" },
        { key: "time", label: "Time", type: "text", ph: "10:00 AM - 1:00 PM" },
        { key: "location", label: "Location", type: "text", ph: "Mountain House Community Park" },
        { key: "description", label: "Description", type: "textarea", ph: "Short description shown under the event." },
        { key: "url", label: "Event / RSVP link", type: "url", ph: "https://…" },
      ];
      fields.forEach((f) => {
        const wrap = document.createElement("div");
        wrap.className = "form-field";
        const label = document.createElement("label");
        label.textContent = f.label;
        wrap.appendChild(label);
        if (f.hint) {
          const hint = document.createElement("p");
          hint.className = "field-hint";
          hint.textContent = f.hint;
          wrap.appendChild(hint);
        }
        const input = document.createElement(f.type === "textarea" ? "textarea" : "input");
        if (f.type !== "textarea") input.type = f.type;
        input.value = ev[f.key] || "";
        input.placeholder = f.ph;
        input.addEventListener("input", () => {
          state.events[i][f.key] = input.value;
        });
        // Retitle/redate the collapsed header once the field loses focus.
        if (f.key === "title" || f.key === "date") {
          input.addEventListener("change", renderEvents);
        }
        wrap.appendChild(input);
        body.appendChild(wrap);
      });

      body.appendChild(buildEventPhotoField(i, ev));
      row.appendChild(body);

      head.addEventListener("click", (e) => {
        if (e.target.closest(".event-edit-del")) return;
        row.classList.toggle("is-open");
      });

      eventsEditor.appendChild(row);
    });
  }

  // Event photo: either upload a file (compressed the same way as
  // logo/banner, so it can be committed straight into the repo — events
  // don't accumulate the way logo/banner replace-in-place, but a single
  // flyer is small) or paste a direct image link. Either way, shows an
  // actual <img> immediately so a broken/share-page link is obvious before
  // publishing rather than discovered afterward on the live page.
  function buildEventPhotoField(i, ev) {
    const wrap = document.createElement("div");
    wrap.className = "form-field event-photo-field";

    const label = document.createElement("label");
    label.textContent = "Photo";
    wrap.appendChild(label);

    const hint = document.createElement("p");
    hint.className = "field-hint";
    hint.textContent = "Upload an image, or paste a direct link ending in .jpg/.png. A Google Photos or Dropbox share page won't display — paste it below to check.";
    wrap.appendChild(hint);

    const row = document.createElement("div");
    row.className = "file-row";

    const thumb = document.createElement("div");
    thumb.className = "file-thumb wide";
    thumb.textContent = "No photo";

    const uploadLabel = document.createElement("label");
    uploadLabel.className = "btn btn-outline btn-sm";
    uploadLabel.textContent = "Upload image";
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.className = "file-input";
    uploadLabel.appendChild(fileInput);

    row.appendChild(thumb);
    row.appendChild(uploadLabel);
    wrap.appendChild(row);

    const urlInput = document.createElement("input");
    urlInput.type = "url";
    urlInput.placeholder = "https://…/flyer.jpg";
    urlInput.value = ev.image && !ev.image.startsWith("data:") ? ev.image : "";
    urlInput.style.marginTop = "8px";
    wrap.appendChild(urlInput);

    const preview = document.createElement("div");
    preview.className = "event-photo-preview";
    wrap.appendChild(preview);

    // Only relevant on the email fallback (mailto can't attach files) — an
    // uploaded photo that publishes straight to the Worker doesn't need this,
    // but someone whose sign-in isn't recognised still needs a way to hand
    // the file to whoever applies their emailed request.
    const downloadLink = document.createElement("a");
    downloadLink.className = "form-note";
    downloadLink.download = "event-photo.jpg";
    downloadLink.hidden = true;
    downloadLink.innerHTML = `${iconSvg("download", 15)} Download this photo to attach to the email`;
    wrap.appendChild(downloadLink);

    function setStatusNote(text, ok) {
      let note = preview.querySelector(".event-photo-ok, .event-photo-error");
      if (!note) {
        note = document.createElement("p");
        preview.appendChild(note);
      }
      note.className = ok ? "event-photo-ok" : "event-photo-error";
      note.textContent = text;
    }

    function showPreview(src) {
      preview.innerHTML = "";
      if (!src) return;
      const img = document.createElement("img");
      img.alt = "Event photo preview";
      img.onload = () => setStatusNote(`Looks good — ${img.naturalWidth}×${img.naturalHeight}px.`, true);
      img.onerror = () => {
        img.remove();
        setStatusNote(
          "This doesn't load as an image — it's likely a share page rather than a direct image link. Try \"Copy image address\" from the photo instead, or upload the file directly.",
          false
        );
      };
      preview.appendChild(img);
      img.src = src;
    }

    function setEventImage(value) {
      state.events[i].image = value || undefined;
      thumb.innerHTML = "";
      if (value) {
        const t = document.createElement("img");
        t.src = value;
        t.onerror = () => { thumb.innerHTML = ""; thumb.textContent = "No photo"; };
        thumb.appendChild(t);
      } else {
        thumb.textContent = "No photo";
      }
      if (value && value.startsWith("data:")) {
        downloadLink.href = value;
        downloadLink.download = `${(ev.title || "event").toLowerCase().replace(/[^a-z0-9]+/g, "-")}-photo.jpg`;
        downloadLink.hidden = false;
      } else {
        downloadLink.hidden = true;
      }
    }

    fileInput.addEventListener("change", async () => {
      const file = fileInput.files[0];
      if (!file) return;
      if (file.size > MAX_UPLOAD_BYTES) {
        setStatusNote("That file is over 10MB — please choose a smaller image.", false);
        fileInput.value = "";
        return;
      }
      try {
        const { dataUrl, bytes } = await compressImage(file, {
          maxDim: 1000, minDim: 500, mime: "image/jpeg", targetBytes: BANNER_TARGET_BYTES, canReduceQuality: true,
        });
        urlInput.value = "";
        setEventImage(dataUrl);
        preview.innerHTML = "";
        const img = document.createElement("img");
        img.src = dataUrl;
        img.alt = "Event photo preview";
        preview.appendChild(img);
        setStatusNote(`Uploaded (${Math.round(bytes / 1024)}KB) — will attach when you save.`, true);
      } catch (err) {
        console.error(err);
        setStatusNote("Could not read that file — try a different image.", false);
      }
    });

    let debounceTimer;
    urlInput.addEventListener("input", () => {
      clearTimeout(debounceTimer);
      const value = urlInput.value.trim();
      setEventImage(value);
      if (!value) { preview.innerHTML = ""; return; }
      debounceTimer = setTimeout(() => showPreview(value), 350);
    });

    // Existing photo on load, so re-opening an event shows what's already set.
    if (ev.image) {
      setEventImage(ev.image);
      showPreview(ev.image);
    }

    return wrap;
  }

  if (addEventBtn) {
    addEventBtn.addEventListener("click", () => {
      state.events.push({
        id: `evt-${state.events.length + 1}-${state.events.length}`,
        title: "",
        date: todayISO(),
        time: "",
        location: "",
        description: "",
      });
      renderEvents();
      // Open the one just added so it's immediately editable.
      const rows = eventsEditor.querySelectorAll(".event-edit");
      const last = [...rows].find((r) => r.querySelector("strong").textContent === "Untitled event");
      if (last) {
        last.classList.add("is-open");
        const first = last.querySelector("input");
        if (first) first.focus();
      }
    });
  }

  // Click-to-change overlay, re-attached after every render since both
  // containers get their contents replaced when the preview redraws.
  function addHint(container, label) {
    const hint = document.createElement("div");
    hint.className = "edit-preview-hint";
    hint.innerHTML = `${iconSvg("image", label ? 20 : 18)}${label ? ` ${label}` : ""}`;
    container.appendChild(hint);
  }

  function renderPreview() {
    previewName.textContent = current ? current.name : "Organization Name";
    previewBadge.textContent = orgCategoryLabel(categories, state.categoryId, state.categoryOther);
    previewTagline.textContent = state.tagline || "";

    previewBanner.innerHTML = "";
    const banner = displayBanner();
    if (banner) {
      const img = document.createElement("img");
      img.src = banner;
      img.alt = "Banner preview";
      previewBanner.appendChild(img);
    }
    addHint(previewBanner, "Click to change banner");

    fillAvatar(previewAvatar, { logo: displayLogo(), name: current ? current.name : "Org" });
    addHint(previewAvatar);
  }

  function renderThumbs() {
    const logo = displayLogo();
    logoThumb.innerHTML = "";
    if (logo) {
      const img = document.createElement("img");
      img.src = logo;
      img.alt = "Logo preview";
      logoThumb.appendChild(img);
    } else {
      logoThumb.textContent = "No logo";
    }

    const banner = displayBanner();
    bannerThumb.innerHTML = "";
    if (banner) {
      const img = document.createElement("img");
      img.src = banner;
      img.alt = "Banner preview";
      bannerThumb.appendChild(img);
    } else {
      bannerThumb.textContent = "No banner";
    }

    const slug = current ? current.slug : "org";
    if (state.pendingLogo) {
      logoDownload.href = state.pendingLogo;
      logoDownload.download = `${slug}-logo.png`;
      logoDownload.hidden = false;
    } else {
      logoDownload.hidden = true;
    }
    if (state.pendingBanner) {
      bannerDownload.href = state.pendingBanner;
      bannerDownload.download = `${slug}-banner.jpg`;
      bannerDownload.hidden = false;
    } else {
      bannerDownload.hidden = true;
    }
  }

  function loadOrgIntoForm(org) {
    current = org;
    state.themeColor = org.themeColor && /^#[0-9A-Fa-f]{6}$/.test(org.themeColor) ? org.themeColor : DEFAULT_COLOR;
    state.themeColor2 = org.themeColor2 && /^#[0-9A-Fa-f]{6}$/.test(org.themeColor2) ? org.themeColor2 : DEFAULT_COLOR2;
    state.currentLogo = org.logo || null;
    state.currentBanner = org.banner || null;
    // If a local preview from an earlier visit is still the source of the
    // logo/banner, treat it as still-pending so the download links reappear.
    state.pendingLogo = org.hasLocalEdit && state.currentLogo && state.currentLogo.startsWith("data:") ? state.currentLogo : null;
    state.pendingBanner = org.hasLocalEdit && state.currentBanner && state.currentBanner.startsWith("data:") ? state.currentBanner : null;

    state.categoryId = org.categoryId || "";
    state.categoryOther = org.categoryOther || "";
    state.alsoServes = (org.alsoServes || []).slice();
    state.tagline = org.tagline || "";
    state.description = org.description || "";
    state.website = org.website || "";
    state.orgEmail = org.email || "";
    state.phone = org.phone || "";
    state.ein = org.ein || "";
    state.serviceArea = org.serviceArea || "";
    state.donateUrl = org.donateUrl || "";
    state.supportUrl = org.supportUrl || "";
    state.programs = org.programs || [];
    state.events = JSON.parse(JSON.stringify(org.events || []));

    categorySelect.value = state.categoryId;
    categoryOtherInput.value = state.categoryOther;
    categoryOtherField.hidden = state.categoryId !== "other";
    renderAlsoServes();
    taglineInput.value = state.tagline;
    descriptionInput.value = state.description;
    websiteInput.value = state.website;
    orgEmailInput.value = state.orgEmail;
    phoneInput.value = state.phone;
    einInput.value = state.ein;
    locationInput.value = state.serviceArea;
    donateInput.value = state.donateUrl;
    supportInput.value = state.supportUrl;
    programsInput.value = state.programs.join("\n");
    renderEvents();

    applyThemeVars();
    renderPreview();
    renderThumbs();
    updateSigninUI();
    setStatus(
      org.hasLocalEdit
        ? "You have an unsaved local preview for this organization from an earlier visit."
        : "",
      false
    );
  }

  // Cache the ID token in sessionStorage (per-tab, cleared when the tab
  // closes — deliberately not localStorage, since this is a bearer
  // credential) so navigating between org.html's Edit link and edit.html, or
  // reloading, doesn't force a re-click every time within the same session.
  const SESSION_KEY = "209collective:googleSession";

  function saveSession(idToken, email) {
    try {
      sessionStorage.setItem(SESSION_KEY, JSON.stringify({ idToken, email }));
    } catch { /* storage may be unavailable (private browsing, quota) — sign-in still works, just not cached */ }
  }

  function loadSession() {
    try {
      const raw = sessionStorage.getItem(SESSION_KEY);
      if (!raw) return null;
      const { idToken, email } = JSON.parse(raw);
      const payload = decodeJwtPayload(idToken);
      // Google ID tokens are short-lived (~1hr) — an expired cached token
      // would silently fail every publish attempt, so drop it up front
      // rather than surface a confusing error later.
      if (!payload || !payload.exp || payload.exp * 1000 < Date.now()) {
        sessionStorage.removeItem(SESSION_KEY);
        return null;
      }
      return { idToken, email };
    } catch {
      return null;
    }
  }

  function onSignedIn(idToken, email) {
    googleIdToken = idToken;
    googleEmail = email;
    saveSession(idToken, email);
    updateSigninUI();
    if (signinDialog.open) signinDialog.close();
  }

  signinOpenBtn.addEventListener("click", () => signinDialog.showModal());
  signinCloseBtn.addEventListener("click", () => signinDialog.close());
  // Clicking the dim backdrop closes it too — the default <dialog> behaviour
  // only closes on the close button or an explicit .close() call.
  signinDialog.addEventListener("click", (e) => {
    if (e.target === signinDialog) signinDialog.close();
  });
  // Closing (any way — X, backdrop, Esc) counts as "seen it" for this tab,
  // so arriving at the page doesn't pop it open again on every navigation.
  signinDialog.addEventListener("close", () => {
    try { sessionStorage.setItem("209collective:signinDialogSeen", "1"); } catch { /* ignore */ }
  });

  function initGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID) {
      signinUnconfigured.hidden = false;
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setTimeout(initGoogleSignIn, 150);
      return;
    }

    const cached = loadSession();
    if (cached) onSignedIn(cached.idToken, cached.email);

    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        const email = (decodeJwtPayload(response.credential) || {}).email || null;
        onSignedIn(response.credential, email);
      },
      // Lets Google silently re-confirm an existing session (One Tap) rather
      // than requiring a fresh click every visit, on top of our own cache.
      auto_select: true,
    });
    if (!cached) {
      // Only prompt automatically when there's nothing cached — otherwise a
      // signed-in user would get an unsolicited popup on every page load.
      window.google.accounts.id.prompt();
      // "Click Edit" should land somewhere that makes signing in the
      // obvious next step rather than one card in a long scroll — but only
      // the first time in this tab, so closing it once doesn't mean it pops
      // back open on every subsequent page.
      let dialogSeen = false;
      try { dialogSeen = sessionStorage.getItem("209collective:signinDialogSeen") === "1"; } catch { /* ignore */ }
      if (!dialogSeen) signinDialog.showModal();
    }
    window.google.accounts.id.renderButton(document.getElementById("g_id_signin"), {
      theme: "filled_black",
      size: "medium",
    });
  }
  initGoogleSignIn();

  themeGrid.innerHTML = "";
  THEMES.forEach((theme) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "theme-preset";
    btn.dataset.themeId = theme.id;
    btn.title = theme.label;
    btn.innerHTML = `<span class="theme-preset-swatch" style="background: linear-gradient(135deg, ${theme.accent}, ${theme.accent2})">${iconSvg(theme.icon, 18)}</span><span>${theme.label}</span>`;
    btn.addEventListener("click", () => setTheme(theme.accent, theme.accent2));
    themeGrid.appendChild(btn);
  });

  colorPicker.addEventListener("input", () => setTheme(colorPicker.value));
  colorHex.addEventListener("change", () => setTheme(colorHex.value.trim()));
  colorPicker2.addEventListener("input", () => setTheme(state.themeColor, colorPicker2.value));

  categoryOtherInput.addEventListener("input", () => {
    state.categoryOther = categoryOtherInput.value;
    renderPreview();
  });

  // Clicking the logo/banner directly (in the live preview or the small
  // thumbnail) opens the file picker, same as the "Choose image" button.
  previewAvatar.addEventListener("click", () => logoInput.click());
  previewBanner.addEventListener("click", () => bannerInput.click());
  logoThumb.addEventListener("click", () => logoInput.click());
  bannerThumb.addEventListener("click", () => bannerInput.click());

  categorySelect.addEventListener("change", () => {
    state.categoryId = categorySelect.value;
    // The new primary shouldn't also sit in alsoServes — that would double
    // count it and list the org twice under the same need.
    state.alsoServes = state.alsoServes.filter((id) => id !== state.categoryId);
    categoryOtherField.hidden = state.categoryId !== "other";
    renderAlsoServes();
    renderPreview();
  });
  taglineInput.addEventListener("input", () => { state.tagline = taglineInput.value; renderPreview(); });
  descriptionInput.addEventListener("input", () => { state.description = descriptionInput.value; });
  websiteInput.addEventListener("input", () => { state.website = websiteInput.value; });
  orgEmailInput.addEventListener("input", () => { state.orgEmail = orgEmailInput.value; });
  phoneInput.addEventListener("input", () => { state.phone = phoneInput.value; });
  einInput.addEventListener("input", () => { state.ein = einInput.value; });
  locationInput.addEventListener("input", () => { state.serviceArea = locationInput.value; });
  donateInput.addEventListener("input", () => { state.donateUrl = donateInput.value; });
  supportInput.addEventListener("input", () => { state.supportUrl = supportInput.value; });
  programsInput.addEventListener("input", () => {
    state.programs = programsInput.value.split("\n").map((p) => p.trim()).filter(Boolean);
  });

  function loadImageFromFile(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(reader.error);
      reader.onload = () => {
        const img = new Image();
        img.onerror = () => reject(new Error("Could not read that image file."));
        img.onload = () => resolve(img);
        img.src = reader.result;
      };
      reader.readAsDataURL(file);
    });
  }

  function drawToDataUrl(img, dim, mime, quality) {
    let { width, height } = img;
    if (width > dim || height > dim) {
      if (width > height) {
        height = Math.round((height * dim) / width);
        width = dim;
      } else {
        width = Math.round((width * dim) / height);
        height = dim;
      }
    }
    const canvas = document.createElement("canvas");
    canvas.width = width;
    canvas.height = height;
    canvas.getContext("2d").drawImage(img, 0, 0, width, height);
    return canvas.toDataURL(mime, quality);
  }

  function dataUrlBytes(dataUrl) {
    return Math.ceil((dataUrl.length - dataUrl.indexOf(",") - 1) * 0.75);
  }

  // Enforces a real ceiling on what actually gets stored in the repo — not
  // just the raw upload — so member-uploaded images can never balloon the
  // site's size. JPEG can shrink via quality; PNG (kept for logo transparency)
  // can only shrink via dimensions, since canvas ignores PNG "quality".
  async function compressImage(file, { maxDim, minDim, mime, targetBytes, canReduceQuality }) {
    const img = await loadImageFromFile(file);
    let dim = maxDim;
    let quality = 0.85;
    let dataUrl = drawToDataUrl(img, dim, mime, quality);

    while (dataUrlBytes(dataUrl) > targetBytes) {
      if (canReduceQuality && quality > 0.4) {
        quality -= 0.15;
      } else if (dim > minDim) {
        dim = Math.round(dim * 0.8);
      } else {
        break;
      }
      dataUrl = drawToDataUrl(img, dim, mime, quality);
    }
    return { dataUrl, bytes: dataUrlBytes(dataUrl) };
  }

  logoInput.addEventListener("change", async () => {
    const file = logoInput.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus("That logo file is over 10MB — please choose a smaller image.", false);
      logoInput.value = "";
      return;
    }
    try {
      const { dataUrl, bytes } = await compressImage(file, {
        maxDim: 400,
        minDim: 150,
        mime: "image/png",
        targetBytes: LOGO_TARGET_BYTES,
        canReduceQuality: false,
      });
      if (bytes > LOGO_TARGET_BYTES * 1.5) {
        setStatus(`That logo is too detailed to compress under ${Math.round(LOGO_TARGET_BYTES / 1024)}KB even at a smaller size — try a simpler image.`, false);
        logoInput.value = "";
        return;
      }
      state.pendingLogo = dataUrl;
      setStatus(`Logo ready (${Math.round(bytes / 1024)}KB).`, false);
      renderPreview();
      renderThumbs();
    } catch (err) {
      console.error(err);
      setStatus("Could not read that logo file — try a different image.", false);
    }
  });

  bannerInput.addEventListener("change", async () => {
    const file = bannerInput.files[0];
    if (!file) return;
    if (file.size > MAX_UPLOAD_BYTES) {
      setStatus("That banner file is over 10MB — please choose a smaller image.", false);
      bannerInput.value = "";
      return;
    }
    try {
      const { dataUrl, bytes } = await compressImage(file, {
        maxDim: 1000,
        minDim: 500,
        mime: "image/jpeg",
        targetBytes: BANNER_TARGET_BYTES,
        canReduceQuality: true,
      });
      state.pendingBanner = dataUrl;
      setStatus(`Banner ready (${Math.round(bytes / 1024)}KB).`, false);
      renderPreview();
      renderThumbs();
    } catch (err) {
      console.error(err);
      setStatus("Could not read that banner file — try a different image.", false);
    }
  });

  resetBtn.addEventListener("click", async () => {
    if (!current) return;
    const slug = current.slug;
    clearLocalOverride(slug);
    try {
      const fresh = await loadOrg(slug);
      const idx = orgs.findIndex((o) => o.slug === slug);
      if (idx !== -1) orgs[idx] = fresh;
      setStatus("Local preview cleared for this organization.", false);
      loadOrgIntoForm(fresh);
    } catch (err) {
      console.error(err);
      setStatus("Cleared, but could not reload the organization data.", false);
    }
  });

  orgSelect.addEventListener("change", () => {
    const org = orgs.find((o) => o.slug === orgSelect.value);
    if (org) loadOrgIntoForm(org);
  });

  function currentFields() {
    return {
      themeColor: state.themeColor,
      themeColor2: state.themeColor2,
      categoryId: state.categoryId || undefined,
      categoryOther: state.categoryId === "other" ? state.categoryOther || undefined : undefined,
      alsoServes: state.alsoServes,
      tagline: state.tagline || undefined,
      description: state.description || undefined,
      website: state.website || undefined,
      email: state.orgEmail || undefined,
      phone: state.phone || undefined,
      ein: state.ein || undefined,
      serviceArea: state.serviceArea || undefined,
      donateUrl: state.donateUrl || undefined,
      supportUrl: state.supportUrl || undefined,
      programs: state.programs.length ? state.programs : undefined,
      events: state.events,
    };
  }

  async function tryPublishLive() {
    if (!WORKER_URL || !googleIdToken || !isAuthorizedFor(current.slug)) return false;
    setStatus("Publishing live…", false);
    try {
      const res = await fetch(WORKER_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          idToken: googleIdToken,
          slug: current.slug,
          fields: currentFields(),
          logo: state.pendingLogo || undefined,
          banner: state.pendingBanner || undefined,
        }),
      });
      const data = await res.json();
      if (data.ok) {
        clearLocalOverride(current.slug);
        setStatus("Published live! It may take a minute to appear — refresh the organization's page to see it.", true);
        return true;
      }
      setStatus(`Could not publish automatically (${data.error}). Falling back to email instead.`, false);
      return false;
    } catch (err) {
      console.error(err);
      setStatus("Could not reach the publishing service. Falling back to email instead.", false);
      return false;
    }
  }

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!current) return;

    setLocalOverride(current.slug, {
      themeColor: state.themeColor,
      themeColor2: state.themeColor2,
      logo: state.pendingLogo || undefined,
      banner: state.pendingBanner || undefined,
      categoryId: state.categoryId || undefined,
      categoryOther: state.categoryId === "other" ? state.categoryOther || undefined : undefined,
      alsoServes: state.alsoServes,
      tagline: state.tagline || undefined,
      description: state.description || undefined,
      website: state.website || undefined,
      email: state.orgEmail || undefined,
      phone: state.phone || undefined,
      ein: state.ein || undefined,
      serviceArea: state.serviceArea || undefined,
      donateUrl: state.donateUrl || undefined,
      supportUrl: state.supportUrl || undefined,
      programs: state.programs.length ? state.programs : undefined,
      events: state.events,
    });

    if (await tryPublishLive()) return;

    const subject = `209 Nonprofit Collective Update — ${current.name}`;
    const bodyLines = [
      `Organization: ${current.name} (${current.slug})`,
      "",
      `Category: ${orgCategoryLabel(categories, state.categoryId, state.categoryOther)}`,
      `Also serves: ${state.alsoServes.map((id) => categoryLabel(categories, id)).join(", ") || "(none)"}`,
      `Events: ${state.events.length ? state.events.map((e) => `${e.date} ${e.title}`).join("; ") : "(none)"}`,
      `Tagline: ${state.tagline}`,
      `Description: ${state.description}`,
      `Website: ${state.website}`,
      `Contact email: ${state.orgEmail}`,
      `Phone: ${state.phone}`,
      `EIN: ${state.ein}`,
      `Location (city & ZIP): ${state.serviceArea}`,
      `Donate link: ${state.donateUrl}`,
      `Get involved link: ${state.supportUrl}`,
      `Programs:`,
      ...(state.programs.length ? state.programs.map((p) => `  - ${p}`) : ["  (none)"]),
      "",
      `Theme colors: ${state.themeColor} / ${state.themeColor2}`,
      "",
      state.pendingLogo
        ? `A new logo was selected on the edit page — please attach the downloaded "${current.slug}-logo.png" file here before sending.`
        : "Logo unchanged.",
      state.pendingBanner
        ? `A new banner was selected on the edit page — please attach the downloaded "${current.slug}-banner.jpg" file here before sending.`
        : "Banner unchanged.",
      "",
      "(This lists every field so it's easy to spot what changed — feel free to trim anything that's the same as before.)",
    ];
    const mailto = `mailto:${EDIT_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(bodyLines.join("\n"))}`;

    setStatus(
      "Saved as a local preview on this device. Opening your email client — please attach any downloaded logo/banner files before sending, so we can make the update live for everyone.",
      true
    );
    window.location.href = mailto;
  });

  try {
    const editorsRes = await fetch("data/editors.json");
    editors = editorsRes.ok ? await editorsRes.json() : [];
  } catch (err) {
    console.error(err);
    editors = [];
  }

  try {
    [categories, orgs] = await Promise.all([loadCategories(), loadAllOrgs()]);

    categorySelect.innerHTML = "";
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      categorySelect.appendChild(opt);
    });

    orgSelect.innerHTML = "";
    orgs
      .slice()
      .sort((a, b) => a.name.localeCompare(b.name))
      .forEach((org) => {
        const opt = document.createElement("option");
        opt.value = org.slug;
        opt.textContent = org.name;
        orgSelect.appendChild(opt);
      });

    const startSlug = initialSlug && orgs.some((o) => o.slug === initialSlug) ? initialSlug : orgs[0] && orgs[0].slug;
    if (startSlug) {
      orgSelect.value = startSlug;
      loadOrgIntoForm(orgs.find((o) => o.slug === startSlug));
    } else {
      setStatus("No organizations found yet.", false);
    }
  } catch (err) {
    console.error(err);
    setStatus("Could not load organizations. If you are viewing this file directly, run a local server (see README).", false);
  }
})();
