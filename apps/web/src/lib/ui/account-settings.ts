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
        description:
          "Te avisamos cuando recibís una propuesta, contraoferta o respuesta en tus charlas.",
      },
      {
        name: "jobRemindersEnabled",
        title: "Recordatorios de trabajos",
        description:
          "Te recordamos tus trabajos de mañana y los que están por vencer.",
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
        description:
          "Recibís por mail cada cambio de estado de tus trabajos, pagos y tu cuenta.",
      },
      {
        name: "verificationAlertsEnabled",
        title: "Verificación",
        description:
          "Te avisamos cuando tu identidad o tu perfil de proveedor cambia de estado.",
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
        description:
          "Consejos y novedades de Changas, solo si querés recibirlos.",
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
