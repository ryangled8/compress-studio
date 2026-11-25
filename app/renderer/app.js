// Compress Studio — UI logic. Talks to the main process through window.api (see preload.cjs).

const $  = (sel) => document.querySelector(sel);
const $$ = (sel) => [...document.querySelectorAll(sel)];

const store = {
  get: (k, fallback) => { try { return JSON.parse(localStorage.getItem(k)) ?? fallback; } catch { return fallback; } },
  set: (k, v) => localStorage.setItem(k, JSON.stringify(v)),
};

const state = {
  type: store.get("type", "img"),
  presets: null,
  preset: store.get("preset", { ...RECOMMENDED }),
  sources: { img: [], vid: [], gif: [] },
  adjust: { img: {}, vid: {}, gif: {} },
  subfolders: store.get("subfolders", false),
  files: [],
  rows: [],        // per-file status during/after a run
  running: false,
  view: "steps",   // "steps" | "results" | "history"
  total: 0,
  current: 0,
};

// ─── Formatting ───────────────────────────────────────────────────────────────

function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${Math.round(n / 1024)} KB`;
  if (n < 1024 ** 3) return `${(n / 1024 ** 2).toFixed(1)} MB`;
  return `${(n / 1024 ** 3).toFixed(2)} GB`;
}

function plural(n, [one, many]) {
  return `${n} ${n === 1 ? one : many}`;
}

function baseName(p) {
  return p.split("/").filter(Boolean).pop() ?? p;
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

// ─── Toasts ───────────────────────────────────────────────────────────────────

function toast(message, { kind = "info", action, timeout = 6000 } = {}) {
  const el = document.createElement("div");
  el.className = `toast ${kind}`;
  el.innerHTML = `
    <span data-icon="${kind === "error" ? "warn" : kind === "success" ? "check" : "bulb"}"></span>
    <p>${escapeHtml(message)}</p>
    ${action ? `<button class="inline-link">${escapeHtml(action.label)}</button>` : ""}
    <button class="icon-button" aria-label="Dismiss"><span data-icon="x"></span></button>`;
  hydrateIcons(el);
  const close = () => { el.classList.add("leaving"); setTimeout(() => el.remove(), 200); };
  el.querySelector(".icon-button").onclick = close;
  if (action) el.querySelector(".inline-link").onclick = () => { action.fn(); close(); };
  $("#toasts").append(el);
  if (timeout) setTimeout(close, timeout);
}

function showError(error) {
  if (error.kind === "permission") {
    toast(`${error.message} Click Allow when macOS asks, or turn access on in System Settings.`, {
      kind: "error",
      timeout: 0,
      action: { label: "Open settings", fn: () => window.api.openFilesPrivacy() },
    });
  } else {
    toast(error.message, { kind: "error", timeout: 9000 });
  }
}

// ─── Type (Images / Videos / GIFs) ────────────────────────────────────────────

function selectType(type) {
  if (state.running) return;
  state.type = type;
  store.set("type", type);
  const copy = TYPE_COPY[type];

  $("#dz-title").textContent   = copy.drop;

  const hintOff = store.get(`hint-off-${type}`, false);
  $("#tab-hint").hidden = hintOff;
  $("#tab-hint-text").textContent = copy.hint;

  showView("steps");
  renderPresets();
  renderFields();
  refreshFiles();
}

// ─── Views: steps / results / history ─────────────────────────────────────────

function showView(view) {
  state.view = view;
  $("#steps-view").hidden   = view !== "steps";
  $("#results-view").hidden = view !== "results";
  $("#history-view").hidden = view !== "history";
  $(".actionbar").hidden    = view !== "steps";

  $$(".nav-item").forEach((b) => b.classList.toggle("active",
    view === "history" ? b.dataset.view === "history" : b.dataset.type === state.type));

  const copy = TYPE_COPY[state.type];
  if (view === "history") {
    $("#page-title").textContent = "History";
    $("#page-sub").textContent   = "Your recent runs, newest first. Click one to see the full summary.";
    renderHistory();
  } else {
    $("#page-title").textContent = copy.title;
    $("#page-sub").textContent   = copy.sub;
  }
  $(".main-scroll").scrollTop = 0;
}

function renderHistory() {
  const runs = History.renderList($("#history-list"));
  $("#history-empty").hidden = runs.length > 0;
  $("#history-clear").hidden = runs.length === 0;
  $("#history-meta").textContent = runs.length ? `${plural(runs.length, ["run", "runs"])} saved on this Mac` : "";
  updateHistoryCount();
}

function updateHistoryCount() {
  const n = History.all().length;
  $("#history-count").textContent = n ? plural(n, ["recent run", "recent runs"]) : "Your recent runs";
}

// ─── Step 1: files ────────────────────────────────────────────────────────────

async function addSources(paths, { replace = false } = {}) {
  if (!paths.length) return;
  const current = replace ? [] : state.sources[state.type];
  state.sources[state.type] = [...new Set([...current, ...paths])];
  showView("steps");
  await refreshFiles({ announceSkipped: true });
}

async function refreshFiles({ announceSkipped = false } = {}) {
  const sources = state.sources[state.type];
  if (!sources.length) {
    state.files = [];
  } else {
    const res = await window.api.collect(state.type, sources, state.subfolders);
    if (res.error) {
      showError(res.error);
      state.files = [];
    } else {
      state.files = res.files;
      if (announceSkipped && res.skipped) {
        const [one, many] = TYPE_COPY[state.type].noun;
        toast(res.skipped === 1
          ? `Skipped 1 file that isn't ${/^[aeiou]/.test(one) ? "an" : "a"} ${one}.`
          : `Skipped ${res.skipped} files that aren't ${many}.`);
      }
      if (announceSkipped && !res.files.length) {
        toast(`No ${TYPE_COPY[state.type].noun[1]} found there.${state.subfolders ? "" : " Try ticking “Include files in subfolders”."}`);
      }
    }
  }
  state.rows = state.files.map(() => ({ status: "ready" }));
  renderSource();
  renderFiles();
  updateActionBar();
}

