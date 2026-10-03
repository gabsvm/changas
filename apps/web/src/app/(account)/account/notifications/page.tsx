import Link from "next/link";
import { redirect } from "next/navigation";

import { MobileAppBar } from "@/components/ui/mobile-app-bar";
import { EmptyState } from "@/components/ui/marketplace/empty-state";
import { StatusChip } from "@/components/ui/marketplace/status-chip";
import { listNotifications } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";
import { getNotificationKindLabel } from "@/lib/ui/notifications";

import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "./actions";

export const dynamic = "force-dynamic";

const dateFormatter = new Intl.DateTimeFormat("es-AR", {
  day: "numeric",
  month: "short",
  timeZone: "America/Argentina/Buenos_Aires",
});

const timeFormatter = new Intl.DateTimeFormat("es-AR", {
  hour: "2-digit",
  minute: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
  timeZone: "America/Argentina/Buenos_Aires",
});

function dayKey(value: Date): string {
  return dayKeyFormatter.format(value);
}

function activityGroupLabel(value: Date, now = new Date()): string {
  const key = dayKey(value);
  if (key === dayKey(now)) return "Hoy";
  if (key === dayKey(new Date(now.getTime() - 86_400_000))) return "Ayer";
  return dateFormatter.format(value);
}

export default async function NotificationCenterPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login?next=/account/notifications");

  const notifications = await listNotifications(supabase);
  const unreadCount = notifications.filter((item) => item.unread).length;
  const groups = new Map<string, typeof notifications>();

  for (const notification of notifications) {
    const label = activityGroupLabel(new Date(notification.createdAt));
    groups.set(label, [...(groups.get(label) ?? []), notification]);
  }

  return (
    <section className="pb-6 sm:py-10">
      <MobileAppBar title="Actividad" />
      <div className="pt-4 sm:pt-0">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="min-w-0">
            <h1 className="hidden text-3xl font-bold tracking-[-0.035em] sm:block">
              Actividad
            </h1>
            <p className="text-ink/70 max-w-[22rem] text-sm leading-5 sm:mt-1">
              Novedades de trabajos, propuestas, pagos y cuenta.
            </p>
          </div>
          <div className="-ml-2.5 flex items-center gap-1 self-start sm:ml-0">
            <Link
              href="/account/settings/notifications"
              className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.07] inline-flex min-h-11 items-center rounded-lg px-2.5 text-sm font-bold whitespace-nowrap"
            >
              Ajustes de avisos
            </Link>
            {unreadCount > 0 ? (
              <form action={markAllNotificationsReadAction}>
                <button
                  className="consumer-pressable text-terracotta hover:bg-brand-orange/[0.07] inline-flex min-h-11 items-center self-start rounded-lg px-2.5 text-sm font-bold whitespace-nowrap"
                  type="submit"
                >
                  Marcar todo leído
                </button>
              </form>
            ) : null}
          </div>
        </div>

        <div className="mt-5 max-w-3xl">
          <section aria-label="Actividad reciente">
            {notifications.length === 0 ? (
              <EmptyState
                className="empty-state-card py-12"
                icon={<span aria-hidden="true">✓</span>}
                title="Todo al día"
                description="No tenés novedades pendientes. Cuando algo requiera tu atención va a aparecer acá."
              />
            ) : (
              <div className="space-y-6">
                {Array.from(groups.entries()).map(([label, items]) => (
                  <section key={label} aria-labelledby={`activity-${label}`}>
                    <h2
                      id={`activity-${label}`}
                      className="text-ink/70 mb-2 text-xs font-bold tracking-[0.1em] uppercase"
                    >
                      {label}
                    </h2>
                    <ol className="consumer-card bg-surface divide-ink/[0.07] divide-y px-3">
                      {items.map((item) => (
                        <li key={item.id} className="py-3.5 sm:px-1">
                          <div className="flex gap-3">
                            <span
                              className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${item.unread ? "bg-brand-orange" : "bg-ink/18"}`}
                              aria-hidden="true"
                            />
                            <div className="min-w-0 flex-1">
                              <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                  <div className="flex flex-wrap items-center gap-1.5">
                                    <span className="text-ink/70 text-[11px] font-semibold">
                                      {getNotificationKindLabel(item.kind)}
                                    </span>
                                    {item.unread ? (
                                      <StatusChip tone="brand">
                                        Nueva
                                      </StatusChip>
                                    ) : null}
                                  </div>
                                  <Link
                                    href={item.actionUrl}
                                    className="text-ink hover:text-terracotta mt-1 block text-[0.98rem] leading-6 font-semibold"
                                  >
                                    {item.title}
                                  </Link>
                                </div>
                                <div className="flex shrink-0 flex-col items-end gap-1">
                                  <time
                                    className="text-ink/38 shrink-0 text-[11px]"
                                    dateTime={item.createdAt}
                                  >
                                    {timeFormatter.format(
                                      new Date(item.createdAt),
                                    )}
                                  </time>
                                  {item.unread ? (
                                    <form action={markNotificationReadAction}>
                                      <input
                                        type="hidden"
                                        name="notificationId"
                                        value={item.id}
                                      />
                                      <button
                                        className="consumer-pressable text-moss hover:bg-moss/[0.07] inline-flex min-h-9 items-center rounded-lg px-2 text-[11px] font-bold"
                                        type="submit"
                                      >
                                        Marcar
                                      </button>
                                    </form>
                                  ) : null}
                                </div>
                              </div>
                              <p className="text-ink/70 mt-0.5 text-sm leading-5">
                                {item.body}
                              </p>
                            </div>
                          </div>
                        </li>
                      ))}
                    </ol>
                  </section>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </section>
  );
}
