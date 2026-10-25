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
          <div className="border-brand-yellow/30 bg-brand-yellow/15 rounded-2xl border px-4 py-3 text-center">
            <p className="text-warning text-2xl font-extrabold">
              {queue.length}
            </p>
            <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.08em] uppercase">
              pendientes
            </p>
          </div>
        }
      />

      {identityCase ? (
        <AdminPanel className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
            <div className="min-w-0">
              <p className="text-ink/60 text-[11px] font-extrabold tracking-[0.14em] uppercase">
                Caso seleccionado
              </p>
              <h2 className="font-display text-ink mt-1 truncate text-xl font-extrabold">
                {identityCase.display_name ??
                  identityCase.email ??
                  identityCase.provider_user_id}
              </h2>
              <p className="text-ink/70 mt-1 truncate text-sm">
                {identityCase.email ?? identityCase.provider_user_id}
              </p>
            </div>
            <AdminStatusBadge
              label={getProviderStatusPresentation(identityCase.status).label}
              tone={providerTone(identityCase.status)}
            />
          </div>

          <div className="border-ink/[0.08] bg-surface rounded-2xl border p-4">
            <p className="text-ink/60 text-xs font-bold">Identidad declarada</p>
            <p className="text-ink mt-1 text-sm font-extrabold">
              {identityCase.legal_name ?? "Sin nombre legal"}
            </p>
            <p className="text-ink/70 mt-1 text-xs">
              DNI y fecha de nacimiento se consultan sólo dentro de este
              contexto administrativo.
            </p>
          </div>

          <div>
            <div className="mb-3 flex items-center justify-between gap-3">
              <h3 className="text-ink text-sm font-extrabold">
                Evidencia privada
              </h3>
              <span className="text-ink/60 text-xs font-bold">
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
                className="border-success/25 bg-success/10 rounded-2xl border p-3"
              >
                <input
                  type="hidden"
                  name="providerUserId"
                  value={identityCase.provider_user_id}
                />
                <input type="hidden" name="decision" value="APPROVE" />
                <label className="text-ink/70 text-xs font-bold">
                  Nota opcional
                  <input
                    className="border-ink/10 text-ink mt-1 w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
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
                className="border-danger/25 bg-danger/10 rounded-2xl border p-3"
              >
                <input
                  type="hidden"
                  name="providerUserId"
                  value={identityCase.provider_user_id}
                />
                <input type="hidden" name="decision" value="REJECT" />
                <label className="text-ink/70 text-xs font-bold">
                  Motivo obligatorio
                  <input
                    className="border-ink/10 text-ink mt-1 w-full border bg-white px-3 py-2 text-sm dark:border-white/10 dark:bg-white/10 dark:text-white"
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
            <div className="border-ink/[0.08] bg-surface rounded-2xl border p-4">
              <p className="text-ink text-sm font-extrabold">
                Caso sin decisión pendiente
              </p>
              <p className="text-ink/70 mt-1 text-xs leading-5">
                Los controles de decisión quedan bloqueados una vez resuelto el
                caso. El historial permanece disponible abajo para trazabilidad.
              </p>
              {identityCase.status === "ACTIVE" ? (
                <button
                  aria-label="Aprobar identidad"
                  className="border-success/25 bg-success/10 text-success mt-3 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm font-extrabold"
                  disabled
                  type="button"
                >
                  ✓ Identidad aprobada
                </button>
              ) : identityCase.status === "REJECTED" ? (
                <button
                  aria-label="Rechazar identidad"
                  className="border-danger/25 bg-danger/10 text-danger mt-3 min-h-12 w-full rounded-2xl border px-4 py-3 text-sm font-extrabold"
                  disabled
                  type="button"
                >
                  Identidad rechazada
                </button>
              ) : null}
            </div>
          )}

          {history.length ? (
            <details className="border-ink/[0.08] bg-surface rounded-2xl border p-3">
              <summary className="text-ink cursor-pointer text-sm font-extrabold">
                Historial de decisiones ({history.length})
              </summary>
              <ul className="mt-3 space-y-2">
                {history.map((item) => (
                  <li
                    className="border-ink/[0.08] bg-surface text-ink/70 rounded-xl border p-3 text-xs"
                    key={String(item.id ?? item.created_at)}
                  >
                    <span className="text-ink font-extrabold">
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
          <h2 className="font-display text-ink text-base font-extrabold">
            Cola de revisión
          </h2>
          <span className="text-ink/60 text-xs font-bold">
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
                    Evidencia
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
                {queue.map((row) => (
                  <tr
                    key={row.provider_user_id}
                    className="border-ink/[0.08] bg-surface hover:border-brand-yellow/30 hover:bg-ink/[0.04] rounded-3xl border transition-colors"
                  >
                    <th
                      scope="row"
                      className="min-w-0 rounded-l-3xl p-4 text-left"
                    >
                      <Link
                        className="text-ink block truncate text-sm font-extrabold hover:underline"
                        href={`/admin/identity?provider=${row.provider_user_id}`}
                      >
                        {row.display_name ?? row.email ?? row.provider_user_id}
                      </Link>
                    </th>
                    <td className="text-ink/70 p-4 text-xs">
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
