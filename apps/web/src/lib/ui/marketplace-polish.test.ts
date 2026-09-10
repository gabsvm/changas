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
const nearbySource = readFileSync(
  new URL(
    "../../components/ui/marketplace/nearby-service-rail.tsx",
    import.meta.url,
  ),
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
const installPromptSource = readFileSync(
  new URL("../../components/pwa/install-prompt.tsx", import.meta.url),
  "utf8",
);
const appHeaderSource = readFileSync(
  new URL("../../components/ui/marketplace/app-header.tsx", import.meta.url),
  "utf8",
);
const bottomNavSource = readFileSync(
  new URL("../../components/ui/authenticated-bottom-nav.tsx", import.meta.url),
  "utf8",
);
const emptyStateSource = readFileSync(
  new URL("../../components/ui/marketplace/empty-state.tsx", import.meta.url),
  "utf8",
);
const marketplaceManagementSource = readFileSync(
  new URL(
    "../../components/provider/marketplace-management.tsx",
    import.meta.url,
  ),
  "utf8",
);

describe("marketplace polish contracts", () => {
  it("gives the home feed a standalone search and quick-action depth", () => {
    expect(rootSource).toContain("home-search-panel");
    expect(rootSource).toContain("quick-action-card");
    expect(rootSource).toContain("shadow");
    expect(rootSource).not.toContain("<BrandHero");
    expect(heroSource).toContain("shadow");
  });

  it("offers explicit device location with a manual and remote fallback", () => {
    expect(locationSource).toContain(
      "navigator.geolocation.getCurrentPosition",
    );
    expect(locationSource).toContain("Usar mi ubicación");
    expect(locationSource).toContain("Sin ubicación");
    expect(rootSource).toContain("mode=remoto");
    expect(locationSource).toContain("findNearestManualLocation");
    expect(locationSource).toContain("Ubicación actual");
  });

  it("makes the compact location action right-aligned and explains its sheet", () => {
    expect(locationSource).toContain("justify-between");
    expect(locationSource).toContain("location-picker-sheet");
    expect(locationSource).toContain("¿Dónde estás buscando?");
    expect(locationSource).toContain("Usar mi ubicación actual");
    expect(locationSource).toContain('aria-modal="true"');
  });

  it("explains the public profile link without exposing technical slug jargon", () => {
    expect(marketplaceManagementSource).toContain("Enlace de tu perfil");
    expect(marketplaceManagementSource).toContain(
      "Se usa para crear el enlace que vas a compartir",
    );
    expect(marketplaceManagementSource).not.toContain('label="Slug público"');
  });

  it("keeps the primary hero action readable on narrow screens", () => {
    expect(rootSource).toContain("whitespace-nowrap");
    expect(rootSource).toContain("w-full");
  });

  it("organizes the home as a polished marketplace feed", () => {
    expect(rootSource).toContain("feed-home");
    expect(rootSource).toContain("Oficios populares");
    expect(rootSource).toContain("Profesionales destacados");
    expect(rootSource).toContain("Explorá por modalidad");
    expect(rootSource).toContain("Ofrecer mis servicios");
    expect(rootSource).toContain('layout="stack"');
    expect(rootSource).toContain("Garantía comunitaria");
    expect(nearbySource).toContain('layout?: "rail" | "stack"');
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

  it("keeps the install prompt above navigation and inside the safe viewport", () => {
    expect(installPromptSource).toContain("z-[60]");
    expect(installPromptSource).toContain("max-h-[calc(100dvh");
    expect(installPromptSource).toContain("overflow-y-auto");
    expect(installPromptSource).toContain("env(safe-area-inset-bottom)");
  });

  it("keeps authenticated headers and empty copy composed on mobile", () => {
    expect(messagesSource).toContain("max-w-[18rem]");
    expect(messagesSource).toContain("whitespace-nowrap");
    expect(activitySource).toContain("max-w-[22rem]");
    expect(emptyStateSource).toContain("px-5");
    expect(appHeaderSource).toContain("consumer-app-header");
  });

  it("uses visible focus without leaving a browser outline on touch navigation", () => {
    expect(bottomNavSource).toContain("focus-visible:ring");
    expect(bottomNavSource).toContain("outline-none");
  });
});
