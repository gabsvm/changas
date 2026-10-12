const ENABLED_VALUES: Record<string, true> = {
  "1": true,
  true: true,
  yes: true,
  on: true,
  enabled: true,
};
export function parsePaymentsEnabled(value: string | undefined): boolean {
  if (!value) return false;
  return ENABLED_VALUES[value.trim().toLowerCase()] === true;
}

/**
 * Flag server-only `PAYMENTS_ENABLED` (default off). Los pagos siguen
 * simulados (FAKE/admin): con el flag OFF el checkout real queda oculto y
 * con el flag ON se muestra el botón real de pago de adicional.
 * Nunca lee credenciales ni conecta Mercado Pago.
 */
export function isPaymentsEnabled(): boolean {
  return parsePaymentsEnabled(process.env.PAYMENTS_ENABLED);
}
