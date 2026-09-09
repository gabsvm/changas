"use client";

import type { ChangeEventHandler } from "react";

export function Switch({
  name,
  defaultChecked,
  checked,
  onChange,
  disabled = false,
  ariaLabel,
}: {
  name?: string;
  defaultChecked?: boolean;
  checked?: boolean;
  onChange?: ChangeEventHandler<HTMLInputElement>;
  disabled?: boolean;
  ariaLabel: string;
}) {
  return (
    <label className="relative inline-flex min-h-11 min-w-12 shrink-0 cursor-pointer items-center justify-center">
      <input
        className="peer sr-only"
        type="checkbox"
        role="switch"
        name={name}
        defaultChecked={checked === undefined ? defaultChecked : undefined}
        checked={checked}
        onChange={onChange}
        disabled={disabled}
        aria-label={ariaLabel}
      />
      <span className="peer-focus-visible:ring-moss/35 peer-checked:bg-brand-orange peer-disabled:opacity-45 relative h-7 w-12 rounded-full bg-ink/15 transition-colors peer-focus-visible:ring-2 peer-focus-visible:ring-offset-2">
        <span className="absolute top-1 left-1 h-5 w-5 rounded-full bg-white shadow-sm transition-transform peer-checked:translate-x-5" />
      </span>
    </label>
  );
}
