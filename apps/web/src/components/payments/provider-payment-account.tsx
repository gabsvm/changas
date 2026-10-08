import { IllustratedBadge } from "@/components/ui/marketplace/illustrated-badge";
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
        <div className="flex min-w-0 items-start gap-3">
          <IllustratedBadge tone="blue" icon="wallet" size="md" label="Mercado Pago" />
          <div className="min-w-0">
            <p className="text-terracotta text-[11px] font-extrabold tracking-[0.14em] uppercase">
              Cobros
            </p>
            <h2
              id="provider-payment-account-title"
              className="mt-1 text-xl font-bold tracking-[-0.02em]"
            >
              Mercado Pago
            </h2>
            <p className="text-ink/70 mt-1.5 max-w-2xl text-sm leading-6">
              Vinculá tu cuenta para recibir pagos del marketplace. Tus
              credenciales nunca se exponen al navegador.
            </p>
          </div>
        </div>
        <span className="shrink-0 whitespace-nowrap">
          <StatusChip tone={status.tone}>{status.label}</StatusChip>
        </span>
      </div>

      <div className="consumer-card bg-surface border-ink/[0.08] mt-4 overflow-hidden rounded-2xl border shadow-[0_1px_2px_rgb(23_20_15/6%),0_8px_20px_-6px_rgb(23_20_15/12%)] dark:shadow-[0_8px_20px_-6px_rgb(0_0_0/60%)]">
        <div
          className="relative h-14 overflow-hidden"
          style={{
            backgroundImage:
              "linear-gradient(135deg, #4F8DFF 0%, #2F4BFE 100%)",
          }}
          aria-hidden="true"
        >
          <span
            className="absolute inset-0 opacity-25"
            style={{
              backgroundImage:
                "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
              backgroundSize: "10px 10px",
            }}
          />
          <span className="absolute -right-4 -bottom-6 h-16 w-16 rounded-full bg-white/20" />
        </div>
        <div className="px-4 pb-4">
        {feedback === "connected" ? (
          <p
            className="bg-success/[0.07] text-success -mx-4 px-4 py-2.5 text-sm font-semibold"
            role="status"
          >
            Cuenta de Mercado Pago vinculada correctamente.
          </p>
        ) : null}
        {feedback === "oauth_error" ? (
          <p
            className="bg-danger/[0.07] text-danger -mx-4 px-4 py-2.5 text-sm font-semibold"
            role="alert"
          >
            No pudimos completar la vinculación. Podés volver a intentarlo sin
            afectar trabajos ni pagos existentes.
          </p>
        ) : null}

        <dl className="divide-ink/[0.07] divide-y text-sm">
          <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
            <dt className="text-ink/70">Cuenta</dt>
            <dd className="min-w-0 truncate text-right font-semibold">
              {account.providerAccountReference ?? "Todavía no vinculada"}
            </dd>
          </div>
          <div className="flex min-h-12 items-center justify-between gap-4 py-2.5">
            <dt className="text-ink/70">Autorización</dt>
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
          className="button-primary mt-2 inline-flex w-full sm:w-auto"
          href="/api/payments/mercado-pago/oauth/start"
        >
          {actionLabel}
        </a>
        </div>
      </div>
    </section>
  );
}
