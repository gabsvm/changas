import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { AccountMenuItem } from "@/components/ui/account-menu-item";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getNextOnboardingHref } from "@/lib/ui/onboarding";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

import { startProviderOnboarding } from "../../(provider)/actions";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account");
  }

  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "Tu cuenta";
  const initial = displayName.trim().charAt(0).toUpperCase() || "C";
  const providerPresentation = provider
    ? getProviderStatusPresentation(provider.status)
    : null;
  const canContinue =
    provider?.status === "PROFILE_INCOMPLETE" ||
    provider?.status === "IDENTITY_PENDING";

  return (
    <section className="py-6 sm:py-14">
      <div className="mx-auto max-w-3xl">
        <header className="flex items-center gap-3 sm:items-end sm:justify-between">
          <div className="brand-gradient-surface grid h-12 w-12 shrink-0 place-items-center rounded-2xl text-lg font-extrabold text-white">
            {initial}
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
              Mi cuenta
            </p>
            <h1 className="font-display mt-0.5 truncate text-2xl font-extrabold tracking-[-0.035em] sm:text-4xl">
              {displayName}
            </h1>
            <p className="text-ink/55 mt-1 truncate text-xs sm:text-sm">
              {user.email ?? "Cuenta de Changas"}
            </p>
          </div>
        </header>

        <section className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_12px_34px_rgba(32,33,36,0.05)] sm:p-6">
          {provider ? (
            <>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
                    Perfil de proveedor
                  </p>
                  <h2 className="font-display mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                    {provider.status === "ACTIVE"
                      ? "Tu perfil está listo"
                      : "Completá tu verificación"}
                  </h2>
                </div>
                {providerPresentation ? (
                  <StatusBadge
                    label={providerPresentation.label}
                    tone={providerPresentation.tone}
                  />
                ) : null}
              </div>
              <p className="text-ink/60 mt-2 text-sm leading-6">
                {providerPresentation?.description}
              </p>
              {provider.status !== "ACTIVE" ? (
                <div className="mt-5">
                  <div className="mb-2 flex items-center justify-between text-xs font-bold">
                    <span>Progreso</span>
                    <span className="text-ink/55">
                      Paso {Math.min(4, Math.max(1, provider.onboarding_step))}{" "}
                      de 4
                    </span>
                  </div>
                  <ProgressBar
                    value={
                      (Math.min(4, Math.max(1, provider.onboarding_step)) / 4) *
                      100
                    }
                    label="Progreso de verificación"
                  />
                </div>
              ) : null}
              <div className="mt-5">
                {provider.status === "ACTIVE" ? (
                  <Link
                    className="button-primary w-full sm:w-auto"
                    href="/provider/manage"
                  >
                    Gestionar servicios
                  </Link>
                ) : canContinue ? (
                  <Link
                    className="button-primary w-full sm:w-auto"
                    href={getNextOnboardingHref(provider.onboarding_step)}
                  >
                    Continuar verificación
                  </Link>
                ) : (
                  <Link
                    className="button-secondary w-full sm:w-auto"
                    href="/provider/onboarding"
                  >
                    Ver estado
                  </Link>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
                Ofrecer servicios
              </p>
              <h2 className="font-display mt-1 text-2xl font-extrabold tracking-[-0.025em]">
                ¿Querés trabajar con Changas?
              </h2>
              <p className="text-ink/60 mt-2 text-sm leading-6">
                Prepará tu perfil de proveedor cuando quieras. Tu cuenta sigue
                sirviendo también para contratar.
              </p>
              <StartProviderForm action={startProviderOnboarding} />
            </>
          )}
        </section>

        <section className="border-ink/10 bg-surface mt-5 overflow-hidden rounded-3xl border px-4 shadow-[0_10px_28px_rgba(32,33,36,0.04)] sm:px-5">
          <AccountMenuItem
            href="/account/profile"
            icon="profile"
            title="Perfil público"
            description="Nombre, zona y presentación"
          />
          <AccountMenuItem
            href="/account/identity"
            icon="identity"
            title="Identidad privada"
            description="Datos legales que no se publican"
          />
          <AccountMenuItem
            href="/account/favorites"
            icon="saved"
            title="Guardados"
            description="Profesionales y servicios que marcaste"
          />
          <AccountMenuItem
            href="/account/notifications"
            icon="activity"
            title="Actividad y notificaciones"
            description="Novedades y preferencias de avisos"
          />
          <AccountMenuItem
            href="/account/settings"
            icon="settings"
            title="Configuración"
            description="Preferencias de cuenta y sesión"
          />
        </section>
      </div>
    </section>
  );
}
