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
      className="bg-canvas text-ink mobile-content-with-nav min-h-screen overflow-x-clip px-4 sm:px-8 sm:py-5"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="border-ink/[0.07] hidden min-h-14 items-center justify-between gap-5 border-b pb-4 sm:flex">
          <Link
            className="flex items-center gap-2.5"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="text-lg font-bold tracking-[-0.025em]">
              Changas
            </span>
          </Link>
          <nav
            className="flex items-center justify-end gap-1 text-sm font-semibold"
            aria-label="Proveedor"
          >
            <DesktopNavLink href="/messages">Mensajes</DesktopNavLink>
            <DesktopNavLink href="/account/notifications">
              <span className="flex items-center gap-2">
                Actividad
                {unreadCount > 0 ? (
                  <span className="bg-brand-pink-strong min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] leading-4 font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                ) : null}
              </span>
            </DesktopNavLink>
            <DesktopNavLink href="/account">Cuenta</DesktopNavLink>
          </nav>
        </header>
        {children}
      </div>
      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}

function DesktopNavLink({
  href,
  children,
}: {
  href: string;
  children: React.ReactNode;
}) {
  return (
    <Link
      href={href}
      className="consumer-pressable hover:bg-ink/[0.04] text-ink/65 hover:text-ink inline-flex min-h-11 items-center rounded-lg px-3"
    >
      {children}
    </Link>
  );
}
