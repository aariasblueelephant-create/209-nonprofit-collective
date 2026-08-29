const DATA_BASE = "data";
const LOCAL_EDIT_PREFIX = "209collective:orgEdit:";

// Members can preview theme/logo/banner edits (see edit.html) before we have
// real accounts. The edit only lives in this browser's localStorage — it is
// NOT synced to the JSON files, so other visitors won't see it until an
// admin applies the change from the emailed request.
function getLocalOverride(slug) {
  try {
    const raw = localStorage.getItem(LOCAL_EDIT_PREFIX + slug);
    return raw ? JSON.parse(raw) : null;
  } catch (err) {
    return null;
  }
}

function setLocalOverride(slug, override) {
  try {
    localStorage.setItem(LOCAL_EDIT_PREFIX + slug, JSON.stringify(override));
  } catch (err) {
    console.error(err);
  }
}

function clearLocalOverride(slug) {
  try {
    localStorage.removeItem(LOCAL_EDIT_PREFIX + slug);
  } catch (err) {
    console.error(err);
  }
}

function applyLocalOverride(org) {
  const override = getLocalOverride(org.slug);
  if (!override) return org;
  const merged = { ...org, hasLocalEdit: true };
  if (override.themeColor) merged.themeColor = override.themeColor;
  if (override.themeColor2) merged.themeColor2 = override.themeColor2;
  if (override.logo) merged.logo = override.logo;
  if (override.banner) merged.banner = override.banner;
  if (override.categoryId) merged.categoryId = override.categoryId;
  if (override.categoryOther) merged.categoryOther = override.categoryOther;
  if (override.tagline) merged.tagline = override.tagline;
  if (override.description) merged.description = override.description;
  if (override.website) merged.website = override.website;
  if (override.email) merged.email = override.email;
  if (override.phone) merged.phone = override.phone;
  if (override.ein) merged.ein = override.ein;
  if (override.serviceArea) merged.serviceArea = override.serviceArea;
  if (override.donateUrl) merged.donateUrl = override.donateUrl;
  if (override.supportUrl) merged.supportUrl = override.supportUrl;
  if (override.programs && override.programs.length) merged.programs = override.programs;
  return merged;
}

async function loadCategories() {
  const res = await fetch(`${DATA_BASE}/categories.json`);
  return res.json();
}

async function loadManifest() {
  const res = await fetch(`${DATA_BASE}/manifest.json`);
  return res.json();
}

async function loadOrg(slug) {
  const res = await fetch(`${DATA_BASE}/orgs/${slug}.json`);
  if (!res.ok) throw new Error(`Org not found: ${slug}`);
  const org = await res.json();
  return applyLocalOverride(org);
}

async function loadAllOrgs() {
  const slugs = await loadManifest();
  const orgs = await Promise.all(slugs.map((slug) => loadOrg(slug).catch(() => null)));
  return orgs.filter(Boolean);
}

function categoryLabel(categories, categoryId) {
  const match = categories.find((c) => c.id === categoryId);
  return match ? match.label : "Other";
}

// Shows a member's own custom label when they picked "Other" — but the
// underlying categoryId stays "other" so the directory filter still groups
// them together instead of fragmenting into one-off filter options.
function orgCategoryLabel(categories, categoryId, otherText) {
  if (categoryId === "other" && otherText) return otherText;
  return categoryLabel(categories, categoryId);
}

function formatDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
