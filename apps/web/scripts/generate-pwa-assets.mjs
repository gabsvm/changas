// Genera los assets PWA de Changas desde la identidad de marca
// (public/icon-512.svg + docs/design/changas-brand-system.md).
//
// Uso: `node scripts/generate-pwa-assets.mjs` desde `apps/web`.
// Cero dependencias: implementa un renderizador procedural + encoder PNG
// con `node:zlib`. Re-ejecutar pisa los PNG versionados en `public/`.
//
// Salidas:
// - public/icon-512.png, public/icon-192.png (purpose "any")
// - public/maskable-512.png (purpose "maskable", arte al ~78% centrado)
// - public/screenshots/inicio-390x844.png (form_factor "narrow")
// - public/screenshots/buscar-1280x720.png (form_factor "wide")

import { deflateSync } from "node:zlib";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const PUBLIC = join(root, "public");

// #region Utilidades de color

/** @param {string} hex @returns {[number, number, number]} */
function hex(hex) {
  const v = hex.replace("#", "");
  return [
    Number.parseInt(v.slice(0, 2), 16),
    Number.parseInt(v.slice(2, 4), 16),
    Number.parseInt(v.slice(4, 6), 16),
  ];
}

const GRADIENT_STOPS = [
  [0, hex("#FFC857")],
  [0.48, hex("#FF6B35")],
  [1, hex("#FF0A78")],
];

/** @param {number} t @returns {[number, number, number]} */
function brandGradient(t) {
  const clamped = Math.min(1, Math.max(0, t));
  for (let i = 1; i < GRADIENT_STOPS.length; i += 1) {
    const [t1, c1] = GRADIENT_STOPS[i - 1];
    const [t2, c2] = GRADIENT_STOPS[i];
    if (clamped <= t2) {
      const k = (clamped - t1) / (t2 - t1 || 1);
      return [
        Math.round(c1[0] + (c2[0] - c1[0]) * k),
        Math.round(c1[1] + (c2[1] - c1[1]) * k),
        Math.round(c1[2] + (c2[2] - c1[2]) * k),
      ];
    }
  }
  return GRADIENT_STOPS[GRADIENT_STOPS.length - 1][1];
}

// #endregion

// #region Lienzo + SDF

/**
 * @param {number} w @param {number} h
 * @param {[number, number, number, number]} fill
 */
function canvas(w, h, fill) {
  const data = Buffer.alloc(w * h * 4);
  for (let i = 0; i < w * h; i += 1) {
    data[i * 4] = fill[0];
    data[i * 4 + 1] = fill[1];
    data[i * 4 + 2] = fill[2];
    data[i * 4 + 3] = fill[3];
  }
  return { w, h, data };
}

/** @param {{w:number,h:number,data:Buffer}} img @param {number} x @param {number} y @param {[number,number,number]} rgb @param {number} a */
function blend(img, x, y, rgb, a) {
  if (x < 0 || y < 0 || x >= img.w || y >= img.h || a <= 0) return;
  const i = (y * img.w + x) * 4;
  const alpha = Math.min(1, a);
  const dstA = img.data[i + 3] / 255;
  const outA = alpha + dstA * (1 - alpha);
  if (outA <= 0) return;
  img.data[i] = Math.round((rgb[0] * alpha + img.data[i] * dstA * (1 - alpha)) / outA);
  img.data[i + 1] = Math.round((rgb[1] * alpha + img.data[i + 1] * dstA * (1 - alpha)) / outA);
  img.data[i + 2] = Math.round((rgb[2] * alpha + img.data[i + 2] * dstA * (1 - alpha)) / outA);
  img.data[i + 3] = Math.round(outA * 255);
}

function smoothstep(edge0, edge1, x) {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0 || 1)));
  return t * t * (3 - 2 * t);
}

/** Distancia con signo a un rect redondeado. */
function sdRoundRect(px, py, x, y, w, h, r) {
  const cx = x + w / 2;
  const cy = y + h / 2;
  const qx = Math.abs(px - cx) - (w / 2 - r);
  const qy = Math.abs(py - cy) - (h / 2 - r);
  const ax = Math.max(qx, 0);
  const ay = Math.max(qy, 0);
  return Math.hypot(ax, ay) + Math.min(Math.max(qx, qy), 0) - r;
}

/**
 * Rellena un rect redondeado con antialiasing.
 * @param {(u:number,v:number)=>[number,number,number]} paint color por posición normalizada
 */
