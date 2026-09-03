// Derives every brand asset from assets/logo-source.png.
//
// Run with `npm run icons` after replacing the source logo. Node's zlib is the
// only dependency: the PNG is decoded, trimmed, box-resampled and re-encoded
// by hand so the repo stays free of image tooling.

import { deflateSync, inflateSync } from 'node:zlib';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';

const SRC = 'assets/logo-source.png';
const OUT = 'public';

// ── PNG codec ─────────────────────────────────────────────────────────────
const CRC_TABLE = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xEDB88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(buf) {
  let crc = 0xFFFFFFFF;
  for (const b of buf) crc = CRC_TABLE[(crc ^ b) & 0xFF] ^ (crc >>> 8);
  return (crc ^ 0xFFFFFFFF) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body));
  return Buffer.concat([len, body, crc]);
}

function decodePng(path) {
  const buf = readFileSync(path);
  let o = 8, w = 0, h = 0, channels = 3;
  const idat = [];
  while (o < buf.length) {
    const len = buf.readUInt32BE(o);
    const type = buf.slice(o + 4, o + 8).toString('ascii');
    if (type === 'IHDR') {
      w = buf.readUInt32BE(o + 8);
      h = buf.readUInt32BE(o + 12);
      if (buf[o + 16] !== 8) throw new Error('only 8-bit PNGs supported');
      channels = buf[o + 17] === 6 ? 4 : buf[o + 17] === 2 ? 3 : 0;
      if (!channels) throw new Error('only RGB/RGBA PNGs supported');
      if (buf[o + 20] !== 0) throw new Error('interlaced PNGs not supported');
    } else if (type === 'IDAT') {
      idat.push(buf.slice(o + 8, o + 8 + len));
    } else if (type === 'IEND') break;
    o += 12 + len;
  }

  const raw = inflateSync(Buffer.concat(idat));
  const stride = w * channels;
  const out = Buffer.alloc(w * h * 3);
  const prev = Buffer.alloc(stride);
  const line = Buffer.alloc(stride);

  for (let y = 0; y < h; y++) {
    const filter = raw[y * (stride + 1)];
    raw.copy(line, 0, y * (stride + 1) + 1, y * (stride + 1) + 1 + stride);
    for (let i = 0; i < stride; i++) {
      const a = i >= channels ? line[i - channels] : 0;
      const b = prev[i];
      const c = i >= channels ? prev[i - channels] : 0;
      let v = line[i];
      if (filter === 1) v += a;
      else if (filter === 2) v += b;
      else if (filter === 3) v += (a + b) >> 1;
      else if (filter === 4) {
        const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
        v += pa <= pb && pa <= pc ? a : pb <= pc ? b : c;
      }
      line[i] = v & 0xFF;
    }
    for (let x = 0; x < w; x++) {
      out[(y * w + x) * 3]     = line[x * channels];
      out[(y * w + x) * 3 + 1] = line[x * channels + 1];
      out[(y * w + x) * 3 + 2] = line[x * channels + 2];
    }
    line.copy(prev);
  }
  return { w, h, data: out };
}

