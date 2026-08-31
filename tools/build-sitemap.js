#!/usr/bin/env node
// Regenerates sitemap.xml from data/manifest.json.
// Optional admin convenience — the site itself still needs no build step.
// Run after adding or removing an organisation:  node tools/build-sitemap.js
const fs = require("fs");
const path = require("path");

const ROOT = path.join(__dirname, "..");
const BASE = "https://aariasblueelephant-create.github.io/209-nonprofit-collective";
const PAGES = ["index.html", "directory.html", "help.html", "apply.html"];

const slugs = JSON.parse(fs.readFileSync(path.join(ROOT, "data/manifest.json"), "utf8"))
  // Local test fixtures are prefixed with "_" and must never be indexed.
  .filter((s) => !s.startsWith("_"));

const today = new Date().toISOString().slice(0, 10);
const url = (loc, priority) =>
  `  <url>\n    <loc>${loc}</loc>\n    <lastmod>${today}</lastmod>\n    <priority>${priority}</priority>\n  </url>`;

const body = [
  ...PAGES.map((p, i) => url(`${BASE}/${p}`, i === 0 ? "1.0" : "0.8")),
  ...slugs.map((s) => url(`${BASE}/org.html?slug=${encodeURIComponent(s)}`, "0.7")),
].join("\n");

fs.writeFileSync(
  path.join(ROOT, "sitemap.xml"),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${body}\n</urlset>\n`
);
console.log(`sitemap.xml written — ${PAGES.length} pages + ${slugs.length} org page(s)`);
