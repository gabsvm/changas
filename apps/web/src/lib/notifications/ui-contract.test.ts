import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 08 notification center UI contract", () => {
  it("renders the owner notification center with read controls and preferences", () => {
    const page = source(
      "apps/web/src/app/(account)/account/notifications/page.tsx",
    );

    expect(page).toContain("listNotifications");
    expect(page).toContain("markAllNotificationsReadAction");
    expect(page).toContain("NotificationPreferencesForm");
    expect(page).toContain("PushOptIn");
    expect(page).toContain("No tenés notificaciones todavía");
  });

  it("shows an SSR unread badge in account navigation", () => {
    const layout = source("apps/web/src/app/(account)/layout.tsx");

    expect(layout).toContain("getUnreadNotificationCount");
    expect(layout).toContain('href="/account/notifications"');
    expect(layout).toContain("Notificaciones");
  });

  it("keeps permission prompting behind an explicit push-enable action", () => {
    const control = source("apps/web/src/components/pwa/push-opt-in.tsx");

    expect(control).toContain("enablePush");
    expect(control).toContain("Notification.requestPermission()");
    expect(control).toContain('type="button"');
    expect(control).not.toMatch(
      /useEffect\([\s\S]{0,500}Notification\.requestPermission\(\)/,
    );
  });
});
