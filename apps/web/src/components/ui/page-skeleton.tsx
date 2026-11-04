import { Skeleton } from "@/components/ui/marketplace/skeleton";

// Instant feedback while a dynamic route renders on the server: Next.js shows
// the nearest loading.tsx immediately on navigation and prefetches it.
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "hero" | "form" | "cover";
}) {
  if (variant === "cover") {
    return (
      <div role="status" aria-busy="true" className="space-y-4 pt-5">
        <span className="sr-only">Cargando…</span>
        <div
          className="brand-gradient-surface relative overflow-hidden rounded-3xl px-5 py-6"
          aria-hidden="true"
        >
          
          
          
          <span className="relative flex items-center gap-3">
            <span className="skeleton-shimmer h-11 w-11 shrink-0 rounded-2xl" />
            <span className="min-w-0 flex-1 space-y-2">
              <span className="skeleton-shimmer block h-3 w-24 rounded-full bg-white/30" />
              <span className="skeleton-shimmer block h-5 w-2/3 rounded-lg bg-white/30" />
            </span>
          </span>
        </div>
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      </div>
    );
  }

  return (
    <div role="status" aria-busy="true" className="space-y-4 pt-5">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-2/3 max-w-sm" />
      {variant === "hero" ? (
        <Skeleton className="h-56 w-full rounded-3xl" />
      ) : null}
      {variant === "form" ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-full rounded-xl" />
          <Skeleton className="h-12 w-40 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-3">
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
          <Skeleton className="h-24 w-full rounded-2xl" />
        </div>
      )}
    </div>
  );
}
