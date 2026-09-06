import Link from "next/link";

export default function PaymentReturnSuccessPage() {
  return (
    <section className="mx-auto max-w-2xl py-16 sm:py-24">
      <p className="text-moss text-xs font-semibold tracking-[0.16em] uppercase">
        Pago enviado
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.03em]">
        Estamos confirmando el pago
      </h1>
      <p className="text-ink/65 mt-5 text-sm leading-6">
        Mercado Pago te devolvió a Changas. La confirmación real llega por el
        canal seguro del proveedor de pagos; esta pantalla no modifica el estado
        del trabajo.
      </p>
      <Link className="button-primary mt-7 inline-flex" href="/account">
        Volver a mi cuenta
      </Link>
    </section>
  );
}
