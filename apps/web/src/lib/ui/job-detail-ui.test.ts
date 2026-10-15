import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync(
  new URL("../../app/(account)/jobs/[jobId]/page.tsx", import.meta.url),
  "utf8",
);

const listSource = readFileSync(
  new URL("../../app/(account)/jobs/page.tsx", import.meta.url),
  "utf8",
);

describe("job detail marketplace UI", () => {
  it("uses human status and modality helpers", () => {
    expect(source).toContain("getJobStatusPresentation");
    expect(source).toContain("getServiceModalityLabel");
    expect(source).not.toContain('detail.modality.replaceAll("_", " ")');
  });

  it("leads with the tracker and a single next action", () => {
    expect(source).toContain("Seguimiento");
    expect(source).toContain("JobTracker");
    expect(source).toContain("Qué sigue");
    expect(source).toContain("nextAction");
    expect(source).toContain("PrimaryAction");
    expect(source).toContain("Ver chat");
    expect(source).toContain("collapsible");
    expect(source).toContain("border-l-2");
  });

  it("shows payment before scope and collapses secondary sections", () => {
    expect(source.indexOf("Pago del trabajo")).toBeLessThan(
      source.indexOf("Alcance acordado"),
    );
    expect(source).toContain("needsScopeAttention");
    expect(source).toContain("needsRescheduleAttention");
    expect(source).toContain("showHelp");
  });

  it("decouples delivery submission from the client handover PIN", () => {
    expect(source).toContain("PIN para el prestador");
    expect(source).toContain("ConfirmationCodeForm");
    expect(source).toContain("Ingresar PIN");
    expect(source).toContain("DeliverySubmitForm");
    expect(source).toContain("Enviar entrega");
    expect(source).toContain("CorrectionForm");
  });

  it("registers external money bilaterally without bank proof", () => {
    expect(source).toContain("ExternalMoneySection");
    expect(source).toContain("getExternalMoney");
    expect(source).not.toMatch(/verificad[oa] por YALO/i);
    expect(source).toContain("JOB_EXTERNAL_PAYMENT_DECLARED");
    expect(source).toContain("JOB_EXTERNAL_PAYMENT_CONFIRMED");
    expect(source).toContain("JOB_EXTERNAL_PAYMENT_CONTESTED");
    expect(source).toContain("JOB_EXTERNAL_PAYMENT_VOIDED");
    expect(source.indexOf('settlement_status === "SETTLED" ? (')).toBeLessThan(
      source.indexOf("<ExternalMoneySection"),
    );
  });

  it("shows amounts, next actions and status filters in the job list", () => {
    expect(listSource).toContain("jobAmount");
    expect(listSource).toContain("nextAction");
    expect(listSource).toContain("status=");
    expect(listSource).toContain("aria-label=");
    expect(listSource).toContain("Sin trabajos en este estado");
  });

  it("avoids giant nested card chrome", () => {
    expect(source).not.toContain("rounded-[2rem]");
    expect(source).not.toContain("rounded-3xl");
    expect(source).not.toContain("shadow-[0_20px_70px");
  });
});
