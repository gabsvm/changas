"use client";

import Link from "next/link";
import { useActionState } from "react";

import type { AuthActionState } from "@/lib/forms/action-state";
import { initialActionState } from "@/lib/forms/action-state";

type AuthAction = (
  previousState: AuthActionState,
  formData: FormData,
) => Promise<AuthActionState>;

type AuthMode = "login" | "signup" | "reset" | "update";

const copy = {
  login: {
    title: "Volvé a Changas",
    description: "Ingresá para continuar con tu cuenta.",
    submit: "Iniciar sesión",
  },
  signup: {
    title: "Creá tu cuenta",
    description: "Empezá con una cuenta simple y segura.",
    submit: "Crear cuenta",
  },
  reset: {
    title: "Recuperá el acceso",
    description: "Te enviaremos instrucciones a tu correo.",
    submit: "Enviar instrucciones",
  },
  update: {
    title: "Elegí una nueva contraseña",
    description: "Usá al menos ocho caracteres.",
    submit: "Guardar contraseña",
  },
} satisfies Record<
  AuthMode,
  { title: string; description: string; submit: string }
>;

export function AuthForm({
  action,
  googleAction,
  googleEnabled = false,
  mode,
  nextPath = "/account",
}: {
  action: AuthAction;
  googleAction?: (formData: FormData) => Promise<void>;
  googleEnabled?: boolean;
  mode: AuthMode;
  nextPath?: string;
}) {
  const [state, formAction, pending] = useActionState(
    action,
    initialActionState,
  );
  const modeCopy = copy[mode];

  return (
    <div className="border-ink/10 w-full max-w-md rounded-[2rem] border bg-white/75 p-6 shadow-[0_24px_80px_rgba(22,56,50,0.12)] sm:p-8">
      <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
        Cuenta Changas
      </p>
      <h1 className="font-display mt-3 text-4xl leading-tight font-semibold tracking-[-0.03em]">
        {modeCopy.title}
      </h1>
      <p className="text-ink/65 mt-3 text-sm leading-6">
        {modeCopy.description}
      </p>

      <form action={formAction} className="mt-8 space-y-5">
        <input type="hidden" name="next" value={nextPath} />

        {mode === "signup" ? (
          <label className="block text-sm font-semibold">
            Nombre visible
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:ring-2"
              name="displayName"
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        ) : null}

        {mode !== "update" ? (
          <label className="block text-sm font-semibold">
            Correo electrónico
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:ring-2"
              name="email"
              type="email"
              autoComplete="email"
              required
            />
          </label>
        ) : null}

        {mode === "login" || mode === "signup" || mode === "update" ? (
          <label className="block text-sm font-semibold">
            Contraseña
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:ring-2"
              name="password"
              type="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        ) : null}

        {mode === "signup" || mode === "update" ? (
          <label className="block text-sm font-semibold">
            Repetí la contraseña
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 font-normal outline-none focus:ring-2"
              name="confirmPassword"
              type="password"
              autoComplete="new-password"
              minLength={8}
              maxLength={128}
              required
            />
          </label>
        ) : null}

        {state.error ? (
          <p
            className="bg-terracotta/10 text-terracotta rounded-xl px-4 py-3 text-sm leading-6"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="bg-moss/10 text-moss rounded-xl px-4 py-3 text-sm leading-6"
            role="status"
            aria-live="polite"
          >
            {state.success}
          </p>
        ) : null}

        <button
          className="button-primary w-full disabled:cursor-wait disabled:opacity-60"
          type="submit"
          disabled={pending}
        >
          {pending ? "Procesando…" : modeCopy.submit}
        </button>
      </form>

      {googleEnabled &&
      googleAction &&
      (mode === "login" || mode === "signup") ? (
        <form action={googleAction} className="mt-4">
          <input type="hidden" name="next" value={nextPath} />
          <button className="button-secondary w-full" type="submit">
            Continuar con Google
          </button>
        </form>
      ) : null}

      <nav
        className="text-ink/65 mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm"
        aria-label="Navegación de cuenta"
      >
        {mode === "login" ? (
          <>
            <Link className="underline underline-offset-4" href="/sign-up">
              Crear cuenta
            </Link>
            <Link
              className="underline underline-offset-4"
              href="/forgot-password"
            >
              Olvidé mi contraseña
            </Link>
          </>
        ) : null}
        {mode === "signup" ? (
          <Link className="underline underline-offset-4" href="/login">
            Ya tengo una cuenta
          </Link>
        ) : null}
        {mode === "reset" ? (
          <Link className="underline underline-offset-4" href="/login">
            Volver a iniciar sesión
          </Link>
        ) : null}
        {mode === "update" ? (
          <Link className="underline underline-offset-4" href="/login">
            Volver a iniciar sesión
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
