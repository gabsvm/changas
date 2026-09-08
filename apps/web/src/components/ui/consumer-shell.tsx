import Link from "next/link";
import type { ReactNode } from "react";

import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

import { AuthenticatedBottomNav } from "./authenticated-bottom-nav";

type ConsumerShellProps = {
  children: ReactNode;
  maxWidth?: "max-w-4xl" | "max-w-5xl" | "max-w-6xl" | "max-w-7xl";
};

export async function ConsumerShell({
  children,
  maxWidth = "max-w-7xl",
}: ConsumerShellProps) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const unreadCount = user ? await getUnreadNotificationCount(supabase) : 0;

  return (
    <main
      id="main-content"
      className={`bg-canvas text-ink min-h-screen ${
        user ? "mobile-content-with-nav" : ""
      }`}
    >
      <div className={`mx-auto w-full ${maxWidth} px-5 py-5 sm:px-8`}>
        <header className="border-ink/10 flex min-h-14 items-center justify-between gap-4 border-b pb-4">
          <Link
            className="flex min-h-12 items-center gap-3 rounded-xl pr-2"
            href="/"
            aria-label="Changas, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="font-display text-xl font-extrabold tracking-[-0.025em]">
              Changas
            </span>
          </Link>

          <nav className="flex items-center gap-2 sm:gap-3" aria-label="Acceso">
            {user ? (
              <Link
                className="text-moss hover:bg-moss/5 inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-bold transition-colors"
                href="/account"
              >
                Mi cuenta
              </Link>
            ) : (
              <Link
                className="text-moss hover:bg-moss/5 inline-flex min-h-12 items-center rounded-xl px-3 text-sm font-bold transition-colors"
                href="/login"
              >
                Ingresar
              </Link>
            )}
            <Link
              className="button-secondary hidden sm:inline-flex"
              href="/provider/onboarding"
            >
              Soy proveedor
            </Link>
          </nav>
        </header>

        {children}
      </div>

      {user ? <AuthenticatedBottomNav unreadCount={unreadCount} /> : null}
    </main>
  );
}
