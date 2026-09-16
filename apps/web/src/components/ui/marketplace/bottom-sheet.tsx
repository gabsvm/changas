"use client";

import { useEffect, useRef } from "react";

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  closeLabel,
}: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: React.ReactNode;
  closeLabel?: string;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!open) return;
    closeRef.current?.focus();
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [onClose, open]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/40"
        aria-label={closeLabel ?? `Cerrar ${title}`}
        onClick={onClose}
      />
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="marketplace-sheet-title"
        className="mobile-safe-bottom bg-surface relative z-10 max-h-[88dvh] w-full overflow-y-auto rounded-t-[1.25rem] px-4 pt-3 pb-4 shadow-[0_-18px_50px_rgba(0,0,0,0.18)] sm:max-w-xl sm:rounded-2xl sm:p-5"
      >
        <div
          className="bg-ink/15 mx-auto mb-2 h-1 w-10 rounded-full sm:hidden"
          aria-hidden="true"
        />
        <div className="flex min-h-14 items-center justify-between gap-4">
          <h2
            id="marketplace-sheet-title"
            className="text-lg font-extrabold tracking-[-0.02em]"
          >
            {title}
          </h2>
          <button
            ref={closeRef}
            type="button"
            className="consumer-pressable text-ink/60 hover:bg-ink/[0.05] grid h-12 w-12 shrink-0 place-items-center rounded-full text-2xl"
            onClick={onClose}
            aria-label={closeLabel ?? `Cerrar ${title}`}
          >
            ×
          </button>
        </div>
        {children}
      </section>
    </div>
  );
}
