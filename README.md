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

## Adding a new organization (after vetting)

1. **Logo (optional).** Add a square logo to `assets/logos/<slug>.svg` (or `.png`). If you skip this, the site automatically shows a circular initials badge instead — you don't have to supply a logo to onboard an org.
2. **Org record.** Copy `data/orgs/aarias-blue-elephant.json` to `data/orgs/<slug>.json` and fill in the fields (see schema below).
3. **Manifest.** Add `"<slug>"` to the array in `data/manifest.json`.
4. **Commit and push.** The org now appears automatically in the directory, the homepage member bubbles, and — if it has announcements — the homepage announcement feed.

`<slug>` should be a lowercase, hyphenated version of the org name (e.g. `aarias-blue-elephant`) and must match the JSON filename and the value in `manifest.json`.

### Org JSON schema

```jsonc
{
  "slug": "example-org",                 // must match filename and manifest.json entry
  "name": "Example Org",
  "categoryId": "education",             // one of the ids in data/categories.json
  "logo": "assets/logos/example-org.svg",// omit or leave "" to use the auto-generated initials badge
  "tagline": "One line describing the mission.",
  "description": "A longer paragraph shown on the org's profile page.",
  "website": "https://example.org",
  "email": "contact@example.org",
  "serviceArea": "Mountain House, CA 95391",
  "joinedDate": "2026-08-25",            // YYYY-MM-DD
  "programs": ["Program One", "Program Two"],
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

## Editing categories

`data/categories.json` is the single source of truth for category filters (used on the directory page, the org pages, and the apply form dropdown). Add, remove, or relabel categories there; every page picks up the change automatically.

## Changing the applications inbox

The `apply.html` form sends applications to the address set in `assets/js/apply.js` (`APPLY_EMAIL`). Update that constant if the collective gets a dedicated inbox later.
