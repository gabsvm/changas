export type OnboardingStepId = "profile" | "identity" | "documents" | "review";

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
    title: "Tus datos",
    description: "Nombre y zona. Nada más.",
    href: "/provider/onboarding/profile",
  },
  {
    id: "identity",
    title: "Tu identidad",
    description: "Tu DNI. Solo vos lo ves.",
    href: "/provider/onboarding/identity",
  },
  {
    id: "documents",
    title: "Tus papeles",
    description: "Fotos claras de tus papeles.",
    href: "/provider/onboarding/documents",
  },
  {
    id: "review",
    title: "Revisá y enviá",
    description: "Mirá todo. Tocá Enviar.",
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
  return (
    steps.find((step) => step.state === "current")?.href ??
    steps[0]?.href ??
    "/provider/onboarding/profile"
  );
}
