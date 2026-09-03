import "server-only";

import {
  buildResendRequest,
  buildVapidAuthorization,
  classifyDeliveryHttpStatus,
} from "./delivery";
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

export class WebPushProvider implements PushProvider {
  readonly available: boolean;

  constructor(
    private readonly config: {
      publicKey?: string;
      privateKey?: string;
      subject?: string;
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
      return retryableProviderError("PUSH_PROVIDER_UNCONFIGURED");
    }

    try {
      const response = await fetch(message.endpoint, {
        method: "POST",
        headers: {
          Authorization: buildVapidAuthorization({
            endpoint: message.endpoint,
            publicKey: this.config.publicKey,
            privateKey: this.config.privateKey,
            subject: this.config.subject,
          }),
          TTL: "300",
        },
      });

      return classifyDeliveryHttpStatus(response.status);
    } catch {
      return retryableProviderError("PUSH_NETWORK_ERROR");
    }
  }
}

export class ResendEmailProvider implements EmailProvider {
  readonly available: boolean;

  constructor(
    private readonly config: {
      apiKey?: string;
      from?: string;
      origin?: string;
    },
  ) {
    this.available = Boolean(config.apiKey && config.from && config.origin);
  }

  async send(message: TransactionalEmail): Promise<DeliveryResult> {
    if (!this.config.apiKey || !this.config.from || !this.config.origin) {
      return retryableProviderError("EMAIL_PROVIDER_UNCONFIGURED");
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
    publicKey: process.env.VAPID_PUBLIC_KEY ?? process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY,
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
