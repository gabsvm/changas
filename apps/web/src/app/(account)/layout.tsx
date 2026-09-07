import Link from "next/link";

import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

export default async function AccountLayout({
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
            <span className="font-display text-xl font-extrabold tracking-[-0.035em]">
              Changas
            </span>
          </Link>
          <nav
            className="flex items-center justify-end gap-4 text-sm font-semibold"
            aria-label="Cuenta"
          >
            <Link
              className="hover:text-moss underline decoration-ink/20 underline-offset-4 transition-colors"
              href="/messages"
            >
              Mensajes
            </Link>
            <Link
              className="hover:text-moss flex items-center gap-2 underline decoration-ink/20 underline-offset-4 transition-colors"
              href="/account/notifications"
            >
              Notificaciones
              {unreadCount > 0 ? (
                <span
                  className="bg-brand-pink-strong min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] leading-4 font-bold text-white no-underline"
                  aria-label={`${unreadCount} notificaciones sin leer`}
                >
                  {unreadCount > 99 ? "99+" : unreadCount}
                </span>
              ) : null}
            </Link>
            <Link
              className="hover:text-moss underline decoration-ink/20 underline-offset-4 transition-colors"
              href="/account"
            >
              Cuenta
            </Link>
            <Link
              className="hover:text-moss underline decoration-ink/20 underline-offset-4 transition-colors"
              href="/account/settings"
            >
              Configuración
            </Link>
            <Link
              className="hover:text-moss underline decoration-ink/20 underline-offset-4 transition-colors"
              href="/account/favorites"
            >
              Guardados
            </Link>
          </nav>
        </header>
        {children}
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
