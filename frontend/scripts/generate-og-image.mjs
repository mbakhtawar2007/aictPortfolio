// Generates public/og-image.png (1200x630) at build time with pure Node
// (zlib only, no dependencies, no font rendering).
//
// Why build-time, not a committed file: the repo push routes cannot carry
// binary files (snapshot push rejects non-UTF-8; the file API stores
// base64 text literally), so the PNG is generated on every build instead
// of being shipped as a blob. WhatsApp/Facebook/Twitter link previews
// need a real PNG/JPG — SVG is ignored — so this script draws the
// TechHive mark (gradient hexagon + white T) on a dark cosmic gradient.
//
// Usage: node scripts/generate-og-image.mjs [output-path]
// Default output: <frontend>/public/og-image.png
import { deflateSync } from 'node:zlib';
import { writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const W = 1200;
const H = 630;
const out = process.argv[2] || join(dirname(fileURLToPath(import.meta.url)), '..', 'public', 'og-image.png');

const lerp = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const C1 = [59, 130, 246]; // blue
const C2 = [139, 92, 246]; // violet
const C3 = [217, 70, 239]; // magenta

// Deterministic pseudo-random for the star dots (same image every build).
let seed = 42;
const rand = () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const stars = Array.from({ length: 90 }, () => ({
  x: rand() * W,
  y: rand() * H,
  r: rand() < 0.8 ? 1 : 2,
  a: 40 + Math.floor(rand() * 90),
}));

// Pointy-top hexagon vertices, centred, radius R.
const CX = W / 2;
const CY = H / 2;
const R = 190;
const hex = Array.from({ length: 6 }, (_, i) => {
  const a = (Math.PI / 3) * i - Math.PI / 2;
  return [CX + R * Math.cos(a), CY + R * Math.sin(a)];
});
const insideHex = (x, y) => {
  // Convex polygon: point is inside iff it is on the same side of every edge.
  let sign = 0;
  for (let i = 0; i < 6; i++) {
    const [x1, y1] = hex[i];
    const [x2, y2] = hex[(i + 1) % 6];
    const c = (x2 - x1) * (y - y1) - (y2 - y1) * (x - x1);
    if (sign === 0) sign = Math.sign(c);
    else if (Math.sign(c) !== 0 && Math.sign(c) !== sign) return false;
  }
  return true;
};
const inT = (x, y) =>
  (x >= CX - 78 && x <= CX + 78 && y >= CY - 58 && y <= CY - 22) || // top bar
  (x >= CX - 22 && x <= CX + 22 && y >= CY - 22 && y <= CY + 78); // stem

const buf = Buffer.alloc(W * H * 4);
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const i = (y * W + x) * 4;
    // Background: diagonal dark gradient.
    const t = (x / W + y / H) / 2;
    let px = lerp([7, 11, 30], [27, 20, 64], t);
    // Soft violet glow behind the hexagon.
    const d = Math.hypot(x - CX, y - CY);
    if (d < 330) {
      const a = 0.28 * (1 - d / 330);
      px = px.map((v, k) => Math.round(v + ([139, 92, 246][k] - v) * a));
    }
    // Stars.
    for (const s of stars) {
      if (Math.hypot(x - s.x, y - s.y) <= s.r) {
        px = px.map((v) => Math.round(v + (255 - v) * (s.a / 255)));
        break;
      }
    }
    if (insideHex(x, y)) {
      // Hexagon gradient along its own diagonal.
      const ht = ((x - (CX - R)) / (2 * R) + (y - (CY - R)) / (2 * R)) / 2;
      px = ht < 0.5 ? lerp(C1, C2, ht * 2) : lerp(C2, C3, (ht - 0.5) * 2);
      if (inT(x, y)) px = [255, 255, 255];
    }
    buf[i] = px[0];
    buf[i + 1] = px[1];
    buf[i + 2] = px[2];
    buf[i + 3] = 255;
  }
}

// Minimal PNG encoder: 8-bit RGBA, filter 0 per scanline.
const crcTable = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();
const crc32 = (b) => {
  let c = 0xffffffff;
  for (const v of b) c = crcTable[(c ^ v) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([Buffer.from(type), data])), 0);
  return Buffer.concat([len, Buffer.from(type), data, crc]);
};
const ihdr = Buffer.alloc(13);
ihdr.writeUInt32BE(W, 0);
ihdr.writeUInt32BE(H, 4);
ihdr[8] = 8; // bit depth
ihdr[9] = 6; // colour type RGBA
const raw = Buffer.alloc(H * (1 + W * 4));
for (let y = 0; y < H; y++) {
  raw[y * (1 + W * 4)] = 0;
  buf.copy(raw, y * (1 + W * 4) + 1, y * W * 4, (y + 1) * W * 4);
}
const png = Buffer.concat([
  Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
  chunk('IHDR', ihdr),
  chunk('IDAT', deflateSync(raw)),
  chunk('IEND', Buffer.alloc(0)),
]);
writeFileSync(out, png);
console.log(`og-image written: ${out} (${png.length} bytes)`);
