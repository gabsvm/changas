import Link from "next/link";

export default function PaymentReturnFailurePage() {
  return (
    <section className="mx-auto max-w-2xl py-16 sm:py-24">
      <p className="text-terracotta text-xs font-semibold tracking-[0.16em] uppercase">
        Pago no completado
      </p>
      <h1 className="font-display mt-3 text-4xl font-semibold tracking-[-0.03em]">
        El pago no pudo completarse
      </h1>
      <p className="text-ink/65 mt-5 text-sm leading-6">
        Esta pantalla sólo informa el regreso desde Mercado Pago. Changas no
        marca un pago como fallido ni aprobado por parámetros de redirección; el
        estado financiero se actualiza únicamente después de verificar al
        proveedor por el canal seguro del servidor.
      </p>
      <Link className="button-primary mt-7 inline-flex" href="/account">
        Volver a mi cuenta
      </Link>
    </section>
  );
}
