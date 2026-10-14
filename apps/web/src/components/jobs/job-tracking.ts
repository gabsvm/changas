import type { JobStatus } from "@changas/domain";

export type TrackingStepKey =
  "confirmed" | "in_progress" | "review" | "payment" | "rating";

export type TrackingStepState = "done" | "current" | "todo";

export type TrackingStep = {
  key: TrackingStepKey;
  label: string;
  hint: string;
  state: TrackingStepState;
};

export type TrackingExceptionKind =
  "disputed" | "cancelled" | "no_show" | "expired" | "refunded";

export type TrackingException = {
  kind: TrackingExceptionKind;
  title: string;
  description: string;
};

export type JobTracking = {
  steps: TrackingStep[];
  currentIndex: number;
  exception: TrackingException | null;
};

const STEP_DEFS: { key: TrackingStepKey; label: string; hint: string }[] = [
  { key: "confirmed", label: "Confirmado", hint: "Acuerdo cerrado" },
  { key: "in_progress", label: "En curso", hint: "Se está haciendo" },
  { key: "review", label: "Revisión", hint: "Confirmá el resultado" },
  { key: "payment", label: "Pago", hint: "Pagás al finalizar" },
  { key: "rating", label: "Reseña", hint: "Contá cómo te fue" },
];

function buildSteps(currentIndex: number): TrackingStep[] {
  return STEP_DEFS.map((def, index) => ({
    ...def,
    state:
      index < currentIndex
        ? "done"
        : index === currentIndex
          ? "current"
          : "todo",
  }));
}

const EXCEPTIONS: Record<
  TrackingExceptionKind,
  Omit<TrackingException, "kind">
> = {
  disputed: {
    title: "En revisión por el equipo",
    description:
      "Reportaste un problema y lo estamos viendo con ambas partes. No tenés que hacer nada más por ahora.",
  },
  cancelled: {
    title: "Servicio cancelado",
    description: "Este servicio se canceló. No tenés pagos pendientes por él.",
  },
  no_show: {
    title: "Ausencia registrada",
    description:
      "Se registró una ausencia. Si creés que es un error, escribinos desde el chat.",
  },
  expired: {
    title: "Servicio vencido",
    description:
      "Este servicio venció sin ejecutarse. Podés volver a contratar cuando quieras.",
  },
  refunded: {
    title: "Pago devuelto",
    description:
      "El pago de este servicio fue devuelto. No tenés que hacer nada más.",
  },
};

export function getJobTracking(
  status: JobStatus,
  settlementStatus: string | null,
): JobTracking {
  switch (status) {
    case "CONFIRMED":
      return { steps: buildSteps(0), currentIndex: 0, exception: null };
    case "IN_PROGRESS":
      return { steps: buildSteps(1), currentIndex: 1, exception: null };
    case "COMPLETION_REQUESTED":
      return { steps: buildSteps(2), currentIndex: 2, exception: null };
    case "COMPLETED": {
      const paymentPending = settlementStatus === "DUE";
      const index = paymentPending ? 3 : 4;
      return { steps: buildSteps(index), currentIndex: index, exception: null };
    }
    case "DISPUTED":
      return {
        steps: buildSteps(2),
        currentIndex: 2,
        exception: { kind: "disputed", ...EXCEPTIONS.disputed },
      };
    case "CANCELLED":
      return {
        steps: buildSteps(0).map((s) => ({ ...s, state: "todo" as const })),
        currentIndex: -1,
        exception: { kind: "cancelled", ...EXCEPTIONS.cancelled },
      };
    case "NO_SHOW":
      return {
        steps: buildSteps(0).map((s) => ({ ...s, state: "todo" as const })),
        currentIndex: -1,
        exception: { kind: "no_show", ...EXCEPTIONS.no_show },
      };
    case "EXPIRED":
      return {
        steps: buildSteps(0).map((s) => ({ ...s, state: "todo" as const })),
        currentIndex: -1,
        exception: { kind: "expired", ...EXCEPTIONS.expired },
      };
    case "REFUNDED":
    case "PARTIALLY_REFUNDED":
      return {
        steps: buildSteps(4),
        currentIndex: 4,
        exception: { kind: "refunded", ...EXCEPTIONS.refunded },
      };
    default:
      return { steps: buildSteps(0), currentIndex: 0, exception: null };
  }
}

