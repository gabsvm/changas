import Link from "next/link";

import {
  restoreAccountAction,
  setAccountRestrictionAction,
} from "@/app/admin/actions";
import { AdminProviderControls } from "@/components/admin/admin-provider-controls";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  providerTone,
} from "@/components/admin/admin-ui";
import { getAdminProviderDetail, listAdminProviders } from "@/lib/admin/server";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

type SearchParams = { q?: string | string[]; provider?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

function statusLabel(status: string) {
  return getProviderStatusPresentation(status).label;
}

export default async function AdminProvidersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q);
  const providerId = first(params.provider);
  const [providers, detail] = await Promise.all([
    listAdminProviders(query),
    providerId ? getAdminProviderDetail(providerId) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Marketplace"
        title="Prestadores"
        description="Estado de verificación, progreso de onboarding, documentos, servicios y controles operativos en una sola vista."
      />

      <form className="flex gap-2" method="get">
        <input
          className="min-w-0 flex-1 border border-ink/10 bg-white px-4 py-3 text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
          name="q"
          defaultValue={query}
          placeholder="Nombre, email o slug"
          aria-label="Buscar prestador"
        />
        <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
          Buscar
        </button>
      </form>

      {detail ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-ink/60 uppercase">
                Prestador seleccionado
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold text-ink">
                {detail.display_name ?? detail.public_slug}
              </h2>
              <p className="mt-1 truncate text-sm text-ink/70">
                {detail.email ?? "Sin email"}
              </p>
            </div>
            <AdminStatusBadge
              label={statusLabel(detail.status)}
              tone={providerTone(detail.status)}
            />
          </div>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            {[
              ["Paso onboarding", `${detail.onboarding_step}/4`],
              ["Documentos", String(detail.document_count)],
              ["Servicios", String(detail.service_count)],
              [
                "Marketplace",
                detail.marketplace_paused ? "Pausado" : "Disponible",
              ],
            ].map(([label, value]) => (
              <div
                className="rounded-2xl border border-ink/[0.08] bg-surface p-3"
                key={label}
              >
                <p className="text-[11px] font-bold text-ink/60">{label}</p>
                <p className="mt-1 text-sm font-extrabold text-ink">
                  {value}
                </p>
              </div>
            ))}
          </div>

          <AdminProviderControls
            userId={detail.provider_user_id}
            providerStatus={detail.status}
          />

          <details className="rounded-2xl border border-ink/[0.08] bg-surface p-3">
            <summary className="cursor-pointer text-sm font-extrabold text-ink">
              Restricciones operativas
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <form action={setAccountRestrictionAction}>
                <input
                  type="hidden"
                  name="userId"
                  value={detail.provider_user_id}
                />
                <input type="hidden" name="kind" value="RESTRICTED" />
                <input
                  className="w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  required
                  minLength={3}
                  placeholder="Motivo"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl bg-[#ffc857] px-3 py-2 text-sm font-extrabold text-[#10131a]">
                  Restringir
                </button>
              </form>
              <form action={setAccountRestrictionAction}>
                <input
                  type="hidden"
                  name="userId"
                  value={detail.provider_user_id}
                />
                <input type="hidden" name="kind" value="SUSPENDED" />
                <input
                  className="w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  required
                  minLength={3}
                  placeholder="Motivo"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl bg-[#ef5350] px-3 py-2 text-sm font-extrabold text-white">
                  Suspender
                </button>
              </form>
              <form action={restoreAccountAction}>
                <input
                  type="hidden"
                  name="userId"
                  value={detail.provider_user_id}
                />
                <input
                  className="w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  placeholder="Motivo"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl border border-ink/[0.08] px-3 py-2 text-sm font-extrabold text-ink">
                  Restaurar
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-extrabold text-ink">
            Prestadores registrados
          </h2>
          <span className="rounded-full border border-ink/[0.08] bg-surface px-2.5 py-1 text-xs font-bold text-ink/70">
            {providers.length}
          </span>
        </div>

        {providers.length ? (
          <div className="consumer-scrollbar-none -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-separate border-spacing-2">
            <caption className="sr-only">
              Prestadores registrados ({providers.length})
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Prestador
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Contacto
                </th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {providers.map((provider) => (
                <tr
                  key={provider.provider_user_id}
                  className="rounded-3xl border border-ink/[0.08] bg-surface transition-colors hover:border-brand-orange/30 hover:bg-ink/[0.04]"
                >
                  <th scope="row" className="min-w-0 rounded-l-3xl p-4 text-left">
                    <Link
                      className="block truncate text-sm font-extrabold text-ink hover:underline"
                      href={`/admin/providers?q=${encodeURIComponent(query)}&provider=${provider.provider_user_id}`}
                    >
                      {provider.display_name ?? provider.public_slug}
                    </Link>
                    <span className="mt-2 block text-[11px] font-bold text-ink/60">
                      Paso {provider.onboarding_step}/4 ·{" "}
                      {provider.document_count} docs
                    </span>
                  </th>
                  <td className="max-w-45 truncate p-4 text-xs text-ink/70">
                    {provider.email ?? provider.public_slug}
                  </td>
                  <td className="rounded-r-3xl p-4 text-right">
                    <AdminStatusBadge
                      label={statusLabel(provider.status)}
                      tone={providerTone(provider.status)}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <AdminEmptyState
            title="No hay prestadores"
            description="Las cuentas normales aparecen en Usuarios. Desde ahí podés invitarlas a iniciar onboarding o activarlas manualmente."
          />
        )}
      </div>
    </section>
  );
}
