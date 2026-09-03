import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import {
  getNotificationPreferences,
  listNotifications,
} from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
  updateNotificationPreferencesAction,
} from "./actions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

export default async function NotificationCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login?next=/account/notifications");
  }

  const [notifications, preferences] = await Promise.all([
    listNotifications(supabase),
    getNotificationPreferences(supabase),
  ]);
  const unreadCount = notifications.filter((item) => item.unread).length;

  return (
    <section className="py-10 sm:py-14">
      <div className="flex flex-col justify-between gap-6 sm:flex-row sm:items-end">
        <div className="max-w-2xl">
          <p className="text-terracotta text-xs font-semibold tracking-[0.18em] uppercase">
            Actividad
          </p>
          <h1 className="font-display mt-3 text-5xl leading-none font-semibold tracking-[-0.04em]">
            Notificaciones
          </h1>
          <p className="text-ink/65 mt-4 text-sm leading-6">
            Revisá cambios importantes de trabajos, propuestas, pagos y cuenta.
            Los detalles privados se muestran acá, no en la pantalla bloqueada.
          </p>
        </div>

        {unreadCount > 0 ? (
          <form action={markAllNotificationsReadAction}>
            <button
              className="border-ink/20 rounded-full border px-5 py-3 text-sm font-semibold"
              type="submit"
            >
              Marcar todas como leídas
            </button>
          </form>
        ) : null}
      </div>

      <div className="mt-10 grid gap-10 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)]">
        <div>
          {notifications.length === 0 ? (
            <div className="border-ink/10 rounded-2xl border bg-white/65 p-8">
              <h2 className="font-display text-2xl font-semibold">
                No tenés notificaciones todavía
              </h2>
              <p className="text-ink/60 mt-2 text-sm leading-6">
                Cuando haya algo que requiera tu atención va a aparecer en este
                centro, aunque no actives push.
              </p>
            </div>
          ) : (
            <ol className="space-y-4">
              {notifications.map((item) => (
                <li
                  key={item.id}
                  className={`rounded-2xl border p-5 sm:p-6 ${
                    item.unread
                      ? "border-moss/35 bg-moss/5"
                      : "border-ink/10 bg-white/60"
                  }`}
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-terracotta text-xs font-semibold tracking-[0.14em] uppercase">
                          {item.kind}
                        </p>
                        {item.unread ? (
                          <span className="bg-moss/10 text-moss rounded-full px-2.5 py-1 text-xs font-semibold">
                            No leída
                          </span>
                        ) : (
                          <span className="text-ink/45 text-xs">Leída</span>
                        )}
                      </div>
                      <h2 className="font-display mt-2 text-2xl font-semibold">
                        {item.title}
                      </h2>
                    </div>
                    <time className="text-ink/45 text-xs" dateTime={item.createdAt}>
                      {dateFormatter.format(new Date(item.createdAt))}
                    </time>
                  </div>

                  <p className="text-ink/70 mt-3 text-sm leading-6">{item.body}</p>

                  <div className="mt-5 flex flex-wrap items-center gap-4">
                    <Link
                      className="text-moss text-sm font-semibold underline underline-offset-4"
                      href={item.actionUrl}
                    >
                      Abrir detalle
                    </Link>
                    {item.unread ? (
                      <form action={markNotificationReadAction}>
                        <input type="hidden" name="notificationId" value={item.id} />
                        <button
                          className="text-ink/65 text-sm font-semibold underline underline-offset-4"
                          type="submit"
                        >
                          Marcar como leída
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>

        <aside className="space-y-6">
          <PushOptIn
            publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
            initialEnabled={preferences.pushActionableEnabled}
          />

          <section className="border-ink/10 rounded-2xl border bg-white/65 p-5 sm:p-6">
            <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
              Preferencias
            </p>
            <h2 className="font-display mt-2 text-2xl font-semibold">
              Qué querés recibir
            </h2>
            <p className="text-ink/60 mt-2 mb-5 text-sm leading-6">
              Las alertas críticas dentro de Changas siguen activas aunque
              desactives promociones o canales externos.
            </p>
            <NotificationPreferencesForm
              action={updateNotificationPreferencesAction}
              initialValues={preferences}
            />
          </section>
        </aside>
      </div>
    </section>
  );
}
