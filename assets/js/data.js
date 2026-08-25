const DATA_BASE = "data";

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
  return res.json();
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

function formatDate(isoDate) {
  if (!isoDate) return "";
  const d = new Date(`${isoDate}T00:00:00`);
  if (Number.isNaN(d.getTime())) return isoDate;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}
