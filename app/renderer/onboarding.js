// First-run welcome screen and guided tour.
// The welcome shows once (then from Help → Welcome screen); the tour can be replayed from Help.

const Onboarding = (() => {
  const TOUR = [
    { target: "nav",     title: "Choose what you're making",
      text: "Images to shrink or convert, Videos to make smaller MP4s, or GIFs from a video clip." },
    { target: "source",  title: "Add your files",
      text: "Drag files or a whole folder anywhere onto the window, or click Browse… to pick them in Finder. Tick “Include files in subfolders” to grab everything inside." },
    { target: "presets", title: "Pick a preset",
      text: "Presets are ready-made settings. If you're not sure, the one marked Recommended is a safe bet." },
    { target: "adjust",  title: "Fine-tune (optional)",
      text: "Need an exact width, quality or format? Open this. Hover the little ? icons for an explanation of each setting." },
    { target: "files",   title: "Watch your files",
      text: "Everything you've added shows here. After processing, each file shows how much smaller it got." },
    { target: "start",   title: "Press Start",
      text: "New files go into an “Outputs” folder next to your originals, and the originals are never changed. When it's done, click Show in Finder." },
    { target: "help",    title: "Help is always here",
      text: "Tips, troubleshooting, and this tour live behind the ? button. That's everything, so go ahead and try it!" },
  ];

  let slide = 0;
  let step  = 0;
  const $ = (s) => document.querySelector(s);

  // ── Welcome slides ──────────────────────────────────────────────────────────

  function slides() {
    return [...document.querySelectorAll("#slides .slide")];
  }

  function renderSlide() {
    const all = slides();
    all.forEach((s, i) => s.classList.toggle("active", i === slide));
    $("#dots").innerHTML = all.map((_, i) => `<span class="${i === slide ? "on" : ""}"></span>`).join("");
    $("#welcome-back").hidden = slide === 0;
    const last = slide === all.length - 1;
    $("#welcome-next").textContent = last ? "Show me around" : "Next";
    $("#welcome-skip").textContent = last ? "I'll explore myself" : "Skip";
  }

  function showWelcome() {
    slide = 0;
    renderSlide();
    $("#welcome").hidden = false;
    $("#welcome-next").focus();
  }

  function closeWelcome() {
    $("#welcome").hidden = true;
    localStorage.setItem("welcomed", "1");
  }

  // ── Guided tour ─────────────────────────────────────────────────────────────

  function startTour() {
    step = 0;
    $("#tour").hidden = false;
    document.body.classList.add("touring");
    renderStep();
  }

  function endTour() {
    $("#tour").hidden = true;
    document.body.classList.remove("touring");
    localStorage.setItem("toured", "1");
  }

  function renderStep() {
    const s  = TOUR[step];
    const el = document.querySelector(`[data-tour="${s.target}"]`);
    if (!el) return next();

    el.scrollIntoView({ block: "nearest" });
    const r   = el.getBoundingClientRect();
    const pad = 8;
    const spot = $("#tour-spot");
    spot.style.left   = `${r.left - pad}px`;
    spot.style.top    = `${r.top - pad}px`;
    spot.style.width  = `${r.width + pad * 2}px`;
    spot.style.height = `${r.height + pad * 2}px`;
    spot.style.borderRadius = s.target === "help" ? "999px" : "16px";

    $("#tour-step").textContent  = `Step ${step + 1} of ${TOUR.length}`;
    $("#tour-title").textContent = s.title;
    $("#tour-text").textContent  = s.text;
    $("#tour-back").hidden = step === 0;
    $("#tour-next").textContent = step === TOUR.length - 1 ? "Got it" : "Next";

    placeCard(r);
    $("#tour-next").focus();
  }

  // Put the card beside the highlighted area, wherever there's room.
  function placeCard(r) {
    const card = $("#tour-card");
    const gap  = 18;
    const vw = window.innerWidth, vh = window.innerHeight;
    const cw = card.offsetWidth, ch = card.offsetHeight;
    const clampX = (x) => Math.max(16, Math.min(vw - cw - 16, x));
    const clampY = (y) => Math.max(16, Math.min(vh - ch - 16, y));

    let left, top, side;
    if (r.right + gap + cw < vw - 16)      { left = r.right + gap;      top = clampY(r.top); side = "left"; }
    else if (r.left - gap - cw > 16)       { left = r.left - gap - cw;  top = clampY(r.top); side = "right"; }
    else if (r.bottom + gap + ch < vh - 16){ left = clampX(r.left);     top = r.bottom + gap; side = "top"; }
    else                                   { left = clampX(r.left);     top = clampY(r.top - gap - ch); side = "bottom"; }

    card.style.left = `${left}px`;
    card.style.top  = `${top}px`;
    card.dataset.arrow = side;
  }

  function next() {
    if (step >= TOUR.length - 1) return endTour();
    step++;
    renderStep();
  }

  function back() {
    if (step === 0) return;
    step--;
    renderStep();
  }

  // ── Wiring ──────────────────────────────────────────────────────────────────

  function init() {
    $("#welcome-next").onclick = () => {
      if (slide < slides().length - 1) { slide++; renderSlide(); return; }
      closeWelcome();
      startTour();
    };
    $("#welcome-back").onclick = () => { slide = Math.max(0, slide - 1); renderSlide(); };
    $("#welcome-skip").onclick = closeWelcome;

    $("#tour-next").onclick = next;
    $("#tour-back").onclick = back;
    $("#tour-skip").onclick = endTour;

    document.addEventListener("keydown", (e) => {
      if (!$("#welcome").hidden) {
        if (e.key === "Escape") closeWelcome();
        if (e.key === "ArrowRight") $("#welcome-next").click();
        if (e.key === "ArrowLeft") $("#welcome-back").click();
      } else if (!$("#tour").hidden) {
        if (e.key === "Escape") endTour();
        if (e.key === "ArrowRight") next();
        if (e.key === "ArrowLeft") back();
      }
    });
    window.addEventListener("resize", () => { if (!$("#tour").hidden) renderStep(); });

    if (!localStorage.getItem("welcomed")) showWelcome();
  }

  return { init, showWelcome, startTour };
})();
