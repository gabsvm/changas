import type { ReactNode } from "react";

export function BrandHero({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children?: ReactNode;
}) {
  return (
    <section className="brand-gradient-surface relative overflow-hidden rounded-[2rem] px-5 pt-6 pb-8 text-white shadow-[var(--consumer-shadow-hero)] sm:px-8 sm:pt-8">
      <div className="relative z-10">
        <p className="text-xs font-extrabold tracking-[0.1em] text-white/80 uppercase">
          {eyebrow}
        </p>
        <h1 className="mt-3 max-w-xl text-[2.25rem] leading-[0.98] font-extrabold tracking-[-0.055em] sm:text-5xl">
          {title}
        </h1>
        <p className="mt-3 max-w-lg text-sm leading-5 text-white/88 sm:text-base">
          {description}
        </p>
        {children ? (
          <div className="brand-hero-panel text-ink bg-canvas mt-6 rounded-[1.5rem] p-3 shadow-[var(--consumer-shadow-float)] sm:p-4">
            {children}
          </div>
        ) : null}
      </div>
      <span
        className="absolute -top-16 -right-12 h-48 w-48 rounded-full border border-white/20"
        aria-hidden="true"
      />
      <span
        className="absolute right-12 bottom-8 h-3 w-3 rounded-full bg-white/70"
        aria-hidden="true"
      />
    </section>
  );
}
