// Renders the app icon to PNGs, no dependencies: Bro, the cast-iron kettlebell with a game face and a tied lime headband, on a dark tile.
// The shapes repeat the 120×120 drawing in src/components/Bro.tsx; keep the two in step.
import fs from 'node:fs';
import path from 'node:path';
import zlib from 'node:zlib';
import { fileURLToPath } from 'node:url';

const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../public/icons');
fs.mkdirSync(OUT, { recursive: true });

const crcTable = Array.from({ length: 256 }, (_, n) => {
  let c = n;
  for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
  return c >>> 0;
});
const crc32 = (buf) => {
  let c = 0xffffffff;
  for (const b of buf) c = crcTable[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
};
const chunk = (type, data) => {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
};
function png(size, px) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  const raw = Buffer.alloc((size * 4 + 1) * size);
  for (let y = 0; y < size; y++) {
    raw[y * (size * 4 + 1)] = 0;
    px.copy(raw, y * (size * 4 + 1) + 1, y * size * 4, (y + 1) * size * 4);
  }
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}

// Signed distance helpers. The mascot is drawn in its own 120×120 units.
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const sdSegment = (x, y, [ax, ay], [bx, by]) => {
  const dx = bx - ax, dy = by - ay;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)));
  return Math.hypot(x - ax - dx * t, y - ay - dy * t);
};
const sdPolyline = (x, y, pts) => {
  let d = Infinity;
  for (let i = 1; i < pts.length; i++) d = Math.min(d, sdSegment(x, y, pts[i - 1], pts[i]));
  return d;
};
const arc = (cx, cy, r, from, to, n = 10) => Array.from({ length: n + 1 }, (_, i) => {
  const a = from + ((to - from) * i) / n;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
});
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const mix = (a, b, t) => a.map((v, k) => v * (1 - t) + b[k] * t);

const BG1 = hex('#1d2609'), BG2 = hex('#050603'), GLOW = hex('#c3f73a');
const IRON_HI = hex('#7c8492'), IRON = hex('#4d525d'), IRON_LO = hex('#30343c'), HANDLE_COL = hex('#5c626e');
const BAND = hex('#c3f73a'), LIGHT = hex('#f2f4f6'), DARK = hex('#101216'), WHITE = hex('#ffffff'), BLACK = hex('#000000');

// Handle: up the left side, across the top with rounded corners, down the right side.
const HANDLE = [[35, 60], [35, 39], ...arc(48, 39, 13, Math.PI, Math.PI * 1.5), ...arc(72, 39, 13, Math.PI * 1.5, Math.PI * 2), [85, 60]];
const quad = ([ax, ay], [bx, by], [cx, cy], n = 12) => Array.from({ length: n + 1 }, (_, i) => {
  const t = i / n, u = 1 - t;
  return [u * u * ax + 2 * u * t * bx + t * t * cx, u * u * ay + 2 * u * t * by + t * t * cy];
});
const SMILE = quad([53, 95], [60, 101.5], [67, 95]); // "M53 95 q7 6.5 14 0"
const SHINE = quad([28, 89], [26.5, 81], [30.5, 75]); // "M28 89 q-1.5 -8 2.5 -14"
// The headband's loose ends: "M24 62 q-9 -2 -12 -11" and "M25 60 q-4 -7 -2 -14".
const TAILS = [quad([24, 62], [15, 60], [12, 51]), quad([25, 60], [21, 53], [23, 46])];
const KNOT = hex('#a9dc2a'), BROW = hex('#16181c');
// The game face: a half-lidded eye (flat, slanted lid over a round bottom) for the eye at cx. s is 1 left, -1 right.
const sdGameEye = (x, y, cx, s) => {
  const lid = 80 + ((x - (cx - 6 * s)) / (12 * s)) * 3.5; // the lid runs from 80 on the outside to 83.5 by the nose
  const bowl = y > 86 ? Math.hypot(x - cx, y - 86) - 6 : Math.abs(x - cx) - 6;
  return Math.max(bowl, lid - y);
};

function render(size, { rounded }) {
  const px = Buffer.alloc(size * size * 4);
  // Bro fills about 60% of the tile, inside the safe zone of a maskable icon.
  const K = 78, CX = 60, CY = 68;
  const aaU = (1.5 / size) * K; // anti-aliasing width, in mascot units
  const cov = (d) => Math.min(1, Math.max(0, 0.5 - d / (2 * aaU)));
  const aa = 1.5 / size;
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1, y = ((j + 0.5) / size) * 2 - 1;
      let c = mix(BG1, BG2, Math.min(1, Math.hypot(x, y + 0.25) / 1.5));
      const a = rounded ? Math.min(1, Math.max(0, 0.5 - sdRoundRect(x, y, 0, 0, 1, 1, 0.44) / (2 * aa))) : 1;
      const blend = (col, k) => { c = mix(c, col, Math.min(1, Math.max(0, k))); };
      blend(GLOW, 0.34 * Math.max(0, 1 - Math.hypot(x, y - 0.05) / 1.05) ** 2); // soft lime light behind Bro

      const mx = CX + x * K, my = CY + y * K;
      blend(KNOT, Math.max(...TAILS.map((t) => cov(sdPolyline(mx, my, t) - 2.75)))); // behind the body
      blend(HANDLE_COL, cov(sdPolyline(mx, my, HANDLE) - 5.5));
      // Rounder on top (radius 34) than underneath (22): the flat base of the SVG body.
      const body = cov(sdRoundRect(mx, my, 60, 80, 41, 34, my < 80 ? 34 : 22));
      if (body > 0) {
        const t = Math.min(1, Math.max(0, ((mx - 19) * 49.2 + (my - 46) * 68) / 7045)); // the SVG's diagonal gradient
        blend(t < 0.45 ? mix(IRON_HI, IRON, t / 0.45) : mix(IRON, IRON_LO, (t - 0.45) / 0.55), body);
        blend(BAND, body * cov(Math.abs(my - 62.5) - 5.5)); // sweatband
        blend(BLACK, 0.14 * body * cov(Math.abs(my - 66.75) - 1.25)); // its shadow edge
        blend(WHITE, 0.4 * cov(sdPolyline(mx, my, SHINE) - 2.25)); // highlight on the iron
        blend(WHITE, Math.max(cov(sdGameEye(mx, my, 46, 1)), cov(sdGameEye(mx, my, 74, -1)))); // eyes
        blend(DARK, Math.max(cov(Math.hypot(mx - 47, my - 86.8) - 2.7), cov(Math.hypot(mx - 73, my - 86.8) - 2.7)));
        blend(BROW, Math.max(cov(sdSegment(mx, my, [38.5, 76.8], [53.5, 81.2]) - 1.7), cov(sdSegment(mx, my, [81.5, 76.8], [66.5, 81.2]) - 1.7)));
        blend(LIGHT, cov(sdPolyline(mx, my, SMILE) - 1.75));
      }
      blend(KNOT, cov(Math.hypot(mx - 24.5, my - 62.5) - 4.6)); // the knot, on top of the band's edge
      const o = (j * size + i) * 4;
      px[o] = Math.round(c[0]); px[o + 1] = Math.round(c[1]); px[o + 2] = Math.round(c[2]); px[o + 3] = Math.round(a * 255);
    }
  }
  return png(size, px);
}

fs.writeFileSync(path.join(OUT, 'icon-192.png'), render(192, { rounded: false }));
fs.writeFileSync(path.join(OUT, 'icon-512.png'), render(512, { rounded: false }));
fs.writeFileSync(path.join(OUT, 'apple-touch-icon.png'), render(180, { rounded: false }));
console.log('icons written to', OUT);
