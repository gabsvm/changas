import Link from "next/link";

import {
  activateProviderAction,
  prepareProviderAction,
} from "@/app/admin/provider-actions";

export function AdminProviderControls({
  userId,
  providerStatus,
}: {
  userId: string;
  providerStatus: string | null;
}) {
  const pending =
    providerStatus === "IDENTITY_PENDING" || providerStatus === "UNDER_REVIEW";
  const blocked =
    providerStatus === "SUSPENDED" ||
    providerStatus === "RESTRICTED" ||
    providerStatus === "DEACTIVATED";
  const canManualActivate = providerStatus !== "ACTIVE" && !blocked;

  return (
    <div className="space-y-2">
      {providerStatus === null ? (
        <form action={prepareProviderAction}>
          <input type="hidden" name="userId" value={userId} />
          <button className="min-h-12 w-full rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a] shadow-[0_8px_22px_rgba(255,107,53,0.18)]">
            Invitar a completar perfil
          </button>
        </form>
      ) : null}

      {pending ? (
        <Link
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#ffc857]/35 bg-[#ffc857]/10 px-4 py-3 text-sm font-extrabold text-[#ffd878]"
          href={`/admin/identity?provider=${userId}`}
        >
          Revisar identidad pendiente
        </Link>
      ) : null}

      {providerStatus === "PROFILE_INCOMPLETE" ? (
        <Link
          className="flex min-h-12 w-full items-center justify-center rounded-2xl border border-[#4f7dff]/30 bg-[#2563eb]/10 px-4 py-3 text-sm font-extrabold text-[#7ea2ff]"
          href={`/admin/providers?provider=${userId}`}
        >
          Ver progreso de prestador
        </Link>
      ) : null}

      {canManualActivate ? (
        <details className="rounded-2xl border border-[#d60060]/25 bg-[#d60060]/8 p-3">
          <summary className="cursor-pointer text-sm font-extrabold text-[#ff79ad]">
            Activar manualmente
          </summary>
          <p className="mt-2 text-xs leading-5 text-[#a7b0bf]">
            Omite onboarding y verificación de identidad. Usalo sólo para casos
            de confianza; la acción queda registrada en Auditoría.
          </p>
          <form action={activateProviderAction} className="mt-3 space-y-2">
            <input type="hidden" name="userId" value={userId} />
            <label className="block text-[0.68rem] font-bold text-[#8f99aa]">
              Motivo obligatorio
              <textarea
                className="mt-1 w-full px-3 py-2 text-sm"
                name="reason"
                required
                minLength={3}
                maxLength={1000}
                placeholder="Ej: socio fundador verificado presencialmente"
              />
            </label>
            <button className="min-h-12 w-full rounded-2xl bg-[#d60060] px-4 py-3 text-sm font-extrabold text-white">
              Confirmar activación manual
            </button>
          </form>
        </details>
      ) : null}

      {blocked ? (
        <p className="rounded-2xl border border-[#ef5350]/25 bg-[#ef5350]/8 px-3 py-2 text-xs leading-5 text-[#ff7774]">
          Esta cuenta tiene una restricción operativa. Restaurala primero con los
          controles de cuenta antes de activarla como prestador.
        </p>
      ) : null}
    </div>
  );
}
