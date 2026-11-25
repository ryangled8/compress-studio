// Friendly names and descriptions for the presets in presets/*.js.
// A preset added there shows up automatically; give it an entry here for a nicer
// title and description (otherwise its key and `label` are used).

const TYPE_COPY = {
  img: {
    title: "Compress images",
    sub: "Shrink, resize or convert photos and graphics. Your originals are never changed.",
    drop: "Drop images or a folder here",
    noun: ["image", "images"],
    hint: "Tip: for anything going on a website, WebP gives the smallest files that still look great.",
  },
  vid: {
    title: "Compress videos",
    sub: "Make videos much smaller as MP4, with little visible difference. Your originals are never changed.",
    drop: "Drop videos or a folder here",
    noun: ["video", "videos"],
    hint: "Videos can take a few minutes each. You can leave the app running; your Mac stays awake until it's done.",
  },
  gif: {
    title: "Make GIFs",
    sub: "Turn screen recordings and short clips into GIFs. Your originals are never changed.",
    drop: "Drop videos or a folder here",
    noun: ["video", "videos"],
    outNoun: ["GIF", "GIFs"],
    hint: "GIFs are made from videos. Drop in a .mov or .mp4 screen recording. Short clips (under 15 seconds) work best.",
  },
};

const RECOMMENDED = { img: "webp", vid: "compress", gif: "medium" };

const PRESET_COPY = {
  img: {
    compress:  ["Compress",      "Smaller file, same format and size"],
    webp:      ["WebP",          "Best all-rounder for websites"],
    avif:      ["AVIF",          "Smallest files, newer browsers"],
    social:    ["Social",        "1080px JPEG, ready to post"],
    thumbnail: ["Thumbnail",     "Small 400px preview image"],
    half:      ["Half size",     "50% of the original width"],
    third:     ["Third size",    "33% of the original width"],
    quart:     ["Quarter size",  "25% of the original width"],
  },
  vid: {
    "compress":      ["Compress",        "Much smaller, same dimensions"],
    "compress-best": ["Compress (best)", "Even smaller, takes longer"],
    "web":           ["Web",             "Slightly higher quality for websites"],
    "social":        ["Social",          "Up to 1080px wide for posts"],
    "showcase":      ["Showcase",        "High quality, up to 1920px"],
    "lightweight":   ["Lightweight",     "Small files for email and docs"],
    "half":          ["Half size",       "50% of the original width"],
    "third":         ["Third size",      "33% of the original width"],
    "quart":         ["Quarter size",    "25% of the original width"],
  },
  gif: {
    compress: ["Full size",     "Original dimensions, optimised"],
    tiny:     ["Tiny",          "Reaction GIFs, 180px"],
    small:    ["Small",         "Light web embeds, 240px"],
    medium:   ["Medium",        "UI demos and changelogs, 360px"],
    large:    ["Large",         "Showcase quality, 640px"],
    social:   ["Social",        "Sharing on social, 480px"],
    slack:    ["Slack",         "Slack and Discord, 240px"],
    half:     ["Half size",     "50% of the original width"],
    third:    ["Third size",    "33% of the original width"],
    quart:    ["Quarter size",  "25% of the original width"],
  },
};

const FORMAT_NAMES = { jpeg: "JPEG", png: "PNG", webp: "WebP", avif: "AVIF" };

function sizeLabel(p) {
  if (p.keepOriginalDimensions) return "Original size";
  if (p.widthFactor != null) return `${Math.round(p.widthFactor * 100)}% width`;
  return `${p.width}px wide`;
}

function videoQualityLabel(crf) {
  if (crf <= 23) return "High quality";
  if (crf <= 28) return "Balanced";
  return "Smallest";
}

// One short line of specs under each preset card.
function presetSpecs(type, p) {
  if (type === "img") {
    return [sizeLabel(p), p.format ? FORMAT_NAMES[p.format] : "Same format", `Quality ${p.quality}`];
  }
  if (type === "vid") {
    return [sizeLabel(p), "MP4", videoQualityLabel(p.crf)];
  }
  return [sizeLabel(p), `${p.fps} fps`, `${p.colors} colours`];
}

function presetCopy(type, key, preset) {
  const [title, desc] = PRESET_COPY[type]?.[key] ?? [key, preset.label];
  return { title, desc };
}
