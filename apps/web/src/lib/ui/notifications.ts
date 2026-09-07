const notificationKindLabels: Record<string, string> = {
  MESSAGE: "Mensajes",
  PROPOSAL: "Propuestas",
  PAYMENT: "Pagos",
  JOB: "Trabajos",
  REVIEW: "Reseñas",
  VERIFICATION: "Verificación",
  SECURITY: "Seguridad",
  MODERATION: "Moderación",
};

export function getNotificationKindLabel(kind: string): string {
  return notificationKindLabels[kind] ?? "Actividad";
}
