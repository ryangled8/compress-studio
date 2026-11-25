// Compress Studio — Electron main process.
// Owns the window, file access and the job queue; the UI lives in app/renderer/.

import { app, BrowserWindow, ipcMain, dialog, shell, nativeImage, nativeTheme, powerSaveBlocker, Notification } from "electron";
import path from "path";
import fs from "fs";
import { fileURLToPath } from "url";
import ffmpegStatic from "ffmpeg-static";
import { MEDIA, collectFiles, planJobs, runJob } from "../lib/jobs.js";
import { setFFmpegPath, checkFFmpeg } from "../lib/runFFmpeg.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Inside the packaged app, binaries live outside the read-only app.asar archive.
setFFmpegPath(ffmpegStatic.replace("app.asar", "app.asar.unpacked"));

nativeTheme.themeSource = "light";

let win = null;

function createWindow() {
  win = new BrowserWindow({
    width: 1280,
    height: 820,
    minWidth: 1080,
    minHeight: 680,
    title: "Compress Studio",
    titleBarStyle: "hiddenInset",
    trafficLightPosition: { x: 20, y: 20 },
    backgroundColor: "#f5f6fa",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  win.loadFile(path.join(__dirname, "renderer", "index.html"));
  win.once("ready-to-show", () => win.show());

  // Links in the help panel open in the browser, never inside the app.
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: "deny" };
  });
  win.webContents.on("will-navigate", (e) => e.preventDefault());
}

app.whenReady().then(createWindow);
app.on("window-all-closed", () => app.quit());

// ─── Helpers ──────────────────────────────────────────────────────────────────

// Turns low-level file errors into something a non-technical user can act on.
function friendlyError(err, filePath) {
  if (err?.code === "EPERM" || err?.code === "EACCES") {
    return {
      kind: "permission",
      message: `macOS didn't let Compress Studio open ${filePath ? `“${path.basename(filePath)}”` : "that folder"}.`,
    };
  }
  if (err?.code === "ENOENT") {
    return { kind: "missing", message: "That file or folder no longer exists." };
  }
  return { kind: "other", message: err?.message ?? String(err) };
}

// ─── Presets & files ──────────────────────────────────────────────────────────

ipcMain.handle("app:info", () => ({
  version: app.getVersion(),
  ffmpegReady: checkFFmpeg(),
}));

ipcMain.handle("presets:get", () => ({
  img: MEDIA.img.presets,
  vid: MEDIA.vid.presets,
  gif: MEDIA.gif.presets,
}));

ipcMain.handle("dialog:choose", async (_e, type) => {
  const kind = type === "img" ? "images" : "videos";
  const result = await dialog.showOpenDialog(win, {
    title: `Choose ${kind} or a folder`,
    buttonLabel: "Choose",
    message: `Pick a folder, or one or more ${kind}.`,
    properties: ["openFile", "openDirectory", "multiSelections"],
    filters: [{ name: kind, extensions: MEDIA[type].extensions.map((e) => e.slice(1)) }],
  });
  return result.canceled ? [] : result.filePaths;
});

ipcMain.handle("files:collect", (_e, type, paths, includeSubfolders) => {
  try {
    const { files, skipped } = collectFiles(type, paths, includeSubfolders);
    return { files, skipped };
  } catch (err) {
    return { error: friendlyError(err, err?.path ?? paths[0]) };
  }
});

ipcMain.handle("files:thumbnail", async (_e, filePath) => {
  try {
    const img = await nativeImage.createThumbnailFromPath(filePath, { width: 96, height: 96 });
    return img.isEmpty() ? null : img.toDataURL();
  } catch {
    return null;
  }
});

// ─── Shell ────────────────────────────────────────────────────────────────────

ipcMain.handle("shell:reveal", (_e, target) => {
  if (fs.existsSync(target) && fs.statSync(target).isDirectory()) shell.openPath(target);
  else shell.showItemInFolder(target);
});

ipcMain.handle("shell:openFilesPrivacy", () =>
  shell.openExternal("x-apple.systempreferences:com.apple.preference.security?Privacy_FilesAndFolders"));

// ─── Job queue ────────────────────────────────────────────────────────────────

let running = null; // { cancelled, child }

function send(event) {
  win?.webContents.send("jobs:event", event);
}

ipcMain.handle("jobs:plan", (_e, type, presetName, files, options) => {
  try {
    const { jobs } = planJobs(type, presetName, files, options);
    const folders = [...new Set(jobs.map((j) => j.outFolder))];
    return { folders };
  } catch (err) {
    return { error: { kind: "settings", message: err.message.split("\n")[0] } };
  }
});

ipcMain.handle("jobs:start", async (_e, type, presetName, files, options) => {
  if (running) return { error: { kind: "busy", message: "Already processing." } };

  let plan;
  try {
    plan = planJobs(type, presetName, files, options);
  } catch (err) {
    return { error: { kind: "settings", message: err.message.split("\n")[0] } };
  }

  const { settings, jobs } = plan;
  running = { cancelled: false, child: null };
  const blocker = powerSaveBlocker.start("prevent-app-suspension");
  const results = { passed: 0, failed: 0, inBytes: 0, outBytes: 0 };

  // Start on the next tick so the renderer gets this reply before the first event.
  setImmediate(async () => {
    for (let i = 0; i < jobs.length; i++) {
      if (running.cancelled) break;
      const job = jobs[i];
      send({ kind: "start", index: i });
      win?.setProgressBar(i / jobs.length);

      try {
        const size = await runJob(type, job, settings, {
          onSpawn: (child) => (running.child = child),
          onProgress: (p) => {
            send({ kind: "progress", index: i, progress: p });
            win?.setProgressBar((i + p) / jobs.length);
          },
        });
        results.passed++;
        results.inBytes  += job.size;
        results.outBytes += size;
        send({ kind: "done", index: i, outSize: size, output: job.output });
      } catch (err) {
        if (running.cancelled) {
          fs.rmSync(job.output, { force: true }); // drop the half-written file
          break;
        }
        results.failed++;
        send({ kind: "error", index: i, error: friendlyError(err, job.abs) });
      } finally {
        running.child = null;
      }
    }

    const cancelled = running.cancelled;
    running = null;
    powerSaveBlocker.stop(blocker);
    win?.setProgressBar(-1);

    const folders = [...new Set(jobs.map((j) => j.outFolder))].filter((f) => fs.existsSync(f));
    send({ kind: "finished", cancelled, results, folders });

    if (!cancelled && win && !win.isFocused() && Notification.isSupported()) {
      new Notification({
        title: "All done",
        body: `${results.passed} file${results.passed === 1 ? "" : "s"} saved${results.failed ? `, ${results.failed} failed` : ""}.`,
      }).show();
      app.dock?.bounce("informational");
    }
  });

  return { ok: true, total: jobs.length };
});

ipcMain.handle("jobs:cancel", () => {
  if (!running) return;
  running.cancelled = true;
  running.child?.kill("SIGTERM");
});
