import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { ProgressBar } from "@/components/ui/progress-bar";
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

  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: provider }] = await Promise.all([
    supabase
      .from("profiles")
      .select("display_name, public_zone, bio, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
    supabase
      .from("provider_profiles")
      .select("status, onboarding_step")
      .eq("user_id", user.id)
      .maybeSingle(),
  ]);

  const displayName = profile?.display_name || user.email?.split("@")[0] || "Tu cuenta";
  const providerPresentation = provider
    ? getProviderStatusPresentation(provider.status)
    : null;
  const step = provider ? Math.min(4, Math.max(1, provider.onboarding_step)) : 0;
  const canContinue =
    provider?.status === "PROFILE_INCOMPLETE" ||
    provider?.status === "IDENTITY_PENDING";

  return (
    <section className="pb-6 pt-5 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header>
          <Link
            href="/account/profile"
            className="consumer-pressable -mx-2 flex min-h-16 items-center gap-3 rounded-xl px-2 py-2 hover:bg-ink/[0.03]"
          >
            <Avatar name={displayName} src={profile?.avatar_url} size="lg" />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-bold tracking-[-0.025em]">
                {displayName}
              </span>
              <span className="text-ink/48 mt-0.5 block truncate text-sm">
                {user.email ?? "Cuenta de Changas"}
              </span>
            </span>
            <span className="text-ink/28 text-2xl" aria-hidden="true">›</span>
          </Link>
        </header>

        <section className="consumer-card bg-surface mt-5 px-4 py-4">
          {provider ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink/45 text-xs font-semibold">Perfil de proveedor</p>
                  <h2 className="mt-0.5 text-lg font-bold tracking-[-0.02em]">
                    {provider.status === "ACTIVE" ? "Listo para trabajar" : "Completá tu verificación"}
                  </h2>
                </div>
                {providerPresentation ? (
                  <StatusChip
                    tone={
                      provider.status === "ACTIVE"
                        ? "success"
                        : provider.status === "REJECTED"
                          ? "danger"
                          : "warning"
                    }
                  >
                    {providerPresentation.label}
                  </StatusChip>
                ) : null}
              </div>
              <p className="text-ink/52 mt-1 text-sm leading-5">
                {providerPresentation?.description}
              </p>
              {provider.status !== "ACTIVE" ? (
                <div className="mt-3">
                  <div className="text-ink/48 mb-1.5 flex items-center justify-between text-xs font-semibold">
                    <span>Progreso</span>
                    <span>{step} de 4</span>
                  </div>
                  <ProgressBar value={(step / 4) * 100} label="Progreso de verificación" />
                </div>
              ) : null}
              <Link
                className="consumer-pressable text-terracotta mt-3 inline-flex min-h-11 items-center rounded-lg px-2 text-sm font-bold hover:bg-brand-orange/[0.07]"
                href={
                  provider.status === "ACTIVE"
                    ? "/provider/manage"
                    : canContinue
                      ? getNextOnboardingHref(provider.onboarding_step)
                      : "/provider/onboarding"
                }
              >
                {provider.status === "ACTIVE"
                  ? "Gestionar servicios"
                  : canContinue
                    ? "Continuar verificación"
                    : "Ver estado"}
                <span className="ml-1" aria-hidden="true">›</span>
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-lg font-bold tracking-[-0.02em]">¿Querés ofrecer servicios?</h2>
              <p className="text-ink/52 mt-1 text-sm leading-5">
                Creá tu perfil profesional sin cambiar cómo usás Changas para contratar.
              </p>
              <StartProviderForm action={startProviderOnboarding} />
            </div>
          )}
        </section>

        <AccountGroup title="Cuenta">
          <SettingsRow href="/account/profile" title="Perfil público" description="Foto, nombre, zona y presentación" />
          <SettingsRow href="/account/identity" title="Identidad y seguridad" description="Datos legales que no se publican" />
          <SettingsRow href="/account/favorites" title="Guardados" description="Servicios y profesionales que marcaste" />
          <SettingsRow href="/account/notifications" title="Notificaciones" description="Actividad y preferencias de avisos" />
        </AccountGroup>

        {provider ? (
          <AccountGroup title="Proveedor">
            <SettingsRow
              href={provider.status === "ACTIVE" ? "/provider/manage" : "/provider/onboarding"}
              title={provider.status === "ACTIVE" ? "Mis servicios" : "Verificación de proveedor"}
              description={provider.status === "ACTIVE" ? "Servicios, habilidades y disponibilidad" : "Completá los pasos para publicar"}
            />
            {provider.status === "ACTIVE" ? (
              <SettingsRow href="/provider/manage" title="Disponibilidad" description="Zonas, horarios y pausas" />
            ) : null}
          </AccountGroup>
        ) : null}

        <AccountGroup title="Preferencias">
          <SettingsRow href="/account/settings" title="Configuración" description="Cuenta, privacidad y sesión" />
        </AccountGroup>
      </div>
    </section>
  );
}

function AccountGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-7" aria-label={title}>
      <h2 className="text-ink/42 px-1 text-xs font-bold uppercase tracking-[0.08em]">{title}</h2>
      <div className="consumer-card bg-surface mt-1 divide-y divide-ink/[0.07] px-4">
        {children}
      </div>
    </section>
  );
}
