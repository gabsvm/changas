import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  userId: "45500000-0000-4000-8000-000000000001" as string | null,
  isAdmin: false,
  scopeChanges: [] as Array<Record<string, unknown>>,
  jobDetail: null as Record<string, unknown> | null,
  adminCalls: [] as Array<{ name: string; args: Record<string, unknown> }>,
  upcomingRows: [] as Array<Record<string, unknown>>,
  pastRows: [] as Array<Record<string, unknown>>,
  missingNewJobListRpc: false,
  jobListCalls: [] as Array<{
    name: string;
    args: Record<string, unknown>;
  }>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      }),
    },
    rpc: async (name: string, args?: Record<string, unknown>) => {
      if (name === "is_current_user_admin") {
        return { data: mocks.isAdmin, error: null };
      }
      if (name === "list_job_scope_changes") {
        return { data: mocks.scopeChanges, error: null };
      }
      if (name === "get_job_detail") {
        return { data: mocks.jobDetail ? [mocks.jobDetail] : [], error: null };
      }
      if (name === "list_my_upcoming_jobs" || name === "list_my_past_jobs") {
        const seenArgs = args ?? {};
        mocks.jobListCalls.push({ name, args: seenArgs });
        if (mocks.missingNewJobListRpc && "status_filter" in seenArgs) {
          return {
            data: null,
            error: { code: "42883", message: "function does not exist" },
          };
        }
        return {
          data: applyJobListArgs(
            name,
            name === "list_my_upcoming_jobs"
              ? mocks.upcomingRows
              : mocks.pastRows,
            seenArgs,
          ),
          error: null,
        };
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

import {
  applyFakeAdditionalPayment,
  applyFakeSettlementPayment,
  JobServerError,
  listMyPastJobsThrough,
  listMyUpcomingJobsPage,
  listMyUpcomingJobsThrough,
} from "./server";
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
    mocks.jobDetail = null;
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

describe("applyFakeSettlementPayment", () => {
  const JOB_ID = "45510000-0000-4000-8000-000000000001";
  const SCOPE_CHANGE_ID = "45520000-0000-4000-8000-000000000001";
  const NONCE = "45530000-0000-4000-8000-000000000002";

  afterEach(() => {
    vi.unstubAllEnvs();
    mocks.userId = "45500000-0000-4000-8000-000000000001";
    mocks.isAdmin = false;
    mocks.scopeChanges = [];
    mocks.jobDetail = null;
    mocks.adminCalls = [];
  });

  function seedSettledDue() {
    mocks.jobDetail = {
      job_id: JOB_ID,
      job_status: "COMPLETED",
      client_user_id: mocks.userId,
      base_price_amount: 125000,
      paid_additional_amount: 0,
      total_price_amount: 125000,
      currency_code: "ARS",
      settlement_status: "DUE",
      settlement_total_minor: 140000,
      settlement_unpaid_extras_minor: 15000,
      settlement_unpaid_extra_ids: [SCOPE_CHANGE_ID],
    };
  }

  it("blocks non-admin callers in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    seedSettledDue();

    const error = await applyFakeSettlementPayment({
      jobId: JOB_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    }).catch((thrown: unknown) => thrown);

    expect(error).toBeInstanceOf(JobServerError);
    expect((error as JobServerError).code).toBe("FORBIDDEN");
    expect(mocks.adminCalls).toHaveLength(0);
  });

  it("lets admins settle a completed due job in production", async () => {
    vi.stubEnv("NODE_ENV", "production");
    mocks.isAdmin = true;
    seedSettledDue();

    await applyFakeSettlementPayment({
      jobId: JOB_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    });

    expect(mocks.adminCalls).toHaveLength(1);
    expect(mocks.adminCalls[0]?.name).toBe("apply_job_settlement_result");
    expect(mocks.adminCalls[0]?.args).toMatchObject({
      target_job_id: JOB_ID,
      settlement_nonce: NONCE,
      settlement_provider_name: "FAKE",
      settlement_result_status: "SUCCEEDED",
      settlement_actor_user_id: mocks.userId,
      included_scope_change_ids: [SCOPE_CHANGE_ID],
      assert_total_minor: 140000,
    });
  });

  it("rejects jobs that are not completed or not due", async () => {
    seedSettledDue();
    mocks.jobDetail = { ...mocks.jobDetail, job_status: "IN_PROGRESS" };

    const notComplete = await applyFakeSettlementPayment({
      jobId: JOB_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    }).catch((thrown: unknown) => thrown);
    expect((notComplete as JobServerError).code).toBe("CONFLICT");

    seedSettledDue();
    mocks.jobDetail = { ...mocks.jobDetail, settlement_status: "SETTLED" };
    const notDue = await applyFakeSettlementPayment({
      jobId: JOB_ID,
      nonce: NONCE,
      outcome: "SUCCESS",
    }).catch((thrown: unknown) => thrown);
    expect((notDue as JobServerError).code).toBe("CONFLICT");
    expect(mocks.adminCalls).toHaveLength(0);
  });
});

function jobTestId(n: number): string {
  const head = n.toString(16).padStart(8, "0");
  const tail = n.toString(16).padStart(12, "0");
  return `${head}-0000-4000-8000-${tail}`;
}

function makeJobRow(
  n: number,
  jobStatus: string,
  settlementStatus: string | null = null,
): Record<string, unknown> {
  // sort_key estrictamente creciente con n: los "por cerrar" (n >= 48)
  // quedan fuera de la primera página sin filtrar.
  const sortKey = new Date(Date.UTC(2026, 9, 1) + n * 60000).toISOString();
  const stamp = `2026-09-${String((n % 27) + 1).padStart(2, "0")}T10:${String(n % 60).padStart(2, "0")}:00.000Z`;
  return {
    job_id: jobTestId(n),
    job_status: jobStatus,
    service_title: `Servicio ${n}`,
    counterparty_name: "Contraparte",
    schedule_type: "UNSCHEDULED",
    starts_at: null,
    ends_at: null,
    deadline_at: null,
    updated_at: stamp,
    base_price_amount: 100000,
    paid_additional_amount: 0,
    total_price_amount: 100000,
    currency_code: "ARS",
    is_client: true,
    settlement_status: settlementStatus,
    settlement_total_minor: null,
    sort_key: sortKey,
  };
}

// Réplica mínima de la semántica nueva del RPC: filtro server-side,
// orden por sort key y cursor keyset.
function applyJobListArgs(
  name: string,
  rows: Array<Record<string, unknown>>,
  args: Record<string, unknown>,
): Array<Record<string, unknown>> {
  const upcoming = name === "list_my_upcoming_jobs";
  const limit = Math.min(
    Math.max(typeof args.limit_count === "number" ? args.limit_count : 20, 1),
    50,
  );
  const statusFilter =
    typeof args.status_filter === "string" ? args.status_filter : null;
  const filtered = rows.filter((row) => {
    if (upcoming) {
      if (statusFilter === "CONFIRMED") return row.job_status === "CONFIRMED";
      if (statusFilter === "IN_PROGRESS")
        return row.job_status === "IN_PROGRESS";
      if (statusFilter === "CLOSING")
        return (
          row.job_status === "COMPLETION_REQUESTED" ||
          row.job_status === "DISPUTED"
        );
      return true;
    }
    if (statusFilter === "PENDING_SETTLEMENT")
      return row.settlement_status === "DUE";
    return true;
  });
  const keyOf = (row: Record<string, unknown>): string =>
    upcoming ? String(row.sort_key ?? row.updated_at) : String(row.updated_at);
  const compareKeys = (a: string, b: string): number =>
    a === b ? 0 : a > b ? 1 : -1;
  const ordered = [...filtered].sort((a, b) => {
    const byKey = compareKeys(keyOf(a), keyOf(b));
    if (byKey !== 0) return upcoming ? byKey : -byKey;
    const byId = compareKeys(String(a.job_id), String(b.job_id));
    return upcoming ? byId : -byId;
  });
  const beforeKey =
    (upcoming ? args.before_sort_key : args.before_updated_at) ?? null;
  const beforeId = args.before_id ?? null;
  const paged =
    typeof beforeKey === "string" && typeof beforeId === "string"
      ? ordered.filter((row) => {
          const key = keyOf(row);
          if (key === beforeKey) {
            const afterId = String(row.job_id) > beforeId ? 1 : -1;
            return upcoming ? afterId > 0 : afterId < 0;
          }
          return upcoming ? key > beforeKey : key < beforeKey;
        })
      : ordered;
  return paged.slice(0, limit);
}

describe("job list pagination (YALO B3)", () => {
  afterEach(() => {
    mocks.userId = "45500000-0000-4000-8000-000000000001";
    mocks.upcomingRows = [];
    mocks.pastRows = [];
    mocks.missingNewJobListRpc = false;
    mocks.jobListCalls = [];
  });

  function seedUpcoming55(): void {
    // Los 8 "por cerrar" quedan después de la primera página de 20:
    // filtrar en cliente sobre la primera página daría un falso vacío.
    mocks.upcomingRows = [
      ...Array.from({ length: 40 }, (_, i) => makeJobRow(i + 1, "CONFIRMED")),
      ...Array.from({ length: 7 }, (_, i) => makeJobRow(i + 41, "IN_PROGRESS")),
      ...Array.from({ length: 4 }, (_, i) =>
        makeJobRow(i + 48, "COMPLETION_REQUESTED"),
      ),
      ...Array.from({ length: 4 }, (_, i) => makeJobRow(i + 52, "DISPUTED")),
    ];
  }

  it("finds filtered states beyond the first page", async () => {
    seedUpcoming55();

    const { items, next } = await listMyUpcomingJobsThrough(
      null,
      "CLOSING",
      20,
    );

    expect(items).toHaveLength(8);
    expect(
      items.every(
        (job) =>
          job.job_status === "COMPLETION_REQUESTED" ||
          job.job_status === "DISPUTED",
      ),
    ).toBe(true);
    expect(next).toBeNull();
    expect(mocks.jobListCalls[0]?.args).toMatchObject({
      status_filter: "CLOSING",
    });
  });

  it("accumulates pages continuously through a cursor", async () => {
    seedUpcoming55();

    const first = await listMyUpcomingJobsThrough(null, null, 20);
    expect(first.items).toHaveLength(20);
    expect(first.next).not.toBeNull();

    const second = await listMyUpcomingJobsThrough(first.next, null, 20);
    expect(second.items).toHaveLength(40);

    const third = await listMyUpcomingJobsThrough(second.next, null, 20);
    expect(third.items).toHaveLength(55);
    expect(third.next).toBeNull();
    expect(new Set(third.items.map((job) => job.job_id)).size).toBe(55);
  });

  it("filters past jobs by pending settlement", async () => {
    mocks.pastRows = [
      makeJobRow(1, "COMPLETED", "DUE"),
      makeJobRow(2, "COMPLETED", "DUE"),
      makeJobRow(3, "COMPLETED", "SETTLED"),
      makeJobRow(4, "COMPLETED", "NOT_REQUIRED"),
      makeJobRow(5, "CANCELLED", "NOT_DUE"),
    ];

    const { items, next } = await listMyPastJobsThrough(
      null,
      "PENDING_SETTLEMENT",
      20,
    );

    expect(items).toHaveLength(2);
    expect(items.every((job) => job.settlement_status === "DUE")).toBe(true);
    expect(next).toBeNull();
  });

  it("falls back to the legacy shape when the new RPC is missing", async () => {
    seedUpcoming55();
    mocks.missingNewJobListRpc = true;

    const jobs = await listMyUpcomingJobsPage({}, 20);

    expect(jobs).toHaveLength(20);
    expect(mocks.jobListCalls).toHaveLength(2);
    expect(mocks.jobListCalls[1]?.args).toEqual({ limit_count: 20 });
  });
});