export type NextActionKind =
  | "start"
  | "request_completion"
  | "confirm_completion"
  | "pay"
  | "review"
  | null;

export type NextAction = {
  heading: string;
  sub: string;
  kind: NextActionKind;
};

/**
 * Una sola "próxima acción" por rol y estado. Si el otro lado tiene la
 * pelota, devuelve kind null con un texto de espera: la tarjeta muestra
 * qué pasa ahora en vez de un botón que no corresponde.
 */
export function getJobNextAction(args: {
  status: JobStatus;
  isClient: boolean;
  isProvider: boolean;
  settlementPending: boolean;
  // YALO A3: con el cobro online apagado no se promete ni se pide pagar.
  // Default false = copia honesta; los callers server pasan el flag real.
  paymentsEnabled?: boolean;
}): NextAction {
  const { status, isClient, isProvider, settlementPending } = args;
  const paymentsEnabled = args.paymentsEnabled ?? false;
  if (isProvider && status === "CONFIRMED") {
    return {
      heading: "Iniciá el trabajo cuando llegues",
      sub: "El cliente ya ve que estás en camino cuando lo iniciás.",
      kind: "start",
    };
  }
  if (isProvider && status === "IN_PROGRESS") {
    return {
      heading: "Pedí la revisión con el código del cliente",
      sub: "Ingresá los 4 dígitos que ve el cliente en su Seguimiento.",
      kind: "request_completion",
    };
  }
  if (isClient && status === "COMPLETION_REQUESTED") {
    return {
      heading: "Revisá y confirmá el trabajo",
      sub: "Si está todo bien, confirmalo para habilitar el pago.",
      kind: "confirm_completion",
    };
  }
  if (isClient && status === "COMPLETED" && settlementPending) {
    if (!paymentsEnabled) {
      return {
        heading: "Trabajo completado · pago pendiente de habilitación",
        sub: "El cobro online aún no está disponible. Te avisamos cuando se habilite; tu saldo queda registrado.",
        kind: null,
      };
    }
    return {
      heading: "Pagá el trabajo",
      sub: "Un solo pago por todo: base + adicionales aprobados.",
      kind: "pay",
    };
  }
  if (isProvider && status === "COMPLETED" && settlementPending) {
    if (!paymentsEnabled) {
      return {
        heading: "Cierre confirmado · cobro pendiente de habilitación",
        sub: "El cobro online aún no está disponible. El saldo queda registrado hasta la habilitación.",
        kind: null,
      };
    }
  }
  if (status === "COMPLETED" && !settlementPending) {
    return {
      heading: isClient
        ? "Contá cómo te fue"
        : "Esperando la reseña del cliente",
      sub: isClient
        ? "Tu reseña ayuda a la próxima persona que contrate."
        : "Te avisamos cuando el cliente deje su reseña.",
      kind: isClient ? "review" : null,
    };
  }
  if (isClient && (status === "CONFIRMED" || status === "IN_PROGRESS")) {
    return {
      heading:
        status === "CONFIRMED" ? "Trabajo confirmado" : "Trabajo en curso",
      sub: "El prestador se encarga del siguiente paso. Te avisamos de cada avance.",
      kind: null,
    };
  }
  if (isProvider && status === "COMPLETION_REQUESTED") {
    return {
      heading: "Esperando la revisión del cliente",
      sub: "Ya pediste la finalización. Te avisamos cuando el cliente confirme.",
      kind: null,
    };
  }
  if (status === "DISPUTED") {
    return {
      heading: "Caso en revisión",
      sub: "Estamos viendo lo reportado con ambas partes.",
      kind: null,
    };
  }
  return {
    heading: "Seguimiento del servicio",
    sub: "Acá ves el estado y qué sigue, paso por paso.",
    kind: null,
  };
}
