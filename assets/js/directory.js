(async function initDirectory() {
  const grid = document.getElementById("card-grid");
  const searchInput = document.getElementById("search-input");
  const categorySelect = document.getElementById("category-select");

  let categories = [];
  let orgs = [];

  function matches(org, query, categoryId) {
    if (categoryId !== "all" && org.categoryId !== categoryId) return false;
    if (!query) return true;
    const haystack = [org.name, org.tagline, org.description, ...(org.programs || [])]
      .join(" ")
      .toLowerCase();
    return haystack.includes(query.toLowerCase());
  }

  function render() {
    const query = searchInput.value.trim();
    const categoryId = categorySelect.value;
    const filtered = orgs.filter((org) => matches(org, query, categoryId));

    grid.innerHTML = "";
    if (filtered.length === 0) {
      grid.innerHTML = '<div class="empty-state">No organizations match yet. Try a different search or category.</div>';
      return;
    }
    filtered.forEach((org) => grid.appendChild(createCard(org, categories)));
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
