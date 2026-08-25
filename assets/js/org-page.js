(async function initOrgPage() {
  const params = new URLSearchParams(window.location.search);
  const slug = params.get("slug");

  const errorState = document.getElementById("error-state");
  const orgContent = document.getElementById("org-content");

  if (!slug) {
    errorState.hidden = false;
    return;
  }

  try {
    const [categories, org] = await Promise.all([loadCategories(), loadOrg(slug)]);

    document.title = `${org.name} · 209 Nonprofit Collective`;

    fillAvatar(document.getElementById("org-avatar"), org);
    document.getElementById("org-name").textContent = org.name;
    document.getElementById("org-badge").textContent = categoryLabel(categories, org.categoryId);
    document.getElementById("org-tagline").textContent = org.tagline || "";
    document.getElementById("org-description").textContent = org.description || "";

    const metaRow = document.getElementById("org-meta-row");
    metaRow.innerHTML = "";
    if (org.serviceArea) {
      const span = document.createElement("span");
      span.textContent = `📍 ${org.serviceArea}`;
      metaRow.appendChild(span);
    }
    if (org.website) {
      const a = document.createElement("a");
      a.href = org.website;
      a.target = "_blank";
      a.rel = "noopener";
      a.textContent = "Website ↗";
      metaRow.appendChild(a);
    }
    if (org.email) {
      const a = document.createElement("a");
      a.href = `mailto:${org.email}`;
      a.textContent = "Email";
      metaRow.appendChild(a);
    }
    if (org.joinedDate) {
      const span = document.createElement("span");
      span.textContent = `Member since ${formatDate(org.joinedDate)}`;
      metaRow.appendChild(span);
    }

    const programList = document.getElementById("program-list");
    programList.innerHTML = "";
    (org.programs || []).forEach((p) => {
      const li = document.createElement("li");
      li.textContent = p;
      programList.appendChild(li);
    });
    document.getElementById("programs-card").hidden = (org.programs || []).length === 0;

    const announceList = document.getElementById("org-announcements");
    announceList.innerHTML = "";
    const announcements = [...(org.announcements || [])].sort((a, b) => (a.date < b.date ? 1 : -1));
    if (announcements.length === 0) {
      announceList.innerHTML = '<div class="empty-state">No announcements yet.</div>';
    } else {
      announcements.forEach((a) => announceList.appendChild(createAnnouncementItem(org, a)));
    }

    orgContent.hidden = false;
  } catch (err) {
    console.error(err);
    errorState.hidden = false;
  }
})();
