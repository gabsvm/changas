export type OnboardingStepId =
  | "profile"
  | "identity"
  | "documents"
  | "review";

export type OnboardingStepState = "complete" | "current" | "pending";

export type OnboardingStepPresentation = {
  id: OnboardingStepId;
  number: number;
  title: string;
  description: string;
  href: string;
  state: OnboardingStepState;
};

const stepDefinitions = [
  {
    id: "profile",
    title: "Datos básicos",
    description: "Completá cómo te van a ver y tu zona aproximada.",
    href: "/provider/onboarding/profile",
  },
  {
    id: "identity",
    title: "Identidad privada",
    description: "Guardá tus datos legales en un espacio privado.",
    href: "/provider/onboarding/identity",
  },
  {
    id: "documents",
    title: "Documentos",
    description: "Subí los archivos necesarios para la revisión.",
    href: "/provider/onboarding/documents",
  },
  {
    id: "review",
    title: "Revisión",
    description: "Revisá lo completado y el estado actual del perfil.",
    href: "/provider/onboarding/review",
  },
] as const satisfies ReadonlyArray<{
  id: OnboardingStepId;
  title: string;
  description: string;
  href: string;
}>;

export function clampOnboardingStep(step: number): number {
  if (!Number.isFinite(step)) return 1;
  return Math.min(4, Math.max(1, Math.trunc(step)));
}

export function getOnboardingSteps(
  currentStep: number,
): OnboardingStepPresentation[] {
  const activeStep = clampOnboardingStep(currentStep);

  return stepDefinitions.map((definition, index) => {
    const number = index + 1;
    const state: OnboardingStepState =
      number < activeStep
        ? "complete"
        : number === activeStep
          ? "current"
          : "pending";

    return {
      ...definition,
      number,
      state,
    };
  });
}

export function getNextOnboardingHref(currentStep: number): string {
  const steps = getOnboardingSteps(currentStep);
  return steps.find((step) => step.state === "current")?.href ?? steps[0].href;
}
