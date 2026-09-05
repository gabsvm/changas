import { beforeEach, describe, expect, it, vi } from "vitest";

const { buildMercadoPagoOAuthRedirect, completeMercadoPagoOAuthCallback } =
  vi.hoisted(() => ({
    buildMercadoPagoOAuthRedirect: vi.fn(),
    completeMercadoPagoOAuthCallback: vi.fn(),
  }));

vi.mock("@/lib/payments/server", () => ({
  buildMercadoPagoOAuthRedirect,
  completeMercadoPagoOAuthCallback,
}));

import { GET as startOAuth } from "./start/route";
import { GET as completeOAuth } from "./callback/route";

describe("Phase 11 Mercado Pago OAuth routes", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("redirects the seller to the server-generated Mercado Pago authorization URL", async () => {
    buildMercadoPagoOAuthRedirect.mockResolvedValue(
      "https://auth.mercadopago.com.ar/authorization?client_id=phase11-client-id&response_type=code&platform_id=mp&state=signed-state&redirect_uri=https%3A%2F%2Fchangas.test%2Fapi%2Fpayments%2Fmercado-pago%2Foauth%2Fcallback",
    );

    const response = await startOAuth(
      new Request("https://changas.test/api/payments/mercado-pago/oauth/start"),
    );

    expect(response.status).toBe(302);
    expect(response.headers.get("location")).toContain(
      "https://auth.mercadopago.com.ar/authorization?",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("passes only code/state into the callback server contract and returns to the signed local path", async () => {
    completeMercadoPagoOAuthCallback.mockResolvedValue({
      returnPath: "/provider/manage",
      account: {
        providerName: "MERCADO_PAGO",
        providerAccountReference: "123456",
        status: "CONNECTED",
      },
    });

    const response = await completeOAuth(
      new Request(
        "https://changas.test/api/payments/mercado-pago/oauth/callback?code=authorization-code-1&state=signed-state&status=approved&payment_id=attacker-controlled",
      ),
    );

    expect(completeMercadoPagoOAuthCallback).toHaveBeenCalledWith({
      code: "authorization-code-1",
      state: "signed-state",
    });
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://changas.test/provider/manage?payment_account=connected",
    );
    expect(response.headers.get("cache-control")).toBe("private, no-store");
  });

  it("does not call the payment server when code or state is missing", async () => {
    const response = await completeOAuth(
      new Request(
        "https://changas.test/api/payments/mercado-pago/oauth/callback?status=approved&payment_id=attacker-controlled",
      ),
    );

    expect(completeMercadoPagoOAuthCallback).not.toHaveBeenCalled();
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://changas.test/provider/manage?payment_account=oauth_error",
    );
  });

  it("fails closed to the provider management screen without exposing OAuth errors", async () => {
    completeMercadoPagoOAuthCallback.mockRejectedValue(
      new Error("sensitive provider error"),
    );

    const response = await completeOAuth(
      new Request(
        "https://changas.test/api/payments/mercado-pago/oauth/callback?code=authorization-code-1&state=invalid-state",
      ),
    );

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe(
      "https://changas.test/provider/manage?payment_account=oauth_error",
    );
    expect(await response.text()).not.toContain("sensitive provider error");
  });
});
