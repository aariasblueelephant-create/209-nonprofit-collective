// A bare Google Photos share link (photos.app.goo.gl or photos.google.com)
// pasted into free text can't be embedded — it's an HTML page, not an image
// — so it's swapped for a styled "View Photo Album" link instead. Built as
// DOM text nodes + one anchor rather than innerHTML, so nothing else in the
// surrounding text is ever interpreted as markup.
const PHOTO_SHARE_LINK_RE = /https?:\/\/(?:photos\.app\.goo\.gl|photos\.google\.com)\/\S+/gi;
const TRAILING_PUNCTUATION_RE = /[).,;:!?\]"']+$/;

function renderTextWithPhotoLinks(el, text) {
  el.innerHTML = "";
  if (!text) return;
  const matches = [...text.matchAll(PHOTO_SHARE_LINK_RE)];
  if (matches.length === 0) {
    el.textContent = text;
    return;
  }

  let cursor = 0;
  matches.forEach((m) => {
    const raw = m[0];
    const trailing = (raw.match(TRAILING_PUNCTUATION_RE) || [""])[0];
    const url = trailing ? raw.slice(0, -trailing.length) : raw;

    if (m.index > cursor) el.appendChild(document.createTextNode(text.slice(cursor, m.index)));

    const card = document.createElement("a");
    card.className = "photo-album-card";
    card.href = url;
    card.target = "_blank";
    card.rel = "noopener";
    card.innerHTML = `${iconSvg("image", 16)} <span>View Photo Album</span> ${iconSvg("external", 13)}`;
    el.appendChild(card);

    if (trailing) el.appendChild(document.createTextNode(trailing));
    cursor = m.index + raw.length;
  });
  if (cursor < text.length) el.appendChild(document.createTextNode(text.slice(cursor)));
}

function initialsFor(name) {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("");
}

function fillAvatar(container, org) {
  container.innerHTML = "";
  if (org.logo) {
    const img = document.createElement("img");
    img.alt = `${org.name} logo`;
    img.src = org.logo;
    img.onerror = () => {
      container.innerHTML = "";
      const span = document.createElement("span");
      span.className = "initials";
      span.textContent = initialsFor(org.name);
      container.appendChild(span);
    };
    container.appendChild(img);
  } else {
    const span = document.createElement("span");
    span.className = "initials";
    span.textContent = initialsFor(org.name);
    container.appendChild(span);
  }
}

function createBubble(org) {
  const a = document.createElement("a");
  a.className = "bubble";
  a.href = `org.html?slug=${encodeURIComponent(org.slug)}`;

  const avatar = document.createElement("div");
  avatar.className = "bubble-avatar";
  fillAvatar(avatar, org);

  const name = document.createElement("div");
  name.className = "bubble-name";
  name.textContent = org.name;

  a.appendChild(avatar);
  a.appendChild(name);
  return a;
}

// opts.alsoNote — when the org surfaced because of a SECONDARY category,
// name it, so the card explains why it's in these results rather than
// showing only a badge that doesn't match what was searched.
function createCard(org, categories, opts) {
  const card = document.createElement("article");
  card.className = "card";

  const top = document.createElement("div");
  top.className = "card-top";

  const avatar = document.createElement("div");
  avatar.className = "card-avatar";
  fillAvatar(avatar, org);

  const title = document.createElement("div");
  title.className = "card-title";
  title.textContent = org.name;

  top.appendChild(avatar);
  top.appendChild(title);

  const badgeRow = document.createElement("div");
  badgeRow.className = "card-badges";

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = orgCategoryLabel(categories, org.categoryId, org.categoryOther);
  badgeRow.appendChild(badge);

  if (opts && opts.alsoNote) {
    const also = document.createElement("div");
    also.className = "badge badge-also";
    also.textContent = opts.alsoNote;
    badgeRow.appendChild(also);
  }

  const tagline = document.createElement("div");
  tagline.className = "card-tagline";
  tagline.textContent = org.tagline || "";

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `org.html?slug=${encodeURIComponent(org.slug)}`;
  link.innerHTML = `View Profile ${iconSvg("arrowRight", 16)}`;

  card.appendChild(top);
  card.appendChild(badgeRow);
  card.appendChild(tagline);
  card.appendChild(link);
  return card;
}

function eventDateBadge(isoDate) {
  const d = new Date(`${isoDate}T00:00:00`);
  const badge = document.createElement("div");
  badge.className = "event-date-badge";
  if (Number.isNaN(d.getTime())) {
    badge.textContent = "—";
    return badge;
  }
  const day = document.createElement("div");
  day.className = "event-date-day";
  day.textContent = d.getDate();
  const month = document.createElement("div");
  month.className = "event-date-month";
  month.textContent = d.toLocaleDateString("en-US", { month: "short" }).toUpperCase();
  badge.appendChild(day);
  badge.appendChild(month);
  return badge;
}

