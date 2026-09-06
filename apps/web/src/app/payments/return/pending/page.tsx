import Link from "next/link";

export default function PaymentReturnPendingPage() {
  return (
    <section className="mx-auto max-w-2xl py-16 sm:py-24">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Pago pendiente
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.03em]">
        El pago todavía está en proceso
      </h1>
      <p className="text-ink/65 mt-5 text-sm leading-6">
        No hace falta volver a pagar. Changas actualizará el trabajo únicamente
        cuando reciba y verifique la confirmación segura de Mercado Pago.
      </p>
      <Link className="button-primary mt-7 inline-flex" href="/account">
        Volver a mi cuenta
      </Link>
    </section>
  );
}
