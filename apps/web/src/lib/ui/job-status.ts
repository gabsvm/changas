export type JobStatusTone =
  | "neutral"
  | "info"
  | "success"
  | "warning"
  | "danger"
  | "brand";

export type JobStatusPresentation = {
  label: string;
  tone: JobStatusTone;
};

const jobStatusPresentations: Record<string, JobStatusPresentation> = {
  CONFIRMED: { label: "Confirmado", tone: "info" },
  IN_PROGRESS: { label: "En curso", tone: "brand" },
  COMPLETION_REQUESTED: { label: "Pendiente de cierre", tone: "warning" },
  COMPLETED: { label: "Completado", tone: "success" },
  CANCELLED: { label: "Cancelado", tone: "neutral" },
  DISPUTED: { label: "En disputa", tone: "danger" },
  REFUNDED: { label: "Reembolsado", tone: "neutral" },
  PARTIALLY_REFUNDED: { label: "Reembolso parcial", tone: "warning" },
  EXPIRED: { label: "Vencido", tone: "neutral" },
  NO_SHOW: { label: "No se presentó", tone: "danger" },
};

const fallbackPresentation: JobStatusPresentation = {
  label: "Estado del trabajo",
  tone: "neutral",
};

export function getJobStatusPresentation(status: string): JobStatusPresentation {
  return jobStatusPresentations[status] ?? fallbackPresentation;
}
