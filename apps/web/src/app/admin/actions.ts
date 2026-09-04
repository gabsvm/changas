"use server";

import { revalidatePath } from "next/cache";

import { decideAdminIdentityCase } from "@/lib/admin/identity";
import { adminRpc } from "@/lib/admin/server";

function requiredText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${key}.`);
  }
  return value.trim();
}

function optionalText(formData: FormData, key: string): string | null {
  const value = formData.get(key);
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

function integerValue(formData: FormData, key: string, fallback = 0): number {
  const value = Number(formData.get(key) ?? fallback);
  return Number.isInteger(value) ? value : fallback;
}

export async function decideIdentityAction(formData: FormData) {
  const decision = requiredText(formData, "decision");
  if (decision !== "APPROVE" && decision !== "REJECT") {
    throw new Error("Decisión de identidad inválida.");
  }
  await decideAdminIdentityCase({
    providerUserId: requiredText(formData, "providerUserId"),
    decision,
    reason: optionalText(formData, "reason"),
  });
  revalidatePath("/admin/identity");
  revalidatePath("/admin/providers");
}

export async function setAccountRestrictionAction(formData: FormData) {
  await adminRpc("admin_set_account_restriction", {
    target_user_id: requiredText(formData, "userId"),
    requested_kind: requiredText(formData, "kind"),
    requested_reason: requiredText(formData, "reason"),
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/audit");
}

export async function restoreAccountAction(formData: FormData) {
  await adminRpc("admin_restore_account", {
    target_user_id: requiredText(formData, "userId"),
    requested_reason: optionalText(formData, "reason"),
  });
  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/audit");
}

export async function resolveReportAction(formData: FormData) {
  await adminRpc("admin_resolve_report", {
    requested_report_type: requiredText(formData, "reportType"),
    target_report_id: requiredText(formData, "reportId"),
    requested_resolution: requiredText(formData, "resolution"),
  });
  revalidatePath("/admin/reports");
  revalidatePath("/admin/audit");
}

export async function setReviewModerationAction(formData: FormData) {
  await adminRpc("admin_set_review_moderation", {
    target_review_id: requiredText(formData, "reviewId"),
    requested_disposition: requiredText(formData, "disposition"),
    requested_reason: optionalText(formData, "reason"),
  });
  revalidatePath("/admin/reports");
  revalidatePath("/admin/audit");
  revalidatePath("/prestador", "layout");
}

export async function setMessageModerationAction(formData: FormData) {
  await adminRpc("admin_set_message_moderation", {
    target_message_id: requiredText(formData, "messageId"),
    requested_disposition: requiredText(formData, "disposition"),
    requested_reason: optionalText(formData, "reason"),
  });
  revalidatePath("/admin/reports");
  revalidatePath("/admin/audit");
}

export async function setServiceModerationAction(formData: FormData) {
  await adminRpc("admin_set_service_moderation", {
    target_service_id: requiredText(formData, "serviceId"),
    requested_state: requiredText(formData, "state"),
    requested_reason: optionalText(formData, "reason"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function createCategoryAction(formData: FormData) {
  await adminRpc("admin_create_category", {
    requested_slug: requiredText(formData, "slug"),
    requested_name: requiredText(formData, "name"),
    requested_description: optionalText(formData, "description"),
    requested_sort_order: integerValue(formData, "sortOrder"),
  });
  revalidatePath("/admin/catalog");
}

export async function updateCategoryStateAction(formData: FormData) {
  await adminRpc("admin_update_category", {
    target_category_id: requiredText(formData, "categoryId"),
    requested_slug: requiredText(formData, "slug"),
    requested_name: requiredText(formData, "name"),
    requested_description: optionalText(formData, "description"),
    requested_sort_order: integerValue(formData, "sortOrder"),
    requested_is_active: requiredText(formData, "nextActive") === "true",
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
}

export async function deleteCategoryAction(formData: FormData) {
  await adminRpc("admin_delete_category", {
    target_category_id: requiredText(formData, "categoryId"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function createSkillAction(formData: FormData) {
  await adminRpc("admin_create_skill", {
    target_category_id: requiredText(formData, "categoryId"),
    requested_slug: requiredText(formData, "slug"),
    requested_name: requiredText(formData, "name"),
    requested_description: optionalText(formData, "description"),
    requested_sort_order: integerValue(formData, "sortOrder"),
  });
  revalidatePath("/admin/catalog");
}

export async function updateSkillStateAction(formData: FormData) {
  await adminRpc("admin_update_skill", {
    target_skill_id: requiredText(formData, "skillId"),
    target_category_id: requiredText(formData, "categoryId"),
    requested_slug: requiredText(formData, "slug"),
    requested_name: requiredText(formData, "name"),
    requested_description: optionalText(formData, "description"),
    requested_sort_order: integerValue(formData, "sortOrder"),
    requested_is_active: requiredText(formData, "nextActive") === "true",
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
}

export async function deleteSkillAction(formData: FormData) {
  await adminRpc("admin_delete_skill", {
    target_skill_id: requiredText(formData, "skillId"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function createSkillSynonymAction(formData: FormData) {
  await adminRpc("admin_create_skill_synonym", {
    target_skill_id: requiredText(formData, "skillId"),
    requested_phrase: requiredText(formData, "phrase"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function updateSkillSynonymAction(formData: FormData) {
  await adminRpc("admin_update_skill_synonym", {
    target_synonym_id: requiredText(formData, "synonymId"),
    requested_phrase: requiredText(formData, "phrase"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function deleteSkillSynonymAction(formData: FormData) {
  await adminRpc("admin_delete_skill_synonym", {
    target_synonym_id: requiredText(formData, "synonymId"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function createServiceTagAction(formData: FormData) {
  await adminRpc("admin_create_service_tag", {
    target_service_id: requiredText(formData, "serviceId"),
    requested_tag: requiredText(formData, "tag"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function updateServiceTagAction(formData: FormData) {
  await adminRpc("admin_update_service_tag", {
    target_service_id: requiredText(formData, "serviceId"),
    target_normalized_tag: requiredText(formData, "normalizedTag"),
    requested_tag: requiredText(formData, "tag"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}

export async function deleteServiceTagAction(formData: FormData) {
  await adminRpc("admin_delete_service_tag", {
    target_service_id: requiredText(formData, "serviceId"),
    target_normalized_tag: requiredText(formData, "normalizedTag"),
  });
  revalidatePath("/admin/catalog");
  revalidatePath("/buscar");
  revalidatePath("/admin/audit");
}
