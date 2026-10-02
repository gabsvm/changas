export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`skeleton-shimmer block rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
