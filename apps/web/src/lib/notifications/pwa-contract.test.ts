import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import sharp from "sharp";

import manifest from "@/app/manifest";

describe("Phase 08 PWA contract", () => {
  it("publishes installable 192px and 512px application icons", () => {
    const appManifest = manifest();
    const sizes = new Set(appManifest.icons?.map((icon) => icon.sizes));

    expect(appManifest.display).toBe("standalone");
    expect(sizes.has("192x192")).toBe(true);
    expect(sizes.has("512x512")).toBe(true);
  });

  it("keeps private navigation network-first and provides an offline shell", () => {
    const worker = readFileSync(
      join(process.cwd(), "apps/web/public/sw.js"),
      "utf8",
    );

    expect(worker).toContain("/offline");
    expect(worker).toContain('request.mode === "navigate"');
    expect(worker).toContain("event.respondWith(fetch(request)");
  });

  it("reloads only after the user explicitly accepts a waiting service worker", () => {
    const register = readFileSync(
      join(
        process.cwd(),
        "apps/web/src/components/pwa/service-worker-register.tsx",
      ),
      "utf8",
    );

    expect(register).toContain("reloadOnControllerChange.current = true");
    expect(register).toContain("if (reloadOnControllerChange.current)");
    expect(register).toContain('postMessage({ type: "SKIP_WAITING" })');
  });

  it("renders the real push payload with a generic fallback and safe click roots", () => {
    const worker = readFileSync(
      join(process.cwd(), "apps/web/public/sw.js"),
      "utf8",
    );

    expect(worker).toContain('addEventListener("push"');
    expect(worker).toContain('addEventListener("notificationclick"');
    expect(worker).toContain("event.data.json()");
    expect(worker).toContain("showNotification(title");
    expect(worker).toContain("data: { actionUrl }");
    expect(worker).toContain(
      'const SAFE_ACTION_ROOTS = ["/messages", "/jobs", "/account", "/provider"]',
    );
    expect(worker).toContain("Tenés una actualización importante.");
    expect(worker).toContain('matchAll({ type: "window"');
    expect(worker).toContain("clients.openWindow(actionUrl)");
  });

  it("resolves the offline image fallback across all caches, not only the image cache", () => {
    const worker = readFileSync(
      join(process.cwd(), "apps/web/public/sw.js"),
      "utf8",
    );

    expect(worker).toContain('caches.match("/icon-192.png")');
    expect(worker).not.toContain("cache.match(STATIC_URLS[2])");
  });

  it("regenerates centered YALO assets reproducibly with the maskable art inside the 40% safe circle", async () => {
    const appManifest = manifest();
    const maskable = appManifest.icons?.find(
      (icon) => icon.purpose === "maskable",
    );
    expect(maskable?.src).toBe("/icon-maskable-512.png");

    const output = mkdtempSync(join(tmpdir(), "yalo-assets-"));
    const script = join(
      process.cwd(),
      "apps/web/scripts/generate-pwa-assets.mjs",
    );
    const run = () =>
      execFileSync(process.execPath, [script, "--output-dir", output]);
    const digest = (files: string[]) =>
      createHash("sha256")
        .update(
          Buffer.concat(files.map((file) => readFileSync(join(output, file)))),
        )
        .digest("hex");

    try {
      run();
      const assets = [
        "icon-192.png",
        "icon-512.png",
        "icon-maskable-512.png",
        "apple-touch-icon.png",
        "icon-192.svg",
        "icon-512.svg",
        "src/app/icon.svg",
        "src/app/apple-icon.png",
        "brand/yalo-icon-master.svg",
        "brand/yalo-wordmark-white.svg",
        "brand/yalo-wordmark-navy.svg",
        "brand/yalo-symbol-mono-white.svg",
        "brand/yalo-symbol-mono-navy.svg",
        "brand/yalo-logo-primary-dark.svg",
        "brand/yalo-logo-horizontal-dark.svg",
        "brand/yalo-logo-horizontal-light.svg",
      ];
      const first = digest(assets);
      run();
      expect(digest(assets)).toBe(first);
      expect(readdirSync(output)).not.toContain("screenshots");

      for (const [file, size, expectedWidth] of [
        ["icon-512.png", 512, 0.65],
        ["icon-maskable-512.png", 512, 0.6],
        ["apple-touch-icon.png", 180, 0.65],
      ] as const) {
        const { data, info } = await sharp(join(output, file))
          .raw()
          .toBuffer({ resolveWithObject: true });
        expect(info.channels).toBe(4);
        const artwork: Array<[number, number]> = [];
        for (let y = 0; y < info.height; y += 1) {
          for (let x = 0; x < info.width; x += 1) {
            const offset = (y * info.width + x) * info.channels;
            const red = data[offset]!;
            const green = data[offset + 1]!;
            const blue = data[offset + 2]!;
            const alpha = data[offset + 3]!;
            if (
              alpha > 0 &&
              Math.abs(red - 13) + Math.abs(green - 18) + Math.abs(blue - 27) >
                80
            ) {
              artwork.push([x, y]);
            }
          }
        }
        const bounds = artwork.reduce<{
          left: number;
          right: number;
          top: number;
          bottom: number;
        }>(
          (box, [x, y]) => ({
            left: Math.min(box.left, x),
            right: Math.max(box.right, x),
            top: Math.min(box.top, y),
            bottom: Math.max(box.bottom, y),
          }),
          { left: size, right: 0, top: size, bottom: 0 },
        );
        const { left, right, top, bottom } = bounds;
        const center = (size - 1) / 2;
        expect(artwork.length).toBeGreaterThan(1000);
        expect((right - left + 1) / size).toBeGreaterThan(expectedWidth - 0.06);
        expect((right - left + 1) / size).toBeLessThan(expectedWidth + 0.06);
        expect((left + right) / 2).toBeCloseTo(center, 0);
        expect((top + bottom) / 2).toBeCloseTo(center, 0);

        if (file === "icon-maskable-512.png") {
          expect(
            [...data]
              .filter((_, index) => index % 4 === 3)
              .every((alpha) => alpha === 255),
          ).toBe(true);
          expect(
            artwork.every(
              ([x, y]) => Math.hypot(x - center, y - center) <= size * 0.4 + 2,
            ),
          ).toBe(true);
        }
        if (file === "apple-touch-icon.png") {
          expect(
            [...data]
              .filter((_, index) => index % 4 === 3)
              .every((alpha) => alpha === 255),
          ).toBe(true);
        }
      }
    } finally {
      rmSync(output, { recursive: true, force: true });
    }
  });
});
