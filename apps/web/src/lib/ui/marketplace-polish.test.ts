import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const rootSource = readFileSync(
  new URL("../../app/page.tsx", import.meta.url),
  "utf8",
);
const heroSource = readFileSync(
  new URL("../../components/ui/marketplace/brand-hero.tsx", import.meta.url),
  "utf8",
);
const locationSource = readFileSync(
  new URL("../../components/discovery/location-picker.tsx", import.meta.url),
  "utf8",
);
const messagesSource = readFileSync(
  new URL("../../app/(account)/messages/page.tsx", import.meta.url),
  "utf8",
);
const activitySource = readFileSync(
  new URL(
    "../../app/(account)/account/notifications/page.tsx",
    import.meta.url,
  ),
  "utf8",
);
const cssSource = readFileSync(
  new URL("../../app/globals.css", import.meta.url),
  "utf8",
);

describe("marketplace polish contracts", () => {
  it("gives the home hero and search panel layered depth", () => {
    expect(heroSource).toContain("brand-hero-panel");
    expect(heroSource).toContain("shadow");
    expect(rootSource).toContain("brand-hero-search");
  });

  it("offers explicit device location with a manual and remote fallback", () => {
    expect(locationSource).toContain(
      "navigator.geolocation.getCurrentPosition",
    );
    expect(locationSource).toContain("Usar mi ubicación");
    expect(locationSource).toContain("Sin ubicación");
    expect(rootSource).toContain("mode=remoto");
  });

  it("uses premium action surfaces in authenticated empty states", () => {
    expect(messagesSource).toContain("empty-state-card");
    expect(messagesSource).toContain("chevron");
    expect(activitySource).toContain("empty-state-card");
    expect(activitySource).toContain("settings-card");
  });

  it("defines shared depth and interaction tokens", () => {
    expect(cssSource).toContain("--consumer-shadow-card");
    expect(cssSource).toContain("--consumer-shadow-float");
    expect(cssSource).toContain("--consumer-shadow-hero");
    expect(cssSource).toContain("--consumer-surface-raised");
  });
});