function fillRoundRect(img, x, y, w, h, r, paint, alpha = 1) {
  const aa = 1.25;
  const x0 = Math.max(0, Math.floor(x - 2));
  const y0 = Math.max(0, Math.floor(y - 2));
  const x1 = Math.min(img.w - 1, Math.ceil(x + w + 2));
  const y1 = Math.min(img.h - 1, Math.ceil(y + h + 2));
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const d = sdRoundRect(px + 0.5, py + 0.5, x, y, w, h, r);
      const cover = 1 - smoothstep(-aa, aa, d);
      if (cover <= 0) continue;
      const u = (px + 0.5 - x) / w;
      const v = (py + 0.5 - y) / h;
      blend(img, px, py, paint(u, v), alpha * cover);
    }
  }
}

/** Gradiente de marca en diagonal del bbox. */
const brandPaint = (u, v) => brandGradient((u + v) / 2);

/** Dibuja la "C" de Changas como anillo abierto hacia la derecha. */
function drawBrandC(img, cx, cy, rOuter, thickness, color, alpha = 1) {
  const aa = 1.25;
  const rMid = rOuter - thickness / 2;
  const half = thickness / 2;
  const gapHalf = (38 * Math.PI) / 180;
  const x0 = Math.max(0, Math.floor(cx - rOuter - 2));
  const y0 = Math.max(0, Math.floor(cy - rOuter - 2));
  const x1 = Math.min(img.w - 1, Math.ceil(cx + rOuter + 2));
  const y1 = Math.min(img.h - 1, Math.ceil(cy + rOuter + 2));
  for (let py = y0; py <= y1; py += 1) {
    for (let px = x0; px <= x1; px += 1) {
      const dx = px + 0.5 - cx;
      const dy = py + 0.5 - cy;
      const dist = Math.hypot(dx, dy);
      let d = Math.abs(dist - rMid) - half;
      const ang = Math.atan2(dy, dx);
      if (Math.abs(ang) < gapHalf && dx > 0) d = Math.max(d, gapHalf * dist * 0.35 + 2);
      const cover = 1 - smoothstep(-aa, aa, d);
      if (cover > 0) blend(img, px, py, color, alpha * cover);
    }
  }
}

/** Barras decorativas del ícono (lado izquierdo, como en icon-512.svg). */
function drawBrandBars(img, s) {
  const white = [255, 255, 255];
  fillRoundRect(img, 70 * s, 184 * s, 80 * s, 18 * s, 9 * s, () => white);
  fillRoundRect(img, 52 * s, 228 * s, 108 * s, 20 * s, 10 * s, () => white);
  fillRoundRect(img, 80 * s, 274 * s, 104 * s, 18 * s, 9 * s, () => white);
}

// #endregion

// #region PNG

const CRC_TABLE = (() => {
  const t = new Int32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c;
  }
  return t;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i += 1) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type, "ascii");
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])));
  return Buffer.concat([len, typeBuf, data, crc]);
}

