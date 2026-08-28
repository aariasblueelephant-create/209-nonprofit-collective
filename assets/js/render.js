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

function createCard(org, categories) {
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

  const badge = document.createElement("div");
  badge.className = "badge";
  badge.textContent = categoryLabel(categories, org.categoryId);

  const tagline = document.createElement("div");
  tagline.className = "card-tagline";
  tagline.textContent = org.tagline || "";

  const link = document.createElement("a");
  link.className = "card-link";
  link.href = `org.html?slug=${encodeURIComponent(org.slug)}`;
  link.textContent = "View Profile →";

  card.appendChild(top);
  card.appendChild(badge);
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
  const item = document.createElement("a");
  item.className = "event-item";
  item.href = `org.html?slug=${encodeURIComponent(org.slug)}`;

  item.appendChild(eventDateBadge(event.date));

  const content = document.createElement("div");
  content.className = "event-content";

  const title = document.createElement("div");
  title.className = "event-title";
  title.textContent = event.title;
  content.appendChild(title);

  const metaParts = [];
  if (showOrg) metaParts.push(org.name);
  if (event.time) metaParts.push(event.time);
  if (event.location) metaParts.push(event.location);

  const meta = document.createElement("div");
  meta.className = "event-meta";
  meta.textContent = metaParts.join(" · ");
  content.appendChild(meta);

  if (event.description) {
    const desc = document.createElement("div");
    desc.className = "event-desc";
    desc.textContent = event.description;
    content.appendChild(desc);
  }

  item.appendChild(content);
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
  body.textContent = announcement.body;

  item.appendChild(meta);
  item.appendChild(title);
  item.appendChild(body);
  return item;
}
