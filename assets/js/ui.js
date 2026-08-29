// Shared UI behaviour: preloader, scroll-reveal choreography, animated
// counters, and pointer-tilt. Everything degrades safely — if JS fails or
// motion is reduced, content is still fully visible and usable.

const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/* Preloader — hides once the page is ready, with a floor so the reveal
   reads as intentional rather than a flash. */
function initPreloader() {
  const pre = document.querySelector(".preloader");
  if (!pre) return;
  const start = performance.now();
  const MIN_MS = prefersReducedMotion ? 0 : 620;

  const finish = () => {
    const wait = Math.max(0, MIN_MS - (performance.now() - start));
    setTimeout(() => {
      pre.classList.add("done");
      document.body.classList.add("loaded");
      setTimeout(() => pre.remove(), 800);
    }, wait);
  };

  if (document.readyState === "complete") finish();
  else window.addEventListener("load", finish);
  // Safety net: never let a stalled asset trap the page behind the loader.
  setTimeout(finish, 4000);
}

/* Scroll reveal — staggers children of any [data-reveal] container. */
function initReveal() {
  const targets = document.querySelectorAll(".reveal");
  if (!targets.length) return;
  if (prefersReducedMotion || !("IntersectionObserver" in window)) {
    targets.forEach((el) => el.classList.add("in"));
    return;
  }
  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add("in");
        io.unobserve(entry.target);
      });
    },
    { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
  );
  targets.forEach((el) => io.observe(el));

  // Safety net: a decorative animation must never leave content permanently
  // hidden. Anything still un-revealed shortly after load gets shown outright.
  setTimeout(() => {
    document.querySelectorAll(".reveal:not(.in)").forEach((el) => el.classList.add("in"));
  }, 2200);
}

// Apply .reveal to a set of elements with an incremental transition delay.
function stagger(elements, step) {
  const gap = step || 70;
  Array.from(elements).forEach((el, i) => {
    el.classList.add("reveal");
    el.style.transitionDelay = `${Math.min(i * gap, 500)}ms`;
  });
}

/* Count-up for stat numbers. */
function countUp(el, target) {
  if (prefersReducedMotion || target === 0) { el.textContent = String(target); return; }
  const DURATION = 1100;
  const startTime = performance.now();
  function frame(now) {
    // Clamp at BOTH ends: a rAF timestamp can predate the performance.now()
    // captured just before scheduling it, which made progress go negative and
    // rendered a nonsense value (e.g. "-83") instead of counting up.
    const p = Math.min(1, Math.max(0, (now - startTime) / DURATION));
    // easeOutCubic
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = String(Math.round(target * eased));
    if (p < 1) requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
}

// Run the count only once the element scrolls into view.
function countUpOnView(el, target) {
  if (!("IntersectionObserver" in window)) { countUp(el, target); return; }
  let done = false;
  const run = () => {
    if (done) return;
    done = true;
    io.disconnect();
    countUp(el, target);
  };
  const io = new IntersectionObserver((entries) => {
    entries.forEach((entry) => { if (entry.isIntersecting) run(); });
  }, { threshold: 0.5 });
  io.observe(el);
  // Fallback: a stat showing a placeholder 0 is wrong data, not just a
  // missing flourish — make sure the real number lands either way.
  setTimeout(run, 2200);
}

/* Subtle pointer-tracked tilt. Skipped on touch and reduced-motion. */
function attachTilt(el, maxDeg) {
  if (prefersReducedMotion || window.matchMedia("(hover: none)").matches) return;
  const max = maxDeg || 7;
  let raf = null;

  el.addEventListener("pointermove", (e) => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = null;
      const r = el.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width - 0.5;
      const py = (e.clientY - r.top) / r.height - 0.5;
      el.style.setProperty("--tilt-x", `${(-py * max).toFixed(2)}deg`);
      el.style.setProperty("--tilt-y", `${(px * max).toFixed(2)}deg`);
      el.classList.add("tilting");
    });
  });

  el.addEventListener("pointerleave", () => {
    el.classList.remove("tilting");
    el.style.removeProperty("--tilt-x");
    el.style.removeProperty("--tilt-y");
  });
}

initPreloader();
document.addEventListener("DOMContentLoaded", () => {
  if (typeof hydrateIcons === "function") hydrateIcons();
  initReveal();
});
