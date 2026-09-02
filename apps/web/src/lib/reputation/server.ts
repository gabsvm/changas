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

type PublicReputationRpcClient = {
  rpc(
    name:
      | "get_public_provider_reputation"
      | "list_public_provider_reputation_context"
      | "list_public_provider_reviews",
    args: Record<string, unknown>,
  ): Promise<{
    data: unknown;
    error: { message?: string | null } | null;
  }>;
};

function rows<T>(value: unknown): T[] {
  return Array.isArray(value) ? (value as T[]) : [];
}

export async function getPublicProviderReputation(
  client: SupabaseClient<Database>,
  providerSlug: string,
): Promise<PublicProviderReputation | null> {
  const rpc = client as unknown as PublicReputationRpcClient;
  const { data, error } = await rpc.rpc("get_public_provider_reputation", {
    target_provider_slug: providerSlug,
  });
  if (error) return null;
  return rows<PublicProviderReputation>(data)[0] ?? null;
}

export async function listPublicProviderReputationContext(
  client: SupabaseClient<Database>,
  providerSlug: string,
): Promise<PublicReputationContext[]> {
  const rpc = client as unknown as PublicReputationRpcClient;
  const { data, error } = await rpc.rpc(
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
  const rpc = client as unknown as PublicReputationRpcClient;
  const { data, error } = await rpc.rpc("list_public_provider_reviews", {
    target_provider_slug: providerSlug,
    page_size: Math.min(Math.max(pageSize, 1), 50),
  });
  return error ? [] : rows<PublicProviderReview>(data);
}
