// Run summaries and the History page.
// A "run" is one press of Start. It's summarised on the results screen and kept
// (most recent first) in localStorage, so History survives quitting the app.

const History = (() => {
  const KEY = "history";
  const MAX_RUNS  = 50;
  const MAX_NAMES = 200; // per list, to keep storage small for huge batches

  const TYPE_LABEL = { img: "Images", vid: "Videos", gif: "GIFs" };
  const TYPE_ICON  = { img: "image", vid: "video", gif: "gif" };

  function all() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? []; } catch { return []; }
  }

  function save(runs) {
    localStorage.setItem(KEY, JSON.stringify(runs.slice(0, MAX_RUNS)));
  }

  function add(run) {
    save([run, ...all()]);
  }

  function remove(id) {
    save(all().filter((r) => r.id !== id));
  }

  function clear() {
    localStorage.removeItem(KEY);
  }

  // ── Building a run record from the finished batch ───────────────────────────

  function build({ type, presetKey, presetTitle, adjustments, sources, files, rows, results, folders, cancelled }) {
    const pick = (status, map) => rows
      .map((r, i) => (r.status === status ? map(r, files[i]) : null))
      .filter(Boolean)
      .slice(0, MAX_NAMES);

    const growth = (bigger, smaller) => Math.round((bigger / smaller - 1) * 100);
    const smaller = rows
      .map((r, i) => (r.status === "smaller" ? { rel: files[i].rel, pct: Math.round((1 - r.outSize / files[i].size) * 100) } : null))
      .filter(Boolean);

    return {
      id: Date.now(),
      at: Date.now(),
      type,
      preset: presetKey,
      presetTitle,
      adjustments,
      source: sources.length === 1 ? baseName(sources[0]) : `${sources.length} items`,
      total: files.length,
      cancelled,
      results,
      folders,
      best: smaller.sort((a, b) => b.pct - a.pct)[0] ?? null,
      kept:   pick("kept",   (r, f) => ({ rel: f.rel, pct: growth(r.attemptedSize, f.size), saved: baseName(r.output) })),
      larger: pick("larger", (r, f) => ({ rel: f.rel, pct: growth(r.outSize, f.size) })),
      failed: pick("error",  (r, f) => ({ rel: f.rel, message: r.error.message })),
    };
  }

  // ── Formatting ──────────────────────────────────────────────────────────────

  function duration(ms) {
    if (ms < 10000) return `${Math.max(0.1, ms / 1000).toFixed(1)}s`;
    const s = Math.round(ms / 1000);
    if (s < 60) return `${s}s`;
    const m = Math.floor(s / 60);
    if (m < 60) return `${m}m ${s % 60}s`;
    return `${Math.floor(m / 60)}h ${m % 60}m`;
  }

  function when(ts) {
    const d = new Date(ts);
    const time = d.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
    const today = new Date();
    const yesterday = new Date(Date.now() - 864e5);
    if (d.toDateString() === today.toDateString()) return `Today, ${time}`;
    if (d.toDateString() === yesterday.toDateString()) return `Yesterday, ${time}`;
    return `${d.toLocaleDateString([], { day: "numeric", month: "short" })}, ${time}`;
  }

  function nouns(type) {
    return TYPE_COPY[type].outNoun ?? TYPE_COPY[type].noun;
  }

  function savedCount(r) {
    return r.smaller + r.kept + r.larger + r.gif;
  }

  function headline(run) {
    const r = run.results;
    const n = savedCount(r);
    const noun = nouns(run.type);
    if (run.cancelled) return n ? `Stopped after ${n} of ${run.total}` : "Stopped before anything was saved";
    if (r.failed && !n) return "Nothing could be processed";
    if (r.failed) return `${plural(n, noun)} saved, ${r.failed} couldn't be processed`;
    return `All done: ${plural(n, noun)} saved`;
  }

  function savingLine(run) {
    const r = run.results;
    if (!r.inBytes || run.type === "gif") return "";
    const pct = Math.round((1 - r.outBytes / r.inBytes) * 100);
    return pct >= 0 ? `${pct}% smaller` : `${-pct}% larger`;
  }

  // ── Rendering ───────────────────────────────────────────────────────────────

  function fileList(items, render) {
    return `<details class="bd-files"><summary>Show ${items.length === 1 ? "file" : `${items.length} files`}</summary>
      <ul>${items.map((it) => `<li>${render(it)}</li>`).join("")}</ul></details>`;
  }

  // Full summary: headline, before/after stats and a breakdown of what happened.
  function renderRun(run) {
    const r = run.results;
    const isGif = run.type === "gif";
    const n = savedCount(r);
    const kind = run.cancelled || r.failed ? "warn" : "check";
    const pct = r.inBytes ? Math.round((1 - r.outBytes / r.inBytes) * 100) : 0;
    const afterWidth = r.inBytes ? Math.max(2, Math.min(100, Math.round((r.outBytes / r.inBytes) * 100))) : 0;
    const meta = [
      TYPE_LABEL[run.type],
      `${escapeHtml(run.presetTitle)} preset`,
      run.adjustments ? escapeHtml(run.adjustments) : "",
      escapeHtml(run.source),
      when(run.at),
    ].filter(Boolean).join(" · ");

    const stats = isGif
      ? [
          ["Source videos", formatBytes(r.inBytes), plural(run.total, ["file", "files"])],
          ["GIFs", formatBytes(r.outBytes), n ? `${formatBytes(r.outBytes / n)} on average` : ""],
          ["Time", duration(r.durationMs), n ? `${duration(r.durationMs / n)} per file` : ""],
        ]
      : [
          ["Before", formatBytes(r.inBytes), plural(n, nouns(run.type))],
          ["After", formatBytes(r.outBytes), ""],
          pct >= 0
            ? ["Saved", formatBytes(r.inBytes - r.outBytes), `${pct}% smaller`, "good"]
            : ["Size change", `+${formatBytes(r.outBytes - r.inBytes)}`, `${-pct}% larger`, "bad"],
          ["Time", duration(r.durationMs), n ? `${duration(r.durationMs / n)} per file` : ""],
        ];

    const rows = [];
    if (isGif && r.gif) {
      rows.push(["ok", "check", `${plural(r.gif, ["GIF", "GIFs"])} made`, `Saved in ${run.folders.map(baseName).map(escapeHtml).join(", ")}.`]);
    }
    if (r.smaller) {
      const best = run.best ? ` Biggest saving: ${escapeHtml(run.best.rel)} (${run.best.pct}% smaller).` : "";
      rows.push(["ok", "check", `${r.smaller} compressed`, `Every one of these is smaller than its original.${best}`]);
    }
    if (r.kept) {
      rows.push(["kept", "keep", `${r.kept} kept as original${r.kept === 1 ? "" : "s"}`,
        `Compressing would have made ${r.kept === 1 ? "this file" : "these files"} bigger, so the original was copied into Outputs unchanged, with “-original” added to the name.`
        + fileList(run.kept, (k) => `${escapeHtml(k.rel)} <span class="muted">→ ${escapeHtml(k.saved)} · would have been ${k.pct}% bigger</span>`)]);
    }
    if (r.larger) {
      rows.push(["larger", "up", `${r.larger} came out larger`,
        `Converting or resizing made ${r.larger === 1 ? "this file" : "these files"} bigger than the original. ${r.larger === 1 ? "It's" : "They're"} still saved, since the original isn't in the format or size you asked for.`
        + fileList(run.larger, (k) => `${escapeHtml(k.rel)} <span class="muted">· ${k.pct}% larger</span>`)]);
    }
    if (r.failed) {
      rows.push(["failed", "warn", `${r.failed} couldn't be processed`,
        "The file may be damaged, still downloading, or a format the app can't read. Everything else carried on as normal."
        + fileList(run.failed, (k) => `${escapeHtml(k.rel)} <span class="muted">· ${escapeHtml(k.message)}</span>`)]);
    }
    if (run.cancelled && run.total > n + r.failed) {
      rows.push(["skipped", "x", `${run.total - n - r.failed} not processed`, "You cancelled before these were reached."]);
    }

    return `
      <article class="run">
        <header class="run-head">
          <span class="run-icon ${kind}" data-icon="${kind}"></span>
          <div>
            <h2>${headline(run)}</h2>
            <p class="muted">${meta}</p>
          </div>
        </header>
        <div class="stats">${stats.map(([label, value, sub, tone]) => `
          <div class="stat ${tone ?? ""}"><span>${label}</span><b>${value}</b>${sub ? `<small>${sub}</small>` : ""}</div>`).join("")}
        </div>
        ${!isGif && r.inBytes ? `
        <div class="compare" aria-hidden="true">
          <div class="compare-row"><span>Before</span><div class="compare-track"><div class="compare-before"></div></div></div>
          <div class="compare-row"><span>After</span><div class="compare-track"><div class="compare-after" data-width="${afterWidth}"></div></div></div>
        </div>` : ""}
        <ul class="breakdown">${rows.map(([tone, icon, title, body]) => `
          <li class="${tone}"><span class="bd-icon" data-icon="${icon}"></span><div><b>${title}</b><div class="bd-text">${body}</div></div></li>`).join("")}
        </ul>
      </article>`;
  }

  // Compact list on the History page; each entry expands to the full summary.
  function renderList(container) {
    const runs = all();
    container.innerHTML = runs.map((run) => {
      const r = run.results;
      const n = savedCount(r);
      const saving = savingLine(run);
      const flags = [
        r.kept   ? `<span class="badge kept">${r.kept} kept original${r.kept === 1 ? "" : "s"}</span>` : "",
        r.larger ? `<span class="badge slow">${r.larger} larger</span>` : "",
        r.failed ? `<span class="badge bad">${r.failed} failed</span>` : "",
        run.cancelled ? `<span class="badge">Cancelled</span>` : "",
      ].join("");
      return `
        <li>
          <details class="history-item" data-id="${run.id}">
            <summary>
              <span class="nav-icon" data-icon="${TYPE_ICON[run.type]}"></span>
              <span class="hi-main">
                <b>${escapeHtml(run.presetTitle)} · ${plural(n, nouns(run.type))}</b>
                <small class="muted">${when(run.at)} · ${escapeHtml(run.source)}</small>
              </span>
              <span class="hi-flags">${flags}</span>
              <span class="hi-size">
                ${run.type === "gif" ? `<b>${formatBytes(r.outBytes)}</b><small class="muted">of GIFs</small>`
                  : `<b>${formatBytes(r.inBytes)} → ${formatBytes(r.outBytes)}</b><small class="${saving.endsWith("smaller") ? "good" : "muted"}">${saving}</small>`}
              </span>
              <span class="adjust-chevron" data-icon="chevron"></span>
            </summary>
            <div class="history-body">
              ${renderRun(run)}
              <div class="history-actions">
                <button class="button primary" data-action="reveal"><span data-icon="folder"></span> Show in Finder</button>
                <button class="inline-link" data-action="remove">Remove from history</button>
              </div>
            </div>
          </details>
        </li>`;
    }).join("");
    hydrate(container);
    return runs;
  }

  // Call after inserting renderRun/renderList HTML. Inline style attributes are
  // blocked by the page's Content Security Policy, so widths are set here.
  function hydrate(container) {
    container.querySelectorAll("[data-width]").forEach((el) => (el.style.width = `${el.dataset.width}%`));
    hydrateIcons(container);
  }

  return { all, add, remove, clear, build, renderRun, renderList, hydrate };
})();
