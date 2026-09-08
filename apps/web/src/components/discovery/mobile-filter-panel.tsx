"use client";

import { useState, type ReactNode } from "react";

export function MobileFilterPanel({
  activeCount,
  children,
}: {
  activeCount: number;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        className="button-secondary mt-1 w-full justify-between sm:hidden"
        aria-expanded={open}
        aria-controls="discovery-advanced-filters"
        onClick={() => setOpen((value) => !value)}
      >
        <span>Filtros{activeCount > 0 ? ` (${activeCount})` : ""}</span>
        <span aria-hidden="true">{open ? "−" : "+"}</span>
      </button>
      <div
        id="discovery-advanced-filters"
        className={`${open ? "grid" : "hidden"} border-ink/10 gap-3 border-t pt-4 sm:grid sm:col-span-3 sm:grid-cols-4 lg:grid-cols-6`}
      >
        {children}
      </div>
    </>
  );
}
