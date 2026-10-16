import Link from "next/link";

import { isUuid } from "@changas/validation";

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
    selectedUserId && isUuid(selectedUserId)
      ? getAdminUserDetail(selectedUserId).catch(() => null)
      : Promise.resolve(null),
  ]);
  const invalidSelection = Boolean(selectedUserId) && !detail;

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Personas · Cuentas"
        title="Usuarios"
        description="Buscá una cuenta, revisá su rol y estado, habilitala como prestador o aplicá controles operativos sin salir del mismo flujo."
      />

      <form className="flex gap-2" method="get">
        <input
          className="border-ink/10 text-ink min-w-0 flex-1 border bg-white px-4 py-3 dark:border-white/10 dark:bg-white/10 dark:text-white"
          name="q"
          defaultValue={query}
          placeholder="Email o nombre"
          aria-label="Buscar usuario"
        />
        <button className="min-h-12 rounded-2xl bg-[#12D9C5] px-4 py-3 text-sm font-extrabold text-[#10131a]">
          Buscar
        </button>
      </form>

      {invalidSelection ? (
        <AdminPanel>
          <p className="text-ink text-sm font-bold">
            No pudimos cargar esa cuenta.
          </p>
          <p className="text-ink/70 mt-1 text-sm">
            Verificá el identificador o elegí una cuenta desde la lista.
          </p>
        </AdminPanel>
      ) : null}

      {detail ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.14em] uppercase">
                Cuenta seleccionada
              </p>
              <h2 className="font-display text-ink mt-1 truncate text-xl font-extrabold">
                {detail.display_name ?? detail.email ?? detail.user_id}
              </h2>
              <p className="text-ink/70 mt-1 truncate text-sm">
                {detail.email ?? "Sin email"}
              </p>
            </div>
            <div className="flex flex-wrap gap-2">
              <AdminStatusBadge
                label={detail.role === "admin" ? "Admin" : "Usuario"}
                tone={detail.role === "admin" ? "pink" : "neutral"}
              />
              <AdminStatusBadge
                label={providerLabel(detail.provider_status)}
                tone={providerTone(detail.provider_status)}
              />
            </div>
          </div>

          <dl className="border-ink/[0.08] bg-surface grid gap-3 rounded-2xl border p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-ink/60 text-xs font-bold">Nombre legal</dt>
              <dd className="text-ink mt-1 font-semibold">
                {detail.legal_name ?? "No cargado"}
              </dd>
            </div>
            <div>
              <dt className="text-ink/60 text-xs font-bold">
                Estado de prestador
              </dt>
              <dd className="text-ink mt-1 font-semibold">
                {providerLabel(detail.provider_status)}
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-3">
              <p className="text-ink text-sm font-extrabold">
                Habilitación como prestador
              </p>
              <p className="text-ink/70 mt-1 text-xs leading-5">
                El camino normal conserva onboarding y revisión. La activación
                manual es un bypass auditado.
              </p>
            </div>
            <AdminProviderControls
              userId={detail.user_id}
              providerStatus={detail.provider_status}
            />
          </div>

          <details className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
            <summary className="text-ink cursor-pointer text-sm font-extrabold">
              Restricciones de cuenta
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {(["RESTRICTED", "SUSPENDED"] as const).map((kind) => (
                <form
                  action={setAccountRestrictionAction}
                  className="border-ink/[0.08] bg-surface rounded-2xl border p-3"
                  key={kind}
                >
                  <input type="hidden" name="userId" value={detail.user_id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input
                    className="border-ink/10 text-ink w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="reason"
                    required
                    minLength={3}
                    placeholder={`Motivo ${kind === "SUSPENDED" ? "de suspensión" : "de restricción"}`}
                  />
                  <button
                    className={`mt-2 min-h-11 w-full rounded-xl px-3 py-2 text-sm font-extrabold ${kind === "SUSPENDED" ? "bg-[#ef5350] text-white" : "bg-[#ffc857] text-[#10131a]"}`}
                  >
                    {kind === "SUSPENDED" ? "Suspender" : "Restringir"}
                  </button>
                </form>
              ))}
              <form
                action={restoreAccountAction}
                className="border-ink/[0.08] bg-surface rounded-2xl border p-3"
              >
                <input type="hidden" name="userId" value={detail.user_id} />
                <input
                  className="border-ink/10 text-ink w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  placeholder="Motivo de restauración"
                />
                <button className="border-ink/[0.08] text-ink mt-2 min-h-11 w-full rounded-xl border px-3 py-2 text-sm font-extrabold">
                  Restaurar cuenta
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-ink text-base font-extrabold">
            Cuentas
          </h2>
          <span className="border-ink/[0.08] bg-surface text-ink/70 rounded-full border px-2.5 py-1 text-xs font-bold">
            {users.length}
          </span>
        </div>

        {users.length ? (
          <>
            <div
              className="grid gap-3 md:hidden"
              aria-label="Cuentas registradas"
            >
              {users.map((user) => (
                <Link
                  key={user.user_id}
                  href={
                    "/admin/users?q=" +
                    encodeURIComponent(query) +
                    "&user=" +
                    user.user_id
                  }
                  className="admin-mobile-record consumer-pressable consumer-card bg-surface flex flex-col gap-2 rounded-2xl p-4"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="text-ink min-w-0 font-extrabold">
                      {user.display_name ?? user.email ?? user.user_id}
                    </span>
                    <span className="shrink-0">
                      <AdminStatusBadge
                        label={providerLabel(user.provider_status)}
                        tone={providerTone(user.provider_status)}
                      />
                    </span>
                  </span>
                  <span className="text-ink/70 text-xs leading-5 break-all">
                    {user.email ?? user.user_id}
                  </span>
                  {user.role === "admin" ? (
                    <span className="text-xs font-extrabold text-[#12D9C5]">
                      ADMIN
                    </span>
                  ) : null}
                  <span className="text-xs font-semibold text-[#12D9C5]">
                    Ver cuenta y permisos →
                  </span>
                </Link>
              ))}
            </div>
            <div className="-mx-1 hidden overflow-x-auto px-1 md:block">
              <table className="w-full min-w-[640px] border-separate border-spacing-2">
                <caption className="sr-only">
                  Cuentas registradas ({users.length})
                </caption>
                <thead>
                  <tr>
                    <th
                      scope="col"
                      className="text-ink/70 px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] uppercase"
                    >
                      Cuenta
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
                  {users.map((user) => (
                    <tr
                      key={user.user_id}
                      className="border-ink/[0.08] bg-surface hover:bg-ink/[0.04] rounded-3xl border transition-colors hover:border-[#12D9C5]/30"
                    >
                      <th
                        scope="row"
                        className="min-w-0 rounded-l-3xl p-4 text-left"
                      >
                        <Link
                          className="text-ink block truncate text-sm font-extrabold hover:underline"
                          href={`/admin/users?q=${encodeURIComponent(query)}&user=${user.user_id}`}
                        >
                          {user.display_name ?? user.email ?? user.user_id}
                        </Link>
                        {user.role === "admin" ? (
                          <span className="text-terracotta text-[11px] font-extrabold">
                            ADMIN
                          </span>
                        ) : null}
                      </th>
                      <td className="text-ink/70 max-w-45 truncate p-4 text-xs">
                        {user.email ?? user.user_id}
                      </td>
                      <td className="rounded-r-3xl p-4 text-right">
                        <AdminStatusBadge
                          label={providerLabel(user.provider_status)}
                          tone={providerTone(user.provider_status)}
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
            title="No encontramos usuarios"
            description="Probá con otro nombre o email."
          />
        )}
      </div>
    </section>
  );
}
