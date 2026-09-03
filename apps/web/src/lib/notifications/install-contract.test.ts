import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 08 PWA install contract", () => {
  it("mounts a dedicated install prompt from the root layout", () => {
    const layout = source("apps/web/src/app/layout.tsx");

    expect(layout).toContain("InstallPrompt");
    expect(layout).toContain("<InstallPrompt />");
  });

  it("uses browser install events without prompting automatically", () => {
    const prompt = source("apps/web/src/components/pwa/install-prompt.tsx");

    expect(prompt).toContain("beforeinstallprompt");
    expect(prompt).toContain("(display-mode: standalone)");
    expect(prompt).toContain("navigator.standalone");
    expect(prompt).toContain("async function installApp");
    expect(prompt).toContain("await deferredPrompt.prompt()");
    expect(prompt).toContain('type="button"');
    expect(prompt).not.toMatch(/useEffect\([\s\S]{0,700}\.prompt\(\)/);
  });

  it("contains iOS add-to-home-screen guidance instead of fabricating a native prompt", () => {
    const prompt = source("apps/web/src/components/pwa/install-prompt.tsx");

    expect(prompt).toContain("Agregar a pantalla de inicio");
    expect(prompt).toContain("Compartir");
    expect(prompt).toContain("iPhone");
  });
});
