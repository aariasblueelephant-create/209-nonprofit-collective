const APPLY_EMAIL = "contact@aariasblueelephant.org";

(async function initApply() {
  document.getElementById("apply-email").textContent = APPLY_EMAIL;
  document.getElementById("apply-email").href = `mailto:${APPLY_EMAIL}`;

  const categorySelect = document.getElementById("apply-category");
  const categoryOtherField = document.getElementById("apply-category-other-field");
  const categoryOtherInput = document.getElementById("apply-category-other");
  try {
    const categories = await loadCategories();
    categories.forEach((c) => {
      const opt = document.createElement("option");
      opt.value = c.label;
      opt.textContent = c.label;
      categorySelect.appendChild(opt);
    });
  } catch (err) {
    console.error(err);
  }

  categorySelect.addEventListener("change", () => {
    categoryOtherField.hidden = categorySelect.value !== "Other";
  });

  const form = document.getElementById("apply-form");
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(form).entries());

    const category = data.category === "Other" && data.categoryOther
      ? `Other — ${data.categoryOther}`
      : data.category || "";

    const subject = `209 Nonprofit Collective Application — ${data.orgName || "New Organization"}`;
    const bodyLines = [
      `Organization name: ${data.orgName || ""}`,
      `Contact name: ${data.contactName || ""}`,
      `Contact email: ${data.contactEmail || ""}`,
      `Contact phone: ${data.contactPhone || ""}`,
      `Website: ${data.website || ""}`,
      `501(c)(3) / fiscal sponsorship status: ${data.status501c3 || ""}`,
      `Physical address: ${data.physicalAddress || ""}`,
      `ZIP code: ${data.zip || ""}`,
      `Category: ${category}`,
      ``,
      `Mission / what you do:`,
      `${data.mission || ""}`,
      ``,
      `Why you want to join the 209 Nonprofit Collective:`,
      `${data.reason || ""}`,
    ];
    const body = bodyLines.join("\n");

    const mailto = `mailto:${APPLY_EMAIL}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
    window.location.href = mailto;
  });
})();
