const HELP_EMAIL = "contact@aariasblueelephant.org";

(async function initHelp() {
  const grid = document.getElementById("needs-grid");
  const results = document.getElementById("needs-results");
  const resultsGrid = document.getElementById("results-grid");
  const resultsTitle = document.getElementById("results-title");
  const resultsSub = document.getElementById("results-sub");
  const backBtn = document.getElementById("needs-back");
  const emailBtn = document.getElementById("help-email");

  emailBtn.href = `mailto:${HELP_EMAIL}?subject=${encodeURIComponent("I'm looking for help in the 209")}`;
  renderShare(document.getElementById("help-share"), { kind: "help" });

  let categories = [];
  let orgs = [];
  let needs = [];

  function orgsForNeed(need) {
    return orgs
      .filter((o) => orgCategoryIds(o).some((id) => need.categoryIds.includes(id)))
      // Specialists first: an org whose primary category is this need is more
      // likely to actually help than one that lists it as a side activity.
      .sort((a, b) => {
        const rank = (o) => (need.categoryIds.includes(o.categoryId) ? 0 : 1);
        return rank(a) - rank(b) || a.name.localeCompare(b.name);
      });
  }

  function isPrimaryFor(org, need) {
    return need.categoryIds.includes(org.categoryId);
  }

  function showNeed(need) {
    const matches = orgsForNeed(need);
    resultsTitle.textContent = need.label;
    resultsSub.textContent = matches.length
      ? `${matches.length} member organisation${matches.length > 1 ? "s" : ""} in the collective work${matches.length === 1 ? "s" : ""} on this.`
      : "No member organisation covers this yet — email us and we'll try to point you elsewhere.";

    resultsGrid.innerHTML = "";
    if (matches.length === 0) {
      resultsGrid.innerHTML = `<div class="empty-state">Nobody in the collective covers this yet. <a href="mailto:${HELP_EMAIL}">Email us</a> and we'll help you look further afield.</div>`;
    } else {
      matches.forEach((org) => resultsGrid.appendChild(createCard(org, categories, {
        alsoNote: isPrimaryFor(org, need) ? null : "also works on this",
      })));
      stagger(resultsGrid.children, 55);
      initReveal();
    }

    grid.hidden = true;
    results.hidden = false;
    // Move focus so keyboard and screen-reader users land on the new content
    // instead of being silently left at the top of the page.
    resultsTitle.setAttribute("tabindex", "-1");
    resultsTitle.focus();
    history.replaceState(null, "", `?need=${encodeURIComponent(need.id)}`);
  }

  function showAll() {
    results.hidden = true;
    grid.hidden = false;
    history.replaceState(null, "", location.pathname);
  }

  backBtn.addEventListener("click", showAll);

  try {
    const [cats, allOrgs, needsRes] = await Promise.all([
      loadCategories(),
      loadAllOrgs(),
      fetch("data/needs.json").then((r) => r.json()),
    ]);
    categories = cats;
    orgs = allOrgs;
    needs = needsRes;

    grid.innerHTML = "";
    needs.forEach((need) => {
      const count = orgsForNeed(need).length;
      const card = document.createElement("button");
      card.type = "button";
      card.className = "need-card";
      card.innerHTML = `
        <span class="need-icon">${iconSvg(need.icon, 24)}</span>
        <span class="need-label">${need.label}</span>
        <span class="need-blurb">${need.blurb}</span>
        <span class="need-examples">${need.examples.map((e) => `<span>"${e}"</span>`).join("")}</span>
        <span class="need-count">${count === 0 ? "No members yet" : `${count} organisation${count > 1 ? "s" : ""}`}</span>`;
      card.addEventListener("click", () => showNeed(need));
      grid.appendChild(card);
    });
    stagger(grid.children, 55);
    initReveal();

    // Deep link, so a specific need can be shared directly.
    const wanted = new URLSearchParams(location.search).get("need");
    const match = wanted && needs.find((n) => n.id === wanted);
    if (match) showNeed(match);
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="empty-state">Could not load. If you are viewing this file directly, run a local server (see README).</div>';
  }
})();
