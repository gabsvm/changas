"use client";

import { useRef, type InputHTMLAttributes } from "react";

export function SearchField({
  className = "",
  ...props
}: InputHTMLAttributes<HTMLInputElement>) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <label
      className={`consumer-control focus-within:border-brand-orange/50 focus-within:ring-brand-orange/15 flex min-h-[52px] items-center gap-2.5 rounded-2xl bg-white px-3.5 transition focus-within:ring-4 ${className}`}
    >
      <svg
        aria-hidden="true"
        viewBox="0 0 24 24"
        className="text-ink/50 h-5 w-5 shrink-0"
        fill="none"
      >
        <circle cx="11" cy="11" r="6.5" stroke="currentColor" strokeWidth="1.8" />
        <path d="m16 16 4 4" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
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
