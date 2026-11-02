// One-off: generates the PWA icons into public/icons. Run: node scripts/make-pwa-icons.mjs
import sharp from "sharp";
import { mkdirSync } from "node:fs";
mkdirSync("public/icons", { recursive: true });
// An "S" drawn as a stroked path on amber; `scale` shrinks the glyph so the maskable icon keeps it inside the safe zone.
const svg = (size, scale, rounded) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 512 512">
<rect width="512" height="512" ${rounded ? 'rx="96"' : ""} fill="#F59E0B"/>
<g transform="translate(256 256) scale(${scale}) translate(-256 -256)">
<path d="M342 170c-12-34-48-52-88-52-48 0-84 26-84 62 0 78 172 40 172 128 0 38-38 66-90 66-46 0-84-20-98-60" fill="none" stroke="#FFFFFF" stroke-width="46" stroke-linecap="round" stroke-linejoin="round"/>
</g></svg>`;
const out = async (name, size, scale, rounded) => sharp(Buffer.from(svg(size, scale, rounded))).png().toFile(`public/icons/${name}`);
await out("icon-192.png", 192, 1, true);
await out("icon-512.png", 512, 1, true);
await out("icon-maskable-512.png", 512, 0.78, false);
await out("apple-touch-icon.png", 180, 0.85, false);
console.log("icons written");
