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
          className="min-w-0 flex-1 border border-ink/10 bg-white px-4 py-3 text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
          name="q"
          defaultValue={query}
          placeholder="Email o nombre"
          aria-label="Buscar usuario"
        />
        <button className="min-h-12 rounded-2xl bg-[#ff6b35] px-4 py-3 text-sm font-extrabold text-[#10131a]">
          Buscar
        </button>
      </form>

      {invalidSelection ? (
        <AdminPanel>
          <p className="text-sm font-bold text-ink">
            No pudimos cargar esa cuenta.
          </p>
          <p className="mt-1 text-sm text-ink/70">
            Verificá el identificador o elegí una cuenta desde la lista.
          </p>
        </AdminPanel>
      ) : null}

      {detail ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-ink/60 uppercase">
                Cuenta seleccionada
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold text-ink">
                {detail.display_name ?? detail.email ?? detail.user_id}
              </h2>
              <p className="mt-1 truncate text-sm text-ink/70">
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

          <dl className="grid gap-3 rounded-2xl border border-ink/[0.08] bg-surface p-4 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-xs font-bold text-ink/60">Nombre legal</dt>
              <dd className="mt-1 font-semibold text-ink">
                {detail.legal_name ?? "No cargado"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-bold text-ink/60">
                Estado de prestador
              </dt>
              <dd className="mt-1 font-semibold text-ink">
                {providerLabel(detail.provider_status)}
              </dd>
            </div>
          </dl>

          <div>
            <div className="mb-3">
              <p className="text-sm font-extrabold text-ink">
                Habilitación como prestador
              </p>
              <p className="mt-1 text-xs leading-5 text-ink/70">
                El camino normal conserva onboarding y revisión. La activación
                manual es un bypass auditado.
              </p>
            </div>
            <AdminProviderControls
              userId={detail.user_id}
              providerStatus={detail.provider_status}
            />
          </div>

          <details className="rounded-2xl border border-ink/[0.08] bg-surface p-3">
            <summary className="cursor-pointer text-sm font-extrabold text-ink">
              Restricciones de cuenta
            </summary>
            <div className="mt-3 grid gap-3 lg:grid-cols-3">
              {(["RESTRICTED", "SUSPENDED"] as const).map((kind) => (
                <form
                  action={setAccountRestrictionAction}
                  className="rounded-2xl border border-ink/[0.08] bg-surface p-3"
                  key={kind}
                >
                  <input type="hidden" name="userId" value={detail.user_id} />
                  <input type="hidden" name="kind" value={kind} />
                  <input
                    className="w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
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
                className="rounded-2xl border border-ink/[0.08] bg-surface p-3"
              >
                <input type="hidden" name="userId" value={detail.user_id} />
                <input
                  className="w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                  name="reason"
                  placeholder="Motivo de restauración"
                />
                <button className="mt-2 min-h-11 w-full rounded-xl border border-ink/[0.08] px-3 py-2 text-sm font-extrabold text-ink">
                  Restaurar cuenta
                </button>
              </form>
            </div>
          </details>
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-extrabold text-ink">Cuentas</h2>
          <span className="rounded-full border border-ink/[0.08] bg-surface px-2.5 py-1 text-xs font-bold text-ink/70">
            {users.length}
          </span>
        </div>

        {users.length ? (
          <div className="consumer-scrollbar-none -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-separate border-spacing-2">
            <caption className="sr-only">
              Cuentas registradas ({users.length})
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Cuenta
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
              {users.map((user) => (
                <tr
                  key={user.user_id}
                  className="rounded-3xl border border-ink/[0.08] bg-surface transition-colors hover:border-brand-orange/30 hover:bg-ink/[0.04]"
                >
                  <th scope="row" className="min-w-0 rounded-l-3xl p-4 text-left">
                    <Link
                      className="block truncate text-sm font-extrabold text-ink hover:underline"
                      href={`/admin/users?q=${encodeURIComponent(query)}&user=${user.user_id}`}
                    >
                      {user.display_name ?? user.email ?? user.user_id}
                    </Link>
                    {user.role === "admin" ? (
                      <span className="text-[11px] font-extrabold text-terracotta">
                        ADMIN
                      </span>
                    ) : null}
                  </th>
                  <td className="max-w-45 truncate p-4 text-xs text-ink/70">
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
