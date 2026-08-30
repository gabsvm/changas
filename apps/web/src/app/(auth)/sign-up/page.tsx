import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

import { signInWithGoogle, signUp } from "../actions";

export default async function SignUpPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      action={signUp}
      googleAction={signInWithGoogle}
      googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true"}
      mode="signup"
      nextPath={safeNextPath(params.next ?? null)}
    />
  );
}
