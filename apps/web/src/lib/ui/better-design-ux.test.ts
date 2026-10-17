import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(new URL(path, import.meta.url), "utf8");
}

const cards = source("../../components/ui/marketplace/service-card.tsx");
const management = source(
  "../../components/provider/marketplace-management.tsx",
);
const home = source("../../app/page.tsx");
const showcaseCss = source("../../app/yalo-showcase.css");
const search = source("../../app/buscar/page.tsx");
const location = source("../../components/discovery/location-picker.tsx");
const notifications = source(
  "../../app/(account)/account/notifications/page.tsx",
);
const notificationActions = source(
  "../../app/(account)/account/notifications/actions.ts",
);
const install = source("../../components/pwa/install-prompt.tsx");
const update = source("../../components/pwa/service-worker-register.tsx");
const inbox = source("../../app/(account)/messages/page.tsx");
const conversations = source("../conversations/server.ts");

describe("Better Design audit — visual, safety and UX regressions", () => {
  it("never displays a rating star for unrated service cards", () => {
    expect(cards.match(/hasRating \? \(\s*<svg/g)?.length).toBe(2);
    expect(cards).toContain('"Nuevo en YALO"');
    expect(cards).toContain("Sin reseñas aún");
    expect(cards).toContain("inline-flex min-h-11");
  });

  it("asks before removing services and names the selected record", () => {
    expect(management).toContain(
      "const [confirming, setConfirming] = useState(false)",
    );
    expect(management).toContain("¿Eliminar {recordLabel}?");
    expect(management).toContain("Cancelar");
    expect(management).toContain('submitLabel="Sí, eliminar"');
    expect(management).toContain(
      'recordLabel={"el servicio «" + service.title + "»"}',
    );
  });

  it("acknowledges an unread notification before opening its internal URL", () => {
    expect(notifications).toContain("action={openNotificationAction}");
    expect(notificationActions).toContain(
      "await markNotificationRead(supabase, notificationId)",
    );
    expect(notificationActions).toContain(
      "redirect(sanitizeNotificationActionUrl(",
    );
    expect(notifications).toContain("markNotificationReadAction");
  });

  it("prioritizes update banners and postpones first-visit iOS install prompts", () => {
    expect(update).toContain("yalo:pwa-update-visibility");
    expect(install).toContain("yalo:pwa-update-visibility");
    expect(update).toContain("Más tarde");
    expect(install).toContain("visits >= 2");
    expect(install).toContain("updateShownThisSession");
  });

  it("keeps hiring and working decisions before search with consistent vector arrows", () => {
    const start = home.indexOf("yalo-intent-actions");
    expect(start).toBeGreaterThan(-1);
    expect(start).toBeLessThan(home.indexOf("yalo-hero-search"));
    expect(home).not.toContain("↗");
    expect(home).toContain('viewBox="0 0 24 24"');
    expect(showcaseCss).toContain(".yalo-hero-shortcuts a { min-height: 44px");
    expect(showcaseCss).toContain("yalo-featured-results--compact");
  });

  it("increases touch targets and clarifies location semantics", () => {
    expect(search).toContain(
      "min-h-11 shrink-0 items-center rounded-full border",
    );
    expect(
      source("../../components/discovery/discovery-results.tsx"),
    ).toContain("Usar mi ubicación");
    expect(location).toContain("Sin zona elegida");
    expect(location).toContain("min-h-11 shrink-0 items-center gap-1.5");
  });

  it("filters unread inbox conversations before building the visible page", () => {
    expect(inbox).toContain("listUnreadConversationsThrough(through)");
    expect(conversations).toContain("listUnreadConversationPage");
    expect(conversations).toContain("item.unread_count > 0");
    expect(conversations).toContain("batch.length < 50");
  });
});
