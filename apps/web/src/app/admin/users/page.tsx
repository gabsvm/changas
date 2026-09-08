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
import { getAdminUserDetail, listAdminUsers } from "@/lib/admin/server";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

type SearchParams = { q?: string | string[]; user?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

function providerLabel(status: string | null) {
  return status ? getProviderStatusPresentation(status).label : "Solo cliente";
}

export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const query = first(params.q);
  const selectedUserId = first(params.user);
  const [users, detail] = await Promise.all([
    listAdminUsers(query),
    selectedUserId ? getAdminUserDetail(selectedUserId) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Cuentas"
        title="Usuarios"
        description="Buscá una cuenta, revisá su rol y estado, habilitala como prestador o aplicá controles operativos sin salir del mismo flujo."
      />

      <form className="flex gap-2" method="get">
        <input
          className="min-w-0 flex-1 px-4 py-3"
          name="q"
          defaultValue={query}
          placeholder="Email o nombre"
          aria-label="Buscar usuario"
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
                Cuenta seleccionada
              </p>
              <h2 className="mt-1 truncate text-xl font-extrabold text-white">
                {detail.display_name ?? detail.email ?? detail.user_id}
              </h2>
              <p className="mt-1 truncate text-sm text-[#98a2b3]">
                {detail.email ?? "Sin email"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge label={detail.role === "admin" ? "Admin" : "Usuario"} tone={detail.role === "admin" ? "pink" : "neutral"} />
              <AdminStatusBadge
                label={providerLabel(detail.provider_status)}
                tone={providerTone(detail.provider_status)}
              />
            </div>
          </div>

          <dl className="grid gap-3 rounded-2xl border border-[#273142] bg-[#101720] p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-[#697386]">Nombre legal</dt>
              <dd className="mt-1 font-semibold text-[#d0d5dd]">
                {detail.legal_name ?? "No cargado"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-[#697386]">Estado de prestador</dt>
              <dd className="mt-1 font-semibold text-[#d0d5dd]">
                {providerLabel(detail.provider_status)}
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-3">
              <p className="text-sm font-extrabold text-white">Habilitación como prestador</p>
              <p className="mt-1 text-xs leading-5 text-[#7f8a9b]">
                El camino normal conserva onboarding y revisión. La activación manual es un bypass auditado.
              </p>
            </div>
            <AdminProviderControls
              userId={detail.user_id}
              providerStatus={detail.provider_status}
            />
          </div>

          <details className="rounded-2xl border border-[#273142] bg-[#101720] p-3">
            <summary className="cursor-pointer text-sm font-extrabold text-[#d0d5dd]">
              Restricciones de cuenta
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {(["RESTRICTED", "SUSPENDED"] as const).map((kind) => (
                <form
                  action={setAccountRestrictionAction}
                  className="rounded-2xl border border-[#273142] bg-[#0d131d] p-3"
                  key={kind}
                >
                  <input type="hidden" name="userId" value={detail.user_id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input
                    className="w-full px-3 py-2 text-sm"
                    name="reason"
                    required
                    minLength={3}
                    placeholder={`Motivo ${kind === "SUSPENDED" ? "de suspensión" : "de restricción"}`}
                  />
                  <button className={`mt-2 min-h-11 w-full rounded-xl px-3 py-2 text-sm font-extrabold ${kind === "SUSPENDED" ? "bg-[#ef5350] text-white" : "bg-[#ffc857] text-[#10131a]"}`}>
                    {kind === "SUSPENDED" ? "Suspender" : "Restringir"}
                  </button>
                </form>
              ))}
              <form
                action={restoreAccountAction}
                className="rounded-2xl border border-[#273142] bg-[#0d131d] p-3"
              >
                <input type="hidden" name="userId" value={detail.user_id} />
                <input
                  className="w-full px-3 py-2 text-sm"
                  name="reason"
                  placeholder="Motivo de restauración"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl border border-[#3a4659] px-3 py-2 text-sm font-extrabold text-[#d0d5dd]">
                  Restaurar cuenta
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-base font-extrabold text-white">Cuentas</h2>
          <span className="rounded-full border border-[#273142] bg-[#151c27] px-2.5 py-1 text-xs font-bold text-[#8f99aa]">
            {users.length}
          </span>
        </div>

        {users.length ? (
          <div className="grid gap-2 md:grid-cols-2">
            {users.map((user) => (
              <Link
                className="group flex min-h-20 items-center justify-between gap-3 rounded-[1.4rem] border border-[#273142] bg-[#151c27] p-4 transition-colors hover:border-[#3a4659] hover:bg-[#192230]"
                href={`/admin/users?q=${encodeURIComponent(query)}&user=${user.user_id}`}
                key={user.user_id}
              >
                <div className="min-w-0">
                  <p className="truncate text-sm font-extrabold text-white">
                    {user.display_name ?? user.email ?? user.user_id}
                  </p>
                  <p className="mt-1 truncate text-xs text-[#7f8a9b]">
                    {user.email ?? user.user_id}
                  </p>
                </div>
                <div className="flex shrink-0 flex-col items-end gap-1.5">
                  {user.role === "admin" ? (
                    <span className="text-[0.62rem] font-extrabold text-[#ff79ad]">ADMIN</span>
                  ) : null}
                  <AdminStatusBadge
                    label={providerLabel(user.provider_status)}
                    tone={providerTone(user.provider_status)}
                  />
                </div>
              </Link>
            ))}
          </div>
        ) : (
          <AdminEmptyState
            title="No encontramos usuarios"
            description="Probá con otro nombre o email."
          />
        )}
      </div>
    </section>
  );
}