/** @param {{w:number,h:number,data:Buffer}} img */
function encodePng(img) {
  const raw = Buffer.alloc((img.w * 4 + 1) * img.h);
  for (let y = 0; y < img.h; y += 1) {
    raw[y * (img.w * 4 + 1)] = 0;
    img.data.copy(raw, y * (img.w * 4 + 1) + 1, y * img.w * 4, (y + 1) * img.w * 4);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(img.w, 0);
  ihdr.writeUInt32BE(img.h, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  return Buffer.concat([signature, chunk("IHDR", ihdr), chunk("IDAT", deflateSync(raw)), chunk("IEND", Buffer.alloc(0))]);
}

/** Reduce por promedio de área. */
function downsample(src, dw, dh) {
  const out = canvas(dw, dh, [0, 0, 0, 0]);
  const sx = src.w / dw;
  const sy = src.h / dh;
  for (let y = 0; y < dh; y += 1) {
    for (let x = 0; x < dw; x += 1) {
      const x0 = Math.floor(x * sx);
      const x1 = Math.min(src.w, Math.ceil((x + 1) * sx));
      const y0 = Math.floor(y * sy);
      const y1 = Math.min(src.h, Math.ceil((y + 1) * sy));
      let r = 0, g = 0, b = 0, a = 0, n = 0;
      for (let syI = y0; syI < y1; syI += 1) {
        for (let sxI = x0; sxI < x1; sxI += 1) {
          const i = (syI * src.w + sxI) * 4;
          r += src.data[i]; g += src.data[i + 1]; b += src.data[i + 2]; a += src.data[i + 3];
          n += 1;
        }
      }
      const o = (y * dw + x) * 4;
      out.data[o] = Math.round(r / n);
      out.data[o + 1] = Math.round(g / n);
      out.data[o + 2] = Math.round(b / n);
      out.data[o + 3] = Math.round(a / n);
    }
  }
  return out;
}

// #endregion

// #region Íconos

function renderIcon(size, { maskable = false } = {}) {
  const img = canvas(size, size, [0, 0, 0, 0]);
  const s = size / 512;
  if (maskable) {
    // Fondo pleno (sin puntas transparentes) y arte centrado al ~78%.
    fillRoundRect(img, 0, 0, size, size, 1, brandPaint);
    const k = 0.78;
    const cx = size / 2;
    const cy = size / 2;
    drawBrandC(img, cx - (256 - 245) * s * k, cy - (256 - 254) * s * k, 144 * s * k, 64 * s * k, [255, 255, 255]);
    // Barras reescaladas dentro del área segura.
    const bs = s * k;
    const ox = size / 2 - 256 * bs;
    const oy = size / 2 - 256 * bs;
    const white = [255, 255, 255];
    fillRoundRect(img, ox + 70 * bs, oy + 184 * bs, 80 * bs, 18 * bs, 9 * bs, () => white);
    fillRoundRect(img, ox + 52 * bs, oy + 228 * bs, 108 * bs, 20 * bs, 10 * bs, () => white);
    fillRoundRect(img, ox + 80 * bs, oy + 274 * bs, 104 * bs, 18 * bs, 9 * bs, () => white);
  } else {
    fillRoundRect(img, 0, 0, size, size, 128 * s, brandPaint);
    drawBrandC(img, 245 * s, 254 * s, 144 * s, 64 * s, [255, 255, 255]);
    drawBrandBars(img, s);
  }
  return img;
}

// #endregion

// #region Screenshots branded (mock esqueletal, sin texto rasterizado)

const CANVAS_BG = hex("#FFF9F3");
const INK = [32, 33, 36];
const CARD = [255, 253, 249];
const WHITE = [255, 255, 255];
const TINT = hex("#FFE3D3");

const bar = (a) => () => INK;
const whitePaint = () => WHITE;
const whiteBar = () => whitePaint;

function skeletonCard(img, x, y, w, h) {
  fillRoundRect(img, x, y, w, h, 20, () => CARD);
  // Avatar con gradiente de marca.
  fillRoundRect(img, x + 16, y + 16, 48, 48, 24, brandPaint);
  // Líneas de texto simuladas.
  fillRoundRect(img, x + 76, y + 22, w - 190, 14, 7, bar(), 0.22);
  fillRoundRect(img, x + 76, y + 44, w - 230, 12, 6, bar(), 0.14);
  // Pastilla de precio.
  fillRoundRect(img, x + w - 96, y + h - 48, 80, 32, 16, () => hex("#FF6B35"));
  fillRoundRect(img, x + w - 84, y + h - 38, 56, 12, 6, whiteBar(), 0.9);
  // Meta inferior.
  fillRoundRect(img, x + 16, y + h - 44, 120, 12, 6, bar(), 0.14);
}

function bottomNav(img) {
  const y = img.h - 84;
  fillRoundRect(img, 0, y, img.w, 84, 0, () => CARD);
  const n = 4;
  const gw = img.w / n;
  for (let i = 0; i < n; i += 1) {
    const cx = gw * i + gw / 2;
    if (i === 0) {
      fillRoundRect(img, cx - 20, y + 18, 40, 12, 6, () => hex("#FF6B35"));
    } else {
      fillRoundRect(img, cx - 14, y + 18, 28, 12, 6, bar(), 0.18);
    }
    fillRoundRect(img, cx - 24, y + 40, 48, 8, 4, bar(), 0.1);
  }
}

function renderMobileShot() {
  const W = 390;
  const H = 844;
  const img = canvas(W, H, [...CANVAS_BG, 255]);
  // Hero de marca.
  fillRoundRect(img, 16, 16, W - 32, 300, 28, brandPaint);
  fillRoundRect(img, 40, 48, 56, 56, 28, () => WHITE);
  drawBrandC(img, 68, 76, 19, 9, hex("#FF6B35"));
  fillRoundRect(img, 40, 124, 210, 18, 9, whiteBar(), 0.95);
  fillRoundRect(img, 40, 150, 150, 13, 6, whiteBar(), 0.7);
  fillRoundRect(img, 40, 196, 240, 11, 5, whiteBar(), 0.55);
  fillRoundRect(img, 40, 214, 190, 11, 5, whiteBar(), 0.55);
  fillRoundRect(img, 40, 252, 130, 36, 18, () => WHITE);
  fillRoundRect(img, 58, 265, 94, 11, 5, () => hex("#C84010"), 0.85);
  // Buscador.
  fillRoundRect(img, 16, 336, W - 32, 54, 27, () => WHITE);
  fillRoundRect(img, 34, 355, 18, 18, 9, bar(), 0.25);
  fillRoundRect(img, 62, 359, 170, 13, 6, bar(), 0.22);
  fillRoundRect(img, W - 92, 347, 60, 32, 16, () => hex("#FF6B35"));
  // Chips.
  const chips = [86, 110, 96];
  let cx = 16;
  chips.forEach((cw, i) => {
    if (i === 0) {
      fillRoundRect(img, cx, 404, cw, 34, 17, () => TINT);
      fillRoundRect(img, cx + 14, 416, cw - 28, 10, 5, () => hex("#C84010"), 0.7);
    } else {
      fillRoundRect(img, cx, 404, cw, 34, 17, () => WHITE);
      fillRoundRect(img, cx + 14, 416, cw - 28, 10, 5, bar(), 0.2);
    }
    cx += cw + 10;
  });
  // Cards.
  skeletonCard(img, 16, 452, W - 32, 140);
  skeletonCard(img, 16, 604, W - 32, 140);
  bottomNav(img);
  return img;
}

function renderWideShot() {
  const W = 1280;
  const H = 720;
  const img = canvas(W, H, [...CANVAS_BG, 255]);
  // Panel hero izquierdo.
  fillRoundRect(img, 48, 48, 400, H - 96, 32, brandPaint);
  fillRoundRect(img, 88, 104, 72, 72, 36, () => WHITE);
  drawBrandC(img, 124, 140, 24, 11, hex("#FF6B35"));
  fillRoundRect(img, 88, 208, 260, 24, 12, whiteBar(), 0.95);
  fillRoundRect(img, 88, 244, 200, 16, 8, whiteBar(), 0.7);
  fillRoundRect(img, 88, 300, 300, 13, 6, whiteBar(), 0.55);
  fillRoundRect(img, 88, 322, 250, 13, 6, whiteBar(), 0.55);
  fillRoundRect(img, 88, 380, 170, 48, 24, () => WHITE);
  fillRoundRect(img, 112, 400, 122, 13, 6, () => hex("#C84010"), 0.85);
  // Columna derecha: buscador + cards.
  const rx = 480;
  const rw = W - rx - 48;
  fillRoundRect(img, rx, 48, rw, 60, 30, () => WHITE);
  fillRoundRect(img, rx + 22, 70, 20, 20, 10, bar(), 0.25);
  fillRoundRect(img, rx + 54, 74, 260, 14, 7, bar(), 0.22);
  fillRoundRect(img, rx + rw - 110, 60, 88, 36, 18, () => hex("#FF6B35"));
  let chipX = rx;
  [120, 150, 130, 110].forEach((cw, i) => {
    if (i === 0) {
      fillRoundRect(img, chipX, 124, cw, 36, 18, () => TINT);
      fillRoundRect(img, chipX + 16, 137, cw - 32, 10, 5, () => hex("#C84010"), 0.7);
    } else {
      fillRoundRect(img, chipX, 124, cw, 36, 18, () => WHITE);
      fillRoundRect(img, chipX + 16, 137, cw - 32, 10, 5, bar(), 0.2);
    }
    chipX += cw + 12;
  });
  const cw2 = (rw - 24) / 3;
  for (let i = 0; i < 3; i += 1) {
    const x = rx + i * (cw2 + 12);
    fillRoundRect(img, x, 180, cw2, H - 228, 24, () => CARD);
    fillRoundRect(img, x + 20, 204, 56, 56, 28, brandPaint);
    fillRoundRect(img, x + 20, 280, cw2 - 40, 15, 7, bar(), 0.22);
    fillRoundRect(img, x + 20, 304, cw2 - 90, 12, 6, bar(), 0.14);
    fillRoundRect(img, x + 20, 330, cw2 - 70, 12, 6, bar(), 0.14);
    fillRoundRect(img, x + 20, H - 120, 110, 36, 18, () => hex("#FF6B35"));
    fillRoundRect(img, x + 36, H - 107, 78, 11, 5, whiteBar(), 0.9);
  }
  return img;
}

// #endregion

function save(img, rel) {
  const target = join(PUBLIC, rel);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, encodePng(img));
  // Autoverificación: firma PNG + dimensiones IHDR.
  const back = readFileSync(target);
  const pngSig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);
  if (!back.subarray(0, 8).equals(pngSig)) throw new Error(`${rel}: firma PNG inválida`);
  const w = back.readUInt32BE(16);
  const h = back.readUInt32BE(20);
  if (w !== img.w || h !== img.h) throw new Error(`${rel}: IHDR ${w}x${h}, esperado ${img.w}x${img.h}`);
  console.log(`ok ${rel} ${w}x${h} (${(back.length / 1024).toFixed(1)} KiB)`);
}

const iconMaster = renderIcon(512);
save(iconMaster, "icon-512.png");
save(downsample(iconMaster, 192, 192), "icon-192.png");
save(renderIcon(512, { maskable: true }), "maskable-512.png");
save(renderMobileShot(), "screenshots/inicio-390x844.png");
save(renderWideShot(), "screenshots/buscar-1280x720.png");
