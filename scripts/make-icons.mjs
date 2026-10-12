// Renders the GymXP app icon (dumbbell inside a gold "level" ring) to PNGs, no dependencies.
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

// Signed distance helpers in a [-1, 1] coordinate space.
const sdRoundRect = (x, y, cx, cy, hw, hh, r) => {
  const qx = Math.abs(x - cx) - hw + r, qy = Math.abs(y - cy) - hh + r;
  return Math.hypot(Math.max(qx, 0), Math.max(qy, 0)) + Math.min(Math.max(qx, qy), 0) - r;
};
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];
const BG1 = hex('#151a24'), BG2 = hex('#07090d'), GREEN = hex('#6ef09a'), GOLD = hex('#f6c847'), TRACK = hex('#232937');

function render(size, { rounded }) {
  const px = Buffer.alloc(size * size * 4);
  const aa = 1.5 / size;
  const cov = (d) => Math.min(1, Math.max(0, 0.5 - d / (2 * aa)));
  for (let j = 0; j < size; j++) {
    for (let i = 0; i < size; i++) {
      const x = ((i + 0.5) / size) * 2 - 1, y = ((j + 0.5) / size) * 2 - 1;
      const t = (y + 1) / 2;
      let c = BG1.map((v, k) => v * (1 - t) + BG2[k] * t);
      let a = rounded ? cov(sdRoundRect(x, y, 0, 0, 1, 1, 0.44)) : 1;
      const blend = (col, k) => { c = c.map((v, n) => v * (1 - k) + col[n] * k); };

      // Level ring: track + gold arc covering 75% (starting at top, clockwise)
      const r = Math.hypot(x, y);
      const ring = Math.abs(r - 0.62) - 0.055;
      let ang = Math.atan2(x, -y); if (ang < 0) ang += Math.PI * 2;
      blend(TRACK, cov(ring));
      if (ang <= Math.PI * 2 * 0.75) blend(GOLD, cov(ring));

      // Dumbbell
      const d = Math.min(
        sdRoundRect(x, y, 0, 0, 0.3, 0.045, 0.04), // bar
        sdRoundRect(x, y, -0.27, 0, 0.055, 0.2, 0.04), // inner plates
        sdRoundRect(x, y, 0.27, 0, 0.055, 0.2, 0.04),
        sdRoundRect(x, y, -0.38, 0, 0.04, 0.13, 0.03), // outer plates
        sdRoundRect(x, y, 0.38, 0, 0.04, 0.13, 0.03),
      );
      blend(GREEN, cov(d));
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
