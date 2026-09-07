export type ProviderStatusTone = "neutral" | "warning" | "success" | "danger";

export type ProviderStatusPresentation = {
  label: string;
  description: string;
  tone: ProviderStatusTone;
};

const providerStatusPresentations: Record<string, ProviderStatusPresentation> =
  {
    NOT_STARTED: {
      label: "Sin comenzar",
      description: "Todavía no empezaste la verificación como proveedor.",
      tone: "neutral",
    },
    PROFILE_INCOMPLETE: {
      label: "Perfil incompleto",
      description: "Completá tus datos para continuar con la verificación.",
      tone: "warning",
    },
    IDENTITY_PENDING: {
      label: "En revisión",
      description: "Tu identidad está pendiente de revisión.",
      tone: "warning",
    },
    UNDER_REVIEW: {
      label: "En revisión",
      description: "Estamos revisando la información que enviaste.",
      tone: "warning",
    },
    ACTIVE: {
      label: "Activo",
      description: "Tu perfil de proveedor está habilitado.",
      tone: "success",
    },
    REJECTED: {
      label: "Requiere atención",
      description: "La revisión necesita una corrección antes de continuar.",
      tone: "danger",
    },
    SUSPENDED: {
      label: "Suspendido",
      description: "Tu perfil de proveedor está suspendido temporalmente.",
      tone: "danger",
    },
    RESTRICTED: {
      label: "Restringido",
      description: "Algunas funciones de proveedor están restringidas.",
      tone: "danger",
    },
    DEACTIVATED: {
      label: "Desactivado",
      description: "Tu perfil de proveedor está desactivado.",
      tone: "neutral",
    },
  };

const fallbackPresentation: ProviderStatusPresentation = {
  label: "Estado de cuenta",
  description: "Revisá el estado de tu cuenta para conocer los próximos pasos.",
  tone: "neutral",
};

export function getProviderStatusPresentation(
  status: string,
): ProviderStatusPresentation {
  return providerStatusPresentations[status] ?? fallbackPresentation;
}
