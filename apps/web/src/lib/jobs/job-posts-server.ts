import type { JobPostStatus } from "@/lib/supabase/database.types";
import { createClient } from "@/lib/supabase/server";

import type { JobPostParsedData } from "./job-post-input";

export type JobPostErrorCode =
  | "UNAUTHORIZED"
  | "FORBIDDEN"
  | "NOT_FOUND"
  | "CONFLICT"
  | "TRANSIENT";

export class JobPostServerError extends Error {
  constructor(
    public readonly code: JobPostErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "JobPostServerError";
  }
}

export type JobPostSummary = {
  id: string;
  owner_user_id: string;
  skill_id: string;
  skill_name: string | null;
  title: string;
  description: string;
  location_text: string | null;
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  desired_budget_amount: number | null;
  currency_code: string;
  status: JobPostStatus;
  created_at: string;
  updated_at: string;
};

type SupabaseError = { code?: string | null; message?: string | null } | null;

function mapError(error: SupabaseError): JobPostServerError {
  switch (error?.code) {
    case "42501":
      return new JobPostServerError(
        "FORBIDDEN",
        "No tenés permiso para esa acción en la necesidad.",
      );
    case "P0002":
      return new JobPostServerError(
        "NOT_FOUND",
        "No encontramos la necesidad solicitada.",
      );
    case "22023":
    case "23505":
      return new JobPostServerError(
        "CONFLICT",
        "No pudimos completar esa acción con el estado actual.",
      );
    default:
      return new JobPostServerError(
        "TRANSIENT",
        "No pudimos completar la acción. Intentá nuevamente.",
      );
  }
}

async function requireUserId(): Promise<string> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    throw new JobPostServerError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para publicar necesidades.",
    );
  }
  return user.id;
}

const POST_COLUMNS =
  "id, owner_user_id, skill_id, title, description, location_text, schedule_start_at, schedule_end_at, desired_budget_amount, currency_code, status, created_at, updated_at";

type PostRow = {
  id: string;
  owner_user_id: string;
  skill_id: string;
  title: string;
  description: string;
  location_text: string | null;
  schedule_start_at: string | null;
  schedule_end_at: string | null;
  desired_budget_amount: number | null;
  currency_code: string;
  status: JobPostStatus;
  created_at: string;
  updated_at: string;
};

async function withSkillNames(rows: PostRow[]): Promise<JobPostSummary[]> {
  if (rows.length === 0) return [];
  const supabase = await createClient();
  const skillIds = [...new Set(rows.map((row) => row.skill_id))];
  const { data: skills, error } = await supabase
    .from("skills")
    .select("id, name")
    .in("id", skillIds);
  if (error) throw mapError(error);
  const names = new Map((skills ?? []).map((skill) => [skill.id, skill.name]));

  return rows.map((row) => ({
    ...row,
    skill_name: names.get(row.skill_id) ?? null,
  }));
}

export async function countPostOffers(postId: string): Promise<number> {
  await requireUserId();
  const supabase = await createClient();
  const { count, error } = await supabase
    .from("job_post_events")
    .select("id", { count: "exact", head: true })
    .eq("job_post_id", postId)
    .eq("event_type", "OFFER_RECEIVED");
  if (error) throw mapError(error);
  return count ?? 0;
}

export async function createJobPost(
  data: JobPostParsedData,
  idempotencyKey: string,
): Promise<string> {
  await requireUserId();
  const supabase = await createClient();
  const { data: postId, error } = await supabase.rpc("create_job_post", {
    requested_skill_id: data.skillId,
    requested_title: data.title,
    requested_description: data.description,
    requested_location_text: data.locationText ?? null,
    proposed_schedule_start_at: data.scheduleStartAt?.toISOString() ?? null,
    proposed_schedule_end_at: data.scheduleEndAt?.toISOString() ?? null,
    desired_budget_amount: data.desiredBudgetAmount ?? null,
    requested_currency_code: "ARS",
    request_idempotency_key: idempotencyKey,
  });
  if (error) throw mapError(error);
  if (!postId) throw mapError(null);
  return postId;
}

export async function listOpenJobPosts(options?: {
  skillId?: string;
  skillIds?: string[];
  limit?: number;
}): Promise<JobPostSummary[]> {
  await requireUserId();
  const supabase = await createClient();
  let query = supabase
    .from("job_posts")
    .select(POST_COLUMNS)
    .eq("status", "OPEN")
    .order("created_at", { ascending: false })
    .limit(options?.limit ?? 30);
  if (options?.skillId) query = query.eq("skill_id", options.skillId);
  if (options?.skillIds && options.skillIds.length > 0)
    query = query.in("skill_id", options.skillIds);
  const { data, error } = await query;
  if (error) throw mapError(error);
  return withSkillNames((data ?? []) as PostRow[]);
}

export async function listMyJobPosts(): Promise<JobPostSummary[]> {
  const userId = await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_posts")
    .select(POST_COLUMNS)
    .eq("owner_user_id", userId)
    .order("created_at", { ascending: false })
    .limit(50);
  if (error) throw mapError(error);
  return withSkillNames((data ?? []) as PostRow[]);
}

export async function getJobPost(postId: string): Promise<JobPostSummary> {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("job_posts")
    .select(POST_COLUMNS)
    .eq("id", postId)
    .maybeSingle();
  if (error) throw mapError(error);
  if (!data) {
    throw new JobPostServerError("NOT_FOUND", "No encontramos la necesidad solicitada.");
  }
  const [summary] = await withSkillNames([data as PostRow]);
  if (!summary) throw mapError(null);
  return summary;
}

export async function updateJobPostStatus(
  postId: string,
  status: JobPostStatus,
): Promise<JobPostStatus> {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("update_job_post_status", {
    target_post_id: postId,
    requested_status: status,
  });
  if (error) throw mapError(error);
  if (!data) throw mapError(null);
  return data;
}

export async function startPostOffer(
  postId: string,
  serviceId: string,
): Promise<string> {
  await requireUserId();
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("start_post_offer_conversation", {
    target_post_id: postId,
    target_service_id: serviceId,
  });
  if (error) throw mapError(error);
  if (!data) throw mapError(null);
  return data;
}
