import "server-only";

import { createAdminClient } from "@/lib/supabase/admin";

import { buildSafePushMessage, buildTransactionalEmail } from "./templates";
import {
  createResendEmailProviderFromEnv,
  createWebPushProviderFromEnv,
} from "./providers";
import type { ClaimedDelivery, DeliveryResult } from "./types";

type DatabaseError = { message?: string | null } | null;
type RpcResponse = Promise<{ data: unknown; error: DatabaseError }>;
type DeleteResponse = Promise<{ error: DatabaseError }>;

type NotificationAdminClient = {
  rpc(name: string, args?: Record<string, unknown>): RpcResponse;
  from(table: string): {
    delete(): {
      eq(column: string, value: string): DeleteResponse;
    };
  };
};

type DeliveryClaimRow = {
  delivery_id: string;
  notification_id: string;
  recipient_user_id: string;
  channel: "PUSH" | "EMAIL";
  notification_kind: ClaimedDelivery["notificationKind"];
  title: string;
  body: string;
  action_url: string;
  source_event_type: string;
  endpoint: string | null;
  p256dh: string | null;
  auth_key: string | null;
  recipient_email: string | null;
  lease_token: string;
};

export type DispatchSummary = {
  materializedReminders: number;
  claimed: number;
  sent: number;
  retrying: number;
  failed: number;
};

function asClaimedDelivery(row: DeliveryClaimRow): ClaimedDelivery {
  return {
    deliveryId: row.delivery_id,
    notificationId: row.notification_id,
    channel: row.channel,
    recipientUserId: row.recipient_user_id,
    notificationKind: row.notification_kind,
    title: row.title,
    body: row.body,
    actionUrl: row.action_url,
    sourceEventType: row.source_event_type,
    endpoint: row.endpoint,
    p256dh: row.p256dh,
    authKey: row.auth_key,
    recipientEmail: row.recipient_email,
    leaseToken: row.lease_token,
  };
}

function permanentFailure(errorCode: string): DeliveryResult {
  return { ok: false, retryable: false, errorCode };
}

async function recordResult(
  admin: NotificationAdminClient,
  delivery: ClaimedDelivery,
  result: DeliveryResult,
): Promise<void> {
  const { data, error } = await admin.rpc(
    "record_notification_delivery_result",
    {
      target_delivery_id: delivery.deliveryId,
      target_lease_token: delivery.leaseToken,
      delivery_succeeded: result.ok,
      delivery_retryable: result.retryable,
      delivery_error_code: result.errorCode,
    },
  );

  if (error || data !== true) {
    throw new Error(
      error?.message ?? "Could not record notification delivery.",
    );
  }
}

async function removeStalePushEndpoint(
  admin: NotificationAdminClient,
  delivery: ClaimedDelivery,
  result: DeliveryResult,
): Promise<void> {
  if (
    delivery.channel !== "PUSH" ||
    !delivery.endpoint ||
    (result.errorCode !== "HTTP_404" && result.errorCode !== "HTTP_410")
  ) {
    return;
  }

  const { error } = await admin
    .from("push_subscriptions")
    .delete()
    .eq("endpoint", delivery.endpoint);

  if (error) {
    throw new Error(
      error.message ?? "Could not delete stale push subscription.",
    );
  }
}

export async function dispatchNotificationBatch({
  batchSize = 25,
}: {
  batchSize?: number;
} = {}): Promise<DispatchSummary> {
  const admin = createAdminClient() as unknown as NotificationAdminClient;
  const pushProvider = createWebPushProviderFromEnv();
  const emailProvider = createResendEmailProviderFromEnv();

  const reminderResult = await admin.rpc("materialize_due_job_reminders", {
    effective_now: new Date().toISOString(),
  });
  if (reminderResult.error) {
    throw new Error(
      reminderResult.error.message ?? "Could not materialize job reminders.",
    );
  }

  const claimResult = await admin.rpc("claim_notification_deliveries_v2", {
    requested_batch_size: Math.min(Math.max(batchSize, 1), 100),
    requested_lease_seconds: 120,
  });
  if (claimResult.error) {
    throw new Error(
      claimResult.error.message ?? "Could not claim notification deliveries.",
    );
  }

  const rows = Array.isArray(claimResult.data)
    ? (claimResult.data as DeliveryClaimRow[])
    : [];
  const summary: DispatchSummary = {
    materializedReminders: Number(reminderResult.data ?? 0),
    claimed: rows.length,
    sent: 0,
    retrying: 0,
    failed: 0,
  };

  for (const row of rows) {
    const delivery = asClaimedDelivery(row);
    let result: DeliveryResult;

    try {
      if (delivery.channel === "PUSH") {
        result = await pushProvider.send(buildSafePushMessage(delivery));
      } else {
        const email = buildTransactionalEmail(delivery);
        result = email
          ? await emailProvider.send(email)
          : permanentFailure("EMAIL_NOT_ALLOWED");
      }
    } catch {
      result = permanentFailure("DELIVERY_PAYLOAD_INVALID");
    }

    await removeStalePushEndpoint(admin, delivery, result);
    await recordResult(admin, delivery, result);

    if (result.ok) {
      summary.sent += 1;
    } else if (result.retryable) {
      summary.retrying += 1;
    } else {
      summary.failed += 1;
    }
  }

  return summary;
}
