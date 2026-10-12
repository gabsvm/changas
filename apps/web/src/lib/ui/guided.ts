/**
 * Flujos guiados paso a paso (estilo apps de delivery): una sola acción
 * por pantalla, frases ultracortas con verbo primero y progreso visible.
 * Este módulo es puro: las pantallas le pasan su estado y él dice qué
 * sigue. Nada de texto largo: la gente no lee párrafos.
 */

export type GuidedStep = {
  /** Verbo corto: qué hace la persona en este paso. */
  action: string;
  /** Una línea, máximo ~5 palabras. */
  hint: string;
};

/** Contratar un servicio, de principio a fin. */
export const CLIENT_HIRE_STEPS: readonly GuidedStep[] = [
  { action: "Buscá", hint: "Tocá una categoría o escribí." },
  { action: "Elegí", hint: "Mirá precio y reseñas." },
  { action: "Chateá", hint: "Acordá día y precio." },
  { action: "Pagá", hint: "Solo cuando termina." },
  { action: "Calificá", hint: "Contá cómo te fue." },
] as const;

/** Darse de alta y empezar a trabajar como prestador. */
export const PROVIDER_START_STEPS: readonly GuidedStep[] = [
  { action: "Tus datos", hint: "Nombre y zona." },
  { action: "Tu identidad", hint: "Tu DNI. Solo vos lo ves." },
  { action: "Tus papeles", hint: "Fotos claras, nada más." },
  { action: "Revisá", hint: "Mirá todo y enviá." },
] as const;

export function guideProgress(step: number, total: number): number {
  if (!Number.isFinite(step) || !Number.isFinite(total) || total <= 0) return 0;
  const clamped = Math.min(total, Math.max(1, Math.trunc(step)));
  return Math.round((clamped / total) * 100);
}

export type ProviderNextAction = {
  title: string;
  hint: string;
  cta: string;
  href: string;
};

/**
 * La única próxima acción del prestador según su estado real.
 * Orden pensado como embudo: primero existir, después publicar,
 * después poder cobrar, después trabajar.
 */
export function getProviderNextAction(args: {
  isProvider: boolean;
  providerActive: boolean;
  onboardingStep: number;
  hasServices: boolean;
  paymentConnected: boolean;
}): ProviderNextAction {
  const { isProvider, providerActive, hasServices, paymentConnected } = args;

  if (!isProvider) {
    return {
      title: "Empezá a trabajar",
      hint: "Son 4 pasos cortos.",
      cta: "Empezar ahora",
      href: "/provider/onboarding",
    };
  }

  if (!providerActive) {
    return {
      title: "Terminá tu alta",
      hint: "Te falta poco. Seguí donde ibas.",
      cta: "Seguir el paso a paso",
      href: "/provider/onboarding",
    };
  }

  if (!hasServices) {
    return {
      title: "Publicá tu primer servicio",
      hint: "Decí qué hacés y cuánto sale.",
      cta: "Publicar servicio",
      href: "/provider/manage",
    };
  }

  if (!paymentConnected) {
    return {
      title: "Conectá tu cobro",
      hint: "Sin esto no podés cobrar.",
      cta: "Conectar Mercado Pago",
      href: "/provider/manage",
    };
  }

  return {
    title: "Todo listo para trabajar",
    hint: "Te avisamos cuando te escriban.",
    cta: "Ver mis servicios",
    href: "/provider/manage",
  };
}

/** Próxima acción del cliente según tenga o no trabajos activos. */
export function getClientNextAction(args: {
  activeJobs: number;
  pendingPayment: boolean;
}): { title: string; hint: string; cta: string; href: string } {
  if (args.pendingPayment) {
    return {
      title: "Tenés un pago pendiente",
      hint: "Tocá y pagá. Es un toque.",
      cta: "Ir a pagar",
      href: "/jobs",
    };
  }
  if (args.activeJobs > 0) {
    return {
      title: "Seguí tu trabajo",
      hint: "Mirá en qué paso va.",
      cta: "Ver mi trabajo",
      href: "/jobs",
    };
  }
  return {
    title: "¿Qué necesitás hoy?",
    hint: "Buscá. Elegí. Listo.",
    cta: "Buscar un servicio",
    href: "/buscar",
  };
}
