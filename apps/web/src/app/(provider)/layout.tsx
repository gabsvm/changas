import Link from "next/link";

import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;

  return (
    <main
      id="main-content"
      className="bg-canvas text-ink mobile-content-with-nav min-h-screen px-5 sm:px-8 sm:py-5"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-ink/10 hidden items-center justify-between gap-4 border-b pb-5 sm:flex">
          <Link
            className="flex items-center gap-3"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-semibold tracking-tight">
              Changas
            </span>
          </Link>
          <nav
            className="flex items-center justify-end gap-4 text-sm"
            aria-label="Proveedor"
          >
            <Link className="underline underline-offset-4" href="/messages">
              Mensajes
            </Link>
            <Link
              className="flex items-center gap-2 underline underline-offset-4"
              href="/account/notifications"
            >
              Notificaciones
              {unreadCount > 0 ? (
                <span
                  className="bg-terracotta min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] leading-4 font-bold text-white no-underline"
                  aria-label={`${unreadCount} notificaciones sin leer`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link className="underline underline-offset-4" href="/account">
              Cuenta
            </Link>
          </nav>
        </header>
        {children}
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
