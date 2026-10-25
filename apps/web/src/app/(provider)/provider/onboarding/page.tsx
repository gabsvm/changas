import { canSelfManageProviderStatus } from "@changas/domain";
import Link from "next/link";
import { redirect } from "next/navigation";

import { StartProviderForm } from "@/components/account/account-form";
import { OnboardingStepCard } from "@/components/provider/onboarding-step-card";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import {
  IllustratedBadge,
  type IllustratedTone,
} from "@/components/ui/marketplace/illustrated-badge";
import { ProgressBar } from "@/components/ui/progress-bar";
import { StatusBadge } from "@/components/ui/status-badge";
import { createClient } from "@/lib/supabase/server";
import { getNextOnboardingHref, getOnboardingSteps } from "@/lib/ui/onboarding";
import {
  hasRequiredIdentityDocuments,
  missingRequiredIdentityDocuments,
} from "@/lib/ui/provider-submission";
import { NextStepBanner } from "@/components/ui/guided";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";
import { startProviderOnboarding } from "../../actions";

export const dynamic = "force-dynamic";
const STEP_VISUALS: Record<
  string,
  { tone: IllustratedTone; icon: "user" | "shield" | "doc" | "check" }
> = {
  profile: { tone: "violet", icon: "user" },
  identity: { tone: "green", icon: "shield" },
  documents: { tone: "blue", icon: "doc" },
  review: { tone: "gold", icon: "check" },
};

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
    const emptySteps = getOnboardingSteps(1);
    return (
      <section className="pb-6 sm:py-14">
        <MobileAppBar title="Ser proveedor" backHref="/account" />
        <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
          <div className="flex min-w-0 items-center gap-3">
            <IllustratedBadge
              tone="orange"
              icon="briefcase"
              size="md"
              label="Ser proveedor"
            />
            <div className="min-w-0">
              <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
                Proveedor
              </p>
              <h1 className="font-display mt-1.5 text-3xl font-extrabold tracking-[-0.035em]">
                Empezá tu verificación
              </h1>
            </div>
          </div>
          <StartProviderForm action={startProviderOnboarding} />
          <p className="text-ink/70 mt-2 max-w-xl text-sm leading-6">
            Son 4 pasos cortos. Empezá ahora.
          </p>

          <section className="border-ink/[0.08] bg-surface divide-ink/[0.07] consumer-card mt-6 divide-y rounded-2xl border px-2 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
            {emptySteps.map((step) => (
              <OnboardingStepCard key={step.id} step={step} disabled />
            ))}
          </section>
        </div>
      </section>
    );
  }

  const editable = canSelfManageProviderStatus(provider.status);
  // YALO B4: el progreso se valida por campos/documentos reales (los mismos
  // que exige la revisión), no por el contador onboarding_step. Una etapa
  // solo figura completa cuando sus requisitos están cargados.
  const [{ data: profile }, { data: privateProfile }, { data: documents }] =
    await Promise.all([
      supabase
        .from("profiles")
        .select("display_name, public_zone, bio")
        .eq("id", user.id)
        .maybeSingle(),
      supabase
        .from("profile_private")
        .select(
          "legal_name, private_phone, date_of_birth, exact_address, dni_number",
        )
        .eq("user_id", user.id)
        .maybeSingle(),
      supabase
        .from("provider_documents")
        .select("document_type")
        .eq("user_id", user.id),
    ]);
  const missingPublic = (
    [
      [profile?.display_name, "nombre visible"],
      [profile?.public_zone, "zona"],
      [profile?.bio, "presentación"],
    ] as const
  )
    .filter(([value]) => !value)
    .map(([, label]) => label);
  const missingPrivate = (
    [
      [privateProfile?.legal_name, "nombre legal"],
      [privateProfile?.private_phone, "teléfono"],
      [privateProfile?.date_of_birth, "fecha de nacimiento"],
      [privateProfile?.exact_address, "dirección"],
      [privateProfile?.dni_number, "DNI"],
    ] as const
  )
    .filter(([value]) => !value)
    .map(([, label]) => label);
  const documentTypeLabels: Record<string, string> = {
    DNI_FRONT: "frente del DNI",
    DNI_BACK: "dorso del DNI",
    SELFIE: "selfie",
  };
  const missingDocuments = missingRequiredIdentityDocuments(documents ?? []);
  const publicComplete = missingPublic.length === 0;
  const privateComplete = missingPrivate.length === 0;
  const documentsComplete = hasRequiredIdentityDocuments(documents ?? []);
  const submitted =
    provider.status === "IDENTITY_PENDING" ||
    provider.status === "UNDER_REVIEW";
  const approved = provider.status === "ACTIVE";
  const readyForSubmission =
    publicComplete && privateComplete && documentsComplete;
  const requirementDone = [
    publicComplete,
    privateComplete,
    documentsComplete,
    submitted || approved,
  ];
  const missingByStep: string[][] = [
    missingPublic,
    missingPrivate,
    missingDocuments.map((type) => documentTypeLabels[type] ?? type),
    readyForSubmission ? [] : ["los pasos anteriores"],
  ];
  const firstOpen = requirementDone.findIndex((done) => !done);
  const baseSteps = getOnboardingSteps(provider.onboarding_step);
  const steps = baseSteps.map((step, index) => {
    const done = requirementDone[index] ?? false;
    const missing = missingByStep[index] ?? [];
    return {
      ...step,
      state: done
        ? ("complete" as const)
        : index === firstOpen
          ? ("current" as const)
          : ("pending" as const),
      description:
        done || missing.length === 0
          ? step.description
          : `Falta: ${missing.join(", ")}.`,
    };
  });
  const current = steps.find((step) => step.state === "current");
  const presentation = getProviderStatusPresentation(provider.status);
  const doneCount = requirementDone.filter(Boolean).length;
  const progress = (doneCount / 4) * 100;
  const currentCta =
    current?.id === "profile"
      ? "Completar tus datos"
      : current?.id === "identity"
        ? "Completar tu identidad"
        : current?.id === "documents"
          ? "Subir documentos"
          : current?.id === "review"
            ? "Revisar y enviar"
            : "Continuar verificación";
  const primaryHref = approved
    ? "/provider/manage"
    : editable && current
      ? current.id === "review" && readyForSubmission && !submitted
        ? "/provider/onboarding/review"
        : current.href
      : editable
        ? getNextOnboardingHref(provider.onboarding_step)
        : "/account";
  const primaryLabel = approved
    ? "Gestionar servicios"
    : editable && current
      ? current.id === "review" && readyForSubmission && !submitted
        ? "Enviar a revisión"
        : currentCta
      : editable
        ? "Continuar verificación"
        : "Volver a mi cuenta";

  return (
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Verificación" backHref="/account" />
      <div className="mx-auto max-w-2xl pt-5 sm:pt-0">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.16em] uppercase">
              Perfil de proveedor
            </p>
            <h1 className="font-display mt-2 text-3xl leading-9 font-extrabold tracking-[-0.035em]">
              Tu verificación
            </h1>
          </div>
          <StatusBadge label={presentation.label} tone={presentation.tone} />
        </div>

        <p className="text-ink/70 mt-3 text-sm leading-7">
          {presentation.description}
        </p>
        {current ? (
          <NextStepBanner
            title={`Paso ${current.number}: ${current.title}`}
            hint={current.description}
            cta={primaryLabel}
            href={primaryHref}
            className="mt-5"
          />
        ) : null}

        <section className="border-ink/[0.08] bg-surface mt-6 rounded-2xl border px-4 py-5 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
          <ol
            className="flex items-center gap-1"
            aria-label="Pasos de verificación"
          >
            {steps.map((step) => {
              const visual = STEP_VISUALS[step.id] ?? {
                tone: "neutral" as IllustratedTone,
                icon: "check" as const,
              };
              const done = step.state === "complete";
              const isCurrent = step.state === "current";
              return (
                <li
                  key={step.id}
                  className="flex min-w-0 flex-1 flex-col items-center gap-1.5 text-center"
                >
                  <span
                    className={done || isCurrent ? "" : "opacity-45 grayscale"}
                  >
                    <IllustratedBadge
                      tone={visual.tone}
                      icon={done ? "check" : visual.icon}
                      size="sm"
                      label={`${step.number}. ${step.title}`}
                    />
                  </span>
                  <span
                    className={`max-w-full truncate text-[11px] leading-4 font-bold ${isCurrent ? "text-ink" : "text-ink/60"}`}
                  >
                    {step.title}
                  </span>
                </li>
              );
            })}
          </ol>
          <div className="mt-4 flex items-center justify-between gap-4 text-xs font-bold">
            <span>Progreso</span>
            <span className="text-ink/70">{doneCount} de 4 requisitos</span>
          </div>
          <div className="mt-2.5">
            <ProgressBar value={progress} label="Progreso de verificación" />
          </div>
          <Link
            className="consumer-pressable cta-ink mt-5 inline-flex min-h-[52px] w-full items-center justify-center rounded-xl px-6 text-[15px] font-extrabold sm:w-auto"
            href={primaryHref}
          >
            {primaryLabel}
          </Link>
        </section>

        <section className="border-ink/[0.08] bg-surface divide-ink/[0.07] mt-5 divide-y rounded-2xl border px-2 shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
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