function renderSource() {
  const sources = state.sources[state.type];
  const has = sources.length > 0;
  $("#dz-empty").hidden  = has;
  $("#dz-filled").hidden = !has;
  $("#dropzone").classList.toggle("filled", has);
  if (!has) return;

  const total = state.files.reduce((s, f) => s + f.size, 0);
  const noun  = TYPE_COPY[state.type].noun;
  $("#source-name").textContent = History.sourceLabel(sources.map((p) => ({
    path: p,
    kind: state.files.some((f) => f.abs === p) ? "file" : "folder",
  })), 3) || `${sources.length} items`;
  $("#source-meta").textContent = `${plural(state.files.length, noun)} found · ${formatBytes(total)}`;
  $("#source-name").title = sources.join("\n");
}

// ─── Files panel ──────────────────────────────────────────────────────────────

const thumbObserver = new IntersectionObserver((entries) => {
  for (const entry of entries) {
    if (!entry.isIntersecting) continue;
    const el = entry.target;
    thumbObserver.unobserve(el);
    window.api.thumbnail(el.dataset.path).then((url) => {
      if (url) el.style.backgroundImage = `url("${url}")`;
      else el.classList.add("no-thumb");
    });
  }
}, { root: null, rootMargin: "200px" });

function renderFiles() {
  const list = $("#file-list");
  list.innerHTML = "";
  $("#files-empty").hidden = state.files.length > 0;
  $("#files-count").textContent = state.files.length ? plural(state.files.length, TYPE_COPY[state.type].noun) : "";

  const frag = document.createDocumentFragment();
  state.files.forEach((f, i) => {
    const li = document.createElement("li");
    li.className = "file";
    li.dataset.index = i;
    li.innerHTML = `
      <span class="thumb" data-path="${escapeHtml(f.abs)}"></span>
      <span class="file-main">
        <span class="file-name" title="${escapeHtml(f.rel)}">${escapeHtml(f.rel)}</span>
        <span class="file-sub"><span class="file-size">${formatBytes(f.size)}</span><span class="file-status"></span></span>
        <span class="file-bar"><span></span></span>
      </span>
      <span class="file-state"></span>`;
    frag.append(li);
  });
  list.append(frag);
  list.querySelectorAll(".thumb").forEach((t) => thumbObserver.observe(t));
}

