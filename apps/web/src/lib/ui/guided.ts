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
  { action: "Acordá pago", hint: "Directo entre ustedes." },
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
 *
 * El `status` (provider_status) manda cuando viene: UNDER_REVIEW /
 * IDENTITY_PENDING no es un alta incompleta (banner tranquilo + borrador),
 * y REJECTED dice qué corregir con link a revisión. Sin `status` se
 * conserva el contrato viejo (booleano) para no romper llamadas.
 */
export function getProviderNextAction(args: {
  isProvider: boolean;
  providerActive: boolean;
  onboardingStep: number;
  hasServices: boolean;
  paymentConnected: boolean;
  paymentsEnabled?: boolean;
  status?: string | null;
}): ProviderNextAction {
  const {
    isProvider,
    providerActive,
    hasServices,
    paymentConnected,
    paymentsEnabled = false,
    status = null,
  } = args;

  if (!isProvider || status === "NOT_STARTED") {
    return {
      title: "Empezá a trabajar",
      hint: "Son 4 pasos cortos.",
      cta: "Empezar ahora",
      href: "/provider/onboarding",
    };
  }

  // Rama por estado real: la revisión pendiente no es alta incompleta.
  if (status !== null && status !== undefined) {
    switch (status) {
      case "PROFILE_INCOMPLETE":
        return {
          title: "Terminá tu alta",
          hint: "Te falta poco. Seguí donde ibas.",
          cta: "Seguir el paso a paso",
          href: "/provider/onboarding",
        };
      case "IDENTITY_PENDING":
      case "UNDER_REVIEW":
        return {
          title: "Tu identidad está en revisión",
          hint: "Te avisamos cuando se apruebe. Mientras tanto podés avanzar.",
          cta: "Crear servicios en borrador",
          href: "/provider/manage",
        };
      case "ACTIVE":
        break;
      case "REJECTED":
        return {
          title: "La revisión te pide un ajuste",
          hint: "Mirá el motivo y corregí lo observado.",
          cta: "Ver qué corregir",
          href: "/provider/onboarding/review",
        };
      case "SUSPENDED":
        return {
          title: "Tu perfil está en pausa",
          hint: "Por ahora no podés publicar ni ofertar.",
          cta: "Ver mi cuenta",
          href: "/account",
        };
      case "RESTRICTED":
        return {
          title: "Tenés una restricción parcial",
          hint: "Algunas funciones están limitadas.",
          cta: "Ver mi cuenta",
          href: "/account",
        };
      case "DEACTIVATED":
        return {
          title: "Tu perfil de proveedor está desactivado",
          hint: "Podés empezar el alta de nuevo cuando quieras.",
          cta: "Empezar de nuevo",
          href: "/provider/onboarding",
        };
      default:
        break;
    }
  }

  if (!providerActive && (status === null || status === undefined)) {
    return {
      title: "Terminá tu alta",
      hint: "Te falta poco. Seguí donde ibas.",
      cta: "Seguir el paso a paso",
      href: "/provider/onboarding",
    };
  }

  if (!providerActive) {
    // Estado desconocido con perfil no activo: no inventar pasos,
    // llevar al resumen de verificación que muestra el estado real.
    return {
      title: "Revisá el estado de tu alta",
      hint: "Mirá en qué paso vas.",
      cta: "Ver mi verificación",
      href: "/provider/onboarding",
    };
  }

  if (!hasServices) {
    return {
      title: "Publicá tu primer servicio",
      hint: "Decí qué hacés y cuánto sale.",
      cta: "Publicar servicio",
      href: "/provider/manage#servicios",
    };
  }

  if (paymentsEnabled && !paymentConnected) {
    return {
      title: "Conectá tu cobro",
      hint: "Sin esto no podés cobrar.",
      cta: "Conectar Mercado Pago",
      href: "/provider/manage#cobros",
    };
  }

  return {
    title: "Todo listo para trabajar",
    hint: "Te avisamos cuando te escriban.",
    cta: "Ver mis servicios",
    href: "/provider/manage#servicios",
  };
}

/** Próxima acción del cliente según tenga o no trabajos activos. */
export function getClientNextAction(args: {
  activeJobs: number;
  pendingPayment: boolean;
  paymentsEnabled?: boolean;
}): { title: string; hint: string; cta: string; href: string } {
  if (args.pendingPayment && args.paymentsEnabled) {
    return {
      title: "Tenés un pago pendiente",
      hint: "Tocá y pagá. Es un toque.",
      cta: "Ir a pagar",
      href: "/jobs",
    };
  }
  if (args.pendingPayment) {
    return {
      title: "Pago entre ustedes",
      hint: "Acuerdan directo entre ustedes.",
      cta: "Ver mis trabajos",
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
