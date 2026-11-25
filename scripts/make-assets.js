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
// Dark tile with a soft pastel box (an isometric cube silhouette with rounded
// corners) and a "C" cut into its left face.

// Cube silhouette: a pointy-top hexagon centred on the tile.
const cx = 512, cy = 512, r = 206;
const hex = [-90, -30, 30, 90, 150, 210]
  .map((deg) => [cx + r * Math.cos((deg * Math.PI) / 180), cy + r * Math.sin((deg * Math.PI) / 180)]);
const hexPath = `M${hex.map(([x, y]) => `${x.toFixed(1)} ${y.toFixed(1)}`).join(" L")} Z`;

// Left face runs from the upper-left vertex down-right at 30° to the centre.
// The C is drawn flat, then sheared onto that plane.
const leftFaceCentre = [(hex[4][0] + cx) / 2, (hex[5][1] + hex[3][1]) / 2 + 2];
const cR = 74, cOpen = (50 * Math.PI) / 180;
const cX = (Math.cos(cOpen) * cR).toFixed(1), cY = (Math.sin(cOpen) * cR).toFixed(1);
const cPath = `M${cX} ${-cY} A${cR} ${cR} 0 1 0 ${cX} ${cY}`;

const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="tile" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#1e1e21"/><stop offset="1" stop-color="#070708"/>
    </linearGradient>
    <linearGradient id="rim" x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stop-color="#ffffff" stop-opacity=".16"/><stop offset="1" stop-color="#ffffff" stop-opacity=".04"/>
    </linearGradient>
    <filter id="shadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="14" stdDeviation="18" flood-color="#000" flood-opacity=".4"/>
    </filter>

    <!-- Soft pastel wash: four colour pools blended over a pale base -->
    <radialGradient id="cream" cx="300" cy="380" r="300" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fbf9e4"/><stop offset="1" stop-color="#fbf9e4" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="blue" cx="660" cy="320" r="330" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#c3d5ff"/><stop offset="1" stop-color="#c3d5ff" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="pink" cx="330" cy="720" r="300" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#f8dcf6"/><stop offset="1" stop-color="#f8dcf6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="peach" cx="690" cy="690" r="320" gradientUnits="userSpaceOnUse">
      <stop offset="0" stop-color="#fde3da"/><stop offset="1" stop-color="#fde3da" stop-opacity="0"/>
    </radialGradient>

    <!-- Rounded cube shape: the hexagon plus a thick round-joined stroke -->
    <mask id="cube">
      <path d="${hexPath}" fill="#fff" stroke="#fff" stroke-width="124" stroke-linejoin="round"/>
    </mask>
  </defs>

  <rect x="100" y="100" width="824" height="824" rx="185" fill="#000" filter="url(#shadow)"/>
  <rect x="100" y="100" width="824" height="824" rx="185" fill="url(#tile)"/>
  <rect x="101.5" y="101.5" width="821" height="821" rx="183.5" fill="none" stroke="url(#rim)" stroke-width="3"/>

  <g mask="url(#cube)">
    <rect width="1024" height="1024" fill="#ece8f4"/>
    <rect width="1024" height="1024" fill="url(#blue)"/>
    <rect width="1024" height="1024" fill="url(#peach)"/>
    <rect width="1024" height="1024" fill="url(#pink)"/>
    <rect width="1024" height="1024" fill="url(#cream)"/>
  </g>

  <path d="${cPath}" transform="matrix(0.866 0.5 0 1 ${leftFaceCentre[0].toFixed(1)} ${leftFaceCentre[1].toFixed(1)})"
        fill="none" stroke="#0b0b0c" stroke-width="44" stroke-linecap="butt"/>
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

// The same artwork, cropped to the tile, for the logo inside the app.
await sharp(Buffer.from(iconSvg))
  .extract({ left: 100, top: 100, width: 824, height: 824 })
  .resize(192, 192)
  .png()
  .toFile(path.join(root, "app", "renderer", "logo.png"));

// ── DMG background (660×460, with @2x for Retina) ──────────────────────────
// Icons are placed by package.json → build.dmg.contents at (180,200) and (480,200).
const font = `-apple-system, 'SF Pro Text', 'Helvetica Neue', Helvetica, Arial, sans-serif`;
const bgSvg = (scale) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${660 * scale}" height="${460 * scale}" viewBox="0 0 660 460">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fbf9ea"/><stop offset=".4" stop-color="#eaeffe"/><stop offset=".75" stop-color="#f8eaf7"/><stop offset="1" stop-color="#fdeee7"/>
    </linearGradient>
  </defs>
  <rect width="660" height="460" fill="url(#bg)"/>
  <text x="330" y="58" text-anchor="middle" font-family="${font}" font-size="21" font-weight="700" fill="#171b26">Install Compress Studio</text>
  <text x="330" y="84" text-anchor="middle" font-family="${font}" font-size="13.5" fill="#4a5163">Drag the app onto the Applications folder</text>
  <g fill="none" stroke="#16161a" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" opacity=".7">
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
console.log("Wrote build/icon.icns, build/icon.png, build/dmg-background.tiff, app/renderer/logo.png");
