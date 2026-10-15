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
  { key: "payment", label: "Pago externo", hint: "Directo entre ustedes" },
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
  | "submit_delivery"
  | "verify_handover"
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
  // YALO S3: entrega desacoplada por modalidad. Defaults conservadores
  // (presencial sin constancia) para callers que aún no pasan el estado.
  modality?: "IN_PERSON" | "REMOTE" | "BOTH";
  deliverySubmitted?: boolean;
  handoverVerified?: boolean;
  /** While S3 DB is not installed, preserve the legacy PIN-based flow. */
  deliveryFlowAvailable?: boolean;
}): NextAction {
  const { status, isClient, isProvider, settlementPending } = args;
  const paymentsEnabled = args.paymentsEnabled ?? false;
  const modality = args.modality ?? "IN_PERSON";
  const deliverySubmitted = args.deliverySubmitted ?? false;
  const handoverVerified = args.handoverVerified ?? false;
  const needsHandover = modality !== "REMOTE";
  if (isProvider && status === "IN_PROGRESS" && args.deliveryFlowAvailable === false) {
    return {
      heading: "Solicitá el código de cierre al cliente",
      sub: "Por ahora la entrega se confirma con el código del cliente. El nuevo flujo de entregas aún no está habilitado.",
      kind: "verify_handover",
    };
  }
  if (args.deliveryFlowAvailable === true && modality === "BOTH" && status === "CONFIRMED") {
    return {
      heading: isClient ? "Elegí si el trabajo es presencial o remoto" : "Esperando elección de modalidad",
      sub: isClient
        ? "El prestador ofrece ambas. Elegí cómo se hará el trabajo antes de comenzar."
        : "El cliente debe elegir presencial o remoto para evitar un PIN incorrecto.",
      kind: null,
    };
  }
  if (isProvider && status === "CONFIRMED") {
    return {
      heading: "Iniciá el trabajo cuando llegues",
      sub: "El cliente ya ve que estás en camino cuando lo iniciás.",
      kind: "start",
    };
  }
  if (isProvider && status === "IN_PROGRESS" && !deliverySubmitted) {
    return {
      heading:
        modality === "REMOTE"
          ? "Enviá la entrega digital para revisión"
          : "Enviá la entrega para revisión",
      sub:
        modality === "REMOTE"
          ? "Resumí lo hecho: el cliente revisa sin ningún código."
          : "Contá qué hiciste: el cliente revisa antes de compartir el PIN.",
      kind: "submit_delivery",
    };
  }
  if (
    isProvider &&
    status === "IN_PROGRESS" &&
    deliverySubmitted &&
    needsHandover &&
    !handoverVerified
  ) {
    return {
      heading: "Dejá constancia con el PIN del cliente",
      sub: "El cliente lo comparte tras revisar tu entrega. No es la confirmación final.",
      kind: "verify_handover",
    };
  }
  if (isProvider && status === "IN_PROGRESS") {
    return {
      heading: "Entrega enviada, esperando revisión",
      sub: "El cliente está revisando tu entrega. Te avisamos de cada avance.",
      kind: null,
    };
  }
  if (isClient && status === "COMPLETION_REQUESTED") {
    return {
      heading: "Revisá y confirmá el trabajo",
      sub: "Si está todo bien, confirmalo para cerrar el trabajo.",
      kind: "confirm_completion",
    };
  }
  if (isClient && status === "COMPLETED" && settlementPending) {
    if (!paymentsEnabled) {
      return {
        heading: "Trabajo completado · pago entre ustedes",
        sub: "Acuerdan efectivo o transferencia directamente. Registrá lo pagado en «Pago entre ustedes».",
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
        heading: "Cierre confirmado · cobro entre ustedes",
        sub: "Acuerdan efectivo o transferencia directamente. Registrá lo recibido en «Pago entre ustedes».",
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