function updateRow(i) {
  const li  = $(`#file-list .file[data-index="${i}"]`);
  const row = state.rows[i];
  if (!li || !row) return;
  li.className = `file ${row.status}`;
  const f = state.files[i];
  const status = li.querySelector(".file-status");
  const icon   = li.querySelector(".file-state");
  const bar    = li.querySelector(".file-bar span");

  if (row.status === "working") {
    status.textContent = row.progress != null ? ` · ${Math.round(row.progress * 100)}%` : " · working…";
    bar.style.width = `${Math.round((row.progress ?? 0) * 100)}%`;
    icon.innerHTML = iconSvg("spinner");
  } else if (row.status === "smaller" || row.status === "larger") {
    const pct = Math.round((1 - row.outSize / f.size) * 100);
    status.innerHTML = ` → ${formatBytes(row.outSize)} <b class="${pct > 0 ? "good" : "bad"}">${pct > 0 ? `${pct}% smaller` : `${-pct}% larger`}</b>`;
    icon.innerHTML = iconSvg(row.status === "smaller" ? "check" : "up");
    li.title = row.status === "larger"
      ? `${row.output}\nConverting or resizing made this bigger than the original. It's still saved.`
      : row.output;
  } else if (row.status === "kept") {
    const grew = Math.round((row.attemptedSize / f.size - 1) * 100);
    status.innerHTML = ` · <b class="kept">kept original</b>`;
    icon.innerHTML = iconSvg("keep");
    li.title = `Compressing would have made this ${grew}% bigger, so the original was copied in unchanged:\n${row.output}`;
  } else if (row.status === "gif") {
    status.innerHTML = ` → <b>${formatBytes(row.outSize)}</b> GIF`;
    icon.innerHTML = iconSvg("check");
    li.title = row.output;
  } else if (row.status === "error") {
    status.textContent = " · couldn't process";
    icon.innerHTML = iconSvg("warn");
    li.title = row.error.message;
  } else {
    status.textContent = "";
    icon.innerHTML = "";
  }
}

// ─── Step 2: presets ──────────────────────────────────────────────────────────

function renderPresets() {
  const type    = state.type;
  const presets = state.presets[type];
  if (!presets[state.preset[type]]) state.preset[type] = RECOMMENDED[type];

  const grid = $("#preset-grid");
  grid.innerHTML = "";
  for (const [key, p] of Object.entries(presets)) {
    const { title, desc } = presetCopy(type, key, p);
    const card = document.createElement("button");
    card.className = "preset";
    card.setAttribute("role", "radio");
    card.dataset.key = key;
    const badges = [
      key === RECOMMENDED[type] ? `<span class="badge rec">Recommended</span>` : "",
      p.slowEncoder ? `<span class="badge slow">Slower</span>` : "",
    ].join("");
    card.innerHTML = `
      <span class="preset-top"><b>${escapeHtml(title)}</b>${badges}</span>
      <span class="preset-desc">${escapeHtml(desc)}</span>
      <span class="preset-specs">${presetSpecs(type, p).map(escapeHtml).join(" · ")}</span>
      <span class="preset-check" data-icon="check"></span>`;
    card.onclick = () => selectPreset(key);
    grid.append(card);
  }
  hydrateIcons(grid);
  markSelectedPreset();
}

function selectPreset(key) {
  if (state.running) return;
  state.preset[state.type] = key;
  store.set("preset", state.preset);
  markSelectedPreset();
  renderFields();
  updateActionBar();
}

