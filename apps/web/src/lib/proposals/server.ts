import type {
  CurrencyCode,
  PaymentRecord,
  ProposalKind,
  ProposalStatus,
  ScheduleType,
  ServiceModality,
} from "@changas/domain";
import {
  FakePaymentProvider,
  proposalKinds,
  proposalStatuses,
  scheduleTypes,
  serviceModalities,
  supportedCurrencyCodes,
} from "@changas/domain";

import { createClient } from "@/lib/supabase/server";

export type ProposalErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class ProposalServerError extends Error {
  constructor(
    public readonly code: ProposalErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "ProposalServerError";
  }
}

export type ProposalSummary = {
  proposal_id: string;
  proposal_kind: ProposalKind;
  proposal_status: ProposalStatus;
  created_by_user_id: string;
  current_version_id: string;
  accepted_version_id: string | null;
  version_number: number;
  authored_by_user_id: string;
  service_title: string;
  modality: ServiceModality;
  scope_text: string;
  price_amount: number | null;
  currency_code: string;
  schedule_type: ScheduleType;
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  deadline_at: string | null;
  expected_duration_minutes: number | null;
  includes_text: string | null;
  materials_notes_text: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
};

export type ProposalDraft = {
  conversationId: string;
  kind: ProposalKind;
  scopeText?: string | null;
  priceAmount?: number | null;
  scheduleStartAt?: string | null;
  scheduleEndAt?: string | null;
  deadlineAt?: string | null;
  expiresAt?: string | null;
};

export type ProposalRevision = Omit<ProposalDraft, "conversationId"> & {
  proposalId: string;
};

export type ProposalResponseAction = "ACCEPT" | "REJECT" | "WITHDRAW";
export type FakePaymentOutcome = "SUCCESS" | "PENDING" | "FAILURE";
export type FakePaymentResult = {
  payment_attempt_id: string | null;
  resulting_proposal_status: ProposalStatus;
  confirmed_job_id: string | null;
};

export type FakePaymentRecordInput = {
  paymentNonce: string;
  amountMinor: number;
  currencyCode: string;
  outcome: FakePaymentOutcome;
};

type RpcError = { code?: string | null } | null;

type ProposalRpcClient = {
  rpc(
    name: "list_conversation_proposals",
    args: { target_conversation_id: string },
  ): Promise<{ data: unknown[] | null; error: RpcError }>;
  rpc(
    name: "create_conversation_proposal",
    args: {
      target_conversation_id: string;
      requested_kind: ProposalKind;
      scope_text: string | null;
      proposed_price_amount: number | null;
      proposed_schedule_start_at: string | null;
      proposed_schedule_end_at: string | null;
      proposed_deadline_at: string | null;
      proposal_expires_at: string | null;
    },
  ): Promise<{ data: string | null; error: RpcError }>;
  rpc(
    name: "revise_conversation_proposal",
    args: {
      target_proposal_id: string;
      requested_kind: ProposalKind;
      scope_text: string | null;
      proposed_price_amount: number | null;
      proposed_schedule_start_at: string | null;
      proposed_schedule_end_at: string | null;
      proposed_deadline_at: string | null;
      proposal_expires_at: string | null;
    },
  ): Promise<{ data: string | null; error: RpcError }>;
  rpc(
    name: "respond_to_proposal",
    args: {
      target_proposal_id: string;
      response_action: ProposalResponseAction;
    },
  ): Promise<{ data: ProposalStatus | null; error: RpcError }>;
};

type FakePaymentRpcClient = {
  rpc(
    name: "apply_fake_payment_result",
    args: {
      target_proposal_id: string;
      payment_nonce: string;
      payment_outcome: FakePaymentOutcome;
      actor_client_user_id: string;
    },
  ): Promise<{ data: FakePaymentResult[] | null; error: RpcError }>;
};

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function isNullableString(value: unknown): value is string | null {
  return value === null || typeof value === "string";
}

function isDateLike(value: unknown): value is string | null {
  return (
    value === null ||
    (typeof value === "string" && Number.isFinite(Date.parse(value)))
  );
}

function isUuid(value: unknown): value is string {
  return typeof value === "string" && UUID_PATTERN.test(value);
}

export async function createFakePaymentRecord(
  input: FakePaymentRecordInput,
): Promise<PaymentRecord> {
  if (!supportedCurrencyCodes.includes(input.currencyCode as CurrencyCode)) {
    throw new ProposalServerError(
      "CONFLICT",
      "La moneda de la propuesta no está soportada para el pago.",
    );
  }

  const provider = new FakePaymentProvider();
  return provider.createPayment({
    idempotencyKey: input.paymentNonce,
    amountMinor: input.amountMinor,
    currencyCode: input.currencyCode as CurrencyCode,
    outcome: input.outcome,
  });
}

export function mapProposalRpcErrorCode(
  code?: string | null,
): ProposalErrorCode {
  switch (code) {
    case "42501":
      return "FORBIDDEN";
    case "P0002":
      return "NOT_FOUND";
    case "22023":
    case "23505":
      return "CONFLICT";
    default:
      return "TRANSIENT";
  }
}

function proposalError(error: RpcError): ProposalServerError {
  const code = mapProposalRpcErrorCode(error?.code);
  const messages: Record<ProposalErrorCode, string> = {
    UNAUTHORIZED: "Necesitás iniciar sesión para usar propuestas.",
    FORBIDDEN: "No tenés permiso para realizar esa acción.",
    NOT_FOUND: "No encontramos la propuesta solicitada.",
    CONFLICT: "La propuesta cambió o no permite esa acción.",
    TRANSIENT: "No pudimos completar la acción. Intentá nuevamente.",
  };
  return new ProposalServerError(code, messages[code]);
}

