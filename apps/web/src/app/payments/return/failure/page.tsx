import Link from "next/link";

import { resolveJobReturnHref } from "../return-href";

export default async function PaymentReturnFailurePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  return (
    <section className="mx-auto max-w-2xl py-16 sm:py-24">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Pago no completado
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.03em]">
        No se cobró nada
      </h1>
      <p className="text-ink/70 mt-5 text-sm leading-6">
        El pago no se completó y no se hizo ningún cargo. Podés reintentarlo
        desde tu trabajo cuando quieras.
      </p>
      <Link
        className="button-primary mt-7 inline-flex"
        href={resolveJobReturnHref(params.job)}
      >
        Reintentar desde el trabajo
      </Link>
    </section>
  );
}