function markSelectedPreset() {
  const key = state.preset[state.type];
  $$(".preset").forEach((c) => {
    const on = c.dataset.key === key;
    c.classList.toggle("selected", on);
    c.setAttribute("aria-checked", on);
  });
}

function currentPreset() {
  return state.presets[state.type][state.preset[state.type]];
}

// ─── Step 3: optional adjustments ─────────────────────────────────────────────

function fieldDefs() {
  const p = currentPreset();
  const widthPlaceholder = p.keepOriginalDimensions ? "Original" : p.widthFactor != null ? `${Math.round(p.widthFactor * 100)}%` : String(p.width);
  const width = {
    key: "width", label: "Width", unit: "px", type: "number", min: 1, max: 8000,
    placeholder: widthPlaceholder,
    help: "Exact width in pixels. Height adjusts automatically to keep the shape.",
  };

  if (state.type === "img") {
    return [
      width,
      { key: "quality", label: "Quality", type: "range", min: 1, max: 100, value: p.quality,
        help: "Lower = smaller file. 75–85 looks great for most photos. PNG ignores this." },
      { key: "format", label: "Format", type: "select",
        options: [["", `Preset default (${p.format ? FORMAT_NAMES[p.format] : "same as original"})`], ["jpg", "JPEG"], ["png", "PNG"], ["webp", "WebP"], ["avif", "AVIF"]],
        help: "WebP and AVIF are smallest. JPEG works everywhere. PNG is lossless (bigger)." },
    ];
  }
  if (state.type === "vid") return [width];
  return [
    width,
    { key: "fps", label: "Frame rate", unit: "fps", type: "number", min: 1, max: 60, placeholder: String(p.fps),
      help: "Frames per second. Fewer frames = smaller GIF but choppier motion. 10–15 is typical." },
  ];
}

function renderFields() {
  const wrap   = $("#fields");
  const values = state.adjust[state.type];
  wrap.innerHTML = "";

  for (const def of fieldDefs()) {
    const field = document.createElement("label");
    field.className = "field";
    const v = values[def.key] ?? "";
    let control;
    if (def.type === "select") {
      control = `<select data-key="${def.key}">${def.options.map(([val, text]) =>
        `<option value="${val}" ${val === v ? "selected" : ""}>${escapeHtml(text)}</option>`).join("")}</select>`;
    } else if (def.type === "range") {
      const val = v === "" ? def.value : v;
      control = `<span class="range"><input type="range" data-key="${def.key}" min="${def.min}" max="${def.max}" value="${val}" />
                 <output>${val}</output></span>`;
    } else {
      control = `<span class="input-unit"><input type="number" inputmode="numeric" data-key="${def.key}" min="${def.min}" max="${def.max}"
                 placeholder="${escapeHtml(def.placeholder)}" value="${escapeHtml(v)}" />${def.unit ? `<em>${def.unit}</em>` : ""}</span>`;
    }
    field.innerHTML = `<span class="field-label">${def.label}<span class="tip" tabindex="0" data-tip="${escapeHtml(def.help)}" data-icon="help"></span></span>${control}`;
    wrap.append(field);
  }
  hydrateIcons(wrap);

  wrap.querySelectorAll("[data-key]").forEach((input) => {
    input.addEventListener("input", () => {
      const key = input.dataset.key;
      if (input.type === "range") {
        input.nextElementSibling.textContent = input.value;
        // Only treat quality as an override once it differs from the preset.
        state.adjust[state.type][key] = Number(input.value) === currentPreset().quality ? "" : input.value;
      } else {
        state.adjust[state.type][key] = input.value.trim();
      }
      updateAdjustSummary();
      updateActionBar();
    });
  });
  updateAdjustSummary();
}

function activeAdjustments() {
  return Object.fromEntries(Object.entries(state.adjust[state.type]).filter(([, v]) => v !== "" && v != null));
}

