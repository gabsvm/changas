import { listAdminAuditEvents } from "@/lib/admin/server";

export default async function AdminAuditPage() {
  const events = await listAdminAuditEvents();
  return (
    <section className="space-y-5">
      <div>
        <h2 className="text-2xl font-bold">Auditoría</h2>
        <p className="text-sm text-slate-600">
          Historial append-only de decisiones administrativas, sin secretos ni
          contenido de documentos.
        </p>
      </div>
      <div className="space-y-2">
        {events.length ? (
          events.map((event) => (
            <article
              className="rounded-xl border border-slate-200 bg-white p-4"
              key={event.event_id}
            >
              <div className="flex flex-wrap justify-between gap-2">
                <p className="font-semibold">{event.action_type}</p>
                <time className="text-xs text-slate-500">
                  {new Date(event.created_at).toLocaleString("es-AR")}
                </time>
              </div>
              <p className="mt-1 text-sm text-slate-600">
                {event.target_type} · {event.target_id ?? "sin target"}
              </p>
              <p className="mt-1 text-xs text-slate-500">
                Actor: {event.actor_display_name ?? event.actor_user_id}
              </p>
            </article>
          ))
        ) : (
          <p className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-600">
            Todavía no hay eventos administrativos.
          </p>
        )}
      </div>
    </section>
  );
}
