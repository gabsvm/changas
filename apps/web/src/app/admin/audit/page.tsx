import {
  AdminEmptyState,
  AdminPageHeader,
  AdminStatusBadge,
} from "@/components/admin/admin-ui";
import { listAdminAuditEvents } from "@/lib/admin/server";

function humanAction(action: string) {
  const labels: Record<string, string> = {
    PROVIDER_ONBOARDING_PREPARED: "Onboarding de prestador preparado",
    PROVIDER_MANUALLY_ACTIVATED: "Prestador activado manualmente",
    IDENTITY_REVIEW_APPROVED: "Identidad aprobada",
    IDENTITY_REVIEW_REJECTED: "Identidad rechazada",
    JOB_DISPUTE_RESOLVED: "Disputa de trabajo resuelta",
    SKILL_REQUEST_APPROVE_NEW: "Habilidad nueva aprobada",
    CATALOG_CATEGORY_CREATED: "Categoría creada",
  };
  return labels[action] ?? action.replaceAll("_", " ");
}

export default async function AdminAuditPage() {
  const events = await listAdminAuditEvents();
  return (
    <section className="space-y-6">
      <AdminPageHeader
        eyebrow="Trazabilidad"
        title="Auditoría"
        description="Historial append-only de decisiones administrativas. Acá vas a ver también las activaciones manuales de prestadores y su motivo."
      />
      {events.length ? (
        <div className="space-y-2">
          {events.map((event) => (
            <article
              className="rounded-3xl border border-ink/[0.08] bg-surface p-4"
              key={event.event_id}
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <p className="text-sm font-extrabold text-ink">
                    {humanAction(event.action_type)}
                  </p>
                  <code className="mt-1 block truncate text-[11px] font-bold tracking-[0.04em] text-ink/40">
                    {event.action_type}
                  </code>
                  <p className="mt-1 truncate text-xs text-ink/70">
                    {event.target_type} · {event.target_id ?? "sin target"}
                  </p>
                </div>
                <time className="shrink-0 text-xs font-semibold text-ink/60">
                  {new Date(event.created_at).toLocaleString("es-AR")}
                </time>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-2">
                <AdminStatusBadge
                  label={event.actor_display_name ?? "Administrador"}
                  tone="neutral"
                />
                {event.action_type === "PROVIDER_MANUALLY_ACTIVATED" ? (
                  <AdminStatusBadge label="Bypass auditado" tone="pink" />
                ) : null}
              </div>
            </article>
          ))}
        </div>
      ) : (
        <AdminEmptyState
          title="Todavía no hay eventos administrativos"
          description="Las decisiones sensibles aparecerán acá sin permitir edición ni borrado."
        />
      )}
    </section>
  );
}
