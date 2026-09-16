import { parseServicePrice, type PriceModel } from "@changas/domain";
import { serviceSchema, serviceTagsSchema } from "@changas/validation";

/**
 * Campos crudos del formulario de servicio (todos strings, como llegan en FormData).
 * Los selects del formulario son la fuente de verdad: si el usuario cambió el
 * modelo de precio después de escribir monto/unidad, esos valores residuales
 * se descartan en lugar de rechazar el formulario.
 */
export type ServiceFormRaw = {
  skillId: string;
  title: string;
  description: string;
  modality: string;
  priceModel: string;
  priceAmount: string;
  currencyCode: string;
  priceUnit: string;
  acceptsOffers: boolean;
  expectedDurationMinutes: number | undefined;
  scheduleType: string;
  includes: string;
  excludes: string;
  materialsNotes: string;
  isPublished: boolean;
  isPaused: boolean;
  tags: string[];
};

const FIELD_MESSAGES: Record<string, string> = {
  skillId:
    "Elegí una habilidad del catálogo. Si la quitaste, volvé a agregarla arriba.",
  title: "El título necesita entre 3 y 120 caracteres.",
  description:
    "La descripción necesita al menos 20 caracteres para que el cliente entienda la oferta.",
  modality: "Elegí una modalidad válida (presencial, remoto o ambas).",
  priceModel: "Elegí un modelo de precio válido.",
  priceAmount:
    "Este modelo de precio necesita un monto válido mayor a $0 en ARS.",
  priceUnit:
    "El precio por unidad necesita una unidad (ej: hora, metro, unidad).",
  expectedDurationMinutes: "La duración debe ser un número válido de minutos.",
  scheduleType: "Elegí un tipo de agenda válido.",
  includes: "El campo “Incluye” admite hasta 1500 caracteres.",
  excludes: "El campo “No incluye” admite hasta 1500 caracteres.",
  materialsNotes: "El campo de materiales admite hasta 1500 caracteres.",
};

export function serviceIssueMessage(
  issues: Array<{ path: Array<PropertyKey>; message: string }>,
): string {
  const first = issues[0];
  const key = typeof first?.path?.[0] === "string" ? first.path[0] : undefined;
  if (key === "priceAmount" && first?.message.includes("fixed amount")) {
    return "“A cotizar” no lleva monto: vaciá el campo de monto o elegí otro modelo de precio.";
  }
  if (key === "priceUnit" && first?.message.includes("Only per-unit")) {
    return "La unidad solo aplica a “Por unidad”: borrala o elegí ese modelo de precio.";
  }
  if (key && FIELD_MESSAGES[key]) return FIELD_MESSAGES[key];
  return "Revisá título, descripción y precio.";
}

export type ServiceParsedData = {
  skillId: string;
  title: string;
  description: string;
  modality: "IN_PERSON" | "REMOTE" | "BOTH";
  priceModel: "FIXED" | "STARTING_AT" | "HOURLY" | "PER_UNIT" | "QUOTE";
  priceAmount?: number | undefined;
  currencyCode: "ARS";
  priceUnit: string;
  acceptsOffers: boolean;
  expectedDurationMinutes?: number | undefined;
  scheduleType: "FIXED_SLOT" | "FLEXIBLE_WINDOW" | "DEADLINE" | "UNSCHEDULED";
  includes: string;
  excludes: string;
  materialsNotes: string;
  isPublished: boolean;
  isPaused: boolean;
};

export type ParsedServiceForm =
  | { ok: true; data: ServiceParsedData; tags: string[] }
  | { ok: false; message: string };

export function parseServiceForm(raw: ServiceFormRaw): ParsedServiceForm {
  // Los selects mandan: monto residual se ignora en QUOTE, unidad residual
  // se ignora fuera de PER_UNIT.
  const isQuote = raw.priceModel === "QUOTE";
  const effectiveUnit = raw.priceModel === "PER_UNIT" ? raw.priceUnit : "";

  let priceAmount: number | null;
  try {
    priceAmount = parseServicePrice(
      raw.priceModel as PriceModel,
      isQuote ? "" : raw.priceAmount,
      raw.currencyCode || "ARS",
    );
  } catch {
    return {
      ok: false,
      message:
        "El monto debe ser positivo, válido y estar expresado en ARS (podés usar coma decimal).",
    };
  }

  const effectiveAmount = isQuote ? undefined : (priceAmount ?? undefined);

  const parsed = serviceSchema.safeParse({
    skillId: raw.skillId,
    title: raw.title,
    description: raw.description,
    modality: raw.modality,
    priceModel: raw.priceModel,
    priceAmount: effectiveAmount,
    currencyCode: raw.currencyCode || "ARS",
    priceUnit: effectiveUnit,
    acceptsOffers: raw.acceptsOffers,
    expectedDurationMinutes: raw.expectedDurationMinutes,
    scheduleType: raw.scheduleType,
    includes: raw.includes,
    excludes: raw.excludes,
    materialsNotes: raw.materialsNotes,
    isPublished: raw.isPublished,
    isPaused: raw.isPaused,
  });
  if (!parsed.success) {
    return { ok: false, message: serviceIssueMessage(parsed.error.issues) };
  }

  const parsedTags = serviceTagsSchema.safeParse(raw.tags);
  if (!parsedTags.success) {
    return {
      ok: false,
      message:
        "Usá hasta ocho tags únicos de entre 2 y 80 caracteres, separados por comas.",
    };
  }

  const data: ServiceParsedData = {
    skillId: parsed.data.skillId,
    title: parsed.data.title,
    description: parsed.data.description,
    modality: parsed.data.modality,
    priceModel: parsed.data.priceModel,
    priceAmount: effectiveAmount,
    currencyCode: parsed.data.currencyCode,
    priceUnit: parsed.data.priceUnit,
    acceptsOffers: parsed.data.acceptsOffers,
    expectedDurationMinutes: parsed.data.expectedDurationMinutes,
    scheduleType: parsed.data.scheduleType,
    includes: parsed.data.includes,
    excludes: parsed.data.excludes,
    materialsNotes: parsed.data.materialsNotes,
    isPublished: parsed.data.isPublished,
    isPaused: parsed.data.isPaused,
  };
  return { ok: true, data, tags: parsedTags.data };
}
