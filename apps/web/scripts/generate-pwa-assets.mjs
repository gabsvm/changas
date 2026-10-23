// Regeneración: `node scripts/generate-pwa-assets.mjs` desde `apps/web`.
// El único origen editable de la silueta y las letras está en public/brand.

import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const appRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputArgs = process.argv.slice(2);
const publicRoot = outputDirectory(outputArgs);
const appOutputRoot = outputArgs.length
  ? join(publicRoot, "src", "app")
  : join(appRoot, "src", "app");
const brandRoot = join(appRoot, "public", "brand");
const NAVY = "#0D121B";
const WHITE = "#FFFFFF";
const TAGLINE = "TRABAJÁ · CONTRATÁ · CRECÉ";

function outputDirectory(args) {
  if (args.length === 0) return join(appRoot, "public");
  if (args.length !== 2 || args[0] !== "--output-dir") {
    throw new Error(
      "Uso: node scripts/generate-pwa-assets.mjs [--output-dir <directorio>]",
    );
  }
  return resolve(args[1]);
}

function svgBody(svg) {
  const match = svg.match(/<svg\b[^>]*>([\s\S]*?)<\/svg>/i);
  if (!match)
    throw new Error("El SVG fuente no contiene una raíz <svg> válida");
  return match[1]
    .replace(/<title\b[^>]*>[\s\S]*?<\/title>/i, "")
    .replace(/<desc\b[^>]*>[\s\S]*?<\/desc>/i, "")
    .replace(/[ \t]+$/gm, "")
    .trim();
}

function rootSvg(width, height, content, viewBox = `0 0 ${width} ${height}`) {
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="${viewBox}">${content}</svg>\n`;
}

function symbolSvg(body, color) {
  return rootSvg(
    320,
    256,
    body
      .replace(/stroke="url\(#yalo-body\)"/g, `stroke="${color}"`)
      .replace(/fill="#12D9C5"/g, `fill="${color}"`),
  );
}

function wordmarkSvg(template, color) {
  if (!template.includes('fill="COLOR"'))
    throw new Error('El template de lettering debe conservar fill="COLOR"');
  return template.replaceAll('fill="COLOR"', `fill="${color}"`);
}

function placeSymbol(body, x, y, width) {
  const height = (width * 256) / 320;
  return `<svg x="${x}" y="${y}" width="${width}" height="${height}" viewBox="0 0 320 256" preserveAspectRatio="xMidYMid meet">${body}</svg>`;
}

function iconSvg(body, size, widthRatio, rounded) {
  const width = size * widthRatio;
  const height = (width * 256) / 320;
  const x = (size - width) / 2;
  const y = (size - height) / 2;
  const radius = rounded ? (size * 118) / 512 : 0;
  return rootSvg(
    size,
    size,
    `<rect width="${size}" height="${size}" rx="${radius}" fill="${NAVY}"/>${placeSymbol(body, x, y, width)}`,
  );
}

async function saveSvg(relativePath, svg) {
  const target = join(publicRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, svg);
  return target;
}

async function saveAppSvg(relativePath, svg) {
  const target = join(appOutputRoot, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await writeFile(target, svg);
}

async function rasterize(svg, relativePath, size, baseDirectory = publicRoot) {
  const target = join(baseDirectory, relativePath);
  await mkdir(dirname(target), { recursive: true });
  await sharp(Buffer.from(svg))
    .resize(size, size)
    .ensureAlpha()
    .png()
    .toFile(target);
  const { width, height, channels } = await sharp(target).metadata();
  if (width !== size || height !== size || channels !== 4)
    throw new Error(
      `${relativePath}: salida PNG inválida (${width}x${height}, ${channels} canales)`,
    );
  console.log(`ok ${relativePath} ${width}x${height}`);
}

const sourceSymbol = await readFile(join(brandRoot, "yalo-symbol.svg"), "utf8");
const sourceWordmark = await readFile(
  join(brandRoot, "yalo-wordmark-template.svg"),
  "utf8",
);
const body = svgBody(sourceSymbol);
const wordmarkWhite = wordmarkSvg(sourceWordmark, WHITE);
const wordmarkNavy = wordmarkSvg(sourceWordmark, NAVY);

const icon512 = iconSvg(body, 512, 0.65, true);
const icon192 = iconSvg(body, 192, 0.65, true);
const maskable = iconSvg(body, 512, 0.6, false);
const appleIcon = iconSvg(body, 180, 0.65, false);
const vertical = rootSvg(
  512,
  540,
  `<rect width="512" height="540" fill="${NAVY}"/>${placeSymbol(body, 128, 100, 256)}<svg x="66" y="332" width="380" height="81" viewBox="0 0 600 128" preserveAspectRatio="xMidYMid meet">${svgBody(wordmarkWhite)}</svg><text x="256" y="450" fill="${WHITE}" font-family="Arial, sans-serif" font-size="14" letter-spacing="1.3" text-anchor="middle">${TAGLINE}</text>`,
);
const horizontalDark = rootSvg(
  520,
  160,
  `${placeSymbol(body, 16, 24, 140)}<svg x="190" y="25" width="300" height="64" viewBox="0 0 600 128" preserveAspectRatio="xMidYMid meet">${svgBody(wordmarkWhite)}</svg><text x="192" y="128" fill="${WHITE}" font-family="Arial, sans-serif" font-size="12" letter-spacing="1" text-anchor="start">${TAGLINE}</text>`,
);
const horizontalLight = rootSvg(
  520,
  160,
  `${placeSymbol(body, 16, 24, 140)}<svg x="190" y="25" width="300" height="64" viewBox="0 0 600 128" preserveAspectRatio="xMidYMid meet">${svgBody(wordmarkNavy)}</svg><text x="192" y="128" fill="${NAVY}" font-family="Arial, sans-serif" font-size="12" letter-spacing="1" text-anchor="start">${TAGLINE}</text>`,
);

await Promise.all([
  saveSvg("icon-192.svg", icon192),
  saveSvg("icon-512.svg", icon512),
  saveAppSvg("icon.svg", icon512),
  saveSvg("brand/yalo-icon-master.svg", icon512),
  saveSvg("brand/yalo-wordmark-white.svg", wordmarkWhite),
  saveSvg("brand/yalo-wordmark-navy.svg", wordmarkNavy),
  saveSvg("brand/yalo-symbol-mono-white.svg", symbolSvg(body, WHITE)),
  saveSvg("brand/yalo-symbol-mono-navy.svg", symbolSvg(body, NAVY)),
  saveSvg("brand/yalo-logo-primary-dark.svg", vertical),
  saveSvg("brand/yalo-logo-horizontal-dark.svg", horizontalDark),
  saveSvg("brand/yalo-logo-horizontal-light.svg", horizontalLight),
  rasterize(icon192, "icon-192.png", 192),
  rasterize(icon512, "icon-512.png", 512),
  rasterize(maskable, "icon-maskable-512.png", 512),
  rasterize(appleIcon, "apple-touch-icon.png", 180),
  rasterize(appleIcon, "apple-icon.png", 180, appOutputRoot),
]);
