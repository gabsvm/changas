import Link from "next/link";
import { redirect } from "next/navigation";

import { NotificationPreferencesForm } from "@/components/notifications/notification-preferences-form";
import { PushOptIn } from "@/components/pwa/push-opt-in";
import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import {
  getNotificationPreferences,
  listNotifications,
} from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import { getNotificationKindLabel } from "@/lib/ui/notifications";

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
    <section className="pb-6 sm:py-14">
      <MobileAppBar title="Actividad" />
      <div className="pt-6 sm:pt-0">
        <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-end">
          <div className="max-w-2xl">
            <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.16em] uppercase">
              Actividad
            </p>
            <div className="mt-2 flex flex-wrap items-center gap-3">
              <h1 className="font-display text-3xl font-semibold tracking-[-0.03em] sm:text-5xl">
                Notificaciones
              </h1>
              {unreadCount > 0 ? (
                <span className="bg-terracotta/10 text-terracotta rounded-full px-3 py-1 text-xs font-bold">
                  {unreadCount} sin leer
                </span>
              ) : null}
            </div>
            <p className="text-ink/60 mt-3 max-w-xl text-sm leading-6">
              Acá concentramos cambios importantes de trabajos, propuestas,
              pagos y cuenta para que puedas detectar rápido qué requiere tu
              atención.
            </p>
          </div>

          {unreadCount > 0 ? (
            <form action={markAllNotificationsReadAction}>
              <button
                className="button-secondary w-full sm:w-auto"
                type="submit"
              >
                Marcar todas como leídas
              </button>
            </form>
          ) : null}
        </div>

        <div className="mt-7 grid gap-8 lg:grid-cols-[minmax(0,1.3fr)_minmax(20rem,0.7fr)] lg:gap-10">
          <div>
            {notifications.length === 0 ? (
              <div className="border-ink/10 bg-surface rounded-3xl border p-6 shadow-[0_10px_30px_rgba(22,56,50,0.04)] sm:p-8">
                <span
                  className="bg-moss/8 text-moss grid h-12 w-12 place-items-center rounded-2xl"
                  aria-hidden="true"
                >
                  ✓
                </span>
                <h2 className="font-display mt-4 text-2xl font-semibold">
                  Estás al día
                </h2>
                <p className="text-ink/60 mt-2 text-sm leading-6">
                  Cuando haya algo que requiera tu atención va a aparecer acá,
                  aunque no actives las notificaciones push.
                </p>
              </div>
            ) : (
              <ol className="space-y-3">
                {notifications.map((item) => (
                  <li
                    key={item.id}
                    className={`rounded-3xl border p-5 shadow-[0_8px_24px_rgba(22,56,50,0.03)] sm:p-6 ${
                      item.unread
                        ? "border-moss/25 bg-moss/5"
                        : "border-ink/10 bg-surface"
                    }`}
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.12em] uppercase">
                            {getNotificationKindLabel(item.kind)}
                          </p>
                          {item.unread ? (
                            <span className="bg-moss/10 text-moss rounded-full px-2.5 py-1 text-[0.68rem] font-bold">
                              Nueva
                            </span>
                          ) : null}
                        </div>
                        <h2 className="font-display mt-2 text-xl font-semibold sm:text-2xl">
                          {item.title}
                        </h2>
                      </div>
                      <time
                        className="text-ink/45 shrink-0 text-xs"
                        dateTime={item.createdAt}
                      >
                        {dateFormatter.format(new Date(item.createdAt))}
                      </time>
                    </div>

                    <p className="text-ink/65 mt-3 text-sm leading-6">
                      {item.body}
                    </p>

                    <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:flex-wrap">
                      <Link
                        className="button-secondary min-h-12 w-full sm:w-auto"
                        href={item.actionUrl}
                      >
                        Abrir detalle
                      </Link>
                      {item.unread ? (
                        <form action={markNotificationReadAction}>
                          <input
                            type="hidden"
                            name="notificationId"
                            value={item.id}
                          />
                          <button
                            className="hover:bg-ink/5 text-ink/65 min-h-12 w-full rounded-2xl px-4 text-sm font-semibold sm:w-auto"
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

          <aside className="space-y-5">
            <PushOptIn
              publicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? ""}
              initialEnabled={preferences.pushActionableEnabled}
            />

            <section className="border-ink/10 bg-surface rounded-3xl border p-5 shadow-[0_8px_24px_rgba(22,56,50,0.03)] sm:p-6">
              <p className="text-terracotta text-[0.68rem] font-bold tracking-[0.14em] uppercase">
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
      </div>
    </section>
  );
}
