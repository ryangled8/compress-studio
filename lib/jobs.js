/**
 * Batch planning and running for the desktop app.
 *
 * Output naming matches `gc <type> batch`:
 *   gif → Outputs gif-{preset}/{name}-{preset}[-{w}px].gif
 *   vid → Outputs vid-{preset}/{name}-{preset}[-{w}px][-muted].mp4
 *   img → Outputs img-{preset}/{name}[-{w}px].{ext}
 * The Outputs folder sits in the chosen folder (or next to each dropped file)
 * and mirrors subfolders. Originals are never modified.
 */

import fs from "fs";
import path from "path";
import gifPresets from "../presets/gifPresets.js";
import videoPresets from "../presets/videoPresets.js";
import imgPresets from "../presets/imgPresets.js";
import { findVideoFiles, findImageFiles, VIDEO_EXTENSIONS, IMAGE_EXTENSIONS } from "./selectFiles.js";
import {
  resolveGifSettings, resolveVideoSettings, resolveImgSettings, widthSuffixFor, muteSuffixFor, imageOutputExt,
} from "./settings.js";
import { buildFilters } from "./buildFilters.js";
import { buildVideoArgs } from "./buildVideoCommand.js";
import { compressImage } from "./runSharp.js";
import { runFFmpegWithProgress } from "./runFFmpeg.js";

const MEDIA = {
  img: { presets: imgPresets,   extensions: IMAGE_EXTENSIONS, find: findImageFiles, resolve: resolveImgSettings },
  vid: { presets: videoPresets, extensions: VIDEO_EXTENSIONS, find: findVideoFiles, resolve: resolveVideoSettings },
  gif: { presets: gifPresets,   extensions: VIDEO_EXTENSIONS, find: findVideoFiles, resolve: resolveGifSettings },
};

/**
 * Expands a mix of folders and files into a flat list of source files for a media type.
 * Folders are scanned (recursively when includeSubfolders); files of the wrong type are skipped.
 * Returns { files: [{ root, rel, abs, size }], skipped }.
 */
function collectFiles(type, paths, includeSubfolders) {
  const { extensions, find } = MEDIA[type];
  const files = [];
  const seen  = new Set();
  let skipped = 0;

  const add = (root, rel) => {
    const abs = path.join(root, rel);
    if (seen.has(abs)) return;
    seen.add(abs);
    files.push({ root, rel, abs, size: fs.statSync(abs).size });
  };

  for (const p of paths) {
    const stat = fs.statSync(p);
    if (stat.isDirectory()) {
      for (const rel of find(p, includeSubfolders)) {
        if (fs.statSync(path.join(p, rel)).isFile()) add(p, rel);
      }
    } else if (extensions.includes(path.extname(p).toLowerCase())) {
      add(path.dirname(p), path.basename(p));
    } else {
      skipped++;
    }
  }

  return { files, skipped };
}

/**
 * Works out settings and an output path for every file.
 * `options` uses CLI flag names (width, quality, format, fps, ...); blanks are ignored.
 */
function planJobs(type, presetName, files, options = {}) {
  const media = MEDIA[type];
  if (!media.presets[presetName]) throw new Error(`Unknown preset: ${presetName}`);

  const cleaned  = Object.fromEntries(Object.entries(options).filter(([, v]) => v !== "" && v != null));
  const settings = media.resolve(presetName, cleaned);
  const suffix   = widthSuffixFor(cleaned, settings.width);
  const folder   = `Outputs ${type}-${presetName}`;

  const jobs = files.map((f) => {
    const base   = path.basename(f.rel, path.extname(f.rel));
    const relDir = path.dirname(f.rel);
    const outDir = path.join(f.root, folder, relDir === "." ? "" : relDir);
    const name =
      type === "img" ? `${base}${suffix}.${imageOutputExt(settings.format, f.rel)}` :
      type === "vid" ? `${base}-${presetName}${suffix}${muteSuffixFor(settings)}.mp4` :
                       `${base}-${presetName}${suffix}.gif`;
    return { ...f, outDir, output: path.join(outDir, name), outFolder: path.join(f.root, folder) };
  });

  return { settings, jobs };
}

/**
 * True when the original file could stand in for the output unchanged: same
 * format and same dimensions. Only then does "keep the original if compressing
 * made it bigger" apply. Conversions (e.g. JPEG → WebP), resizes and muted
 * videos always keep the new file, and GIFs are never compared with their source video.
 */
function originalIsDropIn(type, job, settings) {
  const inExt = path.extname(job.abs).slice(1).toLowerCase();
  const outExt = path.extname(job.output).slice(1).toLowerCase();
  const sameFormat = inExt === outExt || (["jpg", "jpeg"].includes(inExt) && ["jpg", "jpeg"].includes(outExt));
  const sameSize = settings.keepOriginalDimensions && settings.widthFactor == null && !settings.widthOverride;
  if (type === "img") return sameFormat && sameSize;
  if (type === "vid") return sameFormat && sameSize && !settings.fps && !settings.mute;
  return false;
}

// Where a kept original goes, e.g. "Outputs img-compress/beach-original.jpg".
function keptOriginalPath(job) {
  const ext  = path.extname(job.rel);
  const base = path.basename(job.rel, ext);
  return path.join(job.outDir, `${base}-original${ext}`);
}

/**
 * Runs one job. onProgress(0–1) fires for video/GIF; onSpawn(child) allows cancelling.
 * With keepOriginalIfLarger, an output that is no smaller than its source is
 * replaced by a copy of the original named "{name}-original.{ext}" (see
 * originalIsDropIn for when that applies).
 *
 * Returns { size, output, outcome } where outcome is:
 *   "smaller" | "larger" (bigger, but a conversion/resize, so kept) | "kept" (original kept) | "gif"
 * and, for "kept", attemptedSize: how big the compressed file would have been.
 */
async function runJob(type, job, settings, { onProgress, onSpawn, keepOriginalIfLarger = false } = {}) {
  // Check access first: sharp and FFmpeg report blocked files as generic
  // failures, while this throws EACCES/EPERM so callers can explain permissions.
  fs.accessSync(job.abs, fs.constants.R_OK);
  fs.mkdirSync(job.outDir, { recursive: true });

  if (type === "img") {
    await compressImage(job.abs, settings, job.output);
  } else if (type === "vid") {
    await runFFmpegWithProgress(buildVideoArgs(job.abs, settings, job.output), { onProgress, onSpawn });
  } else {
    // Same fields the CLI passes, so app and CLI produce identical GIFs.
    const { fps, width, widthFactor, colors, dither, keepOriginalDimensions } = settings;
    const filters = buildFilters({ fps, width, widthFactor, colors, dither, keepOriginalDimensions });
    await runFFmpegWithProgress(["-i", job.abs, "-vf", filters, "-y", job.output], { onProgress, onSpawn });
  }

  const size = fs.statSync(job.output).size;
  const keptPath = type === "gif" ? null : keptOriginalPath(job);

  if (type === "gif") return { size, output: job.output, outcome: "gif" };

  if (size >= job.size && keepOriginalIfLarger && originalIsDropIn(type, job, settings)) {
    fs.rmSync(job.output, { force: true });
    fs.copyFileSync(job.abs, keptPath);
    return { size: job.size, output: keptPath, outcome: "kept", attemptedSize: size };
  }

  // A previous run may have kept the original; this run's file replaces it.
  if (keptPath !== job.output) fs.rmSync(keptPath, { force: true });
  return { size, output: job.output, outcome: size >= job.size ? "larger" : "smaller" };
}

export { MEDIA, collectFiles, planJobs, runJob };
