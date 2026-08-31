// Share widgets. Each surface supplies its own short write-up rather than a
// bare URL, so a shared post actually explains what the collective is.
const SHARE_TAGS = "#209Collective #SanJoaquin #MountainHouse #Nonprofit";

function shareText(kind, data) {
  const d = data || {};
  switch (kind) {
    case "org":
      return `${d.name} is part of the 209 Nonprofit Collective — a vetted network of San Joaquin County nonprofits.` +
        (d.tagline ? ` ${d.tagline}` : "") + ` Support local:`;
    case "help":
      return `Need help in the 209? The 209 Nonprofit Collective lists vetted local nonprofits by what you actually need — food, housing, kids' programs, disability support, veterans services and more. Free to browse:`;
    default:
      return `Nonprofits of the 209, working as one — a vetted network of San Joaquin County nonprofits coordinating events, sharing resources, and speaking with one voice. Find a cause near you:`;
  }
}

// Facebook's sharer only accepts a URL (it pulls title/description from the
// page's Open Graph tags), so the write-up is passed via `quote`, which the
// share dialog pre-fills for the user.
function buildShareLinks(url, text) {
  return {
    facebook: `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}&quote=${encodeURIComponent(text)}`,
    x: `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(`${text}\n\n${SHARE_TAGS}`)}`,
  };
}

// Renders into `container`. `variant` "buttons" gives labelled pills,
// "icons" gives the compact circular icon row used on org profiles.
function renderShare(container, { url, kind, data, variant = "buttons" } = {}) {
  if (!container) return;
  const shareUrl = url || window.location.href;
  const text = shareText(kind, data);
  const links = buildShareLinks(shareUrl, text);
  container.innerHTML = "";

  const targets = [
    { key: "facebook", icon: "facebook", label: "Share on Facebook", short: "Facebook" },
    { key: "x", icon: "x", label: "Share on X", short: "X" },
  ];

  targets.forEach((t) => {
    const a = document.createElement("a");
    a.href = links[t.key];
    a.target = "_blank";
    a.rel = "noopener";
    a.title = t.label;
    a.setAttribute("aria-label", t.label);
    if (variant === "icons") {
      a.innerHTML = iconSvg(t.icon, 18);
    } else {
      a.className = "btn btn-outline btn-sm";
      a.innerHTML = `${iconSvg(t.icon, 16)} ${t.short}`;
    }
    container.appendChild(a);
  });

  // Copy link — the most-used "share" action in practice, and the only one
  // that works for texting or WhatsApp.
  const copy = document.createElement("button");
  copy.type = "button";
  copy.title = "Copy link";
  copy.setAttribute("aria-label", "Copy link");
  if (variant === "icons") {
    copy.className = "share-copy-icon";
    copy.innerHTML = iconSvg("share", 18);
  } else {
    copy.className = "btn btn-outline btn-sm";
    copy.innerHTML = `${iconSvg("share", 16)} Copy link`;
  }
  copy.addEventListener("click", async () => {
    const original = copy.innerHTML;
    try {
      await navigator.clipboard.writeText(shareUrl);
      copy.innerHTML = variant === "icons"
        ? iconSvg("check", 18)
        : `${iconSvg("check", 16)} Copied`;
    } catch {
      // Clipboard API needs a secure context; fall back to selectable text.
      window.prompt("Copy this link:", shareUrl);
      return;
    }
    setTimeout(() => { copy.innerHTML = original; }, 1800);
  });
  container.appendChild(copy);
}
