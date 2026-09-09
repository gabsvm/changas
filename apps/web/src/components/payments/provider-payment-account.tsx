import { StatusChip } from "@/components/ui/marketplace/status-chip";
import type { ProviderPaymentAccountState } from "@/lib/payments/server";

type ProviderPaymentAccountProps = {
  account: ProviderPaymentAccountState;
  feedback?: "connected" | "oauth_error" | null;
};

const statusPresentation: Record<
  ProviderPaymentAccountState["status"],
  {
    label: string;
    tone: "neutral" | "success" | "warning" | "danger";
  }
> = {
  CONNECTED: { label: "Conectada", tone: "success" },
  REAUTH_REQUIRED: { label: "Requiere reconexión", tone: "warning" },
  DISCONNECTED: { label: "Sin conectar", tone: "neutral" },
  SUSPENDED: { label: "Suspendida", tone: "danger" },
};

export function ProviderPaymentAccount({
  account,
  feedback = null,
}: ProviderPaymentAccountProps) {
  const connected = account.status === "CONNECTED";
  const actionLabel = connected
    ? "Reconectar Mercado Pago"
    : "Conectar Mercado Pago";
  const status = statusPresentation[account.status];

  return (
    <section aria-labelledby="provider-payment-account-title">
      <div className="flex items-start justify-between gap-4">
        <div className="min-w-0">
          <p className="text-terracotta text-[0.68rem] font-extrabold tracking-[0.14em] uppercase">
            Cobros
          </p>
          <h2
            id="provider-payment-account-title"
            className="mt-1 text-xl font-bold tracking-[-0.02em]"
          >
            Mercado Pago
          </h2>
          <p className="text-ink/55 mt-1 max-w-2xl text-sm leading-6">
            Vinculá tu cuenta para recibir pagos del marketplace. Tus
            credenciales nunca se exponen al navegador.
          </p>
        </div>
        <StatusChip tone={status.tone}>{status.label}</StatusChip>
      </div>

      {feedback === "connected" ? (
        <p
          className="bg-success/[0.07] text-success mt-3 rounded-xl px-3 py-2.5 text-sm"
          role="status"
        >
          Cuenta de Mercado Pago vinculada correctamente.
        </p>
      ) : null}
      {feedback === "oauth_error" ? (
        <p
          className="bg-danger/[0.07] text-danger mt-3 rounded-xl px-3 py-2.5 text-sm"
          role="alert"
        >
          No pudimos completar la vinculación. Podés volver a intentarlo sin
          afectar trabajos ni pagos existentes.
        </p>
      ) : null}

      <dl className="border-ink/10 mt-4 divide-y divide-ink/10 border-y text-sm">
        <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
          <dt className="text-ink/50">Cuenta</dt>
          <dd className="min-w-0 truncate text-right font-semibold">
            {account.providerAccountReference ?? "Todavía no vinculada"}
          </dd>
        </div>
        <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
          <dt className="text-ink/50">Autorización</dt>
          <dd className="text-right font-semibold">
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
        className="button-primary mt-4 inline-flex w-full sm:w-auto"
        href="/api/payments/mercado-pago/oauth/start"
      >
        {actionLabel}
      </a>
    </section>
  );
}
