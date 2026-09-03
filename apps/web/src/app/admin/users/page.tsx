import Link from "next/link";

import {
  restoreAccountAction,
  setAccountRestrictionAction,
} from "@/app/admin/actions";
import { getAdminUserDetail, listAdminUsers } from "@/lib/admin/server";

type SearchParams = { q?: string | string[]; user?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

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
      <div>
        <h2 className="text-2xl font-bold">Usuarios</h2>
        <p className="text-sm text-slate-600">
          Búsqueda acotada y detalle privado sólo para administradores.
        </p>
      </div>
      <form className="flex gap-2" method="get">
        <input
          className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2"
          name="q"
          defaultValue={query}
          placeholder="Email o nombre"
        />
        <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">
          Buscar
        </button>
      </form>
      {detail ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-xs font-semibold tracking-wide text-slate-500 uppercase">
            Detalle
          </p>
          <h3 className="mt-1 text-lg font-bold">
            {detail.display_name ?? detail.email ?? detail.user_id}
          </h3>
          <dl className="mt-3 grid gap-2 text-sm sm:grid-cols-2">
            <div>
              <dt className="text-slate-500">Email</dt>
              <dd>{detail.email ?? "—"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Rol</dt>
              <dd>{detail.role}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Estado prestador</dt>
              <dd>{detail.provider_status ?? "No aplica"}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Nombre legal</dt>
              <dd>{detail.legal_name ?? "—"}</dd>
            </div>
          </dl>
          <div className="mt-4 grid gap-3 lg:grid-cols-3">
            {(["RESTRICTED", "SUSPENDED"] as const).map((kind) => (
              <form
                action={setAccountRestrictionAction}
                className="rounded-xl border border-slate-200 p-3"
                key={kind}
              >
                <input type="hidden" name="userId" value={detail.user_id} />
                <input type="hidden" name="kind" value={kind} />
                <input
                  className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                  name="reason"
                  required
                  minLength={3}
                  placeholder={`Motivo ${kind.toLowerCase()}`}
                />
                <button className="mt-2 w-full rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">
                  {kind === "SUSPENDED" ? "Suspender" : "Restringir"}
                </button>
              </form>
            ))}
            <form
              action={restoreAccountAction}
              className="rounded-xl border border-slate-200 p-3"
            >
              <input type="hidden" name="userId" value={detail.user_id} />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                name="reason"
                placeholder="Motivo de restauración"
              />
              <button className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">
                Restaurar cuenta
              </button>
            </form>
          </div>
        </article>
      ) : null}
      <div className="space-y-2">
        {users.map((user) => (
          <Link
            className="block rounded-xl border border-slate-200 bg-white p-4"
            href={`/admin/users?q=${encodeURIComponent(query)}&user=${user.user_id}`}
            key={user.user_id}
          >
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <p className="truncate font-semibold">
                  {user.display_name ?? user.email ?? user.user_id}
                </p>
                <p className="truncate text-xs text-slate-500">
                  {user.email ?? user.user_id}
                </p>
              </div>
              <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-semibold">
                {user.provider_status ?? user.role}
              </span>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
