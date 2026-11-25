/**
 * Batch planning and running for the desktop app.
 *
 * Output naming matches `gc <type> batch`:
 *   gif → Outputs gif-{preset}/{name}-{preset}[-{w}px].gif
 *   vid → Outputs vid-{preset}/{name}-{preset}[-{w}px].mp4
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
  resolveGifSettings, resolveVideoSettings, resolveImgSettings, widthSuffixFor, imageOutputExt,
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
      type === "vid" ? `${base}-${presetName}${suffix}.mp4` :
                       `${base}-${presetName}${suffix}.gif`;
    return { ...f, outDir, output: path.join(outDir, name), outFolder: path.join(f.root, folder) };
  });

  return { settings, jobs };
}

/**
 * Runs one job. onProgress(0–1) fires for video/GIF; onSpawn(child) allows cancelling.
 * Returns the output file size in bytes.
 */
async function runJob(type, job, settings, { onProgress, onSpawn } = {}) {
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

  return fs.statSync(job.output).size;
}

export { MEDIA, collectFiles, planJobs, runJob };
