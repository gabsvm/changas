const steps = [
  {
    title: "Descubrí",
    body: "Explorá servicios y elegí a la persona indicada.",
    color: "#161D2A",
  },
  {
    title: "Acordá",
    body: "Conversá y definí el alcance, el precio y el momento.",
    color: "#161D2A",
  },
  {
    title: "Resolvé y calificá",
    body: "Seguí el trabajo, acordá el pago por fuera de YALO y compartí tu experiencia.",
    color: "#161D2A",
  },
] as const;

export function HowItWorks() {
  return (
    <section
      id="como-funciona"
      aria-labelledby="how-it-works-title"
      className="mt-10 scroll-mt-24"
    >
      <h2
        id="how-it-works-title"
        className="text-lg font-semibold tracking-[-0.025em] sm:text-2xl"
      >
        Cómo funciona
      </h2>
      <ol className="mt-3 grid gap-3 sm:grid-cols-3">
        {steps.map((step, index) => (
          <li
            key={step.title}
            className="consumer-card consumer-card-pressed bg-surface relative overflow-hidden p-5"
          >
            <span
              className="pointer-events-none absolute inset-x-0 top-0 h-1"
              style={{ background: step.color }}
              aria-hidden="true"
            />
            <span
              className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl text-base font-semibold text-white"
              style={{ background: step.color }}
              aria-hidden="true"
            >
              {index + 1}
            </span>
            <h3 className="mt-3 text-[15px] leading-5 font-semibold tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="text-ink/70 mt-1.5 text-sm leading-6">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
