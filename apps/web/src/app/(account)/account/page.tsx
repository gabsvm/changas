import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { Avatar } from "@/components/ui/marketplace/avatar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { createClient } from "@/lib/supabase/server";
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

  const displayName =
    profile?.display_name || user.email?.split("@")[0] || "Tu cuenta";
  const providerPresentation = provider
    ? getProviderStatusPresentation(provider.status)
    : null;
  const step = provider
    ? Math.min(4, Math.max(1, provider.onboarding_step))
    : 0;

  const profileChecks = [
    { label: "foto", done: Boolean(profile?.avatar_url) },
    { label: "presentación", done: Boolean(profile?.bio?.trim()) },
    { label: "zona", done: Boolean(profile?.public_zone?.trim()) },
  ];
  const missing = profileChecks.filter((check) => !check.done);
  const completion = Math.round(
    ((profileChecks.length - missing.length) / profileChecks.length) * 100,
  );

  return (
    <section className="pt-5 pb-6 sm:py-10">
      <div className="mx-auto max-w-2xl">
        <header>
          <Link
            href="/account/profile"
            className="consumer-pressable flex items-center gap-4 rounded-2xl"
            aria-label="Ver perfil público"
          >
            <Avatar
              name={displayName}
              src={profile?.avatar_url ?? null}
              size="lg"
            />
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-extrabold tracking-[-0.02em]">
                {displayName}
              </span>
              <span className="text-ink/70 mt-1 block truncate text-sm leading-5">
                {user.email}
              </span>
            </span>
            <span className="text-ink/28 text-2xl" aria-hidden="true">
              ›
            </span>
          </Link>
        </header>

        {missing.length ? (
          <Link
            href="/account/profile"
            className="consumer-pressable bg-brand-yellow/20 mt-5 block rounded-2xl px-4 py-3.5"
          >
            <span className="flex items-center justify-between gap-3 text-sm font-extrabold">
              Completá tu perfil
              <span className="text-ink/70 font-bold">{completion}%</span>
            </span>
            <span
              className="bg-ink/10 mt-2 block h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <span
                className="bg-brand-orange block h-full rounded-full"
                style={{ width: `${Math.max(completion, 8)}%` }}
              />
            </span>
            <span className="text-ink/70 mt-2 block text-[13px] leading-5">
              Falta: {missing.map((check) => check.label).join(", ")}. Un perfil
              completo genera más confianza.
            </span>
          </Link>
        ) : null}

        <section className="consumer-card bg-surface mt-6 px-5 py-5">
          {provider ? (
            <div>
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-ink/70 text-xs font-semibold">
                    Perfil de proveedor
                  </p>
                  <h2 className="mt-1 text-lg leading-7 font-bold tracking-[-0.02em]">
                    {provider.status === "ACTIVE"
                      ? "Listo para trabajar"
                      : `Verificación en curso · paso ${step} de 4`}
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
              <Link
                className="consumer-pressable border-ink/[0.08] mt-4 flex min-h-12 items-center justify-between rounded-xl border px-4 text-sm font-bold"
                href={
                  provider.status === "ACTIVE"
                    ? "/provider/manage"
                    : "/provider/onboarding"
                }
              >
                {provider.status === "ACTIVE"
                  ? "Gestionar mis servicios"
                  : "Ver mi verificación"}
                <span className="text-ink/40 text-xl" aria-hidden="true">
                  ›
                </span>
              </Link>
            </div>
          ) : (
            <div>
              <h2 className="text-lg leading-7 font-bold tracking-[-0.02em]">
                ¿Querés ofrecer servicios?
              </h2>
              <p className="text-ink/70 mt-1.5 text-sm leading-6">
                Creá tu perfil profesional sin cambiar cómo usás Changas para
                contratar.
              </p>
              <StartProviderForm action={startProviderOnboarding} />
            </div>
          )}
        </section>

        <AccountGroup title="Cuenta">
          <SettingsRow
            href="/account/profile"
            title="Perfil público"
            description="Foto, nombre, zona y presentación"
            leading={<IllustratedBadge tone="violet" icon="user" size="sm" />}
          />
          <SettingsRow
            href="/account/identity"
            title="Identidad y seguridad"
            description="Datos legales que no se publican"
            leading={<IllustratedBadge tone="green" icon="shield" size="sm" />}
          />
          <SettingsRow
            href="/account/favorites"
            title="Guardados"
            description="Servicios y profesionales que marcaste"
            leading={<IllustratedBadge tone="rose" icon="heart" size="sm" />}
          />
          <SettingsRow
            href="/account/notifications"
            title="Notificaciones"
            description="Actividad y preferencias de avisos"
            leading={<IllustratedBadge tone="gold" icon="bell" size="sm" />}
          />
        </AccountGroup>

        {provider ? (
          <AccountGroup title="Proveedor">
            <SettingsRow
              href={
                provider.status === "ACTIVE"
                  ? "/provider/manage"
                  : "/provider/onboarding"
              }
              title={
                provider.status === "ACTIVE"
                  ? "Mis servicios"
                  : "Verificación de proveedor"
              }
              description={
                provider.status === "ACTIVE"
                  ? "Servicios, habilidades y disponibilidad"
                  : "Completá los pasos para publicar"
              }
              leading={
                <IllustratedBadge tone="orange" icon="briefcase" size="sm" />
              }
            />
            {provider.status === "ACTIVE" ? (
              <SettingsRow
                href="/provider/manage"
                title="Disponibilidad"
                description="Zonas, horarios y pausas"
                leading={
                  <IllustratedBadge tone="blue" icon="clock" size="sm" />
                }
              />
            ) : null}
          </AccountGroup>
        ) : null}

        <AccountGroup title="Preferencias">
          <SettingsRow
            href="/account/settings"
            title="Configuración"
            description="Cuenta, privacidad y sesión"
            leading={<IllustratedBadge tone="neutral" icon="gear" size="sm" />}
          />
        </AccountGroup>
      </div>
    </section>
  );
}

function AccountGroup({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="mt-8" aria-label={title}>
      <h2 className="text-ink/42 px-1 text-xs leading-5 font-bold tracking-[0.08em] uppercase">
        {title}
      </h2>
      <div className="consumer-card bg-surface divide-ink/[0.07] mt-2 divide-y px-4">
        {children}
      </div>
    </section>
  );
}