function encodePng({ w, h, data }) {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8; ihdr[9] = 2;
  const stride = w * 3;
  const raw = Buffer.alloc((stride + 1) * h);
  const candidate = Buffer.alloc(stride);
  const best = Buffer.alloc(stride);

  // Adaptive filtering: try all five and keep the row with the lowest sum of
  // absolute deltas, which is what shrinks flat illustration art the most.
  for (let y = 0; y < h; y++) {
    let bestScore = Infinity, bestType = 0;
    for (let type = 0; type < 5; type++) {
      let score = 0;
      for (let i = 0; i < stride; i++) {
        const cur = data[y * stride + i];
        const a = i >= 3 ? data[y * stride + i - 3] : 0;
        const b = y > 0 ? data[(y - 1) * stride + i] : 0;
        const c = y > 0 && i >= 3 ? data[(y - 1) * stride + i - 3] : 0;
        let v;
        if (type === 0) v = cur;
        else if (type === 1) v = cur - a;
        else if (type === 2) v = cur - b;
        else if (type === 3) v = cur - ((a + b) >> 1);
        else {
          const p = a + b - c, pa = Math.abs(p - a), pb = Math.abs(p - b), pc = Math.abs(p - c);
          v = cur - (pa <= pb && pa <= pc ? a : pb <= pc ? b : c);
        }
        v &= 0xFF;
        candidate[i] = v;
        score += v < 128 ? v : 256 - v;
      }
      if (score < bestScore) { bestScore = score; bestType = type; candidate.copy(best); }
    }
    raw[y * (stride + 1)] = bestType;
    best.copy(raw, y * (stride + 1) + 1);
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ── Image ops ─────────────────────────────────────────────────────────────
const px = (img, x, y) => {
  const o = (y * img.w + x) * 3;
  return [img.data[o], img.data[o + 1], img.data[o + 2]];
};

/** Bounding box of everything that differs from the corner background colour. */
function contentBounds(img, { top = 0, bottom = 1, tolerance = 14 } = {}) {
  const [br, bg, bb] = px(img, 2, 2);
  let minX = img.w, minY = img.h, maxX = -1, maxY = -1;
  const y0 = Math.floor(img.h * top), y1 = Math.floor(img.h * bottom);
  for (let y = y0; y < y1; y++) {
    for (let x = 0; x < img.w; x++) {
      const [r, g, b] = px(img, x, y);
      if (Math.abs(r - br) + Math.abs(g - bg) + Math.abs(b - bb) > tolerance) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  return maxX < 0 ? { x:0, y:0, w:img.w, h:img.h } : { x:minX, y:minY, w:maxX - minX + 1, h:maxY - minY + 1 };
}

function crop(img, { x, y, w, h }) {
  const data = Buffer.alloc(w * h * 3);
  for (let j = 0; j < h; j++) {
    img.data.copy(data, j * w * 3, ((y + j) * img.w + x) * 3, ((y + j) * img.w + x + w) * 3);
  }
  return { w, h, data };
}

/** Box-filter downscale — averages source pixels, so edges stay smooth. */
function resize(img, dw, dh) {
  const data = Buffer.alloc(dw * dh * 3);
  const sx = img.w / dw, sy = img.h / dh;
  for (let y = 0; y < dh; y++) {
    const y0 = Math.floor(y * sy), y1 = Math.max(y0 + 1, Math.floor((y + 1) * sy));
    for (let x = 0; x < dw; x++) {
      const x0 = Math.floor(x * sx), x1 = Math.max(x0 + 1, Math.floor((x + 1) * sx));
      let r = 0, g = 0, b = 0, n = 0;
      for (let j = y0; j < Math.min(y1, img.h); j++) {
        for (let i = x0; i < Math.min(x1, img.w); i++) {
          const o = (j * img.w + i) * 3;
          r += img.data[o]; g += img.data[o + 1]; b += img.data[o + 2]; n++;
        }
      }
      const o = (y * dw + x) * 3;
      data[o] = r / n; data[o + 1] = g / n; data[o + 2] = b / n;
    }
  }
  return { w: dw, h: dh, data };
}

/** Centres `img` on a square of `size`, scaled to `fill` of the edge length. */
function square(img, size, fill, bgColor) {
  const canvas = { w: size, h: size, data: Buffer.alloc(size * size * 3) };
  for (let i = 0; i < size * size; i++) {
    canvas.data[i * 3] = bgColor[0]; canvas.data[i * 3 + 1] = bgColor[1]; canvas.data[i * 3 + 2] = bgColor[2];
  }
  const target = Math.round(size * fill);
  const scale = Math.min(target / img.w, target / img.h);
  const dw = Math.max(1, Math.round(img.w * scale));
  const dh = Math.max(1, Math.round(img.h * scale));
  const small = resize(img, dw, dh);
  const ox = Math.round((size - dw) / 2), oy = Math.round((size - dh) / 2);
  for (let y = 0; y < dh; y++) {
    small.data.copy(canvas.data, ((oy + y) * size + ox) * 3, y * dw * 3, (y + 1) * dw * 3);
  }
  return canvas;
}

// ── Build ─────────────────────────────────────────────────────────────────
mkdirSync(OUT, { recursive: true });
const src = decodePng(SRC);
const bg = px(src, 2, 2);

// Full lock-up (emblem + wordmark), trimmed and downscaled for the web.
const full = crop(src, (() => {
  const b = contentBounds(src);
  const pad = Math.round(src.w * 0.02);
  return {
    x: Math.max(0, b.x - pad), y: Math.max(0, b.y - pad),
    w: Math.min(src.w, b.w + pad * 2), h: Math.min(src.h, b.h + pad * 2),
  };
})());
writeFileSync(`${OUT}/logo.png`, encodePng(resize(full, 480, Math.round(480 * full.h / full.w))));

// Emblem only: the top ~60 % holds the raised bed, the wordmark sits below it.
const markBounds = contentBounds(src, { top: 0.05, bottom: 0.58 });
const mark = crop(src, markBounds);
writeFileSync(`${OUT}/logo-mark.png`, encodePng(resize(mark, 224, Math.round(224 * mark.h / mark.w))));

// App icons. 0.72 fill keeps the emblem inside a maskable icon's safe circle.
writeFileSync(`${OUT}/icon-192.png`, encodePng(square(mark, 192, 0.74, bg)));
writeFileSync(`${OUT}/icon-512.png`, encodePng(square(mark, 512, 0.74, bg)));
writeFileSync(`${OUT}/apple-touch-icon.png`, encodePng(square(mark, 180, 0.80, bg)));
writeFileSync(`${OUT}/favicon-64.png`, encodePng(square(mark, 64, 0.92, bg)));

console.log('logo bounds', markBounds, 'bg', bg);
console.log('assets written to public/');