function updateAdjustSummary() {
  const a = activeAdjustments();
  const parts = [];
  if (a.width)   parts.push(`${a.width}px wide`);
  if (a.quality) parts.push(`quality ${a.quality}`);
  if (a.format)  parts.push(FORMAT_NAMES[a.format === "jpg" ? "jpeg" : a.format]);
  if (a.fps)     parts.push(`${a.fps} fps`);
  $("#adjust-summary").textContent = parts.length ? `Custom: ${parts.join(" · ")}` : "Using the preset's settings.";
  $("#adjust").classList.toggle("custom", parts.length > 0);
  $("#reset-adjust").hidden = parts.length === 0;
}

function validateAdjustments() {
  const a = activeAdjustments();
  const checks = [
    ["width",   1, 8000, "Width must be a whole number between 1 and 8000."],
    ["quality", 1, 100,  "Quality must be between 1 and 100."],
    ["fps",     1, 60,   "Frame rate must be between 1 and 60."],
  ];
  for (const [key, min, max, msg] of checks) {
    if (a[key] == null) continue;
    const n = Number(a[key]);
    if (!Number.isInteger(n) || n < min || n > max) return msg;
  }
  return null;
}

// ─── Action bar ───────────────────────────────────────────────────────────────

function updateActionBar() {
  const n     = state.files.length;
  const total = state.files.reduce((s, f) => s + f.size, 0);
  const key   = state.preset[state.type];
  const { title } = presetCopy(state.type, key, currentPreset());

  if (!state.running) {
    $("#action-meta").innerHTML = n
      ? `<b>${plural(n, TYPE_COPY[state.type].noun)}</b> · ${formatBytes(total)}<br><span class="muted">Saves to <code>Outputs ${state.type}-${escapeHtml(key)}</code> next to the originals</span>`
      : `<span class="muted">Add some files to get started.</span>`;
    $("#start-label").textContent = n ? `Start · ${title}` : "Start";
  }
  $("#start-btn").disabled = state.running || n === 0;

  // Preset warnings: slow encoder and big batches.
  const notes = [];
  const p = currentPreset();
  if (p.slowEncoder) notes.push("This preset takes 3–4× longer than the others, for a slightly smaller file.");
  const mb = total / 1024 ** 2;
  if (state.type !== "img" && mb >= 300) {
    const minsPerGB = p.slowEncoder ? 8 : p.codec === "libx265" ? 4 : 2;
    const lo = Math.max(1, Math.round((mb / 1000) * minsPerGB));
    notes.push(`That's ${formatBytes(total)} of video, so expect roughly ${lo < 2 ? "a few minutes" : `${lo}–${lo * 2} minutes`}. You can leave it running.`);
  }
  $("#preset-note").hidden = notes.length === 0;
  $("#preset-note").innerHTML = notes.length ? `<span data-icon="clock"></span><p>${notes.map(escapeHtml).join(" ")}</p>` : "";
  hydrateIcons($("#preset-note"));
}

// ─── Running ──────────────────────────────────────────────────────────────────

async function start() {
  if (!state.files.length || state.running) return;

  const invalid = validateAdjustments();
  if (invalid) {
    $("#adjust").open = true;
    toast(invalid, { kind: "error" });
    return;
  }

  // Set up the UI before starting: the first progress events can arrive
  // before api.start() resolves.
  state.running = true;
  state.total   = state.files.length;
  state.current = 0;
  state.rows    = state.files.map(() => ({ status: "queued" }));
  state.files.forEach((_, i) => updateRow(i));

  const res = await window.api.start(state.type, state.preset[state.type], state.files, activeAdjustments());
  if (res.error) {
    state.running = false;
    state.rows = state.files.map(() => ({ status: "ready" }));
    state.files.forEach((_, i) => updateRow(i));
    return showError(res.error);
  }

  document.body.classList.add("is-running");
  $("#progress").hidden   = false;
  $("#cancel-btn").hidden = false;
  $("#action-meta").hidden = true;
  updateActionBar();
  updateOverall();
}

