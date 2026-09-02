// Cloudflare Worker: verifies a Google sign-in, checks the requester against
// data/editors.json in the GitHub repo, and — only if both pass — commits the
// edited org fields (and any new logo/banner) straight to GitHub via its
// Contents API. This is the one piece of always-on infrastructure that lets
// a verified member's edit go live without an admin manually applying it.
//
// Required config (see wrangler.toml):
//   vars:    GITHUB_OWNER, GITHUB_REPO, GITHUB_BRANCH, ALLOWED_ORIGIN
//   secrets: GITHUB_TOKEN   (fine-grained PAT, scoped to this one repo, Contents: read/write)
//            GOOGLE_CLIENT_ID (the OAuth Client ID from Google Cloud Console)

const EDITABLE_FIELDS = [
  "themeColor",
  "themeColor2",
  "categoryId",
  "categoryOther",
  "alsoServes",
  "tagline",
  "description",
  "website",
  "email",
  "phone",
  "ein",
  "serviceArea",
  "donateUrl",
  "supportUrl",
  "programs",
  "events",
  "gallery",
];

// The client already compresses images to well under these before sending —
// this is a server-side backstop against a caller hitting the API directly,
// so a single image can never blow up the repo regardless of what the
// browser did or didn't enforce.
const MAX_IMAGE_BYTES = 1.5 * 1024 * 1024;

function corsHeaders(env) {
  return {
    "Access-Control-Allow-Origin": env.ALLOWED_ORIGIN || "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
  };
}

function json(env, data, status) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { "Content-Type": "application/json", ...corsHeaders(env) },
  });
}

function utf8ToBase64(str) {
  const bytes = new TextEncoder().encode(str);
  let binary = "";
  bytes.forEach((b) => { binary += String.fromCharCode(b); });
  return btoa(binary);
}

function base64ToUtf8(b64) {
  const binary = atob(b64.replace(/\n/g, ""));
  const bytes = Uint8Array.from(binary, (c) => c.charCodeAt(0));
  return new TextDecoder().decode(bytes);
}

async function githubApi(env, path, options) {
  const url = `https://api.github.com/repos/${env.GITHUB_OWNER}/${env.GITHUB_REPO}/contents/${path}`;
  const res = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${env.GITHUB_TOKEN}`,
      Accept: "application/vnd.github+json",
      "User-Agent": "209-nonprofit-collective-editor",
      ...(options && options.headers),
    },
  });
  return res;
}

async function githubGetFile(env, path) {
  const res = await githubApi(env, `${path}?ref=${env.GITHUB_BRANCH}`);
  if (!res.ok) throw new Error(`Could not read ${path} from GitHub (${res.status})`);
  const data = await res.json();
  return { content: base64ToUtf8(data.content), sha: data.sha };
}

async function githubPutFile(env, path, base64Content, message, sha) {
  const res = await githubApi(env, path, {
    method: "PUT",
    body: JSON.stringify({
      message,
      content: base64Content,
      branch: env.GITHUB_BRANCH,
      ...(sha ? { sha } : {}),
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new Error(`GitHub write to ${path} failed (${res.status}): ${detail}`);
  }
  return res.json();
}

async function verifyGoogleIdToken(env, idToken) {
  const res = await fetch(`https://oauth2.googleapis.com/tokeninfo?id_token=${encodeURIComponent(idToken)}`);
  if (!res.ok) throw new Error("Google could not verify that sign-in token.");
  const info = await res.json();
  if (info.aud !== env.GOOGLE_CLIENT_ID) throw new Error("Sign-in token was not issued for this site.");
  if (info.email_verified !== "true" && info.email_verified !== true) throw new Error("Google email is not verified.");
  return String(info.email || "").toLowerCase();
}

// --- Domain-based authorization -------------------------------------------
// Mirrored from assets/js/domain-auth.js. The client copy only drives UI
// state; THIS copy is the one that gates writes. Keep them in sync.
const PUBLIC_EMAIL_DOMAINS = new Set([
  "gmail.com", "googlemail.com", "yahoo.com", "ymail.com", "hotmail.com",
  "outlook.com", "live.com", "msn.com", "aol.com", "icloud.com", "me.com",
  "mac.com", "proton.me", "protonmail.com", "pm.me", "gmx.com", "gmx.net",
  "mail.com", "zoho.com", "yandex.com", "comcast.net", "sbcglobal.net",
  "att.net", "verizon.net", "cox.net", "charter.net", "pacbell.net",
  "outlook.co.uk", "hotmail.co.uk", "yahoo.co.uk",
]);
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
  return [...SHARED_HOSTS].some((h) => domain.endsWith(`.${h}`));
}
function emailMatchesOrgDomain(email, websiteUrl) {
  const e = domainFromEmail(email);
  const w = domainFromUrl(websiteUrl);
  if (!e || !w) return false;
  if (!e.includes(".") || !w.includes(".")) return false;
  if (PUBLIC_EMAIL_DOMAINS.has(e) || PUBLIC_EMAIL_DOMAINS.has(w)) return false;
  if (isSharedHost(e) || isSharedHost(w)) return false;
  if (e === w) return true;
  return e.endsWith(`.${w}`) || w.endsWith(`.${e}`);
}
// --------------------------------------------------------------------------

// Authorized either by explicit allowlist entry, or by holding an email at
// the organisation's own website domain.
async function authorizeEditor(env, email, slug, org) {
  const { content } = await githubGetFile(env, "data/editors.json");
  const editors = JSON.parse(content);
  if (editors.some((e) => String(e.email || "").toLowerCase() === email && e.slug === slug)) {
    return "allowlist";
  }
  // Match against the website as currently committed in the repo — never a
  // value from the request body, which the caller controls.
  if (emailMatchesOrgDomain(email, org.website)) return "domain";
  return null;
}

