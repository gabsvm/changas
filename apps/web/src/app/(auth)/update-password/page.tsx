import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

import { updatePassword } from "../actions";

export default async function UpdatePasswordPage({
  searchParams,
}: {
  searchParams?: Promise<{ next?: string | string[] }>;
}) {
  const params = searchParams ? await searchParams : undefined;
  const raw = params?.next;
  return (
    <AuthForm
      action={updatePassword}
      mode="update"
      nextPath={safeNextPath(
        Array.isArray(raw) ? (raw[0] ?? null) : (raw ?? null),
      )}
    />
  );
}
