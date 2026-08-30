"use server";

import { getPublicSiteUrl } from "@changas/config/public";
import {
  loginSchema,
  passwordResetSchema,
  passwordUpdateSchema,
  signUpSchema,
} from "@changas/validation";
import { redirect } from "next/navigation";

import { safeNextPath } from "@/lib/auth/redirect";
import type { AuthActionState } from "@/lib/forms/action-state";
import { getFormString } from "@/lib/forms/form-data";
import { createClient } from "@/lib/supabase/server";

const genericAuthError =
  "No pudimos completar la operación. Revisá los datos e intentá de nuevo.";

function invalidForm(): AuthActionState {
  return { error: "Revisá los datos ingresados." };
}

function callbackUrl(next: string): string {
  const url = new URL("/auth/callback", getPublicSiteUrl());
  url.searchParams.set("next", safeNextPath(next));
  return url.toString();
}

export async function signIn(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = loginSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
  });

  if (!parsed.success) {
    return invalidForm();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);

  if (error) {
    return { error: genericAuthError };
  }

  redirect(safeNextPath(getFormString(formData, "next")));
}

export async function signUp(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = signUpSchema.safeParse({
    email: getFormString(formData, "email"),
    password: getFormString(formData, "password"),
    confirmPassword: getFormString(formData, "confirmPassword"),
    displayName: getFormString(formData, "displayName"),
  });

  if (!parsed.success) {
    return invalidForm();
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.displayName },
      emailRedirectTo: callbackUrl(getFormString(formData, "next")),
    },
  });

  if (error) {
    return { error: genericAuthError };
  }

  if (!data.session) {
    return {
      success: "Cuenta creada. Revisá tu correo para confirmar el acceso.",
    };
  }

  redirect(safeNextPath(getFormString(formData, "next")));
}

export async function requestPasswordReset(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordResetSchema.safeParse({
    email: getFormString(formData, "email"),
  });

  if (!parsed.success) {
    return invalidForm();
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.resetPasswordForEmail(
    parsed.data.email,
    {
      redirectTo: callbackUrl("/update-password"),
    },
  );

  if (error) {
    return { error: genericAuthError };
  }

  return {
    success:
      "Si el correo existe, te enviaremos instrucciones para recuperar el acceso.",
  };
}

export async function updatePassword(
  _previousState: AuthActionState,
  formData: FormData,
): Promise<AuthActionState> {
  const parsed = passwordUpdateSchema.safeParse({
    password: getFormString(formData, "password"),
    confirmPassword: getFormString(formData, "confirmPassword"),
  });

  if (!parsed.success) {
    return invalidForm();
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return {
      error: "El enlace de recuperación ya no es válido. Pedí uno nuevo.",
    };
  }

  const { error } = await supabase.auth.updateUser({
    password: parsed.data.password,
  });

  if (error) {
    return { error: genericAuthError };
  }

  redirect("/account");
}

export async function signOut(_formData: FormData): Promise<void> {
  const supabase = await createClient();
  await supabase.auth.signOut();
  redirect("/");
}

export async function signInWithGoogle(formData: FormData): Promise<void> {
  if (process.env.NEXT_PUBLIC_GOOGLE_OAUTH_ENABLED !== "true") {
    redirect("/auth-error?reason=google-disabled");
  }

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: callbackUrl(getFormString(formData, "next")),
    },
  });

  if (error || !data.url) {
    redirect("/auth-error?reason=google-unavailable");
  }

  redirect(data.url);
}
