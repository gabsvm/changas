import type { ReactNode } from "react";

export function StickyActionBar({
  children,
  className = "",
}: {
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={`mobile-sticky-surface sticky z-30 -mx-5 px-5 pt-3 sm:static sm:mx-0 sm:border-0 sm:bg-transparent sm:p-0 sm:backdrop-blur-none ${className}`}
    >
      {children}
    </div>
  );
}
