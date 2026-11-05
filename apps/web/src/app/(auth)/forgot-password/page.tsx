import type { Metadata } from "next";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

import { requestPasswordReset } from "../actions";

export const metadata: Metadata = { title: "Recuperar acceso" };

export default async function ForgotPasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const raw = params?.next;
  return (
    <AuthForm
      action={requestPasswordReset}
      mode="reset"
      nextPath={safeNextPath(
        Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null),
      )}
    />
  );
}
