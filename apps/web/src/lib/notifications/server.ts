import "server-only";

import { sanitizeNotificationActionUrl } from "./templates";
import type { NotificationKind } from "./types";

export type NotificationItem = {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  actionUrl: string;
  entityType: string | null;
  entityId: string | null;
  createdAt: string;
  readAt: string | null;
  unread: boolean;
};

export type NotificationPreferences = {
  pushActionableEnabled: boolean;
  emailImportantEnabled: boolean;
  jobRemindersEnabled: boolean;
  proposalAlertsEnabled: boolean;
  verificationAlertsEnabled: boolean;
  promotionalEnabled: boolean;
  updatedAt: string;
};

type RpcError = { message?: string | null } | null;
type RpcResponse = Promise<{ data: unknown; error: RpcError }>;
type NotificationRpcClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResponse;
};

type NotificationRow = {
  notification_id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  action_url: string | null;
  entity_type: string | null;
  entity_id: string | null;
  created_at: string;
  read_at: string | null;
};

type NotificationPreferenceRow = {
  push_actionable_enabled: boolean;
  email_important_enabled: boolean;
  job_reminders_enabled: boolean;
  proposal_alerts_enabled: boolean;
  verification_alerts_enabled: boolean;
  promotional_enabled: boolean;
  updated_at: string;
};

function asNotificationItem(row: NotificationRow): NotificationItem {
  return {
    id: row.notification_id,
    kind: row.kind,
    title: row.title,
    body: row.body,
    actionUrl: sanitizeNotificationActionUrl(
      row.action_url ?? "/account/notifications",
    ),
    entityType: row.entity_type,
    entityId: row.entity_id,
    createdAt: row.created_at,
    readAt: row.read_at,
    unread: row.read_at === null,
  };
}

function asPreferences(row: NotificationPreferenceRow): NotificationPreferences {
  return {
    pushActionableEnabled: row.push_actionable_enabled,
    emailImportantEnabled: row.email_important_enabled,
    jobRemindersEnabled: row.job_reminders_enabled,
    proposalAlertsEnabled: row.proposal_alerts_enabled,
    verificationAlertsEnabled: row.verification_alerts_enabled,
    promotionalEnabled: row.promotional_enabled,
    updatedAt: row.updated_at,
  };
}

function firstRow<T>(data: unknown): T | null {
  return Array.isArray(data) && data.length > 0 ? (data[0] as T) : null;
}

export async function listNotifications(
  client: NotificationRpcClient,
): Promise<NotificationItem[]> {
  const { data, error } = await client.rpc("list_my_notifications", {
    page_size: 30,
    before_created_at: null,
    before_id: null,
  });

  if (error) {
    throw new Error("No pudimos cargar tus notificaciones.");
  }

  return Array.isArray(data)
    ? (data as NotificationRow[]).map(asNotificationItem)
    : [];
}

export async function getUnreadNotificationCount(
  client: NotificationRpcClient,
): Promise<number> {
  const { data, error } = await client.rpc("get_my_notification_unread_count");

  if (error) {
    return 0;
  }

  const count = Number(data ?? 0);
  return Number.isFinite(count) && count > 0 ? Math.floor(count) : 0;
}

export async function getNotificationPreferences(
  client: NotificationRpcClient,
): Promise<NotificationPreferences> {
  const { data, error } = await client.rpc("get_my_notification_preferences");
  const row = firstRow<NotificationPreferenceRow>(data);

  if (error || !row) {
    throw new Error("No pudimos cargar tus preferencias de notificaciones.");
  }

  return asPreferences(row);
}

export async function updateNotificationPreferences(
  client: NotificationRpcClient,
  preferences: Omit<NotificationPreferences, "updatedAt">,
): Promise<NotificationPreferences> {
  const { data, error } = await client.rpc("update_my_notification_preferences", {
    requested_push_actionable_enabled: preferences.pushActionableEnabled,
    requested_email_important_enabled: preferences.emailImportantEnabled,
    requested_job_reminders_enabled: preferences.jobRemindersEnabled,
    requested_proposal_alerts_enabled: preferences.proposalAlertsEnabled,
    requested_verification_alerts_enabled: preferences.verificationAlertsEnabled,
    requested_promotional_enabled: preferences.promotionalEnabled,
  });
  const row = firstRow<NotificationPreferenceRow>(data);

  if (error || !row) {
    throw new Error("No pudimos guardar tus preferencias de notificaciones.");
  }

  return asPreferences(row);
}
