import Link from "next/link";

import { restoreAccountAction, setAccountRestrictionAction } from "@/app/admin/actions";
import { getAdminProviderDetail, listAdminProviders } from "@/lib/admin/server";

type SearchParams = { q?: string | string[]; provider?: string | string[] };
const first = (value: string | string[] | undefined) => Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

export default async function AdminProvidersPage({ searchParams }: { searchParams: Promise<SearchParams> }) {
  const params = await searchParams;
  const query = first(params.q);
  const providerId = first(params.provider);
  const [providers, detail] = await Promise.all([
    listAdminProviders(query),
    providerId ? getAdminProviderDetail(providerId) : Promise.resolve(null),
  ]);

  return (
    <section className="space-y-6">
      <div><h2 className="text-2xl font-bold">Prestadores</h2><p className="text-sm text-slate-600">Estado, catálogo, documentos y controles operativos.</p></div>
      <form className="flex gap-2" method="get">
        <input className="min-w-0 flex-1 rounded-xl border border-slate-300 bg-white px-3 py-2" name="q" defaultValue={query} placeholder="Nombre, email o slug" />
        <button className="rounded-xl bg-slate-950 px-4 py-2 text-sm font-semibold text-white">Buscar</button>
      </form>
      {detail ? (
        <article className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-2"><h3 className="text-lg font-bold">{detail.display_name ?? detail.public_slug}</h3><span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-bold">{detail.status}</span></div>
          <p className="mt-2 text-sm text-slate-600">{detail.email ?? "Sin email"} · {detail.service_count} servicios · {detail.document_count} documentos</p>
          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <form action={setAccountRestrictionAction}><input type="hidden" name="userId" value={detail.provider_user_id} /><input type="hidden" name="kind" value="RESTRICTED" /><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" required minLength={3} placeholder="Motivo" /><button className="mt-2 w-full rounded-lg bg-amber-600 px-3 py-2 text-sm font-semibold text-white">Restringir</button></form>
            <form action={setAccountRestrictionAction}><input type="hidden" name="userId" value={detail.provider_user_id} /><input type="hidden" name="kind" value="SUSPENDED" /><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" required minLength={3} placeholder="Motivo" /><button className="mt-2 w-full rounded-lg bg-red-700 px-3 py-2 text-sm font-semibold text-white">Suspender</button></form>
            <form action={restoreAccountAction}><input type="hidden" name="userId" value={detail.provider_user_id} /><input className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm" name="reason" placeholder="Motivo" /><button className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Restaurar</button></form>
          </div>
        </article>
      ) : null}
      <div className="space-y-2">{providers.map((provider) => <Link className="block rounded-xl border border-slate-200 bg-white p-4" href={`/admin/providers?q=${encodeURIComponent(query)}&provider=${provider.provider_user_id}`} key={provider.provider_user_id}><div className="flex justify-between gap-3"><div className="min-w-0"><p className="truncate font-semibold">{provider.display_name ?? provider.public_slug}</p><p className="truncate text-xs text-slate-500">{provider.email ?? provider.public_slug}</p></div><span className="rounded-full bg-slate-100 px-2 py-1 text-xs font-bold">{provider.status}</span></div></Link>)}</div>
    </section>
  );
}