function createEventItem(org, event, opts) {
  const showOrg = !opts || opts.showOrg !== false;
  // A plain div, not a link — an event can have its own separate external
  // link (RSVP/details), so the whole card can't also be one big <a> to the
  // org page (can't legally nest <a> tags). The org name below is the link
  // back to the org instead.
  const item = document.createElement("div");
  item.className = "event-item";

  item.appendChild(eventDateBadge(event.date));

  if (event.image) {
    const thumb = document.createElement("div");
    thumb.className = "event-thumb";
    const img = document.createElement("img");
    img.src = event.image;
    img.alt = "";
    img.onerror = () => thumb.remove();
    thumb.appendChild(img);
    item.appendChild(thumb);
  }

  const content = document.createElement("div");
  content.className = "event-content";

  const title = document.createElement("div");
  title.className = "event-title";
  title.textContent = event.title;
  content.appendChild(title);

  const meta = document.createElement("div");
  meta.className = "event-meta";
  const metaNodes = [];
  if (showOrg) {
    const orgLink = document.createElement("a");
    orgLink.href = `org.html?slug=${encodeURIComponent(org.slug)}`;
    orgLink.textContent = org.name;
    metaNodes.push(orgLink);
  }
  if (event.time) metaNodes.push(document.createTextNode(event.time));
  if (event.location) metaNodes.push(document.createTextNode(event.location));
  metaNodes.forEach((node, i) => {
    if (i > 0) meta.appendChild(document.createTextNode(" · "));
    meta.appendChild(node);
  });
  content.appendChild(meta);

  if (event.description) {
    const desc = document.createElement("div");
    desc.className = "event-desc";
    renderTextWithPhotoLinks(desc, event.description);
    content.appendChild(desc);
  }

  if (event.url) {
    const link = document.createElement("a");
    link.className = "event-link";
    link.href = event.url;
    link.target = "_blank";
    link.rel = "noopener";
    link.innerHTML = `Event details / RSVP ${iconSvg("external", 15)}`;
    content.appendChild(link);
  }

  item.appendChild(content);

  // A large flyer, revealed on click. Kept out of the collapsed row so a
  // list of events stays scannable, but reachable — previously an event's
  // photo had nowhere to appear at full size.
  if (event.image) {
    item.classList.add("is-expandable");

    const toggle = document.createElement("button");
    toggle.type = "button";
    toggle.className = "event-toggle";
    toggle.setAttribute("aria-expanded", "false");
    toggle.setAttribute("aria-label", `Show flyer for ${event.title}`);
    toggle.innerHTML = iconSvg("image", 17);

    const full = document.createElement("div");
    full.className = "event-full";
    const fullImg = document.createElement("img");
    fullImg.src = event.image;
    fullImg.alt = `${event.title} flyer`;
    fullImg.loading = "lazy";
    // Some "image" URLs are share pages (Google Photos, Dropbox) rather than
    // a direct image file and will never load. Say so instead of leaving a
    // silent blank panel.
    fullImg.onerror = () => {
      full.innerHTML = "";
      const note = document.createElement("p");
      note.className = "event-img-error";
      note.innerHTML = `That photo link doesn't point directly at an image, so it can't be shown here. `
        + `<a href="${event.image}" target="_blank" rel="noopener">Open it in a new tab</a> instead.`;
      full.appendChild(note);
    };
    full.appendChild(fullImg);

    toggle.addEventListener("click", () => {
      const open = item.classList.toggle("is-open");
      toggle.setAttribute("aria-expanded", String(open));
    });

    item.appendChild(toggle);
    item.appendChild(full);
  }

  return item;
}

function createAnnouncementItem(org, announcement) {
  const item = document.createElement("div");
  item.className = "announce-item";

  const meta = document.createElement("div");
  meta.className = "announce-meta";
  const orgLink = document.createElement("a");
  orgLink.href = `org.html?slug=${encodeURIComponent(org.slug)}`;
  orgLink.textContent = org.name;
  meta.appendChild(orgLink);
  meta.appendChild(document.createTextNode(` · ${formatDate(announcement.date)}`));

  const title = document.createElement("div");
  title.className = "announce-title";
  title.textContent = announcement.title;

  const body = document.createElement("div");
  body.className = "announce-body";
  renderTextWithPhotoLinks(body, announcement.body);

  item.appendChild(meta);
  item.appendChild(title);
  item.appendChild(body);
  return item;
}
