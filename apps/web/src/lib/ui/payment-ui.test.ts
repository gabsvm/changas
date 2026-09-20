import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL(
    "../../components/payments/provider-payment-account.tsx",
    import.meta.url,
  ),
  "utf8",
);

const preferencesSource = readFileSync(
  new URL(
    "../../components/notifications/notification-preferences-form.tsx",
    import.meta.url,
  ),
  "utf8",
);

const pushSource = readFileSync(
  new URL("../../components/pwa/push-opt-in.tsx", import.meta.url),
  "utf8",
);

describe("provider payment account UI", () => {
  it("uses compact settings presentation", () => {
    expect(source).toContain("StatusChip");
    expect(source).not.toContain("rounded-2xl border bg-white/70 p-6");
    expect(source).not.toContain("text-3xl");
  });

  it("groups account detail inside a card with a top feedback banner", () => {
    expect(source).toContain("consumer-card");
    expect(source).toContain('role="status"');
    expect(source).toContain('role="alert"');
  });
});

describe("notification preferences UI", () => {
  it("groups toggles with visible headings and a top save banner", () => {
    expect(preferencesSource).toContain("NOTIFICATION_PREFERENCE_GROUPS");
    expect(preferencesSource).toContain("<fieldset");
    expect(preferencesSource).toContain("<legend");
    expect(preferencesSource).toContain("Guardando cambio");
  });
});

describe("push opt-in UI", () => {
  it("uses explicit message tones instead of sniffing message text", () => {
    expect(pushSource).toContain("resolvePushMessageTone");
    expect(pushSource).not.toContain('includes("No pudimos")');
    expect(pushSource).toContain('? "alert" : "status"');
  });
});
