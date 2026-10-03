import Link from "next/link";

import { ActivityBadge, BottomNav } from "@/components/ui/nav-with-counts";
import { createClient } from "@/lib/supabase/server";

export default async function ProviderLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

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
                <ActivityBadge />
              </span>
            </DesktopNavLink>
            <DesktopNavLink href="/account">Cuenta</DesktopNavLink>
          </nav>
        </header>
        {children}
      </div>
      {user ? <BottomNav authenticated /> : null}
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
      className="consumer-pressable hover:bg-ink/[0.04] text-ink/70 hover:text-ink inline-flex min-h-11 items-center rounded-lg px-3"
    >
      {children}
    </Link>
  );
}
