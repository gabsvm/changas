import "server-only";

import { notFound, redirect } from "next/navigation";

import { createClient } from "@/lib/supabase/server";

import {
  AdminUiError,
  classifyAdminAccess,
  mapAdminRpcError,
  type AdminRpcError,
} from "./policy";

type AdminRpcClient = {
  auth: {
    getUser(): Promise<{
      data: { user: { id: string } | null };
      error: AdminRpcError;
    }>;
  };
  rpc(
    name: string,
    args?: Record<string, unknown>,
  ): Promise<{ data: unknown; error: AdminRpcError }>;
};

type AdminSession = { client: AdminRpcClient; userId: string };

async function getAdminSession(): Promise<AdminSession> {
  const client = (await createClient()) as unknown as AdminRpcClient;
  const userResult = await client.auth.getUser();
  const userId = userResult.error ? null : (userResult.data.user?.id ?? null);

  if (!userId) {
    throw new AdminUiError(
      "UNAUTHORIZED",
      "Necesitás iniciar sesión para acceder al panel administrativo.",
    );
  }

  const adminResult = await client.rpc("is_current_user_admin");
  if (adminResult.error) throw mapAdminRpcError(adminResult.error);

  const access = classifyAdminAccess(userId, adminResult.data === true);
  if (access === "FORBIDDEN") {
    throw new AdminUiError(
      "FORBIDDEN",
      "Esta cuenta no tiene permisos administrativos.",
    );
  }

  return { client, userId };
}

export async function requireAdminPage(): Promise<{ userId: string }> {
  try {
    const session = await getAdminSession();
    return { userId: session.userId };
  } catch (error) {
    if (error instanceof AdminUiError) {
      if (error.code === "UNAUTHORIZED") redirect("/login?next=/admin");
      if (error.code === "FORBIDDEN") notFound();
    }
    throw error;
  }
}

export async function adminRpc<T>(
  name: string,
  args: Record<string, unknown> = {},
): Promise<T> {
  const { client } = await getAdminSession();
  const result = await client.rpc(name, args);
  if (result.error) throw mapAdminRpcError(result.error);
  return result.data as T;
}

export type AdminUserRow = {
  user_id: string;
  email: string | null;
  display_name: string | null;
  role: string;
  provider_status: string | null;
  created_at: string;
};

export type AdminUserDetail = AdminUserRow & {
  legal_name: string | null;
  private_phone: string | null;
  date_of_birth: string | null;
  dni_number: string | null;
};

export type AdminProviderRow = {
  provider_user_id: string;
  email: string | null;
  display_name: string | null;
  public_slug: string;
  public_headline: string | null;
  status: string;
  onboarding_step: number;
  document_count: number;
  created_at: string;
};

export type AdminProviderDetail = AdminProviderRow & {
  marketplace_paused: boolean;
  availability_paused: boolean;
  service_count: number;
  updated_at: string;
};

export type AdminReportRow = {
  report_type: "CONVERSATION_REPORT" | "REVIEW_REPORT";
  report_id: string;
  target_id: string;
  reporter_user_id: string;
  category: string;
  reason: string | null;
  case_id: string | null;
  case_status: "OPEN" | "RESOLVED";
  resolution: string | null;
  created_at: string;
};

export type AdminJobRow = {
  job_id: string;
  status: string;
  service_id: string;
  service_title: string;
  client_user_id: string;
  client_display_name: string | null;
  provider_user_id: string;
  provider_display_name: string | null;
  confirmed_at: string;
  created_at: string;
  updated_at: string;
};

export type AdminAuditRow = {
  event_id: string;
  actor_user_id: string;
  actor_display_name: string | null;
  action_type: string;
  target_type: string;
  target_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
};

export type AdminCategoryRow = {
  category_id: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  skill_count: number;
};

export type AdminSkillRow = {
  skill_id: string;
  category_id: string;
  category_name: string;
  slug: string;
  name: string;
  description: string | null;
  sort_order: number;
  is_active: boolean;
  service_count: number;
};

export type AdminSkillSynonymRow = {
  synonym_id: string;
  skill_id: string;
  skill_name: string;
  phrase: string;
  normalized_phrase: string;
};

export type AdminServiceRow = {
  service_id: string;
  provider_user_id: string;
  provider_display_name: string | null;
  service_title: string;
  service_slug: string;
  skill_name: string;
  is_published: boolean;
  is_paused: boolean;
  moderation_state: "CLEAR" | "FLAGGED" | "DISABLED";
  moderation_reason: string | null;
  updated_at: string;
};

export type AdminServiceTagRow = {
  service_id: string;
  service_title: string;
  provider_display_name: string | null;
  tag: string;
  normalized_tag: string;
};

export async function listAdminUsers(searchText = "") {
  return adminRpc<AdminUserRow[]>("list_admin_users", {
    search_text: searchText.trim() || null,
    page_size: 50,
    page_offset: 0,
  });
}

export async function getAdminUserDetail(userId: string) {
  const rows = await adminRpc<AdminUserDetail[]>("get_admin_user_detail", {
    target_user_id: userId,
  });
  return rows[0] ?? null;
}

export async function listAdminProviders(searchText = "") {
  return adminRpc<AdminProviderRow[]>("list_admin_providers", {
    search_text: searchText.trim() || null,
    requested_status: null,
    page_size: 50,
    page_offset: 0,
  });
}

export async function getAdminProviderDetail(providerUserId: string) {
  const rows = await adminRpc<AdminProviderDetail[]>(
    "get_admin_provider_detail",
    {
      target_provider_user_id: providerUserId,
    },
  );
  return rows[0] ?? null;
}

export async function listAdminReports(
  status: "OPEN" | "RESOLVED" | null = null,
) {
  return adminRpc<AdminReportRow[]>("list_admin_reports", {
    requested_status: status,
    page_size: 50,
    page_offset: 0,
  });
}

export async function listAdminJobs() {
  return adminRpc<AdminJobRow[]>("list_admin_jobs", {
    requested_status: null,
    search_text: null,
    page_size: 50,
    page_offset: 0,
  });
}

export async function listAdminAuditEvents() {
  return adminRpc<AdminAuditRow[]>("list_admin_audit_events", {
    before_created_at: null,
    page_size: 100,
  });
}

export async function listAdminCategories() {
  return adminRpc<AdminCategoryRow[]>("list_admin_catalog_categories");
}

export async function listAdminSkills(categoryId: string | null = null) {
  return adminRpc<AdminSkillRow[]>("list_admin_catalog_skills", {
    target_category_id: categoryId,
  });
}

export async function listAdminSkillSynonyms(skillId: string | null = null) {
  return adminRpc<AdminSkillSynonymRow[]>("list_admin_skill_synonyms", {
    target_skill_id: skillId,
  });
}

export async function listAdminServices(searchText = "") {
  return adminRpc<AdminServiceRow[]>("list_admin_services", {
    search_text: searchText.trim() || null,
    page_size: 50,
    page_offset: 0,
  });
}

export async function listAdminServiceTags(serviceId: string | null = null) {
  return adminRpc<AdminServiceTagRow[]>("list_admin_service_tags", {
    target_service_id: serviceId,
  });
}
