const MODALITY_LABELS: Record<string, string> = {
  IN_PERSON: "Presencial",
  REMOTE: "Remoto",
  BOTH: "Presencial o remoto",
};

const PRICE_MODEL_LABELS: Record<string, string> = {
  FIXED: "Precio fijo",
  STARTING_AT: "Desde",
  HOURLY: "Por hora",
  PER_UNIT: "Por unidad",
  QUOTE: "A cotizar",
};

function readableFallback(value: string): string {
  return value
    .toLowerCase()
    .replaceAll("_", " ")
    .replace(/^./u, (character) => character.toUpperCase());
}

export function getModalityLabel(value: string): string {
  return MODALITY_LABELS[value] ?? readableFallback(value);
}

export function getPriceModelLabel(value: string): string {
  return PRICE_MODEL_LABELS[value] ?? readableFallback(value);
}

export function formatDistanceMeters(value: number | null): string | null {
  if (value === null || !Number.isFinite(value) || value < 0) return null;
  if (value < 1000) return `${Math.round(value)} m`;
  return `${new Intl.NumberFormat("es-AR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 1,
  }).format(value / 1000)} km`;
}
