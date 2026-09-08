const JOB_STATUS_LABELS: Record<string, string> = {
  CONFIRMED: "Confirmado",
  IN_PROGRESS: "En curso",
  COMPLETION_REQUESTED: "Esperando confirmación",
  COMPLETED: "Completado",
  CANCELLED: "Cancelado",
  DISPUTED: "En disputa",
  REFUNDED: "Reintegrado",
  PARTIALLY_REFUNDED: "Reintegro parcial",
  EXPIRED: "Vencido",
  NO_SHOW: "Ausencia reportada",
};

export function getJobStatusLabel(status: string): string {
  return (
    JOB_STATUS_LABELS[status] ??
    status
      .toLowerCase()
      .replaceAll("_", " ")
      .replace(/^./u, (character) => character.toUpperCase())
  );
}
