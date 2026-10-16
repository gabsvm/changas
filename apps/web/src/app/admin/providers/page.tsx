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
        eyebrow="Personas · Prestadores"
        title="Prestadores"
        description="Estado de verificación, progreso de onboarding, documentos, servicios y controles operativos en una sola vista."
      />

      <form className="flex gap-2" method="get">
        <input
          className="border-ink/10 text-ink min-w-0 flex-1 border bg-white px-4 py-3 dark:border-white/10 dark:bg-white/10 dark:text-white"
          name="q"
          defaultValue={query}
          placeholder="Nombre, email o slug"
          aria-label="Buscar prestador"
        />
        <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
          Buscar
        </button>
      </form>

      {detail ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.14em] uppercase">
                Prestador seleccionado
              </p>
              <h2 className="font-display text-ink mt-1 truncate text-xl font-extrabold">
                {detail.display_name ?? detail.public_slug}
              </h2>
              <p className="text-ink/70 mt-1 truncate text-sm">
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
                className="border-ink/[0.08] bg-surface rounded-2xl border p-3"
                key={label}
              >
                <p className="text-ink/60 text-[11px] font-bold">{label}</p>
                <p className="text-ink mt-1 text-sm font-extrabold">{value}</p>
              </div>
            ))}
          </div>

          <AdminProviderControls
            userId={detail.provider_user_id}
            providerStatus={detail.status}
          />

          <details className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
            <summary className="text-ink cursor-pointer text-sm font-extrabold">
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
                  className="border-ink/10 text-ink w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
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
                  className="border-ink/10 text-ink w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
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
                  className="border-ink/10 text-ink w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  placeholder="Motivo"
                />
                <button className="border-ink/[0.08] text-ink mt-2 min-h-11 w-full rounded-xl border px-3 py-2 text-sm font-extrabold">
                  Restaurar
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-extrabold">
            Prestadores registrados
          </h2>
          <span className="border-ink/[0.08] bg-surface text-ink/70 rounded-full border px-2.5 py-1 text-xs font-bold">
            {providers.length}
          </span>
        </div>

        {providers.length ? (
          <>
            <div
              className="grid gap-3 md:hidden"
              aria-label="Prestadores registrados"
            >
              {providers.map((provider) => (
                <Link
                  key={provider.provider_user_id}
                  href={
                    "/admin/providers?q=" +
                    encodeURIComponent(query) +
                    "&provider=" +
                    provider.provider_user_id
                  }
                  className="admin-mobile-record consumer-pressable consumer-card bg-surface flex flex-col gap-2 rounded-2xl p-4"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-ink min-w-0 font-extrabold">
                      {provider.display_name ?? provider.public_slug}
                    </span>
                    <span className="shrink-0">
                      <AdminStatusBadge
                        label={statusLabel(provider.status)}
                        tone={providerTone(provider.status)}
                      />
                    </span>
                  </span>
                  <span className="text-ink/70 text-xs leading-5 break-all">
                    {provider.email ?? provider.public_slug}
                  </span>
                  <span className="text-ink/70 text-xs">
                    Paso {provider.onboarding_step}/4 ·{" "}
                    {provider.document_count} documentos
                  </span>
                  <span className="text-xs font-semibold text-[#12D9C5]">
                    Ver prestador y controles →
                  </span>
                </Link>
              ))}
            </div>
            <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
              <table className="w-full min-w-[640px] border-separate border-spacing-2">
                <caption className="sr-only">
                  Prestadores registrados ({providers.length})
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="text-ink/70 px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] uppercase"
                    >
                      Prestador
                    </th>
                    <th
                      scope="col"
                      className="text-ink/70 px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] uppercase"
                    >
                      Contacto
                    </th>
                    <th
                      scope="col"
                      className="text-ink/70 px-4 py-2 text-right text-xs font-extrabold tracking-[0.08em] uppercase"
                    >
                      Estado
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {providers.map((provider) => (
                    <tr
                      key={provider.provider_user_id}
                      className="border-ink/[0.08] bg-surface hover:bg-ink/[0.04] rounded-3xl border transition-colors hover:border-[#12D9C5]/30"
                    >
                      <th
                        scope="row"
                        className="min-w-0 rounded-l-3xl p-4 text-left"
                      >
                        <Link
                          className="text-ink block truncate text-sm font-extrabold hover:underline"
                          href={`/admin/providers?q=${encodeURIComponent(query)}&provider=${provider.provider_user_id}`}
                        >
                          {provider.display_name ?? provider.public_slug}
                        </Link>
                        <span className="text-ink/60 mt-2 block text-[11px] font-bold">
                          Paso {provider.onboarding_step}/4 ·{" "}
                          {provider.document_count} docs
                        </span>
                      </th>
                      <td className="text-ink/70 max-w-45 truncate p-4 text-xs">
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
          </>
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
