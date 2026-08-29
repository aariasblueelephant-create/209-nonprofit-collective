# 209 Nonprofit Collective

A static, no-backend directory site for a vetted network of San Joaquin County nonprofits — starting in Mountain House (95391) and growing across the 209.

- **Hosting:** GitHub Pages (plain static files, no build step)
- **Data:** JSON files in `data/`, edited directly and committed to the repo — no database, no third-party service
- **Search:** client-side, filters the loaded JSON in the browser
- **Sign-up:** static form on `apply.html` that opens a pre-filled email (`mailto:`) — there is no automated submission, so every applicant is reviewed and vetted by phone before being added

## Running it locally

Browsers block `fetch()` of local JSON files when you open `index.html` directly (`file://…`), so serve the folder with any simple local server:

```bash
cd 209-nonprofit-collective
python3 -m http.server 8000
# then open http://localhost:8000
```

## Publishing to GitHub Pages

1. Create a new GitHub repository (e.g. `209-nonprofit-collective`).
2. Push the contents of this folder to the `main` branch.
3. In the repo, go to **Settings → Pages**, set **Source** to the `main` branch, root folder.
4. Your site will be live at `https://<your-username>.github.io/209-nonprofit-collective/`.

## Eligibility (current phase)

- **Physical address in ZIP 95391 (Mountain House) only.** This will expand to other San Joaquin County ZIP codes once the site and vetting process have been tested. The apply form's ZIP field is locked to `95391` via HTML validation until that changes.
- **501(c)(3) nonprofits only** (or fiscally sponsored charitable projects). 501(c)(6) business leagues / trade associations (e.g. chambers of commerce) are intentionally excluded — the collective is built around charitable causes sponsors and donors can support, and 501(c)(6) dues/support aren't tax-deductible charitable giving the way 501(c)(3) donations are.

When either policy changes, update the copy in `apply.html` and, for the ZIP restriction, the `pattern` attribute on the `zip` input in that file.

## Adding a new organization (after vetting)

The initial record still has to be created by an admin — that's the vetting gate, not a technical limitation — but logo/banner no longer have to be collected upfront if the Worker (below) is deployed; the org can upload their own afterward.

1. **Org record.** Copy `data/orgs/aarias-blue-elephant.json` to `data/orgs/<slug>.json` and fill in the fields (see schema below). It's fine to leave `logo` and `banner` blank — the site shows a circular initials badge and a gradient placeholder respectively until they're set.
2. **Manifest.** Add `"<slug>"` to the array in `data/manifest.json`.
3. **Editor access.** Add `{ "email": "<their Google email>", "slug": "<slug>" }` to `data/editors.json` so they can sign in and publish changes themselves (see "Verified live publishing" below).
4. **Commit and push.** The org now appears automatically in the directory, the homepage member bubbles, and — if it has announcements or upcoming events — the homepage feeds for those too.

If the Cloudflare Worker isn't deployed yet, or an org isn't listed in `editors.json`, they can still email you a logo/banner (or bring it to the vetting call) and you add the files to `assets/logos/<slug>.{svg,png}` / `assets/logos/<slug>-banner.jpg` by hand — same fallback as any other field edit.

`<slug>` should be a lowercase, hyphenated version of the org name (e.g. `aarias-blue-elephant`) and must match the JSON filename and the value in `manifest.json`.

### Org JSON schema

```jsonc
{
  "slug": "example-org",                 // must match filename and manifest.json entry
  "name": "Example Org",
  "categoryId": "education",             // one of the ids in data/categories.json
  "categoryOther": "",                   // only used when categoryId is "other" — shown as the badge label, but the org still files under "Other" for directory filtering
  "logo": "assets/logos/example-org.svg",// omit or leave "" to use the auto-generated initials badge
  "tagline": "One line describing the mission.",
  "description": "A longer paragraph shown on the org's profile page.",
  "website": "https://example.org",
  "email": "contact@example.org",
  "phone": "",                           // optional public contact number
  "ein": "",                             // optional IRS EIN, e.g. "12-3456789" — shown for donor/verification trust
  "serviceArea": "Mountain House, CA 95391", // public location — city + ZIP only, never a street address (that's collected privately during vetting)
  "joinedDate": "2026-08-25",            // YYYY-MM-DD
  "banner": "",                          // optional path to a wide banner photo; "" shows a gradient instead
  "themeColor": "",                      // optional 6-digit hex (e.g. "#22D3EE"); primary accent for that org's own profile page; "" uses the site default cyan
  "themeColor2": "",                     // optional 6-digit hex; secondary/complementary accent used alongside themeColor; "" uses the site default gold. edit.html offers named presets (Fire, Water, Earth, Sky) that set both together
  "donateUrl": "",                       // optional; shows a Donate button on the org page if set
  "programs": ["Program One", "Program Two"],
  "events": [
    {
      "id": "unique-id",
      "title": "Event title",
      "date": "2026-09-12",              // YYYY-MM-DD
      "time": "10:00 AM - 1:00 PM",      // optional, free text
      "location": "Mountain House Community Park", // optional
      "description": "Short description shown under the event.",
      "image": "",                        // optional — a LINK to a flyer/event photo already hosted elsewhere (Canva, Facebook, the org's site, etc.), not an uploaded file. Events accumulate forever (unlike logo/banner, which get replaced), so never commit event photos into this repo — that would make it grow without bound. Shown as a small thumbnail if set, otherwise just the date badge shows.
      "url": ""                           // optional — a link to the event's own page (RSVP/registration/Facebook event/etc.); shown as a small "Event details / RSVP" link if set
    }
  ],
  "announcements": [
    {
      "id": "unique-id",
      "title": "Announcement title",
      "date": "2026-08-25",              // YYYY-MM-DD
      "body": "Announcement text."
    }
  ]
}
```

