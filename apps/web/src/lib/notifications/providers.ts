import "server-only";

import { sendNotification } from "web-push";

import { buildResendRequest, classifyDeliveryHttpStatus } from "./delivery";
import type {
  DeliveryResult,
  EmailProvider,
  PushProvider,
  SafePushMessage,
  TransactionalEmail,
} from "./types";

function retryableProviderError(errorCode: string): DeliveryResult {
  return { ok: false, retryable: true, errorCode };
}

function nonRetryableProviderError(errorCode: string): DeliveryResult {
  return { ok: false, retryable: false, errorCode };
}

export class WebPushProvider implements PushProvider {
  readonly available: boolean;

  constructor(
    private readonly config: {
      publicKey: string | undefined;
      privateKey: string | undefined;
      subject: string | undefined;
    },
  ) {
    this.available = Boolean(
      config.publicKey && config.privateKey && config.subject,
    );
  }

  async send(message: SafePushMessage): Promise<DeliveryResult> {
    if (
      !this.config.publicKey ||
      !this.config.privateKey ||
      !this.config.subject
    ) {
      return nonRetryableProviderError("PUSH_PROVIDER_UNCONFIGURED");
    }

    try {
      await sendNotification(
        {
          endpoint: message.endpoint,
          keys: { p256dh: message.p256dh, auth: message.authKey },
        },
        JSON.stringify({
          title: message.title,
          body: message.body,
          actionUrl: message.actionUrl,
        }),
        {
          vapidDetails: {
            subject: this.config.subject,
            publicKey: this.config.publicKey,
            privateKey: this.config.privateKey,
          },
          TTL: 300,
        },
      );

      return { ok: true, retryable: false, errorCode: null };
    } catch (error) {
      if (
        error !== null &&
        typeof error === "object" &&
        "statusCode" in error &&
        typeof error.statusCode === "number"
      ) {
        // Los 410/404 de WebPushError caen en HTTP_410/HTTP_404 no-retryable y
        // el dispatcher purga el endpoint como hacía con el fetch manual.
        return classifyDeliveryHttpStatus(error.statusCode);
      }

      return retryableProviderError("PUSH_NETWORK_ERROR");
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly available: boolean;

  constructor(
    private readonly config: {
      apiKey: string | undefined;
      from: string | undefined;
      origin: string | undefined;
    },
  ) {
    this.available = Boolean(config.apiKey && config.from && config.origin);
  }

  async send(message: TransactionalEmail): Promise<DeliveryResult> {
    if (!this.config.apiKey || !this.config.from || !this.config.origin) {
      return nonRetryableProviderError("EMAIL_PROVIDER_UNCONFIGURED");
    }

    const request = buildResendRequest({
      apiKey: this.config.apiKey,
      from: this.config.from,
      origin: this.config.origin,
      email: message,
    });

    try {
      const response = await fetch(request.url, request.init);
      return classifyDeliveryHttpStatus(response.status);
    } catch {
      return retryableProviderError("EMAIL_NETWORK_ERROR");
    }
  }
}

export function createWebPushProviderFromEnv(): WebPushProvider {
  return new WebPushProvider({
    publicKey:
      process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
    privateKey: process.env.VAPID_PRIVATE_KEY,
    subject: process.env.VAPID_SUBJECT,
  });
}

export function createResendEmailProviderFromEnv(): ResendEmailProvider {
  return new ResendEmailProvider({
    apiKey: process.env.RESEND_API_KEY,
    from: process.env.RESEND_FROM_EMAIL,
    origin: process.env.NEXT_PUBLIC_SITE_URL,
  });
}
