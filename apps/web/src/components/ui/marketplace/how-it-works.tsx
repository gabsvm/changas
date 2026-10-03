const steps = [
  {
    title: "Buscá lo que necesitás",
    body: "Por servicio, zona o modalidad. Mirá perfiles públicos, reseñas y precios antes de escribir.",
  },
  {
    title: "Hablá y acordá",
    body: "Chateá con la persona y cerrá una propuesta con alcance y precio claros. Todo queda registrado.",
  },
  {
    title: "Coordiná y reseñá",
    body: "Confirmá el trabajo y, cuando termina, dejá tu reseña. Solo opinan quienes lo hicieron.",
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
          <li key={step.title} className="tile-soft rounded-2xl p-5">
            <span
              className="bg-ink grid h-8 w-8 place-items-center rounded-full text-sm font-extrabold text-white"
              aria-hidden="true"
            >
              {index + 1}
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
