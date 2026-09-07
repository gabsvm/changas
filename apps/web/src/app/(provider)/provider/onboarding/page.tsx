import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { OnboardingStepCard } from "@/components/provider/onboarding-step-card";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import {
  getNextOnboardingHref,
  getOnboardingSteps,
} from "@/lib/ui/onboarding";
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
        <div className="mx-auto max-w-2xl pt-6 sm:pt-0">
          <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.16em] uppercase">
            Proveedor
          </p>
          <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
            Empezá tu verificación
          </h1>
          <p className="text-ink/60 mt-3 text-sm leading-6">
            Vamos a crear un espacio privado para guardar tu progreso. Esto no
            publica servicios ni activa tu perfil automáticamente.
          </p>
          <div className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(22,56,50,0.04)] sm:p-6">
            <h2 className="font-display text-2xl font-semibold">
              Cuatro pasos, sin apuro
            </h2>
            <p className="text-ink/60 mt-2 text-sm leading-6">
              Completá tus datos, identidad y documentos. Podés salir y volver
              cuando quieras; la aprobación final sigue siendo manual.
            </p>
            <StartProviderForm action={startProviderOnboarding} />
          </div>
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
      <div className="mx-auto max-w-3xl pt-6 sm:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Perfil de proveedor
            </p>
            <h1 className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
              Tu verificación
            </h1>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/60 mt-3 max-w-2xl text-sm leading-6">
          {presentation.description} El avance se guarda de forma privada y no
          convierte tu perfil en activo sin revisión.
        </p>

        <section className="border-ink/10 bg-surface mt-6 rounded-3xl border p-5 shadow-[0_10px_30px_rgba(22,56,50,0.04)] sm:p-6">
          <div className="flex items-center justify-between gap-4 text-xs font-semibold">
            <span>Progreso guardado</span>
            <span className="text-ink/50">
              Paso {current?.number ?? 1} de 4
            </span>
          </div>
          <div className="mt-3">
            <ProgressBar value={progress} label="Progreso de verificación" />
          </div>
          <Link className="button-primary mt-5 w-full sm:w-auto" href={primaryHref}>
            {primaryLabel}
          </Link>
        </section>

        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          {steps.map((step) => (
            <OnboardingStepCard
              key={step.id}
              step={step}
              disabled={!editable && step.id !== "review"}
            />
          ))}
        </div>

        {!editable && provider.status !== "ACTIVE" ? (
          <p className="bg-warning/10 text-warning mt-5 rounded-2xl px-4 py-3 text-sm leading-6">
            Mientras el perfil está en revisión o requiere intervención, los
            pasos de edición quedan bloqueados desde tu cuenta.
          </p>
        ) : null}
      </div>
    </section>
  );
}
