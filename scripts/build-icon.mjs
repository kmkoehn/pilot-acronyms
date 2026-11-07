// Turns assets/icon-source.webp into every Android icon size plus the 512 px store icon.
// The source is a rounded square on a gray backdrop, so this keeps only the art inside its
// bright border and continues the art's edge colors out to a full-bleed square.
// Usage: node scripts/build-icon.mjs [preview-output.png]
import sharp from "sharp";
import { mkdirSync, writeFileSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const res = join(root, "android/app/src/main/res");
const source = join(root, "assets/icon-source.webp");
const DP = 108, VISIBLE_DP = 72; // adaptive canvas, and the part launchers show
const DENSITIES = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

// Measured from the source, in source pixels.
const SIZE = 1254;
const ART = { x: 627.5, y: 610.5, halfW: 500, halfH: 486, corner: 215 }; // inside the border
const COMPASS = { x: 627, y: 585 }; // the icon centers near the compass hub
const VISIBLE_PX = 1041; // keeps the wing tips inside the launcher's circle
const BACKGROUND = "#001D4A"; // the art's bottom edge

// Positive inside the art, by how many pixels.
function inside(x, y) {
  const qx = Math.abs(x - ART.x) - (ART.halfW - ART.corner), qy = Math.abs(y - ART.y) - (ART.halfH - ART.corner);
  return -(Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - ART.corner);
}

async function master() {
  const raw = await sharp(source).removeAlpha().raw().toBuffer();
  const px = Math.round(VISIBLE_PX * DP / VISIBLE_DP);
  const out = Buffer.alloc(px * px * 3);
  const dx = COMPASS.x - px / 2, dy = COMPASS.y - px / 2;
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    let sx = x + dx, sy = y + dy;
    if (inside(sx, sy) < 2) { // outside the art: repeat the nearest art color toward the center
      let lo = 0, hi = 1;
      for (let i = 0; i < 12; i++) {
        const k = (lo + hi) / 2;
        if (inside(ART.x + (sx - ART.x) * k, ART.y + (sy - ART.y) * k) >= 2) lo = k; else hi = k;
      }
      sx = ART.x + (sx - ART.x) * lo; sy = ART.y + (sy - ART.y) * lo;
    }
    const from = (Math.round(sy) * SIZE + Math.round(sx)) * 3, to = (y * px + x) * 3;
    for (let c = 0; c < 3; c++) out[to + c] = raw[from + c];
  }
  // Blur only the repeated colors so they don't show as streaks.
  const blurred = await sharp(out, { raw: { width: px, height: px, channels: 3 } }).blur(30).raw().toBuffer();
  for (let y = 0; y < px; y++) for (let x = 0; x < px; x++) {
    const a = Math.min(Math.max((40 - inside(x + dx, y + dy)) / 36, 0), 1);
    if (!a) continue;
    for (let c = 0; c < 3; c++) {
      const i = (y * px + x) * 3 + c;
      out[i] = Math.round(out[i] * (1 - a) + blurred[i] * a);
    }
  }
  return { px, png: await sharp(out, { raw: { width: px, height: px, channels: 3 } }).png().toBuffer() };
}

// The part a launcher actually shows.
async function visible({ px, png }, size, shape) {
  const inset = Math.round((px - VISIBLE_PX) / 2);
  const img = sharp(png).extract({ left: inset, top: inset, width: VISIBLE_PX, height: VISIBLE_PX }).resize(size, size);
  if (!shape) return img.flatten().png().toBuffer();
  const svg = shape === "round" ? `<circle cx="${size / 2}" cy="${size / 2}" r="${size / 2}"/>` : `<rect width="${size}" height="${size}" rx="${size * 0.2}"/>`;
  const mask = Buffer.from(`<svg width="${size}" height="${size}">${svg}</svg>`);
  return sharp(await img.png().toBuffer()).ensureAlpha().composite([{ input: mask, blend: "dest-in" }]).png().toBuffer();
}

const full = await master();
for (const [name, scale] of Object.entries(DENSITIES)) {
  const dir = join(res, `mipmap-${name}`);
  await sharp(full.png).resize(DP * scale, DP * scale).png().toFile(join(dir, "ic_launcher_foreground.png"));
  writeFileSync(join(dir, "ic_launcher.png"), await visible(full, 48 * scale, "square"));
  writeFileSync(join(dir, "ic_launcher_round.png"), await visible(full, 48 * scale, "round"));
}
const colorFile = join(res, "values/ic_launcher_background.xml");
writeFileSync(colorFile, readFileSync(colorFile, "utf8").replace(/#[0-9A-Fa-f]{6}/, BACKGROUND));
mkdirSync(join(root, "store"), { recursive: true });
writeFileSync(join(root, "store/icon-512.png"), await visible(full, 512));

// iPhone: one 1024 px icon with no transparency (iOS rounds the corners itself),
// and a launch screen of the icon centered on its own navy.
const iosAssets = join(root, "ios/App/App/Assets.xcassets");
writeFileSync(join(iosAssets, "AppIcon.appiconset/AppIcon-512@2x.png"), await visible(full, 1024));
const SPLASH = 2732, MARK = 640;
const mark = await visible(full, MARK, "square");
const layered = await sharp({ create: { width: SPLASH, height: SPLASH, channels: 3, background: BACKGROUND } })
  .composite([{ input: mark, left: (SPLASH - MARK) / 2, top: (SPLASH - MARK) / 2 }]).png().toBuffer();
const splash = await sharp(layered).removeAlpha().png().toBuffer(); // sharp applies composites last, so flatten separately
for (const name of ["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"])
  writeFileSync(join(iosAssets, "Splash.imageset", name), splash);
console.log("icons written");

// Keep the logo in the chart's header the same as the app icon. Republish the chart afterward.
const chart = join(root, "pilot-acronyms.html");
const logo = await sharp(await visible(full, 120)).webp({ quality: 82 }).toBuffer();
const page = readFileSync(chart, "utf8");
const logoTag = `<img src="data:image/webp;base64,${logo.toString("base64")}" alt="" width="40" height="40">`;
const updated = page.replace(/(const BRAND = `)(<svg[\s\S]*?<\/svg>|<img [^>]*>)/, (_, start) => start + logoTag);
if (updated === page && !page.includes(logoTag)) throw new Error("header logo not found in the chart");
writeFileSync(chart, updated);
console.log(`header logo updated (${logo.length} bytes)`);

const out = process.argv[2];
if (out) {
  const sizes = [[340, "square"], [150, "round"], [150, "square"], [72, "round"], [48, "round"]];
  const layers = [];
  let x = 20;
  for (const [s, shape] of sizes) {
    layers.push({ input: await visible(full, s, shape), left: x, top: 20 + Math.round((340 - s) / 2) });
    x += s + 24;
  }
  await sharp({ create: { width: 900, height: 380, channels: 3, background: "#e9ecef" } }).composite(layers).png().toFile(out);
  console.log("preview written");
}
