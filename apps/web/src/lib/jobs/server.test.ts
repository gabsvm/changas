import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  userId: "45500000-0000-4000-8000-000000000001" as string | null,
  isAdmin: false,
  scopeChanges: [] as Array<Record<string, unknown>>,
  adminCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      }),
    },
    rpc: async (name: string) => {
      if (name === "is_current_user_admin") {
        return { data: mocks.isAdmin, error: null };
      }
      if (name === "list_job_scope_changes") {
        return { data: mocks.scopeChanges, error: null };
      }
      throw new Error(`unexpected rpc ${name}`);
    },
  }),
}));

vi.mock("@/lib/supabase/admin", () => ({
  createAdminClient: () => ({
    rpc: async (name: string, args: Record<string, unknown>) => {
      mocks.adminCalls.push({ name, args });
      return { data: null, error: null };
    },
  }),
}));

import { applyFakeAdditionalPayment, JobServerError } from "./server";
import { createFakeAdditionalPaymentRecord } from "./payment-adapter";

describe("job payment adapter", () => {
  it("routes fake scope-change charges through PaymentProvider", async () => {
    const payment = await createFakeAdditionalPaymentRecord({
      paymentNonce: "06620000-0000-4000-8000-000000000001",
      amountMinor: 50000,
      currencyCode: "ARS",
      outcome: "PENDING",
    });

    expect(payment).toMatchObject({
      idempotencyKey: "06620000-0000-4000-8000-000000000001",
      amountMinor: 50000,
      currencyCode: "ARS",
      status: "PENDING",
    });
    expect(payment.id).toMatch(/^fakepay_[0-9a-f]{8}$/);
  });
});

describe("applyFakeAdditionalPayment admin gate", () => {
  const JOB_ID = "45510000-0000-4000-8000-000000000001";
  const SCOPE_CHANGE_ID = "45520000-0000-4000-8000-000000000001";
  const NONCE = "45530000-0000-4000-8000-000000000001";

  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.userId = "45500000-0000-4000-8000-000000000001";
    mocks.isAdmin = false;
    mocks.scopeChanges = [];
    mocks.adminCalls = [];
  });

  function seedAwaitingPayment() {
    mocks.scopeChanges = [
      {
        scope_change_id: SCOPE_CHANGE_ID,
        change_status: "AWAITING_PAYMENT",
        additional_amount_minor: 15000,
        currency_code: "ARS",
      },
    ];
  }

  it("blocks non-admin callers in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    seedAwaitingPayment();

    const error = await applyFakeAdditionalPayment({
      jobId: JOB_ID,
      scopeChangeId: SCOPE_CHANGE_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JobServerError);
    expect((error as JobServerError).code).toBe("FORBIDDEN");
    expect(mocks.adminCalls).toHaveLength(0);
  });

  it("lets admins resolve scope-change payment in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.isAdmin = true;
    seedAwaitingPayment();

    await applyFakeAdditionalPayment({
      jobId: JOB_ID,
      scopeChangeId: SCOPE_CHANGE_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    });

    expect(mocks.adminCalls).toHaveLength(1);
    expect(mocks.adminCalls[0]?.name).toBe("apply_additional_payment_result");
    expect(mocks.adminCalls[0]?.args).toMatchObject({
      target_scope_change_id: SCOPE_CHANGE_ID,
      payment_nonce: NONCE,
      actor_client_user_id: mocks.userId,
    });
  });

  it("keeps dev behavior for non-admins outside production", async () => {
    seedAwaitingPayment();

    await applyFakeAdditionalPayment({
      jobId: JOB_ID,
      scopeChangeId: SCOPE_CHANGE_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    });

    expect(mocks.adminCalls).toHaveLength(1);
  });
});
