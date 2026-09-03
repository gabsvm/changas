export type NotificationKind =
  | "MESSAGE"
  | "PROPOSAL"
  | "PAYMENT"
  | "JOB"
  | "REVIEW"
  | "VERIFICATION"
  | "SECURITY"
  | "MODERATION";

export type DeliveryChannel = "PUSH" | "EMAIL";

export type ClaimedDelivery = {
  deliveryId: string;
  notificationId: string;
  channel: DeliveryChannel;
  recipientUserId: string;
  notificationKind: NotificationKind;
  title: string;
  body: string;
  actionUrl: string;
  sourceEventType: string;
  endpoint: string | null;
  p256dh: string | null;
  authKey: string | null;
  recipientEmail: string | null;
  leaseToken: string;
};

export type SafePushMessage = {
  deliveryId: string;
  endpoint: string;
  p256dh: string;
  authKey: string;
  title: string;
  body: string;
  actionUrl: string;
};

export type TransactionalEmail = {
  deliveryId: string;
  to: string;
  subject: string;
  text: string;
  html: string;
  actionUrl: string;
};

export type DeliveryResult = {
  ok: boolean;
  retryable: boolean;
  errorCode: string | null;
};

export type PushProvider = {
  readonly available: boolean;
  send(message: SafePushMessage): Promise<DeliveryResult>;
};

export type EmailProvider = {
  readonly available: boolean;
  send(message: TransactionalEmail): Promise<DeliveryResult>;
};
