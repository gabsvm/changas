export type ProviderPaymentStatus =
  "PENDING" | "SUCCEEDED" | "FAILED" | "REFUNDED";

export type PaymentProviderErrorCode =
  | "AUTH_REQUIRED"
  | "PROVIDER_UNAVAILABLE"
  | "RATE_LIMITED"
  | "INVALID_PROVIDER_STATE"
  | "PAYMENT_REJECTED"
  | "REFUND_REJECTED"
  | "RECONCILIATION_MISMATCH"
  | "INTERNAL_ERROR";

export type OAuthCredentials = {
  accessToken: string;
  refreshToken: string;
  expiresInSeconds: number;
  providerAccountReference: string;
  scope: string | null;
};

export type CheckoutBackUrls = {
  success: string;
  pending: string;
  failure: string;
};

export type CheckoutSessionInput = {
  accessToken: string;
  title: string;
  description?: string;
  amountMinor: number;
  currencyCode: "ARS";
  marketplaceFeeMinor: number;
  externalReference: string;
  notificationUrl: string;
  backUrls: CheckoutBackUrls;
  idempotencyKey: string;
};

export type CheckoutSessionResult = {
  providerCheckoutReference: string;
  checkoutUrl: string;
  sandboxCheckoutUrl: string | null;
};

export type AuthoritativeProviderPayment = {
  providerPaymentReference: string;
  status: ProviderPaymentStatus;
  rawStatus: string;
  statusDetail: string | null;
  amountMinor: number;
  refundedAmountMinor: number;
  currencyCode: string;
  providerAccountReference: string;
  externalReference: string | null;
  providerNetReceivedMinor: number | null;
};

export type ProviderRefundResult = {
  providerRefundReference: string;
  providerPaymentReference: string;
  amountMinor: number;
  rawStatus: string;
};

export type WebhookVerificationInput = {
  xSignature: string | null | undefined;
  xRequestId: string | null | undefined;
  dataId: string | null | undefined;
};
