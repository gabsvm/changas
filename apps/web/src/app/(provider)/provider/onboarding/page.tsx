import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { OnboardingStepCard } from "@/components/provider/onboarding-step-card";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getNextOnboardingHref, getOnboardingSteps } from "@/lib/ui/onboarding";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

import { startProviderOnboarding } from "../../actions";

export const dynamic = "force-dynamic";

export default async function ProviderOnboardingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/provider/onboarding");
  }

  const { data: provider } = await supabase
    .from("provider_profiles")
    .select("status, onboarding_step")
    .eq("user_id", user.id)
    .maybeSingle();

  if (!provider) {
    return (
      <section className="pb-6 sm:py-14">
        <MobileAppBar title="Ser proveedor" backHref="/account" />
        <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
          <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
            Proveedor
          </p>
          <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
            Empezá tu verificación
          </h1>
          <p className="text-ink/58 mt-2 max-w-xl text-sm leading-6">
            Son cuatro pasos breves. Podés salir y volver cuando quieras; nada se
            publica ni se activa sin revisión.
          </p>

          <section className="border-ink/10 mt-6 border-y py-1">
            {[
              ["1", "Perfil público"],
              ["2", "Identidad privada"],
              ["3", "Documentos"],
              ["4", "Revisión"],
            ].map(([number, label]) => (
              <div
                className="border-ink/10 flex min-h-12 items-center gap-3 border-b py-2 last:border-b-0"
                key={number}
              >
                <span className="bg-ink/[0.06] text-ink/60 grid h-8 w-8 place-items-center rounded-full text-xs font-extrabold">
                  {number}
                </span>
                <span className="text-sm font-semibold">{label}</span>
              </div>
            ))}
          </section>

          <StartProviderForm action={startProviderOnboarding} />
        </div>
      </section>
    );
  }

  const editable = canSelfManageProviderStatus(provider.status);
  const steps = getOnboardingSteps(provider.onboarding_step);
  const current = steps.find((step) => step.state === "current") ?? steps[0];
  const presentation = getProviderStatusPresentation(provider.status);
  const progress = ((current?.number ?? 1) / 4) * 100;
  const primaryHref =
    provider.status === "ACTIVE"
      ? "/provider/manage"
      : editable
        ? getNextOnboardingHref(provider.onboarding_step)
        : "/account";
  const primaryLabel =
    provider.status === "ACTIVE"
      ? "Gestionar servicios"
      : editable
        ? "Continuar verificación"
        : "Volver a mi cuenta";

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Verificación" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.16em] uppercase">
              Perfil de proveedor
            </p>
            <h1 className="mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
              Tu verificación
            </h1>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/58 mt-2 text-sm leading-6">
          {presentation.description}
        </p>

        <section className="border-ink/10 mt-5 border-y py-4">
          <div className="flex items-center justify-between gap-4 text-xs font-bold">
            <span>Progreso</span>
            <span className="text-ink/45">
              Paso {current?.number ?? 1} de 4
            </span>
          </div>
          <div className="mt-2.5">
            <ProgressBar value={progress} label="Progreso de verificación" />
          </div>
          <Link className="button-primary mt-4 w-full sm:w-auto" href={primaryHref}>
            {primaryLabel}
          </Link>
        </section>

        <section className="border-ink/10 mt-4 divide-y divide-ink/10 border-y">
          {steps.map((step) => (
            <OnboardingStepCard
              key={step.id}
              step={step}
              disabled={!editable && step.id !== "review"}
            />
          ))}
        </section>

        {!editable && provider.status !== "ACTIVE" ? (
          <p className="bg-brand-yellow/14 text-warning mt-4 rounded-xl px-3 py-2.5 text-sm leading-6">
            Mientras el perfil está en revisión o requiere intervención, la
            edición queda bloqueada.
          </p>
        ) : null}
      </div>
    </section>
  );
}
