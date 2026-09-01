(async function initDirectory() {
  const grid = document.getElementById("card-grid");
  const searchInput = document.getElementById("search-input");
  const categorySelect = document.getElementById("category-select");

  let categories = [];
  let orgs = [];

  function matches(org, query, categoryId) {
    if (categoryId !== "all" && !orgServesCategory(org, categoryId)) return false;
    if (!query) return true;
    const haystack = [org.name, org.tagline, org.description, ...(org.programs || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function render() {
    const query = searchInput.value.trim();
    const categoryId = categorySelect.value;
    const filtered = orgs
      .filter((org) => matches(org, query, categoryId))
      // Orgs whose *core* work is this category rank above those that merely
      // also do it — someone filtering for "Special Needs" wants the
      // specialists first, not an org that lists it as a side activity.
      .sort((a, b) => {
        if (categoryId !== "all") {
          const rank = (o) => (o.categoryId === categoryId ? 0 : 1);
          const diff = rank(a) - rank(b);
          if (diff !== 0) return diff;
        }
        return a.name.localeCompare(b.name);
      });

    grid.innerHTML = "";
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state">No organizations match yet. Try a different search or category.</div>';
      return;
    }
    filtered.forEach((org) => {
      // When an org matched on a secondary category, say so on its card
      // rather than showing a badge that doesn't match what was searched.
      const secondary = categoryId !== "all" && org.categoryId !== categoryId;
      grid.appendChild(createCard(org, categories, {
        alsoNote: secondary ? `also ${categoryLabel(categories, categoryId)}` : null,
      }));
    });
    stagger(grid.children, 55);
    initReveal();
  }

  try {
    [categories, orgs] = await Promise.all([loadCategories(), loadAllOrgs()]);

    categorySelect.innerHTML = '<option value="all">All Categories</option>';
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.id;
      opt.textContent = c.label;
      categorySelect.appendChild(opt);
    });

    searchInput.addEventListener("input", render);
    categorySelect.addEventListener("change", render);

    render();
  } catch (err) {
    console.error(err);
    grid.innerHTML = '<div class="empty-state">Could not load organizations. If you are viewing this file directly, run a local server (see README) so the browser can fetch the data files.</div>';
  }
})();
