"use client";

import Link from "next/link";
import { useActionState, useState } from "react";

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

function PasswordInput({
  name,
  autoComplete,
}: {
  name: string;
  autoComplete: string;
}) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative mt-2 block">
      <input
        className="border-ink/15 focus:border-moss focus:ring-moss/20 w-full rounded-xl border bg-white py-3 pr-20 pl-4 dark:border-white/15 dark:bg-white/5 font-normal outline-none focus:ring-2"
        name={name}
        type={visible ? "text" : "password"}
        autoComplete={autoComplete}
        autoCapitalize="none"
        spellCheck={false}
        minLength={8}
        maxLength={128}
        required
      />
      <button
        type="button"
        className="text-terracotta absolute inset-y-0 right-0 min-w-16 px-4 text-sm font-bold"
        onClick={() => setVisible((value) => !value)}
        aria-pressed={visible}
      >
        {visible ? "Ocultar" : "Mostrar"}
      </button>
    </span>
  );
}

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
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const modeCopy = copy[mode];
  const nextQuery =
    nextPath !== "/account" ? `?next=${encodeURIComponent(nextPath)}` : "";

  return (
    <div className="border-ink/[0.08] bg-surface relative w-full max-w-md overflow-hidden rounded-3xl border p-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%),0_24px_70px_-20px_rgb(255_107_53/28%)] sm:rounded-[1.75rem] sm:p-8 dark:shadow-[0_24px_70px_-20px_rgb(0_0_0/70%)]">
      <span aria-hidden="true" className="brand-gradient-surface pointer-events-none absolute inset-x-0 top-0 h-1.5" />
      <p className="text-terracotta text-xs font-extrabold tracking-[0.18em] uppercase">
        Cuenta Changas
      </p>
      <h1 className="font-display mt-2 text-3xl leading-tight font-extrabold tracking-[-0.04em] sm:mt-3 sm:text-4xl">
        {modeCopy.title}
      </h1>
      <p className="text-ink/70 mt-2 text-sm leading-6 sm:mt-3">
        {modeCopy.description}
      </p>

      <form action={formAction} className="mt-6 space-y-5 sm:mt-8">
        <input type="hidden" name="next" value={nextPath} />

        {mode === "signup" ? (
          <label className="block text-sm font-bold">
            Nombre visible
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5 font-normal outline-none focus:ring-2"
              name="displayName"
              value={displayName}
              onChange={(event) => setDisplayName(event.target.value)}
              autoComplete="name"
              minLength={2}
              maxLength={80}
              required
            />
          </label>
        ) : null}

        {mode !== "update" ? (
          <label className="block text-sm font-bold">
            Correo electrónico
            <input
              className="border-ink/15 focus:border-moss focus:ring-moss/20 mt-2 w-full rounded-xl border bg-white px-4 py-3 dark:border-white/15 dark:bg-white/5 font-normal outline-none focus:ring-2"
              name="email"
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              autoComplete="email"
              autoCapitalize="none"
              spellCheck={false}
              inputMode="email"
              required
            />
          </label>
        ) : null}

        {mode === "login" || mode === "signup" || mode === "update" ? (
          <label className="block text-sm font-bold">
            Contraseña
            <PasswordInput
              name="password"
              autoComplete={
                mode === "login" ? "current-password" : "new-password"
              }
            />
          </label>
        ) : null}

        {mode === "signup" || mode === "update" ? (
          <label className="block text-sm font-bold">
            Repetí la contraseña
            <PasswordInput name="confirmPassword" autoComplete="new-password" />
          </label>
        ) : null}

        {state.error ? (
          <p
            className="bg-danger/10 text-danger rounded-xl px-4 py-3 text-sm leading-6"
            role="alert"
          >
            {state.error}
          </p>
        ) : null}
        {state.success ? (
          <p
            className="bg-success/10 text-success rounded-xl px-4 py-3 text-sm leading-6"
            role="status"
            aria-live="polite"
          >
            {state.success}
          </p>
        ) : null}

        {mode === "signup" ? (
          <p className="text-ink/70 text-xs leading-5">
            Al crear tu cuenta aceptás los{" "}
            <Link className="text-terracotta underline" href="/terminos">
              Términos y condiciones
            </Link>{" "}
            y la{" "}
            <Link className="text-terracotta underline" href="/privacidad">
              Política de privacidad
            </Link>
            .
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
        <>
          <div
            className="text-ink/70 my-4 flex items-center gap-3 text-xs font-bold"
            aria-hidden="true"
          >
            <span className="bg-ink/10 h-px flex-1" />
            <span>o</span>
            <span className="bg-ink/10 h-px flex-1" />
          </div>
          <form action={googleAction}>
            <input type="hidden" name="next" value={nextPath} />
            <button className="button-secondary w-full" type="submit">
              Continuar con Google
            </button>
          </form>
        </>
      ) : null}

      <nav
        className="text-ink/70 mt-6 flex flex-wrap gap-x-4 gap-y-2 text-sm"
        aria-label="Navegación de cuenta"
      >
        {mode === "login" ? (
          <>
            <Link
              className="text-terracotta decoration-terracotta/30 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
              href={`/sign-up${nextQuery}`}
            >
              Crear cuenta
            </Link>
            <Link
              className="hover:text-terracotta decoration-ink/20 inline-flex min-h-11 items-center underline underline-offset-4 transition-colors"
              href="/forgot-password"
            >
              Olvidé mi contraseña
            </Link>
          </>
        ) : null}
        {mode === "signup" ? (
          <Link
            className="text-terracotta decoration-terracotta/30 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href={`/login${nextQuery}`}
          >
            Ya tengo una cuenta
          </Link>
        ) : null}
        {mode === "reset" ? (
          <Link
            className="text-terracotta decoration-terracotta/30 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href={`/login${nextQuery}`}
          >
            Volver a iniciar sesión
          </Link>
        ) : null}
        {mode === "update" ? (
          <Link
            className="text-terracotta decoration-terracotta/30 inline-flex min-h-11 items-center font-semibold underline underline-offset-4"
            href={`/login${nextQuery}`}
          >
            Volver a iniciar sesión
          </Link>
        ) : null}
      </nav>
    </div>
  );
}
