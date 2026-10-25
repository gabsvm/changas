/**
 * CTA de contratacion de la ficha segun condiciones reales (SPEC A2).
 * Puro: la ficha le pasa la fila del servicio y recibe el kind correcto.
 * La preautorizacion real la valida el RPC; aca solo se elige el camino.
 */

export type ServiceHireKind = "DIRECT_BOOKING" | "QUOTE_REQUEST";

type HirableService = {
  price_model: string | null;
  price_amount: number | null;
  instant_booking_enabled?: boolean | null;
};

/** Reserva directa solo con precio fijo y monto; el resto pide presupuesto. */
export function getServiceHireKind(service: HirableService): ServiceHireKind {
  // IMPORTANT: the legacy production RPC auto-accepts DIRECT_BOOKING.
  // Never emit that kind unless the provider has explicitly opted in.
  // This also fails closed while the S1 migration is not deployed.
  if (
    service.price_model === "FIXED" &&
    service.price_amount !== null &&
    service.instant_booking_enabled === true
  ) {
    return "DIRECT_BOOKING";
  }
  return "QUOTE_REQUEST";
}

/** Reserva instantanea: precio fijo + monto + flag del prestador. */
export function isInstantBookingEligible(service: HirableService): boolean {
  return (
    getServiceHireKind(service) === "DIRECT_BOOKING" &&
    service.instant_booking_enabled === true
  );
}
