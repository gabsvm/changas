import "server-only";

import { createClient } from "@/lib/supabase/server";

import {
  JobServerError,
  listMyPastJobs,
  listMyUpcomingJobs,
} from "./server";

export type ProviderEarningsSummary = {
  /** Cobros reales: intentos SUCCEEDED no simulados. */
  settledCount: number;
  settledTotal: number;
  /** Liquidaciones simuladas (FAKE/sandbox): no son cobros reales. */
  simulatedSettledCount: number;
  simulatedSettledTotal: number;
  /** Base + adicionales impagos de trabajos COMPLETED no liquidados. */
  dueCount: number;
  dueTotal: number;
  inProgressCount: number;
  /** "rpc" = agregado server-side; "fallback" = cálculo anterior 50+50. */
  source: "rpc" | "fallback";
};

type SummaryNumbers = Omit<ProviderEarningsSummary, "source">;

const EMPTY_SUMMARY: SummaryNumbers = {
  settledCount: 0,
  settledTotal: 0,
  simulatedSettledCount: 0,
  simulatedSettledTotal: 0,
  dueCount: 0,
  dueTotal: 0,
  inProgressCount: 0,
};

function toFiniteInt(value: unknown): number {
  if (typeof value !== "number" || !Number.isFinite(value)) return 0;
  return Math.max(0, Math.trunc(value));
}

function normalizeSummaryRow(row: unknown): SummaryNumbers {
  if (typeof row !== "object" || row === null) return { ...EMPTY_SUMMARY };
  const record = row as Record<string, unknown>;
  return {
    settledCount: toFiniteInt(record.settled_count),
    settledTotal: toFiniteInt(record.settled_total_minor),
    simulatedSettledCount: toFiniteInt(record.simulated_settled_count),
    simulatedSettledTotal: toFiniteInt(
      record.simulated_settled_total_minor,
    ),
    dueCount: toFiniteInt(record.due_count),
    dueTotal: toFiniteInt(record.due_total_minor),
    inProgressCount: toFiniteInt(record.in_progress_count),
  };
}

type RpcErrorShape = { code?: string | null; message?: string | null } | null;

function isMissingFunctionError(error: RpcErrorShape): boolean {
  if (error?.code === "42883" || error?.code === "PGRST202") return true;
  return (
    typeof error?.message === "string" &&
    /could not find the function/i.test(error.message)
  );
}

// YALO C1: agregado server-side sin recorte arbitrario. Si el RPC aún no
// existe (deploy ordering), devuelve null para usar el cálculo anterior.
// Cualquier otro error de query se propaga: la página muestra estado de
// error visible en vez de $0.
async function readRpcSummary(): Promise<SummaryNumbers | null> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobServerError("UNAUTHORIZED", "Tenés que iniciar sesión.");
  }
  // El cliente tipado aún no incluye el RPC nuevo (tipos generados pendientes).
  const untypedRpc = supabase as unknown as {
    rpc(
      name: string,
      args?: Record<string, unknown>,
    ): Promise<{ data: unknown; error: RpcErrorShape }>;
  };
  const { data, error } = await untypedRpc.rpc("get_provider_earnings_summary");
  if (error) {
    if (isMissingFunctionError(error)) return null;
    throw new JobServerError(
      "TRANSIENT",
      "No pudimos cargar el resumen de ingresos.",
    );
  }
  const row = Array.isArray(data) ? data[0] : null;
  return normalizeSummaryRow(row);
}

// Cálculo anterior (hasta 50 por listado): solo fallback cuando el RPC no
// existe. No distingue simulado de real.
async function readFallbackSummary(): Promise<SummaryNumbers> {
  const [past, upcoming] = await Promise.all([
    listMyPastJobs(50).catch(() => []),
    listMyUpcomingJobs(50).catch(() => []),
  ]);
  const mine = [...past, ...upcoming].filter(
    (job) => job.is_client === false,
  );
  const settled = mine.filter((job) => job.settlement_status === "SETTLED");
  const due = mine.filter((job) => job.settlement_status === "DUE");
  const inProgress = mine.filter((job) =>
    ["CONFIRMED", "IN_PROGRESS", "COMPLETION_REQUESTED"].includes(
      job.job_status,
    ),
  );
  return {
    settledCount: settled.length,
    settledTotal: settled.reduce(
      (sum, job) => sum + (job.settlement_total_minor ?? 0),
      0,
    ),
    simulatedSettledCount: 0,
    simulatedSettledTotal: 0,
    dueCount: due.length,
    dueTotal: due.reduce(
      (sum, job) => sum + (job.settlement_total_minor ?? 0),
      0,
    ),
    inProgressCount: inProgress.length,
  };
}

export async function getProviderEarningsSummary(): Promise<ProviderEarningsSummary> {
  const rpc = await readRpcSummary();
  if (rpc) return { ...rpc, source: "rpc" };
  const fallback = await readFallbackSummary();
  return { ...fallback, source: "fallback" };
}
