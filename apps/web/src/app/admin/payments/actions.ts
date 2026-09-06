"use server";

import { revalidatePath } from "next/cache";

import { runAdminPaymentReconciliation } from "@/lib/payments/server-admin";

export async function reconcilePaymentsAction() {
  await runAdminPaymentReconciliation();
  revalidatePath("/admin/payments");
}
