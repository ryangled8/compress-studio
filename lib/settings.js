/**
 * Turns a preset name plus user overrides into the final encoder settings.
 * Shared by the CLI (bin/gc.js) and the desktop app (app/main.js).
 *
 * `options` uses the CLI flag names: width, fps, colors, dither, crf, codec,
 * preset, audio, quality, format. Any of them may be omitted.
 */

import gifPresets from "../presets/gifPresets.js";
import videoPresets from "../presets/videoPresets.js";
import imgPresets from "../presets/imgPresets.js";
import { resolveWidth } from "./resolveWidth.js";

function resolveGifSettings(presetName, options = {}) {
  const preset = { ...gifPresets[presetName] };
  const hasWidthOverride = Boolean(options.width);
  const keepOriginalDimensions = hasWidthOverride ? false : (preset.keepOriginalDimensions ?? false);
  return {
    fps:    options.fps    ? parseInt(options.fps, 10)    : preset.fps,
    colors: options.colors ? parseInt(options.colors, 10) : preset.colors,
    dither: options.dither ?? preset.dither,
    width:  hasWidthOverride ? resolveWidth(options.width, preset.width ?? 1920) : preset.width,
    widthFactor: hasWidthOverride ? null : (preset.widthFactor ?? null),
    keepOriginalDimensions,
    widthOverride: hasWidthOverride,
  };
}

function resolveVideoSettings(presetName, options = {}) {
  const preset = { ...videoPresets[presetName] };

  // Explicit width override disables keepOriginalDimensions
  const hasWidthOverride = Boolean(options.width);
  const keepOriginalDimensions = hasWidthOverride ? false : (preset.keepOriginalDimensions ?? false);
  const width = hasWidthOverride
    ? resolveWidth(options.width, preset.width ?? 1920)
    : preset.width;

  return {
    keepOriginalDimensions,
    widthOverride: hasWidthOverride,
    width,
    widthFactor: hasWidthOverride ? null : (preset.widthFactor ?? null),
    codec:         options.codec  ?? preset.codec,
    crf:           options.crf    ? parseInt(options.crf, 10) : preset.crf,
    preset:        options.preset ?? preset.preset,
    fps:           options.fps    ? parseInt(options.fps, 10) : null,
    audioBitrate:  options.audio  ?? preset.audioBitrate,
  };
}

function resolveImgSettings(presetName, options = {}) {
  const preset = { ...imgPresets[presetName] };
  const hasWidthOverride = Boolean(options.width);
  const keepOriginalDimensions = hasWidthOverride ? false : (preset.keepOriginalDimensions ?? false);
  const width = hasWidthOverride
    ? resolveWidth(options.width, preset.width ?? 1920)
    : preset.width;

  let format = options.format ?? preset.format;
  if (format === "jpg") format = "jpeg";

  return {
    keepOriginalDimensions,
    widthOverride: hasWidthOverride,
    width,
    widthFactor: hasWidthOverride ? null : (preset.widthFactor ?? null),
    format,
    quality: options.quality ? parseInt(options.quality, 10) : preset.quality,
  };
}

// Suffix appended to output names when the user overrides the width, e.g. "-720px".
function widthSuffixFor(options, width) {
  return (options.width && width !== -1) ? `-${width}px` : "";
}

// Output file extension for an image, given the resolved format and the input path.
function imageOutputExt(format, inputPath) {
  const inputExt = inputPath.split(".").pop().toLowerCase();
  return format === "jpeg" ? "jpg" : (format ?? inputExt);
}

export {
  resolveGifSettings,
  resolveVideoSettings,
  resolveImgSettings,
  widthSuffixFor,
  imageOutputExt,
};
