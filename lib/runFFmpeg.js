import { execFileSync, spawn } from "child_process";

// Which FFmpeg binary to run. Defaults to the one on PATH; the desktop app
// (and the CLI, when no system FFmpeg exists) points this at the bundled copy.
let ffmpegPath = process.env.GC_FFMPEG_PATH || "ffmpeg";

function setFFmpegPath(p) {
  ffmpegPath = p;
}

function getFFmpegPath() {
  return ffmpegPath;
}

function checkCodec(codec) {
  try {
    const output = execFileSync(ffmpegPath, ["-hide_banner", "-encoders"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
    });
    return output.includes(codec);
  } catch {
    return false;
  }
}

function checkFFmpeg() {
  try {
    execFileSync(ffmpegPath, ["-version"], { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function printFFmpegInstallHelp() {
  console.error(`\nFFmpeg not found.\n`);
  console.error(`Run npm install in the gc folder to download the bundled copy, or install it:\n`);
  console.error(`  Mac:\n    brew install ffmpeg\n`);
  console.error(`  Ubuntu / Debian:\n    sudo apt install ffmpeg\n`);
  console.error(`  Windows:\n    https://ffmpeg.org/download.html\n`);
}

function runFFmpeg(input, filters, output) {
  if (!checkFFmpeg()) {
    printFFmpegInstallHelp();
    process.exit(1);
  }

  execFileSync(ffmpegPath, ["-i", input, "-vf", filters, "-y", output], {
    stdio: ["ignore", "ignore", "ignore"],
  });
}

function runFFmpegRaw(args) {
  if (!checkFFmpeg()) {
    printFFmpegInstallHelp();
    process.exit(1);
  }

  execFileSync(ffmpegPath, args, { stdio: ["ignore", "ignore", "ignore"] });
}

// Async versions — used by spinner-enabled paths in the CLI

function runFFmpegRawAsync(args) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, args, { stdio: "ignore" });
    proc.on("close", (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

function runFFmpegAsync(input, filters, output) {
  return runFFmpegRawAsync(["-i", input, "-vf", filters, "-y", output]);
}

/**
 * Runs FFmpeg and reports progress as a 0–1 fraction (used by the desktop app).
 *   onProgress(fraction) — called as encoding advances
 *   onSpawn(child)       — receives the child process, so the caller can cancel it
 * Rejects with the tail of FFmpeg's error output on failure.
 */
function runFFmpegWithProgress(args, { onProgress, onSpawn } = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn(ffmpegPath, ["-hide_banner", "-nostats", "-progress", "pipe:1", ...args], {
      stdio: ["ignore", "pipe", "pipe"],
    });
    onSpawn?.(proc);

    let durationSec = null;
    let stderrTail  = "";

    proc.stderr.on("data", (chunk) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-4000);
      if (durationSec == null) {
        const m = stderrTail.match(/Duration: (\d+):(\d+):(\d+(?:\.\d+)?)/);
        if (m) durationSec = (+m[1]) * 3600 + (+m[2]) * 60 + parseFloat(m[3]);
      }
    });

    proc.stdout.on("data", (chunk) => {
      if (!onProgress || !durationSec) return;
      const m = chunk.toString().match(/out_time_us=(\d+)/g);
      if (!m) return;
      const us = parseInt(m[m.length - 1].split("=")[1], 10);
      onProgress(Math.min(1, us / 1e6 / durationSec));
    });

    proc.on("close", (code, signal) => {
      if (code === 0) return resolve();
      if (signal) return reject(Object.assign(new Error("Cancelled"), { cancelled: true }));
      const lastLines = stderrTail.trim().split("\n").slice(-3).join("\n");
      reject(new Error(lastLines || `FFmpeg exited with code ${code}`));
    });
    proc.on("error", reject);
  });
}

export {
  runFFmpeg,
  runFFmpegRaw,
  runFFmpegAsync,
  runFFmpegRawAsync,
  runFFmpegWithProgress,
  checkFFmpeg,
  checkCodec,
  printFFmpegInstallHelp,
  setFFmpegPath,
  getFFmpegPath,
};
