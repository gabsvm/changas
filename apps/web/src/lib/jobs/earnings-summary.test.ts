import { describe, expect, it, vi } from "vitest";

import type * as JobsServer from "./server";


vi.mock("server-only", () => ({}));

const mocks = vi.hoisted(() => ({
  userId: "45500000-0000-4000-8000-000000000001" as string | null,
  rpcData: null as Array<Record<string, unknown>> | null,
  rpcError: null as { code?: string | null; message?: string | null } | null,
  pastRows: [] as Array<Record<string, unknown>>,
  upcomingRows: [] as Array<Record<string, unknown>>,
}));

vi.mock("@/lib/supabase/server", () => ({
  createClient: async () => ({
    auth: {
      getUser: async () => ({
        data: { user: mocks.userId ? { id: mocks.userId } : null },
      }),
    },
    rpc: async (name: string) => {
      if (name !== "get_provider_earnings_summary") {
        throw new Error(`unexpected rpc ${name}`);
      }
      return { data: mocks.rpcData, error: mocks.rpcError };
    },
  }),
}));

vi.mock("./server", async (importOriginal) => {
  const original = await importOriginal<typeof JobsServer>();
  return {
    ...original,
    listMyPastJobs: async () => mocks.pastRows,
    listMyUpcomingJobs: async () => mocks.upcomingRows,
  };
});

import { getProviderEarningsSummary } from "./earnings-summary";

function pastJob(overrides: Record<string, unknown>) {
  return {
    job_id: "00000000-0000-4000-8000-000000000001",
    job_status: "COMPLETED",
    is_client: false,
    settlement_status: "SETTLED",
    settlement_total_minor: 1000,
    ...overrides,
  };
}

describe("getProviderEarningsSummary", () => {
  it("reads totals from the aggregate RPC without row caps", async () => {
    mocks.rpcError = null;
    mocks.rpcData = [
      {
        settled_count: 3,
        settled_total_minor: 9000,
        simulated_settled_count: 1,
        simulated_settled_total_minor: 500,
        due_count: 2,
        due_total_minor: 4000,
        in_progress_count: 1,
      },
    ];
    await expect(getProviderEarningsSummary()).resolves.toEqual({
      settledCount: 3,
      settledTotal: 9000,
      simulatedSettledCount: 1,
      simulatedSettledTotal: 500,
      dueCount: 2,
      dueTotal: 4000,
      inProgressCount: 1,
      source: "rpc",
    });
  });

  it("falls back to the previous 50+50 calc when the RPC is missing", async () => {
    mocks.rpcData = null;
    mocks.rpcError = { code: "42883", message: "function does not exist" };
    mocks.pastRows = [
      pastJob({ settlement_status: "SETTLED", settlement_total_minor: 2000 }),
      pastJob({
        job_id: "00000000-0000-4000-8000-000000000002",
        settlement_status: "DUE",
        settlement_total_minor: 700,
      }),
    ];
    mocks.upcomingRows = [
      {
        job_id: "00000000-0000-4000-8000-000000000003",
        job_status: "IN_PROGRESS",
        is_client: false,
        settlement_status: "NOT_DUE",
        settlement_total_minor: 0,
      },
    ];
    await expect(getProviderEarningsSummary()).resolves.toEqual({
      settledCount: 1,
      settledTotal: 2000,
      simulatedSettledCount: 0,
      simulatedSettledTotal: 0,
      dueCount: 1,
      dueTotal: 700,
      inProgressCount: 1,
      source: "fallback",
    });
  });

  it("throws on query errors instead of returning $0", async () => {
    mocks.rpcData = null;
    mocks.rpcError = { code: "42501", message: "permission denied" };
    await expect(getProviderEarningsSummary()).rejects.toThrow(
      "No pudimos cargar el resumen de ingresos.",
    );
  });
});
