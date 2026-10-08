"use client";

import { useRef, type InputHTMLAttributes } from "react";

export function SearchField({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className={`consumer-control focus-within:border-brand-orange/50 focus-within:ring-brand-orange/15 flex min-h-[3.75rem] items-center gap-2.5 rounded-full border-white/70 bg-white py-1 pr-2 pl-4 shadow-[0_2px_4px_rgb(23_20_15/5%),0_16px_36px_-10px_rgb(23_20_15/20%)] transition focus-within:ring-4 dark:border-white/10 dark:bg-[#2a231c] dark:shadow-[0_2px_4px_rgb(0_0_0/30%),0_16px_36px_-10px_rgb(0_0_0/60%)] ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="text-ink/70 h-5 w-5 shrink-0"
        fill="none"
      >
        <circle
          cx="11"
          cy="11"
          r="6.5"
          stroke="currentColor"
          strokeWidth="1.8"
        />
        <path
          d="m16 16 4 4"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
        />
      </svg>
      <span className="sr-only">Buscar</span>
      <input
        {...props}
        ref={inputRef}
        className="placeholder:text-ink/40 min-w-0 flex-1 border-0 bg-transparent py-3 text-base font-medium outline-none"
        type={props.type ?? "search"}
      />
    </label>
  );
}
