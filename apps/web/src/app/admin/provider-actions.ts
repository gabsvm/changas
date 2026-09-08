"use server";

import { revalidatePath } from "next/cache";

import { adminRpc } from "@/lib/admin/server";

function requiredText(formData: FormData, key: string): string {
  const value = formData.get(key);
  if (typeof value !== "string" || !value.trim()) {
    throw new Error(`Falta ${key}.`);
  }
  return value.trim();
}

function revalidateProviderAdminSurfaces() {
  revalidatePath("/admin");
  revalidatePath("/admin/users");
  revalidatePath("/admin/providers");
  revalidatePath("/admin/identity");
  revalidatePath("/admin/audit");
  revalidatePath("/buscar");
}

export async function prepareProviderAction(formData: FormData) {
  await adminRpc("admin_prepare_provider", {
    target_user_id: requiredText(formData, "userId"),
  });
  revalidateProviderAdminSurfaces();
}

export async function activateProviderAction(formData: FormData) {
  const reason = requiredText(formData, "reason");
  if (reason.length < 3) {
    throw new Error("El motivo de activación manual debe tener al menos 3 caracteres.");
  }

  await adminRpc("admin_activate_provider", {
    target_user_id: requiredText(formData, "userId"),
    requested_reason: reason,
  });
  revalidateProviderAdminSurfaces();
}
