import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";

import type { Database } from "@/lib/supabase/database.types";

export type PublicProviderReputation = {
  provider_slug: string;
  rating_average: number | null;
  adjusted_rating: number | null;
  review_count: number;
  quality_rating_average: number | null;
  punctuality_rating_average: number | null;
  communication_rating_average: number | null;
  completed_jobs: number;
  observed_jobs: number;
  completion_rate: number | null;
  cancellation_count: number;
  cancellation_rate: number | null;
  no_show_count: number;
  no_show_rate: number | null;
  repeat_client_count: number;
};

export type PublicReputationContext = {
  context_type: "SKILL" | "SERVICE";
  context_slug: string;
  context_name: string;
  rating_average: number | null;
  adjusted_rating: number | null;
  review_count: number;
  completed_jobs: number;
};

export type PublicProviderReview = {
  review_id: string;
  reviewer_display_name: string;
  rating: number;
  quality_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  review_text: string | null;
  service_title: string;
  service_slug: string;
  skill_name: string;
  skill_slug: string;
  category_name: string;
  category_slug: string;
  provider_reply: string | null;
  provider_replied_at: string | null;
  created_at: string;
  has_more: boolean;
};

export type JobReviewState = {
  job_id: string;
  job_status: string;
  client_user_id: string;
  provider_user_id: string;
  review_id: string | null;
  rating: number | null;
  quality_rating: number | null;
  punctuality_rating: number | null;
  communication_rating: number | null;
  review_text: string | null;
  review_created_at: string | null;
  provider_reply: string | null;
  provider_replied_at: string | null;
  reported_by_caller: boolean;
  can_review: boolean;
};

export type RehireProposalResult = {
  conversation_id: string;
  proposal_id: string;
  proposal_kind: "DIRECT_BOOKING" | "QUOTE_REQUEST";
  proposal_status: string;
};

export type ReviewReportReason =
  | "THREATS"
  | "INSULTS"
  | "PRIVATE_INFORMATION"
  | "DISCRIMINATION"
  | "IRRELEVANT_CONTENT"
  | "EXTORTION"
  | "ABUSE"
  | "OTHER";

export type CreateJobReviewInput = {
  jobId: string;
  rating: number;
  reviewText: string | null;
  qualityRating: number | null;
  punctualityRating: number | null;
  communicationRating: number | null;
};

type ReputationRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): Promise<{
    data: unknown;
    error: { message?: string | null } | null;
  }>;
};

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

function rpcClient(client: SupabaseClient<Database>): ReputationRpcClient {
  return client as unknown as ReputationRpcClient;
}

async function mutation<T>(
  client: SupabaseClient<Database>,
  name: string,
  args: Record<string, unknown>,
): Promise<T> {
  const { data, error } = await rpcClient(client).rpc(name, args);
  if (error) throw new Error(error.message ?? "No pudimos completar la acción.");
  return data as T;
}

export async function getPublicProviderReputation(
  client: SupabaseClient<Database>,
  providerSlug: string,
): Promise<PublicProviderReputation | null> {
  const { data, error } = await rpcClient(client).rpc(
    "get_public_provider_reputation",
    { target_provider_slug: providerSlug },
  );
  if (error) return null;
  return rows<PublicProviderReputation>(data)[0] ?? null;
}

export async function listPublicProviderReputationContext(
  client: SupabaseClient<Database>,
  providerSlug: string,
): Promise<PublicReputationContext[]> {
  const { data, error } = await rpcClient(client).rpc(
    "list_public_provider_reputation_context",
    { target_provider_slug: providerSlug },
  );
  return error ? [] : rows<PublicReputationContext>(data);
}

export async function listPublicProviderReviews(
  client: SupabaseClient<Database>,
  providerSlug: string,
  pageSize = 12,
): Promise<PublicProviderReview[]> {
  const { data, error } = await rpcClient(client).rpc(
    "list_public_provider_reviews",
    {
      target_provider_slug: providerSlug,
      page_size: Math.min(Math.max(pageSize, 1), 50),
    },
  );
  return error ? [] : rows<PublicProviderReview>(data);
}

export async function getJobReviewState(
  client: SupabaseClient<Database>,
  jobId: string,
): Promise<JobReviewState | null> {
  const { data, error } = await rpcClient(client).rpc("get_job_review_state", {
    target_job_id: jobId,
  });
  if (error) throw new Error(error.message ?? "No pudimos cargar la reseña.");
  return rows<JobReviewState>(data)[0] ?? null;
}

export async function createJobReview(
  client: SupabaseClient<Database>,
  input: CreateJobReviewInput,
): Promise<string> {
  return mutation<string>(client, "create_job_review", {
    target_job_id: input.jobId,
    requested_rating: input.rating,
    requested_review_text: input.reviewText,
    requested_quality_rating: input.qualityRating,
    requested_punctuality_rating: input.punctualityRating,
    requested_communication_rating: input.communicationRating,
  });
}

export async function upsertProviderReviewReply(
  client: SupabaseClient<Database>,
  reviewId: string,
  replyText: string,
): Promise<string> {
  return mutation<string>(client, "upsert_provider_review_reply", {
    target_review_id: reviewId,
    requested_reply_text: replyText,
  });
}

export async function reportReview(
  client: SupabaseClient<Database>,
  reviewId: string,
  reason: ReviewReportReason,
  details: string | null,
): Promise<string> {
  return mutation<string>(client, "report_review", {
    target_review_id: reviewId,
    requested_reason: reason,
    requested_details: details,
  });
}

export async function createRehireProposal(
  client: SupabaseClient<Database>,
  jobId: string,
): Promise<RehireProposalResult> {
  const { data, error } = await rpcClient(client).rpc("create_rehire_proposal", {
    target_job_id: jobId,
  });
  if (error) throw new Error(error.message ?? "No pudimos volver a contratar.");
  const result = rows<RehireProposalResult>(data)[0];
  if (!result) throw new Error("No pudimos crear la nueva propuesta.");
  return result;
}
