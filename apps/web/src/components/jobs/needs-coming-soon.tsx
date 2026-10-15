import Link from "next/link";

export function NeedsComingSoon() {
  return (
    <main className="mx-auto max-w-xl px-5 py-14">
      <h1 className="font-display text-2xl font-bold">
        Nuevas oportunidades en preparación
      </h1>
      <p className="text-ink/70 mt-3 text-base leading-7">
        Estamos terminando de probar las solicitudes abiertas y las ofertas de
        varios prestadores. Por ahora podés seguir buscando y contratando
        servicios de forma habitual.
      </p>
      <Link
        href="/buscar"
        className="consumer-pressable cta-ink mt-6 inline-flex min-h-12 items-center rounded-xl px-5 text-sm font-bold"
      >
        Buscar servicios
      </Link>
    </main>
  );
}
