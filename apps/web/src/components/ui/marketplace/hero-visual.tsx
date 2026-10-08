// Decorative composition for the home hero on large screens: three glass
// cards that state the product promises. No real data and hidden from
// assistive technology (the same promises are in the text below the hero).
const cards = [
  {
    title: "Identidad verificada",
    detail: "DNI y selfie revisados",
    className: "left-0 top-6 [--r:-3deg]",
    gradient: "linear-gradient(135deg, #2FBF71 0%, #0E7C46 100%)",
    icon: (
      <path
        d="M12 3 4.5 6v5.5c0 4.5 3 8 7.5 9.5 4.5-1.5 7.5-5 7.5-9.5V6L12 3Zm-2.8 9 2 2 3.8-4"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ),
  },
  {
    title: "Precio claro",
    detail: "Acordado antes de empezar",
    className: "right-0 top-[8.5rem] [--r:2.5deg]",
    gradient: "linear-gradient(135deg, #F5B942 0%, #DE7E1F 100%)",
    icon: (
      <path
        d="M12 4v16M16 8.5c-.6-1.3-2-2-4-2-2.3 0-4 1.1-4 2.8 0 4 8 1.7 8 5.6 0 1.8-1.8 2.9-4.1 2.9-2.1 0-3.6-.8-4.2-2.2"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
      />
    ),
  },
  {
    title: "Reseñas reales",
    detail: "Solo de trabajos hechos",
    className: "left-8 bottom-2 [--r:-1.5deg]",
    gradient: "linear-gradient(135deg, #FB6F92 0%, #E14D7A 100%)",
    icon: (
      <path
        d="m12 3.5 2.6 5.4 5.9.8-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.8L12 3.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinejoin="round"
      />
    ),
  },
] as const;

export function HeroVisual() {
  return (
    <div
      aria-hidden="true"
      className="relative hidden h-[22rem] lg:block"
      data-hero-visual
    >
      {cards.map((card, index) => (
        <div
          key={card.title}
          style={{ animationDelay: `${index * 0.8}s` }}
          className={`hero-float absolute flex w-64 items-center gap-3.5 rounded-3xl border border-white/60 bg-white/35 p-4 shadow-[0_24px_48px_-20px_rgba(23,20,15,0.35)] backdrop-blur-md dark:border-white/15 dark:bg-white/10 ${card.className}`}
        >
          <span
            className="relative grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-2xl text-white shadow-[0_6px_16px_-6px_rgb(23_20_15/40%)]"
            style={{ backgroundImage: card.gradient }}
          >
            <span
              className="absolute inset-0 opacity-25"
              style={{
                backgroundImage:
                  "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                backgroundSize: "10px 10px",
              }}
            />
            <svg
              viewBox="0 0 24 24"
              aria-hidden="true"
              focusable="false"
              className="relative h-6 w-6 drop-shadow-[0_1px_4px_rgb(0_0_0/30%)]"
              fill="none"
            >
              {card.icon}
            </svg>
          </span>
          <span className="min-w-0">
            <span className="text-ink block text-[15px] leading-5 font-extrabold tracking-[-0.01em]">
              {card.title}
            </span>
            <span className="text-ink/70 block text-[13px] leading-5">
              {card.detail}
            </span>
          </span>
        </div>
      ))}
    </div>
  );
}
