const EDIT_EMAIL = "contact@aariasblueelephant.org";
const DEFAULT_COLOR = "#22D3EE";
const SWATCHES = ["#22D3EE", "#FBBF24", "#A78BFA", "#5EEAD4", "#FB7185", "#34D399", "#60A5FA", "#F472B6"];
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

  const params = new URLSearchParams(window.location.search);
  const initialSlug = params.get("slug");

  const orgSelect = document.getElementById("edit-org");
  const categorySelect = document.getElementById("edit-category");
  const taglineInput = document.getElementById("edit-tagline");
  const descriptionInput = document.getElementById("edit-description");
  const websiteInput = document.getElementById("edit-website");
  const orgEmailInput = document.getElementById("edit-org-email");
  const phoneInput = document.getElementById("edit-phone");
  const einInput = document.getElementById("edit-ein");
  const locationInput = document.getElementById("edit-location");
  const donateInput = document.getElementById("edit-donate");
  const programsInput = document.getElementById("edit-programs");
  const colorPicker = document.getElementById("edit-color");
  const colorHex = document.getElementById("edit-color-hex");
  const swatchRow = document.getElementById("swatch-row");
  const logoInput = document.getElementById("edit-logo");
  const bannerInput = document.getElementById("edit-banner");
  const logoThumb = document.getElementById("logo-thumb");
  const bannerThumb = document.getElementById("banner-thumb");
  const logoDownload = document.getElementById("logo-download");
  const bannerDownload = document.getElementById("banner-download");
  const form = document.getElementById("edit-form");
  const status = document.getElementById("save-status");
  const resetBtn = document.getElementById("reset-btn");

  const previewWrap = document.getElementById("edit-preview");
  const previewBanner = document.getElementById("preview-banner");
  const previewAvatar = document.getElementById("preview-avatar");
  const previewBadge = document.getElementById("preview-badge");
  const previewName = document.getElementById("preview-name");
  const previewTagline = document.getElementById("preview-tagline");

  const signinStatus = document.getElementById("signin-status");
  const signinUnconfigured = document.getElementById("signin-unconfigured");
  const submitBtn = document.getElementById("submit-btn");

  let categories = [];
  let orgs = [];
  let editors = [];
  let current = null;
  let googleIdToken = null;
  let googleEmail = null;

  function isAuthorizedFor(slug) {
    return !!googleEmail && editors.some((e) => String(e.email || "").toLowerCase() === googleEmail && e.slug === slug);
  }

  function updateSigninUI() {
    const slug = current ? current.slug : null;
    if (googleEmail) {
      signinStatus.textContent = slug && isAuthorizedFor(slug)
        ? `Signed in as ${googleEmail} — authorized to publish live for ${current.name}.`
        : `Signed in as ${googleEmail} — not a listed editor for ${current ? current.name : "this organization"}; changes will preview locally and go out by email instead.`;
    } else {
      signinStatus.textContent = "Not signed in — changes will preview locally and go out by email.";
    }
    submitBtn.textContent = slug && isAuthorizedFor(slug) && WORKER_URL ? "Publish Live" : "Save & Email Us";
  }
  // currentLogo/currentBanner: what's actually on file for this org right now
  // (a real asset path, or a previously-saved local-preview data: URL).
  // pendingLogo/pendingBanner: a new file chosen THIS session — the only ones
  // that need downloading/attaching, so we don't ask members to re-send files
  // that are already live.
  const state = {
    themeColor: DEFAULT_COLOR,
    currentLogo: null,
    currentBanner: null,
    pendingLogo: null,
    pendingBanner: null,
    categoryId: "",
    tagline: "",
    description: "",
    website: "",
    orgEmail: "",
    phone: "",
    ein: "",
    serviceArea: "",
    donateUrl: "",
    programs: [],
  };

  function displayLogo() { return state.pendingLogo || state.currentLogo; }
  function displayBanner() { return state.pendingBanner || state.currentBanner; }

  function setStatus(text, isSuccess) {
    status.textContent = text;
    status.className = isSuccess ? "save-status success" : "save-status";
  }

  function setColor(hex) {
    if (!/^#[0-9A-Fa-f]{6}$/.test(hex)) return;
    state.themeColor = hex;
    colorPicker.value = hex;
    colorHex.value = hex;
    previewWrap.style.setProperty("--preview-accent", hex);
    [...swatchRow.children].forEach((btn) => {
      btn.classList.toggle("active", btn.dataset.color.toLowerCase() === hex.toLowerCase());
    });
  }

  function renderPreview() {
    previewName.textContent = current ? current.name : "Organization Name";
    previewBadge.textContent = categoryLabel(categories, state.categoryId);
    previewTagline.textContent = state.tagline || "";

    previewBanner.innerHTML = "";
    const banner = displayBanner();
    if (banner) {
      const img = document.createElement("img");
      img.src = banner;
      img.alt = "Banner preview";
      previewBanner.appendChild(img);
    }

    fillAvatar(previewAvatar, { logo: displayLogo(), name: current ? current.name : "Org" });
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
    state.currentLogo = org.logo || null;
    state.currentBanner = org.banner || null;
    // If a local preview from an earlier visit is still the source of the
    // logo/banner, treat it as still-pending so the download links reappear.
    state.pendingLogo = org.hasLocalEdit && state.currentLogo && state.currentLogo.startsWith("data:") ? state.currentLogo : null;
    state.pendingBanner = org.hasLocalEdit && state.currentBanner && state.currentBanner.startsWith("data:") ? state.currentBanner : null;

    state.categoryId = org.categoryId || "";
    state.tagline = org.tagline || "";
    state.description = org.description || "";
    state.website = org.website || "";
    state.orgEmail = org.email || "";
    state.phone = org.phone || "";
    state.ein = org.ein || "";
    state.serviceArea = org.serviceArea || "";
    state.donateUrl = org.donateUrl || "";
    state.programs = org.programs || [];

    categorySelect.value = state.categoryId;
    taglineInput.value = state.tagline;
    descriptionInput.value = state.description;
    websiteInput.value = state.website;
    orgEmailInput.value = state.orgEmail;
    phoneInput.value = state.phone;
    einInput.value = state.ein;
    locationInput.value = state.serviceArea;
    donateInput.value = state.donateUrl;
    programsInput.value = state.programs.join("\n");

    setColor(state.themeColor);
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

  function initGoogleSignIn() {
    if (!GOOGLE_CLIENT_ID) {
      signinUnconfigured.hidden = false;
      return;
    }
    if (!window.google || !window.google.accounts || !window.google.accounts.id) {
      setTimeout(initGoogleSignIn, 150);
      return;
    }
    window.google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: (response) => {
        googleIdToken = response.credential;
        googleEmail = (decodeJwtPayload(response.credential) || {}).email || null;
        updateSigninUI();
      },
    });
    window.google.accounts.id.renderButton(document.getElementById("g_id_signin"), {
      theme: "filled_black",
      size: "medium",
    });
  }
  initGoogleSignIn();

  swatchRow.innerHTML = "";
  SWATCHES.forEach((hex) => {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "swatch";
    btn.style.background = hex;
    btn.dataset.color = hex;
    btn.title = hex;
    btn.addEventListener("click", () => setColor(hex));
    swatchRow.appendChild(btn);
  });

  colorPicker.addEventListener("input", () => setColor(colorPicker.value));
  colorHex.addEventListener("change", () => setColor(colorHex.value.trim()));

  categorySelect.addEventListener("change", () => { state.categoryId = categorySelect.value; renderPreview(); });
  taglineInput.addEventListener("input", () => { state.tagline = taglineInput.value; renderPreview(); });
  descriptionInput.addEventListener("input", () => { state.description = descriptionInput.value; });
  websiteInput.addEventListener("input", () => { state.website = websiteInput.value; });
  orgEmailInput.addEventListener("input", () => { state.orgEmail = orgEmailInput.value; });
  phoneInput.addEventListener("input", () => { state.phone = phoneInput.value; });
  einInput.addEventListener("input", () => { state.ein = einInput.value; });
  locationInput.addEventListener("input", () => { state.serviceArea = locationInput.value; });
  donateInput.addEventListener("input", () => { state.donateUrl = donateInput.value; });
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
      categoryId: state.categoryId || undefined,
      tagline: state.tagline || undefined,
      description: state.description || undefined,
      website: state.website || undefined,
      email: state.orgEmail || undefined,
      phone: state.phone || undefined,
      ein: state.ein || undefined,
      serviceArea: state.serviceArea || undefined,
      donateUrl: state.donateUrl || undefined,
      programs: state.programs.length ? state.programs : undefined,
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
      logo: state.pendingLogo || undefined,
      banner: state.pendingBanner || undefined,
      categoryId: state.categoryId || undefined,
      tagline: state.tagline || undefined,
      description: state.description || undefined,
      website: state.website || undefined,
      email: state.orgEmail || undefined,
      phone: state.phone || undefined,
      ein: state.ein || undefined,
      serviceArea: state.serviceArea || undefined,
      donateUrl: state.donateUrl || undefined,
      programs: state.programs.length ? state.programs : undefined,
    });

    if (await tryPublishLive()) return;

    const subject = `209 Nonprofit Collective Update — ${current.name}`;
    const bodyLines = [
      `Organization: ${current.name} (${current.slug})`,
      "",
      `Category: ${categoryLabel(categories, state.categoryId)}`,
      `Tagline: ${state.tagline}`,
      `Description: ${state.description}`,
      `Website: ${state.website}`,
      `Contact email: ${state.orgEmail}`,
      `Phone: ${state.phone}`,
      `EIN: ${state.ein}`,
      `Location (city & ZIP): ${state.serviceArea}`,
      `Donate link: ${state.donateUrl}`,
      `Programs:`,
      ...(state.programs.length ? state.programs.map((p) => `  - ${p}`) : ["  (none)"]),
      "",
      `Theme color: ${state.themeColor}`,
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
