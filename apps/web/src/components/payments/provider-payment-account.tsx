import type { ProviderPaymentAccountState } from "@/lib/payments/server";

type ProviderPaymentAccountProps = {
  account: ProviderPaymentAccountState;
  feedback?: "connected" | "oauth_error" | null;
};

const statusLabel: Record<ProviderPaymentAccountState["status"], string> = {
  CONNECTED: "Conectada",
  REAUTH_REQUIRED: "Requiere reconexión",
  DISCONNECTED: "Sin conectar",
  SUSPENDED: "Suspendida",
};

export function ProviderPaymentAccount({
  account,
  feedback = null,
}: ProviderPaymentAccountProps) {
  const connected = account.status === "CONNECTED";
  const actionLabel = connected
    ? "Reconectar Mercado Pago"
    : "Conectar Mercado Pago";

  return (
    <section
      aria-labelledby="provider-payment-account-title"
      className="border-ink/10 rounded-2xl border bg-white/70 p-6 sm:p-7"
    >
      <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-2xl">
          <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
            Cobros
          </p>
          <h2
            id="provider-payment-account-title"
            className="font-display mt-2 text-3xl font-semibold tracking-[-0.03em]"
          >
            Mercado Pago
          </h2>
          <p className="text-ink/65 mt-3 text-sm leading-6">
            Vinculá tu cuenta para recibir pagos del marketplace. Changas nunca
            muestra ni entrega tus credenciales de Mercado Pago al navegador.
          </p>
        </div>
        <span className="bg-ink/5 text-ink/70 rounded-full px-3 py-2 text-xs font-semibold tracking-[0.1em] uppercase">
          {statusLabel[account.status]}
        </span>
      </div>

      {feedback === "connected" ? (
        <p className="bg-moss/10 text-moss mt-5 rounded-xl px-4 py-3 text-sm" role="status">
          Cuenta de Mercado Pago vinculada correctamente.
        </p>
      ) : null}
      {feedback === "oauth_error" ? (
        <p
          className="bg-terracotta/10 text-terracotta mt-5 rounded-xl px-4 py-3 text-sm"
          role="alert"
        >
          No pudimos completar la vinculación. Podés volver a intentarlo sin
          afectar trabajos ni pagos existentes.
        </p>
      ) : null}

      <dl className="mt-6 grid gap-4 text-sm sm:grid-cols-2">
        <div>
          <dt className="text-ink/50">Cuenta</dt>
          <dd className="text-ink mt-1 font-medium">
            {account.providerAccountReference ?? "Todavía no vinculada"}
          </dd>
        </div>
        <div>
          <dt className="text-ink/50">Autorización</dt>
          <dd className="text-ink mt-1 font-medium">
            {account.tokenExpiresAt
              ? new Intl.DateTimeFormat("es-AR", {
                  dateStyle: "medium",
                  timeStyle: "short",
                  timeZone: "America/Argentina/Buenos_Aires",
                }).format(new Date(account.tokenExpiresAt))
              : "Sin autorización activa"}
          </dd>
        </div>
      </dl>

      <a
        className="button-primary mt-6 inline-flex"
        href="/api/payments/mercado-pago/oauth/start"
      >
        {actionLabel}
      </a>
    </section>
  );
}