function dataUrlToBase64(dataUrl) {
  const comma = dataUrl.indexOf(",");
  return comma === -1 ? dataUrl : dataUrl.slice(comma + 1);
}

function base64Bytes(base64) {
  const clean = base64.replace(/=+$/, "");
  return Math.ceil((clean.length * 3) / 4);
}

export default {
  async fetch(request, env) {
    if (request.method === "OPTIONS") {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }
    if (request.method !== "POST") {
      return json(env, { ok: false, error: "Method not allowed" }, 405);
    }

    let body;
    try {
      body = await request.json();
    } catch {
      return json(env, { ok: false, error: "Invalid request body" }, 400);
    }

    const { idToken, slug, fields, logo, banner } = body || {};
    if (!idToken || !slug) {
      return json(env, { ok: false, error: "Missing idToken or slug" }, 400);
    }

    let email;
    try {
      email = await verifyGoogleIdToken(env, idToken);
    } catch (err) {
      return json(env, { ok: false, error: err.message }, 401);
    }

    try {
      // Load the org BEFORE authorizing: domain matching must use the website
      // as committed in the repo, never a value supplied in this request.
      const orgPath = `data/orgs/${slug}.json`;
      const { content: orgRaw, sha: orgSha } = await githubGetFile(env, orgPath);
      const org = JSON.parse(orgRaw);

      const grant = await authorizeEditor(env, email, slug, org);
      if (!grant) {
        return json(env, { ok: false, error: `${email} is not a listed editor for "${slug}", and its domain doesn't match that organisation's website.` }, 403);
      }

      if (fields && typeof fields === "object") {
        for (const key of EDITABLE_FIELDS) {
          if (!Object.prototype.hasOwnProperty.call(fields, key)) continue;
          // The website domain is what grants domain-based access, so someone
          // holding only that grant must not be able to repoint it — that
          // would let them hand edit rights to a different domain.
          if (key === "website" && grant === "domain" && domainFromUrl(fields.website) !== domainFromUrl(org.website)) {
            return json(env, { ok: false, error: "Changing the website domain requires an allowlisted editor. Email us and we'll make the change." }, 403);
          }
          org[key] = fields[key];
        }
      }

      if (typeof logo === "string" && logo.startsWith("data:")) {
        const logoBase64 = dataUrlToBase64(logo);
        if (base64Bytes(logoBase64) > MAX_IMAGE_BYTES) {
          return json(env, { ok: false, error: `Logo image is too large (over ${Math.round(MAX_IMAGE_BYTES / 1024)}KB after encoding).` }, 413);
        }
        const ext = logo.startsWith("data:image/png") ? "png" : "jpg";
        const logoPath = `assets/logos/${slug}.${ext}`;
        let existingSha;
        try { existingSha = (await githubGetFile(env, logoPath)).sha; } catch { /* file may not exist yet */ }
        await githubPutFile(env, logoPath, logoBase64, `Update ${org.name} logo via self-service edit (${email})`, existingSha);
        org.logo = logoPath;
      }

      if (typeof banner === "string" && banner.startsWith("data:")) {
        const bannerBase64 = dataUrlToBase64(banner);
        if (base64Bytes(bannerBase64) > MAX_IMAGE_BYTES) {
          return json(env, { ok: false, error: `Banner image is too large (over ${Math.round(MAX_IMAGE_BYTES / 1024)}KB after encoding).` }, 413);
        }
        const bannerPath = `assets/logos/${slug}-banner.jpg`;
        let existingSha;
        try { existingSha = (await githubGetFile(env, bannerPath)).sha; } catch { /* file may not exist yet */ }
        await githubPutFile(env, bannerPath, bannerBase64, `Update ${org.name} banner via self-service edit (${email})`, existingSha);
        org.banner = bannerPath;
      }

      // Event photos come in as inline data: URLs (the client shows an
      // instant preview before publishing). Write each one out as a real
      // file, same as logo/banner — inlining base64 into the JSON would
      // bloat every future diff of this file forever, not just the commit
      // that added the photo.
      if (Array.isArray(org.events)) {
        for (const event of org.events) {
          if (typeof event.image !== "string" || !event.image.startsWith("data:")) continue;
          const base64 = dataUrlToBase64(event.image);
          if (base64Bytes(base64) > MAX_IMAGE_BYTES) {
            return json(env, { ok: false, error: `The photo for "${event.title || "an event"}" is too large (over ${Math.round(MAX_IMAGE_BYTES / 1024)}KB after encoding).` }, 413);
          }
          const ext = event.image.startsWith("data:image/png") ? "png" : "jpg";
          const safeId = String(event.id || Date.now()).replace(/[^a-z0-9-]/gi, "");
          const eventPath = `assets/events/${slug}-${safeId}.${ext}`;
          let existingSha;
          try { existingSha = (await githubGetFile(env, eventPath)).sha; } catch { /* file may not exist yet */ }
          await githubPutFile(env, eventPath, base64, `Add photo for "${event.title || "event"}" (${org.name}) via self-service edit (${email})`, existingSha);
          event.image = eventPath;
        }
      }

      const newOrgContent = utf8ToBase64(JSON.stringify(org, null, 2) + "\n");
      await githubPutFile(env, orgPath, newOrgContent, `Update ${org.name} via self-service edit (${email})`, orgSha);

      return json(env, { ok: true });
    } catch (err) {
      return json(env, { ok: false, error: err.message || "Unexpected error" }, 500);
    }
  },
};
