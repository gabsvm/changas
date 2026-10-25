import Link from "next/link";

import { AccountHeaderNav } from "@/components/ui/marketplace/account-header-nav";
import { ActivityBadge, BottomNav } from "@/components/ui/nav-with-counts";
import { arePublicNeedsEnabled } from "@/lib/jobs/needs-rollout";
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
      className="yalo-ui bg-canvas text-ink mobile-content-with-nav min-h-screen overflow-x-clip px-4 sm:px-8 sm:py-5"
    >
      <div className="mx-auto w-full max-w-6xl">
        <header className="yalo-account-header border-ink/[0.07] hidden min-h-14 items-center justify-between gap-5 border-b pb-4 sm:flex">
          <Link
            className="flex items-center gap-2.5"
            href="/"
            aria-label="YALO, inicio"
          >
            <span className="brand-mark" aria-hidden="true">
              C
            </span>
            <span className="brand-wordmark text-lg" aria-hidden="true" />
          </Link>
          <AccountHeaderNav
            variant="provider"
            needsEnabled={arePublicNeedsEnabled()}
            badge={<ActivityBadge />}
          />
        </header>
        {children}
      </div>
      {user ? <BottomNav authenticated /> : null}
    </main>
  );
}