export function normalizeProposalRevisionId(value: string | null): string {
  if (value === null) {
    throw new ProposalServerError(
      "CONFLICT",
      "La propuesta venció y ya no puede modificarse.",
    );
  }
  if (!isUuid(value)) throw proposalError(null);
  return value;
}

export function normalizeProposalSummary(value: unknown): ProposalSummary {
  if (!value || typeof value !== "object") {
    throw new Error("Invalid proposal summary");
  }

  const row = value as Record<string, unknown>;
  const price = row.price_amount;
  const duration = row.expected_duration_minutes;

  if (
    !isUuid(row.proposal_id) ||
    !proposalKinds.includes(row.proposal_kind as ProposalKind) ||
    !proposalStatuses.includes(row.proposal_status as ProposalStatus) ||
    !isUuid(row.created_by_user_id) ||
    !isUuid(row.current_version_id) ||
    !(row.accepted_version_id === null || isUuid(row.accepted_version_id)) ||
    !Number.isSafeInteger(row.version_number) ||
    Number(row.version_number) < 1 ||
    !isUuid(row.authored_by_user_id) ||
    typeof row.service_title !== "string" ||
    !serviceModalities.includes(row.modality as ServiceModality) ||
    typeof row.scope_text !== "string" ||
    !(price === null || (Number.isSafeInteger(price) && Number(price) > 0)) ||
    typeof row.currency_code !== "string" ||
    !/^[A-Z]{3}$/.test(row.currency_code) ||
    !scheduleTypes.includes(row.schedule_type as ScheduleType) ||
    !isDateLike(row.schedule_start_at) ||
    !isDateLike(row.schedule_end_at) ||
    !isDateLike(row.deadline_at) ||
    !(
      duration === null ||
      (Number.isSafeInteger(duration) && Number(duration) > 0)
    ) ||
    !isNullableString(row.includes_text) ||
    !isNullableString(row.materials_notes_text) ||
    !isDateLike(row.expires_at) ||
    !isDateLike(row.created_at) ||
    row.created_at === null ||
    !isDateLike(row.updated_at) ||
    row.updated_at === null
  ) {
    throw new Error("Invalid proposal summary");
  }

  return row as unknown as ProposalSummary;
}

async function getRpcClient(): Promise<{
  rpc: ProposalRpcClient;
  userId: string;
}> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    throw new ProposalServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para usar propuestas.",
    );
  }

  return {
    rpc: supabase as unknown as ProposalRpcClient,
    userId: user.id,
  };
}

function proposalArgs(input: ProposalDraft) {
  return {
    target_conversation_id: input.conversationId,
    requested_kind: input.kind,
    scope_text: input.scopeText ?? null,
    proposed_price_amount: input.priceAmount ?? null,
    proposed_schedule_start_at: input.scheduleStartAt ?? null,
    proposed_schedule_end_at: input.scheduleEndAt ?? null,
    proposed_deadline_at: input.deadlineAt ?? null,
    proposal_expires_at: input.expiresAt ?? null,
  };
}

export async function listConversationProposals(
  conversationId: string,
): Promise<ProposalSummary[]> {
  const { rpc } = await getRpcClient();
  const { data, error } = await rpc.rpc("list_conversation_proposals", {
    target_conversation_id: conversationId,
  });

  if (error) throw proposalError(error);
  return (data ?? []).map(normalizeProposalSummary);
}

export async function createConversationProposal(
  input: ProposalDraft,
): Promise<string> {
  const { rpc } = await getRpcClient();
  const { data, error } = await rpc.rpc(
    "create_conversation_proposal",
    proposalArgs(input),
  );

  if (error) throw proposalError(error);
  if (!data || !isUuid(data)) throw proposalError(null);
  return data;
}

export async function reviseConversationProposal(
  input: ProposalRevision,
): Promise<string> {
  const { rpc } = await getRpcClient();
  const { target_conversation_id: _conversation, ...draft } = proposalArgs({
    ...input,
    conversationId: "00000000-0000-4000-8000-000000000000",
  });
  const { data, error } = await rpc.rpc("revise_conversation_proposal", {
    target_proposal_id: input.proposalId,
    ...draft,
  });

  if (error) throw proposalError(error);
  return normalizeProposalRevisionId(data);
}

export async function respondToProposal(
  proposalId: string,
  action: ProposalResponseAction,
): Promise<ProposalStatus> {
  const { rpc } = await getRpcClient();
  const { data, error } = await rpc.rpc("respond_to_proposal", {
    target_proposal_id: proposalId,
    response_action: action,
  });

  if (error) throw proposalError(error);
  if (!data || !proposalStatuses.includes(data)) throw proposalError(null);
  return data;
}

export async function simulateFakeProposalPayment(
  proposalId: string,
  paymentNonce: string,
  outcome: FakePaymentOutcome,
): Promise<FakePaymentResult> {
  if (process.env.NODE_ENV === "production") {
    throw new ProposalServerError(
      "FORBIDDEN",
      "La simulación de pagos no está disponible en producción.",
    );
  }

  const { userId } = await getRpcClient();
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient() as unknown as FakePaymentRpcClient;
  const { data, error } = await admin.rpc("apply_fake_payment_result", {
    target_proposal_id: proposalId,
    payment_nonce: paymentNonce,
    payment_outcome: outcome,
    actor_client_user_id: userId,
  });

  if (error) throw proposalError(error);
  const result = data?.[0];
  if (
    !result ||
    !proposalStatuses.includes(result.resulting_proposal_status) ||
    !(
      result.payment_attempt_id === null || isUuid(result.payment_attempt_id)
    ) ||
    !(result.confirmed_job_id === null || isUuid(result.confirmed_job_id))
  ) {
    throw proposalError(null);
  }
  return result;
}
