"use client";

import { usePathname } from "next/navigation";
import type { ReactNode } from "react";

import { shouldShowAuthenticatedBottomNav } from "@/lib/ui/navigation";

import { AuthenticatedBottomNav } from "./authenticated-bottom-nav";

export function AuthenticatedShellFrame({
  children,
  unreadCount,
}: {
  children: ReactNode;
  unreadCount: number;
}) {
  const pathname = usePathname();
  const showBottomNav = shouldShowAuthenticatedBottomNav(pathname);

  return (
    <main
      id="main-content"
      className={`bg-canvas text-ink min-h-screen px-5 sm:px-8 sm:py-5 ${
        showBottomNav ? "mobile-content-with-nav" : ""
      }`}
    >
      {children}
      {showBottomNav ? (
        <AuthenticatedBottomNav unreadCount={unreadCount} />
      ) : null}
    </main>
  );
}
