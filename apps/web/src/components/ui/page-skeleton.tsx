import { Skeleton } from "@/components/ui/marketplace/skeleton";

// Instant feedback while a dynamic route renders on the server: Next.js shows
// the nearest loading.tsx immediately on navigation and prefetches it.
export function PageSkeleton({
  variant = "list",
}: {
  variant?: "list" | "hero" | "form";
}) {
  return (
    <div role="status" aria-busy="true" className="space-y-4 pt-5">
      <span className="sr-only">Cargando…</span>
      <Skeleton className="h-8 w-2/3 max-w-sm" />
      {variant === "hero" ? (
        <Skeleton className="h-56 w-full rounded-[1.25rem]" />
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
