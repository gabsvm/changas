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
        No pudimos confirmar el pago
      </h1>
      <p className="text-ink/70 mt-5 text-sm leading-6">
        Revisá el estado actualizado en el trabajo antes de intentar de nuevo:
        ahí vas a ver si el pago quedó pendiente o tenés que generarlo otra vez.
      </p>
      <Link
        className="button-primary mt-7 inline-flex"
        href={resolveJobReturnHref(params.job)}
      >
        Volver al trabajo
      </Link>
    </section>
  );
}
