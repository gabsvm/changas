const steps = [
  {
    title: "Buscá lo que necesitás",
    body: "Por servicio, zona o modalidad. Mirá perfiles públicos, reseñas y precios antes de escribir.",
    gradient: "linear-gradient(135deg, #FF9A3D 0%, #EE5A24 100%)",
  },
  {
    title: "Hablá y acordá",
    body: "Chateá con la persona y cerrá una propuesta con alcance y precio claros. Todo queda registrado.",
    gradient: "linear-gradient(135deg, #4F8DFF 0%, #2F4BFE 100%)",
  },
  {
    title: "Coordiná y reseñá",
    body: "Confirmá el trabajo y, cuando termina, dejá tu reseña. Solo opinan quienes lo hicieron.",
    gradient: "linear-gradient(135deg, #2FBF71 0%, #0E7C46 100%)",
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
        className="text-lg font-extrabold tracking-[-0.025em] sm:text-2xl"
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
              style={{ backgroundImage: step.gradient }}
              aria-hidden="true"
            />
            <span
              className="relative grid h-11 w-11 place-items-center overflow-hidden rounded-2xl text-base font-extrabold text-white shadow-[0_6px_16px_-6px_rgb(23_20_15/40%)] dark:shadow-[0_6px_16px_-6px_rgb(0_0_0/70%)]"
              style={{ backgroundImage: step.gradient }}
              aria-hidden="true"
            >
              <span
                className="absolute inset-0 opacity-25"
                style={{
                  backgroundImage:
                    "radial-gradient(rgb(255 255 255 / 55%) 1px, transparent 1.5px)",
                  backgroundSize: "10px 10px",
                }}
              />
              <span className="relative drop-shadow-[0_1px_4px_rgb(0_0_0/30%)]">
                {index + 1}
              </span>
            </span>
            <h3 className="mt-3 text-[15px] leading-5 font-extrabold tracking-[-0.01em]">
              {step.title}
            </h3>
            <p className="text-ink/70 mt-1.5 text-sm leading-6">{step.body}</p>
          </li>
        ))}
      </ol>
    </section>
  );
}
