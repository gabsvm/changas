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

const servicePageSource = readFileSync(
  new URL("../../app/p/[slug]/[serviceSlug]/page.tsx", import.meta.url),
  "utf8",
);

const jobsPageSource = readFileSync(
  new URL("../../app/(account)/jobs/page.tsx", import.meta.url),
  "utf8",
);

describe("S0 D4 external-payments copy", () => {
  it("states external payment on the service sheet, never in-app checkout", () => {
    expect(servicePageSource).toContain("Sin cobro online");
    expect(servicePageSource).toContain("directamente entre las partes");
    expect(servicePageSource).not.toContain("al finalizar desde YALO");
    expect(servicePageSource).not.toContain("Incluida en el total");
  });

  it("labels job filters by real scope, not Todos", () => {
    expect(jobsPageSource).toContain('label: "Activos"');
    expect(jobsPageSource).not.toContain('label: "Todos"');
    expect(jobsPageSource).toContain("Pago externo sin confirmar");
    expect(jobsPageSource).not.toContain("Pendiente de pago");
    expect(jobsPageSource).not.toContain("Pendientes de pago");
  });

  it("never forces Mercado Pago linkage with payments OFF", () => {
    expect(source).toContain("sin vincular");
    expect(source).not.toContain("Para cobrar vas a");
  });
});

describe("push opt-in UI", () => {
  it("uses explicit message tones instead of sniffing message text", () => {
    expect(pushSource).toContain("resolvePushMessageTone");
    expect(pushSource).not.toContain('includes("No pudimos")');
    expect(pushSource).toContain('? "alert" : "status"');
  });
});
