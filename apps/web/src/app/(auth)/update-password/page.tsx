import { AuthForm } from "@/components/auth/auth-form";

import { updatePassword } from "../actions";

export default function UpdatePasswordPage() {
  return <AuthForm action={updatePassword} mode="update" />;
}
