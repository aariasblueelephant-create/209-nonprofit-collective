// Domain-based editor authorization.
//
// A person signing in with an email at the SAME domain as the organisation's
// own website is treated as authorized to edit it — you can't get an
// @aariasblueelephant.org address unless whoever runs that domain gave you
// one, which is a solid affiliation signal and saves hand-maintaining an
// allowlist for every staff member.
//
// This logic is mirrored verbatim in edit-worker/src/index.js. The client
// copy only drives the UI; the Worker copy is the one that actually gates
// writes, so keep them in sync.

// Nobody gets edit rights from a shared consumer mailbox — otherwise an org
// that listed a free host as its "website" would hand access to millions.
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net",
  "mail.com", "zoho.com", "yandex.com", "comcast.net", "sbcglobal.net",
  "att.net", "verizon.net", "cox.net", "charter.net", "pacbell.net",
  "outlook.co.uk", "hotmail.co.uk", "yahoo.co.uk",
]);

// Sites hosted on a shared platform share one domain with thousands of
// unrelated tenants, so a domain match there proves nothing.
const SHARED_HOSTS = new Set([
  "wixsite.com", "wordpress.com", "squarespace.com", "weebly.com",
  "godaddysites.com", "sites.google.com", "blogspot.com", "facebook.com",
  "wix.com", "webflow.io", "github.io", "netlify.app", "vercel.app",
  "linktr.ee", "carrd.co", "notion.site",
]);

function normalizeHost(host) {
  return String(host || "").trim().toLowerCase().replace(/^www\./, "").replace(/\.$/, "");
}

function domainFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "";
  try {
    return normalizeHost(new URL(/^https?:\/\//i.test(raw) ? raw : `https://${raw}`).hostname);
  } catch {
    return "";
  }
}

function domainFromEmail(email) {
  const at = String(email || "").lastIndexOf("@");
  return at === -1 ? "" : normalizeHost(String(email).slice(at + 1));
}

function isSharedHost(domain) {
  if (SHARED_HOSTS.has(domain)) return true;
  // e.g. myorg.wixsite.com -> the registrable part is a shared platform
  return [...SHARED_HOSTS].some((h) => domain.endsWith(`.${h}`));
}

// True when `email` belongs to the same domain as the org's own website.
function emailMatchesOrgDomain(email, websiteUrl) {
  const e = domainFromEmail(email);
  const w = domainFromUrl(websiteUrl);
  if (!e || !w) return false;
  // Require real multi-label domains — guards against a malformed website
  // value like "org" matching every .org address.
  if (!e.includes(".") || !w.includes(".")) return false;
  if (PUBLIC_EMAIL_DOMAINS.has(e) || PUBLIC_EMAIL_DOMAINS.has(w)) return false;
  if (isSharedHost(e) || isSharedHost(w)) return false;
  if (e === w) return true;
  // Allow a subdomain on either side: mail.example.org <-> example.org.
  return e.endsWith(`.${w}`) || w.endsWith(`.${e}`);
}