## Adding a new announcement to an existing org

Open `data/orgs/<slug>.json` and add an entry to that org's `announcements` array (same shape as above). It will show up on that org's page and, if recent enough, on the homepage feed automatically — no other file needs to change.

## Self-service editing (theme color, logo, banner, and org text)

`edit.html` lets a member preview and request changes to their own organization — theme color, logo, banner, tagline, description, phone, EIN, and location — without touching JSON directly:

- Open `edit.html` (or `edit.html?slug=<slug>` from the "✎ Edit" link in the nav on an org's page), pick a color, choose new logo/banner images, and/or update the text fields.
- The **Location** field is intentionally just city + ZIP (e.g. "Mountain House, CA 95391") — never a full street address, which stays private to the vetting call.
- The change previews **instantly on that device only**, saved to `localStorage` (see `LOCAL_EDIT_PREFIX` in `assets/js/data.js`). `loadOrg`/`loadAllOrgs` transparently merge this local override on top of the real JSON, so the home page, directory, and org page all reflect it in that same browser — with a banner on the org page noting it's a local-only preview.
- Clicking **Save & Email Us** opens a pre-filled email (mirroring the `apply.html` flow) with the requested theme color and a reminder to attach the downloaded logo/banner files. An admin applies the change to the real `data/orgs/<slug>.json` and `assets/logos/` files and commits — the same manual step already used for onboarding.

Anyone can still preview changes for any org without signing in — that stays intentionally open while the site is pre-launch. But a **verified editor can now publish instantly** instead of emailing: see the next section.

## Verified live publishing (Google sign-in + Cloudflare Worker)

A member listed in `data/editors.json` can sign in with Google on `edit.html` and have their changes committed straight to this repo — no email, no admin step. This is the only piece of always-on infrastructure in the project, and it holds no user data of its own; it just verifies identity and writes to GitHub.

**How it works:**
1. `edit.html` loads Google Identity Services and shows a "Sign in to publish instantly" card.
2. On sign-in, the browser gets a Google ID token (a signed JWT) — this is sent, along with the edited fields, to a small Cloudflare Worker (`edit-worker/`).
3. The Worker re-verifies the token with Google, checks the signed-in email against `data/editors.json` for the org being edited, and — only if both pass — reads and writes the org's JSON (and any new logo/banner) via the GitHub Contents API, using a token that lives only in the Worker's encrypted secrets, never in the browser.
4. GitHub Pages picks up the new commit and the change is live within about a minute.

If a signed-in email isn't listed in `editors.json` for that org, or the Worker call fails for any reason, the page automatically falls back to the existing local-preview + email flow — nothing breaks for anyone not yet set up as a verified editor.

### One-time setup (only needed once, by whoever administers the site)

1. **Create the GitHub repo** (if not already done) and push this project to it.
2. **Create a Google OAuth Client ID** — free, a few minutes:
   - Go to [Google Cloud Console → APIs & Services → Credentials](https://console.cloud.google.com/apis/credentials).
   - Create a project (any name), then **Create Credentials → OAuth client ID → Web application**.
   - Under **Authorized JavaScript origins**, add your site's URL (e.g. `https://<username>.github.io`).
   - Copy the generated **Client ID** (looks like `xxxxxxxx.apps.googleusercontent.com`) — you don't need the "client secret," only the ID.
3. **Create a fine-grained GitHub token** scoped to just this repo:
   - Go to [github.com/settings/personal-access-tokens](https://github.com/settings/personal-access-tokens/new).
   - Repository access → **Only select repositories** → this repo.
   - Permissions → **Contents: Read and write**. Leave everything else as "No access."
   - Generate and copy the token — this is what the Worker uses to commit; it can never touch any other repo.
4. **Deploy the Cloudflare Worker** (free tier is plenty):
   ```bash
   cd edit-worker
   npx wrangler login          # opens a browser to authorize your free Cloudflare account
   npx wrangler secret put GITHUB_TOKEN        # paste the token from step 3
   npx wrangler secret put GOOGLE_CLIENT_ID    # paste the Client ID from step 2
   npx wrangler deploy
   ```
   Update `wrangler.toml` first if your GitHub username/repo/Pages URL differ from the defaults. Wrangler prints the Worker's URL (`https://collective-editor.<your-subdomain>.workers.dev`) when it deploys.
5. **Wire the frontend to the Worker**: in `assets/js/edit.js`, set `GOOGLE_CLIENT_ID` to the value from step 2 and `WORKER_URL` to the URL from step 4.
6. **Add editors** by adding `{ "email": "...", "slug": "..." }` entries to `data/editors.json` and committing — this is the allowlist of who can publish for which org.

## The shared event calendar

Any member can "claim" a spot on the shared calendar by adding an entry to their own `events` array — there's no separate approval beyond already being a vetted member. Events with a `date` today or later show up automatically, sorted soonest-first, on both the homepage ("Upcoming Events") and the org's own profile page. Past events simply age out of both lists on their own — nothing needs to be deleted.

## Editing categories

`data/categories.json` is the single source of truth for category filters (used on the directory page, the org pages, and the apply form dropdown). Add, remove, or relabel categories there; every page picks up the change automatically.

## Changing the applications inbox

The `apply.html` form sends applications to the address set in `assets/js/apply.js` (`APPLY_EMAIL`). Update that constant if the collective gets a dedicated inbox later.
