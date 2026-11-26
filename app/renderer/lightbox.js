// Full-size preview of files in the Files list.
// Double-click a file to open; ← → to browse; Esc, ✕ or a click outside to close.
// Images and videos load through the app's private preview:// protocol; formats
// the window can't show (e.g. TIFF, some videos) fall back to a Quick Look image.

const Lightbox = (() => {
  const $ = (s) => document.querySelector(s);
  let ctx = null;      // { getFiles, getRows, getType, onIndexChange }
  let index = -1;
  let token = 0;       // ignores late loads after the user has moved on
  let lastFocus = null;

  function isOpen() {
    return !$("#lightbox").hidden;
  }

  function open(i) {
    if (!ctx.getFiles().length) return;
    lastFocus = document.activeElement;
    $("#lightbox").hidden = false;
    document.body.classList.add("previewing");
    show(i);
    $("#lb-close").focus();
  }

  function close() {
    if (!isOpen()) return;
    $("#lb-media").innerHTML = ""; // stops any playing video
    $("#lightbox").hidden = true;
    document.body.classList.remove("previewing");
    ctx.onIndexChange(-1);
    index = -1;
    lastFocus?.focus?.();
  }

  function step(delta) {
    const next = index + delta;
    if (next >= 0 && next < ctx.getFiles().length) show(next);
  }

  function resultText(row, file) {
    if (!row) return "";
    if (row.status === "smaller" || row.status === "larger") {
      const pct = Math.round((1 - row.outSize / file.size) * 100);
      return `→ ${formatBytes(row.outSize)} (${pct > 0 ? `${pct}% smaller` : `${-pct}% larger`})`;
    }
    if (row.status === "kept") return "kept original";
    if (row.status === "gif") return `→ ${formatBytes(row.outSize)} GIF`;
    if (row.status === "error") return "couldn't process";
    return "";
  }

  function setMeta(file, row, extra = []) {
    const parts = [...extra, formatBytes(file.size), resultText(row, file)].filter(Boolean);
    $("#lb-meta").textContent = parts.join(" · ");
  }

  function message(text) {
    const el = document.createElement("div");
    el.className = "lb-message";
    el.textContent = text;
    return el;
  }

  // Quick Look fallback for anything the window can't decode itself.
  async function fallback(file, mine, note) {
    const url = await window.api.thumbnail(file.abs, 2000);
    if (mine !== token) return;
    const media = $("#lb-media");
    media.innerHTML = "";
    if (url) {
      const img = new Image();
      img.src = url;
      img.alt = file.rel;
      media.append(img);
    }
    media.append(message(url ? note : "This file can't be previewed, but it can still be compressed."));
  }

  function show(i) {
    const files = ctx.getFiles();
    const file  = files[i];
    if (!file) return;
    index = i;
    const mine = ++token;
    const row  = ctx.getRows()[i];
    const isVideo = ctx.getType() !== "img";

    $("#lb-name").textContent  = file.rel;
    $("#lb-name").title        = file.abs;
    $("#lb-count").textContent = `${i + 1} of ${files.length}`;
    $("#lb-prev").disabled = i === 0;
    $("#lb-next").disabled = i === files.length - 1;
    setMeta(file, row);
    ctx.onIndexChange(i);

    const media = $("#lb-media");
    media.innerHTML = "";
    media.classList.add("loading");
    const src = window.api.previewUrl(file.abs);

    if (isVideo) {
      const video = document.createElement("video");
      Object.assign(video, { src, controls: true, autoplay: true, muted: true, playsInline: true, loop: true });
      video.addEventListener("loadedmetadata", () => {
        if (mine !== token) return;
        media.classList.remove("loading");
        const secs = Math.round(video.duration);
        const dur = secs >= 60 ? `${Math.floor(secs / 60)}m ${secs % 60}s` : `${secs}s`;
        setMeta(file, row, [`${video.videoWidth} × ${video.videoHeight}`, dur]);
      });
      video.addEventListener("error", () => {
        if (mine !== token) return;
        media.classList.remove("loading");
        fallback(file, mine, "This video format can't play here, but it can still be compressed.");
      });
      media.append(video);
    } else {
      const img = new Image();
      img.alt = file.rel;
      img.decoding = "async";
      img.onload = () => {
        if (mine !== token) return;
        media.classList.remove("loading");
        setMeta(file, row, [`${img.naturalWidth} × ${img.naturalHeight}`]);
      };
      img.onerror = () => {
        if (mine !== token) return;
        media.classList.remove("loading");
        fallback(file, mine, "Showing a Quick Look preview of this format.");
      };
      img.src = src;
      media.append(img);

      // Warm up the neighbours so arrowing through feels instant.
      [files[i - 1], files[i + 1]].filter(Boolean).forEach((f) => { new Image().src = window.api.previewUrl(f.abs); });
    }
  }

  function init(context) {
    ctx = context;
    $("#lb-close").onclick = close;
    $("#lb-prev").onclick  = () => step(-1);
    $("#lb-next").onclick  = () => step(1);
    $("#lb-reveal").onclick = () => {
      const f = ctx.getFiles()[index];
      if (f) window.api.reveal(f.abs);
    };
    // Clicking the dark area around the media closes; clicking the media doesn't.
    $("#lb-stage").addEventListener("click", (e) => {
      if (e.target === e.currentTarget || e.target.id === "lb-media") close();
    });

    // Capture phase, so Esc and arrows don't also reach the help panel or tour.
    document.addEventListener("keydown", (e) => {
      if (!isOpen()) return;
      if (e.key === "Escape")          { close();   }
      else if (e.key === "ArrowLeft")  { step(-1);  }
      else if (e.key === "ArrowRight") { step(1);   }
      else if (e.key === " " && document.activeElement?.tagName !== "VIDEO") {
        const v = $("#lb-media video");
        if (v) v.paused ? v.play() : v.pause();
      } else return;
      e.preventDefault();
      e.stopImmediatePropagation();
    }, true);
  }

  return { init, open, close, isOpen };
})();
