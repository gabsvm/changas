import Link from "next/link";

import { decideIdentityAction } from "@/app/admin/actions";
import {
  getAdminIdentityCase,
  listAdminIdentityQueue,
} from "@/lib/admin/identity";

type SearchParams = { provider?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export default async function AdminIdentityPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const params = await searchParams;
  const providerId = first(params.provider);
  const queue = await listAdminIdentityQueue();
  const identityCase = providerId
    ? await getAdminIdentityCase(providerId)
    : null;
  const documents =
    identityCase && Array.isArray(identityCase.documents)
      ? (identityCase.documents as Array<Record<string, unknown>>)
      : [];
  const history =
    identityCase && Array.isArray(identityCase.review_history)
      ? (identityCase.review_history as Array<Record<string, unknown>>)
      : [];

  return (
    <section className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold">Revisión de identidad</h2>
        <p className="text-sm text-slate-600">
          Los documentos siguen privados; el panel sólo genera acceso temporal
          al archivo exacto.
        </p>
      </div>
      {identityCase ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap justify-between gap-2">
            <div>
              <p className="font-bold">
                {identityCase.display_name ??
                  identityCase.email ??
                  identityCase.provider_user_id}
              </p>
              <p className="text-xs text-slate-500">
                {identityCase.email ?? identityCase.provider_user_id}
              </p>
            </div>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">
              {identityCase.status}
            </span>
          </div>
          <div className="mt-4 grid gap-2 sm:grid-cols-2">
            {documents.map((document) => {
              const id = String(document.id ?? "");
              return (
                <a
                  className="rounded-xl border border-slate-200 px-3 py-3 text-sm font-semibold"
                  href={`/api/admin/identity-documents/${id}`}
                  key={id}
                  rel="noreferrer"
                  target="_blank"
                >
                  Abrir {String(document.document_type ?? "documento")}
                </a>
              );
            })}
          </div>
          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <form
              action={decideIdentityAction}
              className="rounded-xl border border-slate-200 p-3"
            >
              <input
                type="hidden"
                name="providerUserId"
                value={identityCase.provider_user_id}
              />
              <input type="hidden" name="decision" value="APPROVE" />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                name="reason"
                placeholder="Nota opcional"
              />
              <button className="mt-2 w-full rounded-lg bg-emerald-700 px-3 py-2 text-sm font-semibold text-white">
                Aprobar identidad
              </button>
            </form>
            <form
              action={decideIdentityAction}
              className="rounded-xl border border-slate-200 p-3"
            >
              <input
                type="hidden"
                name="providerUserId"
                value={identityCase.provider_user_id}
              />
              <input type="hidden" name="decision" value="REJECT" />
              <input
                className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm"
                name="reason"
                required
                minLength={2}
                placeholder="Motivo del rechazo"
              />
              <button className="mt-2 w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">
                Rechazar identidad
              </button>
            </form>
          </div>
          {history.length ? (
            <div className="mt-5">
              <p className="text-sm font-bold">Historial</p>
              <ul className="mt-2 space-y-2 text-sm text-slate-600">
                {history.map((item) => (
                  <li
                    className="rounded-lg bg-slate-50 p-2"
                    key={String(item.id ?? item.created_at)}
                  >
                    {String(item.decision ?? "DECISIÓN")} ·{" "}
                    {String(item.created_at ?? "")}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
        </article>
      ) : null}
      <div className="space-y-2">
        {queue.length ? (
          queue.map((row) => (
            <Link
              className="block rounded-xl border border-slate-200 bg-white p-4"
              href={`/admin/identity?provider=${row.provider_user_id}`}
              key={row.provider_user_id}
            >
              <div className="flex justify-between gap-3">
                <div>
                  <p className="font-semibold">
                    {row.display_name ?? row.email ?? row.provider_user_id}
                  </p>
                  <p className="text-xs text-slate-500">
                    {row.document_count} documentos
                  </p>
                </div>
                <span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">
                  {row.status}
                </span>
              </div>
            </Link>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            No hay casos pendientes.
          </p>
        )}
      </div>
    </section>
  );
}
