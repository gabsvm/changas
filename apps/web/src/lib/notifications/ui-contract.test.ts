import { readFileSync } from "node:fs";
import { join } from "node:path";

import { describe, expect, it } from "vitest";

function source(path: string): string {
  return readFileSync(join(process.cwd(), path), "utf8");
}

describe("Phase 08 notification center UI contract", () => {
  it("renders the owner notification center with read controls", () => {
    const page = source(
      "apps/web/src/app/(account)/account/notifications/page.tsx",
    );

    expect(page).toContain("listNotifications");
    expect(page).toContain("markAllNotificationsReadAction");
    expect(page).toContain("/account/settings/notifications");
    expect(page).toContain("Todo al día");
  });

  it("keeps push and preferences on their own settings page", () => {
    const page = source(
      "apps/web/src/app/(account)/account/settings/notifications/page.tsx",
    );

    expect(page).toContain("NotificationPreferencesForm");
    expect(page).toContain("PushOptIn");
  });

  it("shows an SSR unread badge in account navigation", () => {
    const layout = source("apps/web/src/app/(account)/layout.tsx");
    const counts = source("apps/web/src/components/ui/nav-with-counts.tsx");

    // The counter is streamed behind Suspense so it never blocks the page.
    expect(counts).toContain("getUnreadNotificationCount");
    expect(layout).toContain("<ActivityBadge />");
    expect(layout).toContain('href="/account/notifications"');
    expect(layout).toContain("Actividad");
  });

  it("keeps permission prompting behind an explicit push-enable action", () => {
    const control = source("apps/web/src/components/pwa/push-opt-in.tsx");

    expect(control).toContain("enablePush");
    expect(control).toContain("Notification.requestPermission()");
    expect(control).toContain("<Switch");
    expect(control).not.toMatch(
      /useEffect\([\s\S]{0,500}Notification\.requestPermission\(\)/,
    );
  });
});
