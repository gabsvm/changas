import Link from "next/link";

import { resolveJobReturnHref } from "../return-href";

export default async function PaymentReturnSuccessPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <section className="mx-auto max-w-2xl py-16 sm:py-24">
      <p className="text-moss text-xs font-semibold tracking-[0.16em] uppercase">
        Pago enviado
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.03em]">
        ¡Pago enviado!
      </h1>
      <p className="text-ink/70 mt-5 text-sm leading-6">
        Estamos confirmando la acreditación con Mercado Pago. Puede tardar unos
        minutos: podés seguir el estado desde tu trabajo, te avisamos de cada
        avance.
      </p>
      <Link
        className="button-primary mt-7 inline-flex"
        href={resolveJobReturnHref(params.job)}
      >
        Ver el estado del trabajo
      </Link>
    </section>
  );
}
