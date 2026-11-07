import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";

import { Avatar } from "@/components/ui/marketplace/avatar";
import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
import { SettingsRow } from "@/components/ui/marketplace/settings-row";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { createClient } from "@/lib/supabase/server";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";
import { NextStepBanner } from "@/components/ui/guided";
import { getProviderNextAction } from "@/lib/ui/guided";
import { listMyUpcomingJobs, type UpcomingJob } from "@/lib/jobs/server";
import {
  JOB_TERMINAL_STATUSES,
  getJobStatusPresentation,
} from "@/lib/ui/job-status";

export const metadata: Metadata = { title: "Mi cuenta" };

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account");

  const [{ data: profile }, { data: provider }, { data: isAdmin }] =
    await Promise.all([
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
      (
        supabase as unknown as {
          rpc(
            name: "is_current_user_admin",
          ): Promise<{ data: boolean | null; error: unknown }>;
        }
      ).rpc("is_current_user_admin"),
    ]);

  // Lo que está en curso manda: un cliente con un trabajo activo ve eso
  // primero, no el alta de prestador.
  let activeJobs: UpcomingJob[] = [];
  try {
    activeJobs = (await listMyUpcomingJobs(5)).filter(
      (job) => !JOB_TERMINAL_STATUSES.includes(job.job_status),
    );
  } catch {
    activeJobs = [];
  }
  const activeJob = activeJobs[0] ?? null;
  const activeJobStatus = activeJob
    ? getJobStatusPresentation(activeJob.job_status)
    : null;

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
      <h1 className="sr-only">Mi cuenta</h1>
      <div className="mx-auto max-w-2xl">
        <header className="brand-gradient-surface relative overflow-hidden rounded-[1.75rem] p-5 shadow-[0_30px_64px_-18px_rgb(13_18_27/28%)]">
          <Link
            href="/account/profile"
            className="consumer-pressable relative flex items-center gap-4 rounded-2xl"
            aria-label="Ver perfil público"
          >
            <span className="rounded-full ring-2 ring-white/70">
              <Avatar
                name={displayName}
                src={profile?.avatar_url ?? null}
                size="lg"
              />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-xl font-semibold tracking-[-0.02em] text-white">
                {displayName}
              </span>
              <span className="mt-1 block truncate text-sm leading-5 text-white/85">
                {user.email}
              </span>
            </span>
            <span
              className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/20 text-xl text-white"
              aria-hidden="true"
            >
              ›
            </span>
          </Link>
        </header>

        {activeJob && activeJobStatus ? (
          <Link
            href={`/jobs/${activeJob.job_id}`}
            className="account-active-job consumer-pressable bg-surface mt-5 block rounded-2xl border border-[#12D9C5]/60 px-5 py-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)]"
          >
            <span className="text-moss block text-xs font-semibold">
              {activeJobs.length > 1
                ? `Tenés ${activeJobs.length} trabajos en marcha`
                : `Trabajo ${activeJobStatus.label.toLowerCase()}`}
            </span>
            <span className="mt-1 block truncate text-lg leading-7 font-bold tracking-[-0.02em]">
              {activeJob.service_title}
            </span>
            <span className="text-ink/70 block truncate text-sm">
              Con {activeJob.counterparty_name}
            </span>
            <span className="cta-ink mt-3 flex min-h-12 items-center justify-center rounded-xl text-[15px] font-semibold">
              Ver seguimiento
            </span>
          </Link>
        ) : null}

        {(() => {
          // Sin alta de prestador no hay "próximo paso" de prestador: el
          // acceso queda como una fila del menú Cuenta.
          if (!provider) return null;
          const next = getProviderNextAction({
            isProvider: Boolean(provider),
            providerActive: provider?.status === "ACTIVE",
            onboardingStep: step,
            hasServices: false,
            paymentConnected: false,
            status: provider?.status ?? null,
          });
          if (provider?.status === "ACTIVE") return null;
          return (
            <NextStepBanner
              title={next.title}
              hint={next.hint}
              cta={next.cta}
              href={next.href}
              className="mt-5"
            />
          );
        })()}

        {missing.length ? (
          <Link
            href="/account/profile"
            className="consumer-pressable border-ink/[0.08] bg-surface mt-5 block rounded-2xl border px-4 py-3.5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]"
          >
            <span className="flex items-center justify-between gap-3 text-sm font-semibold">
              Completá tu perfil
              <span className="text-ink/70 font-bold">{completion}%</span>
            </span>
            <span
              className="bg-ink/10 mt-2 block h-1.5 overflow-hidden rounded-full"
              aria-hidden="true"
            >
              <span
                className="block h-full rounded-full bg-[#1576D2]"
                style={{ width: `${Math.max(completion, 8)}%` }}
              />
            </span>
            <span className="text-ink/70 mt-2 block text-[13px] leading-5">
              Falta: {missing.map((check) => check.label).join(", ")}. Un perfil
              completo genera más confianza.
            </span>
            <span className="border-ink/[0.12] mt-3 flex min-h-11 items-center justify-center rounded-xl border text-sm font-bold">
              Completar perfil
            </span>
          </Link>
        ) : null}

        {provider ? (
          <section className="consumer-card bg-surface border-ink/[0.08] mt-6 border px-5 py-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
          </section>
        ) : null}

        <AccountGroup title="Cuenta">
          {!provider ? (
            <SettingsRow
              href="/provider/onboarding"
              title="Ofrecer mis servicios"
              description="Perfil profesional · 4 pasos"
              leading={
                <IllustratedBadge tone="green" icon="briefcase" size="sm" />
              }
            />
          ) : null}
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
                href="/provider/manage#disponibilidad"
                title="Disponibilidad"
                description="Zonas, horarios y pausas"
                leading={
                  <IllustratedBadge tone="blue" icon="clock" size="sm" />
                }
              />
            ) : null}
            {provider.status === "ACTIVE" && arePublicNeedsEnabled() ? (
              <SettingsRow
                href="/oportunidades"
                title="Oportunidades"
                description="Necesidades abiertas en tus rubros"
                leading={
                  <IllustratedBadge tone="green" icon="compass" size="sm" />
                }
              />
            ) : null}
          </AccountGroup>
        ) : null}

        {isAdmin === true ? (
          <AccountGroup title="Administración">
            <SettingsRow
              href="/admin"
              title="Panel administrativo"
              description="Usuarios, prestadores y operaciones"
              leading={<IllustratedBadge tone="blue" icon="shield" size="sm" />}
            />
          </AccountGroup>
        ) : null}

        <AccountGroup title="Ayuda">
          <SettingsRow
            href="/#como-funciona"
            title="Cómo funciona"
            description="Cómo contratar y ofrecer servicios"
            leading={
              <IllustratedBadge tone="violet" icon="compass" size="sm" />
            }
          />
          <SettingsRow
            href="/terminos"
            title="Términos"
            description="Condiciones de uso de YALO"
            leading={<IllustratedBadge tone="neutral" icon="doc" size="sm" />}
          />
        </AccountGroup>
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
      <h2 className="text-ink/70 px-1 text-xs leading-5 font-semibold">
        {title}
      </h2>
      <div className="consumer-card bg-surface divide-ink/[0.07] border-ink/[0.08] mt-2 divide-y border px-4 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
        {children}
      </div>
    </section>
  );
}
