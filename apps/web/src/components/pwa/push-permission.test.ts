import { describe, expect, it } from "vitest";

import { resolvePushCapability } from "./push-permission";

describe("resolvePushCapability", () => {
  it("reports unsupported without Notification or service workers", () => {
    expect(
      resolvePushCapability({
        notificationSupported: false,
        serviceWorkerSupported: true,
        permission: "default",
      }),
    ).toBe("unsupported");
    expect(
      resolvePushCapability({
        notificationSupported: true,
        serviceWorkerSupported: false,
        permission: "default",
      }),
    ).toBe("unsupported");
  });

  it("preserves default, granted and denied without prompting", () => {
    expect(
      resolvePushCapability({
        notificationSupported: true,
        serviceWorkerSupported: true,
        permission: "default",
      }),
    ).toBe("default");
    expect(
      resolvePushCapability({
        notificationSupported: true,
        serviceWorkerSupported: true,
        permission: "granted",
      }),
    ).toBe("granted");
    expect(
      resolvePushCapability({
        notificationSupported: true,
        serviceWorkerSupported: true,
        permission: "denied",
      }),
    ).toBe("denied");
  });
});
