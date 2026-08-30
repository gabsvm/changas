import { signIn, signInWithGoogle } from "../actions";
import { AuthForm } from "@/components/auth/auth-form";
import { safeNextPath } from "@/lib/auth/redirect";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const params = await searchParams;
  return (
    <AuthForm
      action={signIn}
      googleAction={signInWithGoogle}
      googleEnabled={process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED === "true"}
      mode="login"
      nextPath={safeNextPath(params.next ?? null)}
    />
  );
}
