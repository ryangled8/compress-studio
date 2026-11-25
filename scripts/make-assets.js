// Generates build/icon.icns and build/dmg-background.tiff from SVG.
// Run with `npm run icons` after changing the artwork; the outputs are committed.
// Needs macOS (uses the built-in iconutil and tiffutil).

import sharp from "sharp";
import fs from "fs";
import path from "path";
import { execFileSync } from "child_process";
import { fileURLToPath } from "url";

const root  = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const build = path.join(root, "build");
const tmp   = fs.mkdtempSync(path.join(build, ".tmp-"));

// ── App icon ────────────────────────────────────────────────────────────────
// macOS icon grid: 1024 canvas, ~824 rounded square with a soft shadow.
const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#5a8dff"/><stop offset="1" stop-color="#1c48c7"/>
    </linearGradient>
    <filter id="s" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#0b1d55" flood-opacity=".35"/>
    </filter>
  </defs>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#g)" filter="url(#s)"/>
  <rect x="100" y="100" width="824" height="412" rx="185" fill="#fff" opacity=".07"/>
  <g transform="translate(212 212) scale(25)" fill="none" stroke="#fff" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round">
    <path d="M4 9h5V4M20 15h-5v5M9 9 3.5 3.5M15 15l5.5 5.5"/>
  </g>
</svg>`;

const iconset = path.join(tmp, "icon.iconset");
fs.mkdirSync(iconset);
for (const size of [16, 32, 128, 256, 512]) {
  for (const scale of [1, 2]) {
    const px = size * scale;
    const name = `icon_${size}x${size}${scale === 2 ? "@2x" : ""}.png`;
    await sharp(Buffer.from(iconSvg)).resize(px, px).png().toFile(path.join(iconset, name));
  }
}
execFileSync("iconutil", ["-c", "icns", iconset, "-o", path.join(build, "icon.icns")]);
await sharp(Buffer.from(iconSvg)).resize(512, 512).png().toFile(path.join(build, "icon.png"));

// ── DMG background (660×460, with @2x for Retina) ──────────────────────────
// Icons are placed by package.json → build.dmg.contents at (180,200) and (480,200).
const font = `-apple-system, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const bgSvg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${660 * scale}" height="${460 * scale}" viewBox="0 0 660 460">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#f3f6ff"/><stop offset=".6" stop-color="#f8f4ff"/><stop offset="1" stop-color="#fff6ef"/>
    </linearGradient>
  </defs>
  <rect width="660" height="460" fill="url(#bg)"/>
  <text x="330" y="58" text-anchor="middle" font-family="${font}" font-size="21" font-weight="700" fill="#171b26">Install Compress Studio</text>
  <text x="330" y="84" text-anchor="middle" font-family="${font}" font-size="13.5" fill="#4a5163">Drag the app onto the Applications folder</text>
  <g fill="none" stroke="#2f6bf2" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".85">
    <path d="M262 200h128"/><path d="m376 186 16 14-16 14"/>
  </g>
  <rect x="40" y="312" width="580" height="122" rx="14" fill="#ffffff" stroke="#e3e6ee"/>
  <text x="62" y="340" font-family="${font}" font-size="13.5" font-weight="700" fill="#171b26">Opening it for the first time</text>
  <text font-family="${font}" font-size="12.5" fill="#4a5163">
    <tspan x="62" y="364">1.  Open the app from Applications. macOS will say it can't check it. Click Done.</tspan>
    <tspan x="62" y="386">2.  Open System Settings → Privacy &amp; Security, scroll down, click Open Anyway.</tspan>
    <tspan x="62" y="408">3.  Confirm with your password or Touch ID. You only need to do this once.</tspan>
  </text>
</svg>`;

const bg1 = path.join(tmp, "bg.png");
const bg2 = path.join(tmp, "bg@2x.png");
await sharp(Buffer.from(bgSvg(1))).png().toFile(bg1);
await sharp(Buffer.from(bgSvg(2))).png().toFile(bg2);
execFileSync("tiffutil", ["-cathidpicheck", bg1, bg2, "-out", path.join(build, "dmg-background.tiff")]);

fs.rmSync(tmp, { recursive: true, force: true });
console.log("Wrote build/icon.icns, build/icon.png, build/dmg-background.tiff");
