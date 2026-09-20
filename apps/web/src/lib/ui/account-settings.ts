import type { NotificationPreferences } from "@/lib/notifications/server";

export type PreferenceToggleName = keyof Pick<
  NotificationPreferences,
  | "emailImportantEnabled"
  | "jobRemindersEnabled"
  | "proposalAlertsEnabled"
  | "verificationAlertsEnabled"
  | "promotionalEnabled"
>;

export type PreferenceToggleConfig = {
  name: PreferenceToggleName;
  title: string;
  description: string;
};

export type PreferenceGroupConfig = {
  id: string;
  title: string;
  toggles: PreferenceToggleConfig[];
};

export const NOTIFICATION_PREFERENCE_GROUPS: PreferenceGroupConfig[] = [
  {
    id: "activity",
    title: "Actividad de trabajos",
    toggles: [
      {
        name: "proposalAlertsEnabled",
        title: "Propuestas",
        description: "Cuando una propuesta requiere tu atención.",
      },
      {
        name: "jobRemindersEnabled",
        title: "Recordatorios de trabajos",
        description: "Avisos para trabajos programados próximos.",
      },
    ],
  },
  {
    id: "account",
    title: "Cuenta",
    toggles: [
      {
        name: "emailImportantEnabled",
        title: "Correos importantes",
        description: "Cambios de trabajos, pagos y cuenta.",
      },
      {
        name: "verificationAlertsEnabled",
        title: "Verificación",
        description: "Cambios relevantes de cuenta o perfil.",
      },
    ],
  },
  {
    id: "updates",
    title: "Novedades",
    toggles: [
      {
        name: "promotionalEnabled",
        title: "Promociones",
        description: "Novedades comerciales opcionales.",
      },
    ],
  },
];

export type PushMessageKind =
  | "enabled"
  | "disabled"
  | "permission-denied"
  | "not-configured"
  | "invalid-subscription"
  | "save-failed"
  | "disable-failed";

export type PushMessageTone = "success" | "error";

export function resolvePushMessageTone(kind: PushMessageKind): PushMessageTone {
  return kind === "enabled" || kind === "disabled" ? "success" : "error";
}
