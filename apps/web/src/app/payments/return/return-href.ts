const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Destino post-pago: si Mercado Pago devolvió el `job` que le mandamos en
 * back_urls, vuelve al Seguimiento de ese trabajo; si no, a la lista.
 * Display-only: sin consultas ni mutaciones.
 */
export function resolveJobReturnHref(
  jobParam: string | string[] | undefined,
): string {
  const raw = Array.isArray(jobParam) ? jobParam[0] : jobParam;
  if (raw && UUID_PATTERN.test(raw)) return `/jobs/${raw}`;
  return "/jobs";
}