function updateOverall() {
  const i   = state.current;
  const row = state.rows[i];
  const frac = (i + (row?.progress ?? 0)) / Math.max(1, state.total);
  $("#progress-fill").style.width = `${Math.round(frac * 100)}%`;
  const name = state.files[i]?.rel ?? "";
  $("#progress-label").innerHTML = `Processing <b>${Math.min(i + 1, state.total)} of ${state.total}</b> <span class="muted">· ${escapeHtml(name)}</span>`;
}

function onJobEvent(ev) {
  if (ev.kind === "start") {
    state.current = ev.index;
    state.rows[ev.index] = { status: "working" };
    updateRow(ev.index);
    $(`#file-list .file[data-index="${ev.index}"]`)?.scrollIntoView({ block: "nearest", behavior: "smooth" });
  } else if (ev.kind === "progress") {
    state.rows[ev.index].progress = ev.progress;
    updateRow(ev.index);
  } else if (ev.kind === "done") {
    state.rows[ev.index] = { status: ev.outcome, outSize: ev.outSize, output: ev.output, attemptedSize: ev.attemptedSize };
    updateRow(ev.index);
  } else if (ev.kind === "error") {
    state.rows[ev.index] = { status: "error", error: ev.error };
    updateRow(ev.index);
    if (ev.error.kind === "permission") showError(ev.error);
  } else if (ev.kind === "finished") {
    finish(ev);
    return;
  }
  updateOverall();
}

function finish({ cancelled, results, folders }) {
  state.running = false;
  document.body.classList.remove("is-running");
  $("#progress").hidden    = true;
  $("#cancel-btn").hidden  = true;
  $("#action-meta").hidden = false;
  state.rows.forEach((r, i) => { if (r.status === "queued") { r.status = "ready"; updateRow(i); } });
  updateActionBar();

  const key = state.preset[state.type];
  const custom = $("#adjust-summary").textContent;
  const run = History.build({
    type: state.type,
    presetKey: key,
    presetTitle: presetCopy(state.type, key, currentPreset()).title,
    adjustments: custom.startsWith("Custom") ? custom : "",
    sources: state.sources[state.type],
    files: state.files,
    rows: state.rows,
    results,
    folders,
    cancelled,
  });
  History.add(run);
  updateHistoryCount();

  $("#results-summary").innerHTML = History.renderRun(run);
  History.hydrate($("#results-summary"));
  $("#results-reveal").hidden = folders.length === 0;
  $("#results-reveal").onclick = () => folders.forEach((f) => window.api.reveal(f));
  showView("results");
}

// ─── Drag & drop ──────────────────────────────────────────────────────────────

function setupDragAndDrop() {
  let depth = 0;
  const overlay = $("#drop-overlay");
  const hasFiles = (e) => [...(e.dataTransfer?.types ?? [])].includes("Files");

  window.addEventListener("dragenter", (e) => {
    if (!hasFiles(e) || state.running) return;
    e.preventDefault();
    depth++;
    overlay.hidden = false;
  });
  window.addEventListener("dragover", (e) => { if (hasFiles(e)) e.preventDefault(); });
  window.addEventListener("dragleave", () => {
    depth = Math.max(0, depth - 1);
    if (depth === 0) overlay.hidden = true;
  });
  window.addEventListener("drop", (e) => {
    e.preventDefault();
    depth = 0;
    overlay.hidden = true;
    if (state.running) return;
    const paths = [...e.dataTransfer.files].map((f) => window.api.pathForFile(f)).filter(Boolean);
    addSources(paths);
  });
}

// ─── Help panel ───────────────────────────────────────────────────────────────

function toggleHelp(open = $("#help-panel").hidden) {
  $("#help-panel").hidden = !open;
  $("#help-fab").setAttribute("aria-expanded", open);
  $("#help-fab").classList.toggle("open", open);
}

// ─── Wiring ───────────────────────────────────────────────────────────────────

