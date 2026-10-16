import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const load = (path: string) => readFileSync(new URL(path, import.meta.url), "utf8");
const moneyUI = load("../../app/(account)/jobs/[jobId]/external-money-section.tsx");
const declareUI = load("../../app/(account)/jobs/[jobId]/external-payment-declaration-form.tsx");
const actions = load("../../app/(account)/jobs/actions.ts");
const server = load("./server.ts");
const migration = load("../../../../supabase/migrations/20261019000000_external_payment_tips.sql");

describe("external tip integration regressions", () => {
  it("shows contract versus tips, allowing tip-only declarations", () => {
    expect(moneyUI).toContain("Propinas confirmadas");
    expect(moneyUI).toContain("tip_amount_minor");
    expect(moneyUI).toContain("ExternalPaymentDeclarationForm");
    expect(moneyUI).not.toContain("canConfirmExternalPayment");
    expect(declareUI).toContain("splitExternalMoneyPayment");
    expect(declareUI).toContain("Dejar una propina");
    expect(declareUI).toContain("Desglose estimado");
    expect(declareUI).toContain("la otra parte confirma");
  });

  it("reports declared money errors inline without route crashes", () => {
    expect(actions).toContain("type ExternalPaymentDeclarationState");
    expect(actions).toContain("Promise<ExternalPaymentDeclarationState>");
    expect(declareUI).toContain("useActionState");
    expect(declareUI).toContain('role="alert"');
    expect(declareUI).toContain("disabled={pending || amountMinor === null}");
  });

  it("keeps the tip breakdown private to the job parties", () => {
    expect(server).toContain("tip_amount_minor, currency_code");
    expect(server).toContain('d.state === "CONFIRMED_BY_BOTH"');
    expect(server).toContain("confirmedTipMinor");
    expect(migration).toContain("if caller_id = declaration.declared_by_user_id then");
    expect(migration).toContain("only the counterpart responds to a declaration");
    expect(migration).toContain("pg_advisory_xact_lock");
    expect(migration).toContain("tip_amount_minor = tip_minor");
    expect(migration).toContain("sum(d.amount_minor - d.tip_amount_minor)");
    expect(migration).not.toContain("confirmed amount exceeds the agreed total");
  });
});
