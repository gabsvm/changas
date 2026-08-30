import { AuthForm } from "@/components/auth/auth-form";

import { requestPasswordReset } from "../actions";

export default function ForgotPasswordPage() {
  return <AuthForm action={requestPasswordReset} mode="reset" />;
}
