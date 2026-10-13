import Link from "next/link";

import { decideIdentityAction } from "@/app/admin/actions";
import {
  AdminEmptyState,
  AdminPageHeader,
  AdminPanel,
  AdminStatusBadge,
  providerTone,
} from "@/components/admin/admin-ui";
import { IdentityDocumentPreview } from "@/components/admin/identity-document-preview";
import {
  getAdminIdentityCase,
  listAdminIdentityQueue,
} from "@/lib/admin/identity";
import { getDocumentTypeLabel } from "@/lib/ui/documents";
import { getProviderStatusPresentation } from "@/lib/ui/provider-status";

type SearchParams = { provider?: string | string[] };
const first = (value: string | string[] | undefined) =>
  Array.isArray(value) ? (value[0] ?? "") : (value ?? "");

function dateTime(value: unknown) {
  if (typeof value !== "string" || !value) return "—";
  return new Intl.DateTimeFormat("es-AR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(new Date(value));
}

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
  const previewDocuments = documents.flatMap((document) => {
    const id = typeof document.id === "string" ? document.id : "";
    if (!id) return [];
    return [
      {
        id,
        documentType: getDocumentTypeLabel(
          String(document.document_type ?? ""),
        ),
        mimeType:
          typeof document.mime_type === "string"
            ? document.mime_type
            : "application/octet-stream",
      },
    ];
  });
  const history =
    identityCase && Array.isArray(identityCase.review_history)
      ? (identityCase.review_history as Array<Record<string, unknown>>)
      : [];
  const canDecide =
    identityCase?.status === "IDENTITY_PENDING" ||
    identityCase?.status === "UNDER_REVIEW";

  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Personas · Verificación"
        title="Revisión de identidad"
        description="Sólo aparecen en la cola los prestadores que realmente enviaron su identidad. Los archivos siguen privados y cada apertura genera acceso temporal al documento exacto."
        action={
          <div className="rounded-2xl border border-brand-yellow/30 bg-brand-yellow/15 px-4 py-3 text-center">
            <p className="text-2xl font-extrabold text-warning">
              {queue.length}
            </p>
            <p className="text-[11px] font-extrabold tracking-[0.08em] text-ink/60 uppercase">
              pendientes
            </p>
          </div>
        }
      />

      {identityCase ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-[11px] font-extrabold tracking-[0.14em] text-ink/60 uppercase">
                Caso seleccionado
              </p>
              <h2 className="mt-1 truncate font-display text-xl font-extrabold text-ink">
                {identityCase.display_name ??
                  identityCase.email ??
                  identityCase.provider_user_id}
              </h2>
              <p className="mt-1 truncate text-sm text-ink/70">
                {identityCase.email ?? identityCase.provider_user_id}
              </p>
            </div>
            <AdminStatusBadge
              label={getProviderStatusPresentation(identityCase.status).label}
              tone={providerTone(identityCase.status)}
            />
          </div>

          <div className="rounded-2xl border border-ink/[0.08] bg-surface p-4">
            <p className="text-xs font-bold text-ink/60">
              Identidad declarada
            </p>
            <p className="mt-1 text-sm font-extrabold text-ink">
              {identityCase.legal_name ?? "Sin nombre legal"}
            </p>
            <p className="mt-1 text-xs text-ink/70">
              DNI y fecha de nacimiento se consultan sólo dentro de este
              contexto administrativo.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-sm font-extrabold text-ink">
                Evidencia privada
              </h3>
              <span className="text-xs font-bold text-ink/60">
                {documents.length} archivos
              </span>
            </div>
            {documents.length ? (
              <IdentityDocumentPreview documents={previewDocuments} />
            ) : (
              <AdminEmptyState
                title="Este caso no tiene evidencia registrada"
                description="No se puede tomar una decisión de identidad desde esta pantalla sin un envío pendiente real."
              />
            )}
          </div>

          {canDecide ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <form
                action={decideIdentityAction}
                className="rounded-2xl border border-success/25 bg-success/10 p-3"
              >
                <input
                  type="hidden"
                  name="providerUserId"
                  value={identityCase.provider_user_id}
                />
                <input type="hidden" name="decision" value="APPROVE" />
                <label className="text-xs font-bold text-ink/70">
                  Nota opcional
                  <input
                    className="mt-1 w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="reason"
                    placeholder="Ej: documentación coincidente"
                  />
                </label>
                <button className="mt-2 min-h-12 w-full rounded-2xl bg-[#43c982] px-4 py-3 text-sm font-extrabold text-[#0b1018]">
                  Aprobar identidad
                </button>
              </form>
              <form
                action={decideIdentityAction}
                className="rounded-2xl border border-danger/25 bg-danger/10 p-3"
              >
                <input
                  type="hidden"
                  name="providerUserId"
                  value={identityCase.provider_user_id}
                />
                <input type="hidden" name="decision" value="REJECT" />
                <label className="text-xs font-bold text-ink/70">
                  Motivo obligatorio
                  <input
                    className="mt-1 w-full border border-ink/10 bg-white px-3 py-2 text-sm text-ink dark:border-white/10 dark:bg-white/10 dark:text-white"
                    name="reason"
                    required
                    minLength={2}
                    placeholder="Indicá qué debe corregir"
                  />
                </label>
                <button className="mt-2 min-h-12 w-full rounded-2xl bg-[#ef5350] px-4 py-3 text-sm font-extrabold text-white">
                  Rechazar identidad
                </button>
              </form>
            </div>
          ) : (
            <div className="rounded-2xl border border-ink/[0.08] bg-surface p-4">
              <p className="text-sm font-extrabold text-ink">
                Caso sin decisión pendiente
              </p>
              <p className="mt-1 text-xs leading-5 text-ink/70">
                Los controles de decisión quedan bloqueados una vez resuelto el
                caso. El historial permanece disponible abajo para trazabilidad.
              </p>
              {identityCase.status === "ACTIVE" ? (
                <button
                  aria-label="Aprobar identidad"
                  className="mt-3 min-h-12 w-full rounded-2xl border border-success/25 bg-success/10 px-4 py-3 text-sm font-extrabold text-success"
                  disabled
                  type="button"
                >
                  ✓ Identidad aprobada
                </button>
              ) : identityCase.status === "REJECTED" ? (
                <button
                  aria-label="Rechazar identidad"
                  className="mt-3 min-h-12 w-full rounded-2xl border border-danger/25 bg-danger/10 px-4 py-3 text-sm font-extrabold text-danger"
                  disabled
                  type="button"
                >
                  Identidad rechazada
                </button>
              ) : null}
            </div>
          )}

          {history.length ? (
            <details className="rounded-2xl border border-ink/[0.08] bg-surface p-3">
              <summary className="cursor-pointer text-sm font-extrabold text-ink">
                Historial de decisiones ({history.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {history.map((item) => (
                  <li
                    className="rounded-xl border border-ink/[0.08] bg-surface p-3 text-xs text-ink/70"
                    key={String(item.id ?? item.created_at)}
                  >
                    <span className="font-extrabold text-ink">
                      {String(item.decision ?? "DECISIÓN")}
                    </span>{" "}
                    · {dateTime(item.created_at)}
                    {item.reason ? ` · ${String(item.reason)}` : ""}
                  </li>
                ))}
              </ul>
            </details>
          ) : null}
        </AdminPanel>
      ) : null}

      <div className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-display text-base font-extrabold text-ink">
            Cola de revisión
          </h2>
          <span className="text-xs font-bold text-ink/60">
            Más antiguos primero
          </span>
        </div>

        {queue.length ? (
          <div className="consumer-scrollbar-none -mx-1 overflow-x-auto px-1">
          <table className="w-full min-w-[640px] border-separate border-spacing-2">
            <caption className="sr-only">
              Cola de revisión de identidad ({queue.length})
            </caption>
            <thead>
              <tr>
                <th scope="col" className="px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Prestador
                </th>
                <th scope="col" className="px-4 py-2 text-left text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Evidencia
                </th>
                <th scope="col" className="px-4 py-2 text-right text-xs font-extrabold tracking-[0.08em] text-ink/70 uppercase">
                  Estado
                </th>
              </tr>
            </thead>
            <tbody>
              {queue.map((row) => (
                <tr
                  key={row.provider_user_id}
                  className="rounded-3xl border border-ink/[0.08] bg-surface transition-colors hover:border-brand-yellow/30 hover:bg-ink/[0.04]"
                >
                  <th scope="row" className="min-w-0 rounded-l-3xl p-4 text-left">
                    <Link
                      className="block truncate text-sm font-extrabold text-ink hover:underline"
                      href={`/admin/identity?provider=${row.provider_user_id}`}
                    >
                      {row.display_name ?? row.email ?? row.provider_user_id}
                    </Link>
                  </th>
                  <td className="p-4 text-xs text-ink/70">
                    {row.document_count} documentos · enviado{" "}
                    {dateTime(row.submitted_at ?? row.updated_at)}
                  </td>
                  <td className="rounded-r-3xl p-4 text-right">
                    <AdminStatusBadge
                      label={getProviderStatusPresentation(row.status).label}
                      tone="pending"
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          </div>
        ) : (
          <AdminEmptyState
            title="Todo al día"
            description="No hay identidades realmente enviadas a revisión. Los perfiles incompletos se gestionan desde Usuarios o Prestadores."
          />
        )}
      </div>
    </section>
  );
}
