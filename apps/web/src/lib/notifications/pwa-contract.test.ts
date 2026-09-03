import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

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

  it(
    "handles push and notification clicks without embedding private payload copy",
    () => {
      const worker = readFileSync(
        join(process.cwd(), "apps/web/public/sw.js"),
        "utf8",
      );

      expect(worker).toContain('addEventListener("push"');
      expect(worker).toContain('addEventListener("notificationclick"');
      expect(worker).toContain("Tenés una actualización importante.");
      expect(worker).not.toContain("event.data.text");
      expect(worker).not.toContain("event.data.json");
    },
  );
});
