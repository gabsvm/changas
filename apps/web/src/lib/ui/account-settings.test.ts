import { describe, expect, it } from "vitest";

import {
  NOTIFICATION_PREFERENCE_GROUPS,
  resolvePushMessageTone,
} from "./account-settings";

describe("notification preference groups", () => {
  it("covers every preference toggle exactly once", () => {
    const names = NOTIFICATION_PREFERENCE_GROUPS.flatMap((group) =>
      group.toggles.map((toggle) => toggle.name),
    );

    expect(names).toHaveLength(5);
    expect(new Set(names).size).toBe(5);
    expect(names).toContain("emailImportantEnabled");
    expect(names).toContain("jobRemindersEnabled");
    expect(names).toContain("proposalAlertsEnabled");
    expect(names).toContain("verificationAlertsEnabled");
    expect(names).toContain("promotionalEnabled");
  });

  it("labels every group for mobile scanning", () => {
    for (const group of NOTIFICATION_PREFERENCE_GROUPS) {
      expect(group.title.length).toBeGreaterThan(0);
      expect(group.toggles.length).toBeGreaterThan(0);
    }
  });
});

describe("resolvePushMessageTone", () => {
  it("marks confirmations as success", () => {
    expect(resolvePushMessageTone("enabled")).toBe("success");
    expect(resolvePushMessageTone("disabled")).toBe("success");
  });

  it("marks every failure as error without sniffing message text", () => {
    expect(resolvePushMessageTone("permission-denied")).toBe("error");
    expect(resolvePushMessageTone("not-configured")).toBe("error");
    expect(resolvePushMessageTone("invalid-subscription")).toBe("error");
    expect(resolvePushMessageTone("save-failed")).toBe("error");
    expect(resolvePushMessageTone("disable-failed")).toBe("error");
  });
});