async function init() {
  hydrateIcons();
  state.presets = await window.api.presets();
  const info = await window.api.info();
  $("#help-version").textContent = `Compress Studio ${info.version}`;
  History.setHome(info.home);
  if (!info.ffmpegReady) {
    toast("Video tools didn't start properly. Try reinstalling the app; images will still work.", { kind: "error", timeout: 0 });
  }

  $("#subfolders").checked = state.subfolders;
  $("#subfolders").onchange = (e) => {
    state.subfolders = e.target.checked;
    store.set("subfolders", state.subfolders);
    refreshFiles({ announceSkipped: true });
  };

  $$(".nav-item[data-type]").forEach((b) => (b.onclick = () => selectType(b.dataset.type)));

  const choose = async (replace) => addSources(await window.api.choose(state.type), { replace });
  $("#choose-btn").onclick = (e) => { e.stopPropagation(); choose(false); };
  $("#add-btn").onclick    = () => choose(false);
  $("#change-btn").onclick = () => choose(true);
  $("#dropzone").onclick = (e) => { if (!state.sources[state.type].length && e.target === e.currentTarget) choose(false); };
  $("#dropzone").onkeydown = (e) => { if ((e.key === "Enter" || e.key === " ") && !state.sources[state.type].length) choose(false); };
  $("#clear-btn").onclick = () => { state.sources[state.type] = []; refreshFiles(); };

  $("#reset-adjust").onclick = () => { state.adjust[state.type] = {}; renderFields(); updateActionBar(); };

  $("#start-btn").onclick  = start;
  $("#cancel-btn").onclick = () => window.api.cancel();
  $("#results-adjust").onclick  = () => showView("steps");
  $("#results-new").onclick     = () => { state.sources[state.type] = []; refreshFiles(); showView("steps"); };
  $("#results-history").onclick = () => showView("history");

  // "Show in Finder" links in summaries (results screen and History).
  document.addEventListener("click", async (e) => {
    const link = e.target.closest("[data-reveal]");
    if (!link) return;
    e.preventDefault();
    const [found] = await window.api.existing([link.dataset.reveal]);
    if (found) window.api.reveal(found);
    else toast("That folder or file has been moved or deleted.", { kind: "error" });
  });

  $("#nav-history").onclick = () => { if (!state.running) showView("history"); };
  $("#history-clear").onclick = () => {
    if (!confirm("Clear all history? Your files and Outputs folders aren't affected.")) return;
    History.clear();
    renderHistory();
  };
  $("#history-list").addEventListener("click", async (e) => {
    const btn = e.target.closest("[data-action]");
    if (!btn) return;
    const id  = Number(btn.closest(".history-item").dataset.id);
    const run = History.all().find((r) => r.id === id);
    if (!run) return;
    if (btn.dataset.action === "remove") {
      History.remove(id);
      renderHistory();
    } else if (btn.dataset.action === "reveal") {
      const existing = await window.api.existing(run.folders);
      if (!existing.length) return toast("That Outputs folder has been moved or deleted.", { kind: "error" });
      existing.forEach((f) => window.api.reveal(f));
    }
  });

  $("#tab-hint-close").onclick = () => { store.set(`hint-off-${state.type}`, true); $("#tab-hint").hidden = true; };

  $("#help-fab").onclick       = () => toggleHelp();
  $("#open-help-side").onclick = () => toggleHelp(true);
  $("#help-close").onclick     = () => toggleHelp(false);
  $("#help-privacy").onclick   = () => window.api.openFilesPrivacy();
  $("#help-tour").onclick      = () => { toggleHelp(false); Onboarding.startTour(); };
  $("#help-welcome").onclick   = () => { toggleHelp(false); Onboarding.showWelcome(); };
  document.addEventListener("mousedown", (e) => {
    if (!$("#help-panel").hidden && !e.target.closest("#help-panel, #help-fab, #open-help-side")) toggleHelp(false);
  });
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && !$("#help-panel").hidden) toggleHelp(false);
    if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) start();
  });

  window.api.onJobEvent(onJobEvent);
  setupDragAndDrop();
  selectType(state.type);
  updateHistoryCount();
  Onboarding.init();
}

init();
