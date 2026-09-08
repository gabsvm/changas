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
          className="min-w-0 flex-1 px-4 py-3"
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
              <p className="text-[0.65rem] font-extrabold tracking-[0.14em] text-[#697386] uppercase">
                Prestador seleccionado
              </p>
              <h2 className="mt-1 truncate text-xl font-extrabold text-white">
                {detail.display_name ?? detail.public_slug}
              </h2>
              <p className="mt-1 truncate text-sm text-[#98a2b3]">
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
                className="rounded-2xl border border-[#273142] bg-[#101720] p-3"
                key={label}
              >
                <p className="text-[0.65rem] font-bold text-[#697386]">{label}</p>
                <p className="mt-1 text-sm font-extrabold text-[#d0d5dd]">{value}</p>
              </div>
            ))}
          </div>

          <AdminProviderControls
            userId={detail.provider_user_id}
            providerStatus={detail.status}
          />

          <details className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
            <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
              Restricciones operativas
            </summary>
            <div className="mt-3 grid gap-3 sm:grid-cols-3">
              <form action={setAccountRestrictionAction}>
                <input type="hidden" name="userId" value={detail.provider_user_id} />
                <input type="hidden" name="kind" value="RESTRICTED" />
                <input
                  className="w-full px-3 py-2 text-sm"
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
                <input type="hidden" name="userId" value={detail.provider_user_id} />
                <input type="hidden" name="kind" value="SUSPENDED" />
                <input
                  className="w-full px-3 py-2 text-sm"
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
                <input type="hidden" name="userId" value={detail.provider_user_id} />
                <input
                  className="w-full px-3 py-2 text-sm"
                  name="reason"
                  placeholder="Motivo"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                  Restaurar
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Prestadores registrados</h2>
          <span className="rounded-full border border-[#273142] bg-[#151c27] px-2.5 py-1 text-xs font-bold text-[#8f99aa]">
            {providers.length}
          </span>
        </div>

        {providers.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {providers.map((provider) => (
              <Link
                className="flex min-h-24 items-center justify-between gap-3 rounded-[1.4rem] border border-[#273142] bg-[#151c27] p-4 transition-colors hover:border-[#3a4659] hover:bg-[#192230]"
                href={`/admin/providers?q=${encodeURIComponent(query)}&provider=${provider.provider_user_id}`}
                key={provider.provider_user_id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-white">
                    {provider.display_name ?? provider.public_slug}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#7f8a9b]">
                    {provider.email ?? provider.public_slug}
                  </p>
                  <p className="mt-2 text-[0.68rem] font-bold text-[#697386]">
                    Paso {provider.onboarding_step}/4 · {provider.document_count} docs
                  </p>
                </div>
                <AdminStatusBadge
                  label={statusLabel(provider.status)}
                  tone={providerTone(provider.status)}
                />
              </Link>
            ))}
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
