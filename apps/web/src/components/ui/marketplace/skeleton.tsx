export function Skeleton({ className = "" }: { className?: string }) {
  return (
    <span
      className={`bg-ink/[0.07] block animate-pulse rounded-lg ${className}`}
      aria-hidden="true"
    />
  );
}
