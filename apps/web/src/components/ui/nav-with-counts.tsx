import { Suspense } from "react";

import { AuthenticatedBottomNav } from "@/components/ui/authenticated-bottom-nav";
import { getUnreadConversationCount } from "@/lib/conversations/server";
import { getUnreadNotificationCount } from "@/lib/notifications/server";
import { createClient } from "@/lib/supabase/server";

// Unread counters need extra database round trips. They are streamed behind
// Suspense so the page content is never blocked waiting for badges.

async function BottomNavWithCounts({
  authenticated,
}: {
  authenticated: boolean;
}) {
  let unreadCount = 0;
  let unreadMessages = 0;
  if (authenticated) {
    const supabase = await createClient();
    [unreadCount, unreadMessages] = await Promise.all([
      getUnreadNotificationCount(supabase),
      getUnreadConversationCount(),
    ]);
  }
  return (
    <AuthenticatedBottomNav
      unreadCount={unreadCount}
      unreadMessages={unreadMessages}
    />
  );
}

export function BottomNav({ authenticated }: { authenticated: boolean }) {
  return (
    <Suspense
      fallback={<AuthenticatedBottomNav unreadCount={0} unreadMessages={0} />}
    >
      <BottomNavWithCounts authenticated={authenticated} />
    </Suspense>
  );
}

async function ActivityBadgeCount() {
  const supabase = await createClient();
  const unreadCount = await getUnreadNotificationCount(supabase);
  if (unreadCount <= 0) return null;
  return (
    <span
      aria-label={`${unreadCount} notificaciones sin leer`}
      className="bg-brand-pink-strong min-w-5 rounded-full px-1.5 py-0.5 text-center text-[0.65rem] leading-4 font-bold text-white"
    >
      {unreadCount > 99 ? "99+" : unreadCount}
    </span>
  );
}

export function ActivityBadge() {
  return (
    <Suspense fallback={null}>
      <ActivityBadgeCount />
    </Suspense>
  );
}
