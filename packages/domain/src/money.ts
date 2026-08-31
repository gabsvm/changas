import { priceModels, type PriceModel } from "./marketplace";

export const supportedCurrencyCodes = ["ARS"] as const;
export type CurrencyCode = (typeof supportedCurrencyCodes)[number];

const MAX_SAFE_MINOR_UNITS = BigInt(Number.MAX_SAFE_INTEGER);
const MAJOR_AMOUNT_PATTERN = /^(?:0|[1-9]\d*)(?:\.\d{1,2})?$/;

function assertSupportedCurrency(
  currency: string,
): asserts currency is CurrencyCode {
  if (!supportedCurrencyCodes.includes(currency as CurrencyCode)) {
    throw new Error(`Unsupported currency: ${currency}`);
  }
}

function assertSafeMinorUnits(minorUnits: number): void {
  if (
    !Number.isSafeInteger(minorUnits) ||
    minorUnits <= 0 ||
    BigInt(minorUnits) > MAX_SAFE_MINOR_UNITS
  ) {
    throw new Error("Minor units must be a positive safe integer");
  }
}

export function parseMajorAmountToMinor(
  input: string,
  currency = "ARS",
): number {
  assertSupportedCurrency(currency);
  const normalized = input.trim();
  const match = MAJOR_AMOUNT_PATTERN.exec(normalized);
  if (!match) throw new Error("Invalid major amount");

  const [wholePart, fractionPart = ""] = normalized.split(".");
  if (!wholePart) throw new Error("Invalid major amount");
  const minorUnits =
    BigInt(wholePart) * 100n + BigInt(fractionPart.padEnd(2, "0") || "0");
  if (minorUnits <= 0n || minorUnits > MAX_SAFE_MINOR_UNITS) {
    throw new Error("Amount is outside the safe range");
  }
  return Number(minorUnits);
}

export function parseServicePrice(
  priceModel: PriceModel,
  input: string,
  currency = "ARS",
): number | null {
  if (!priceModels.includes(priceModel)) throw new Error("Invalid price model");
  if (priceModel === "QUOTE") {
    if (input.trim()) throw new Error("Quote services cannot have an amount");
    return null;
  }
  return parseMajorAmountToMinor(input, currency);
}

export function minorUnitsToMajorInput(
  minorUnits: number | null,
  currency = "ARS",
): string {
  assertSupportedCurrency(currency);
  if (minorUnits === null) return "";
  assertSafeMinorUnits(minorUnits);
  const value = BigInt(minorUnits);
  const whole = value / 100n;
  const cents = value % 100n;
  if (cents === 0n) return whole.toString();
  return `${whole}.${cents.toString().padStart(2, "0").replace(/0$/, "")}`;
}

export function formatMinorUnits(
  minorUnits: number | null,
  currency = "ARS",
): string {
  assertSupportedCurrency(currency);
  if (minorUnits === null) return "Consultar precio";
  assertSafeMinorUnits(minorUnits);
  return new Intl.NumberFormat("es-AR", {
    style: "currency",
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  })
    .format(minorUnits / 100)
    .replace(/\u00a0/g, "");
}

export function formatServicePrice(
  priceModel: PriceModel,
  minorUnits: number | null,
  currency = "ARS",
  unit: string | null = null,
): string {
  if (priceModel === "QUOTE") return "A cotizar";
  const formatted = formatMinorUnits(minorUnits, currency);
  if (priceModel === "STARTING_AT") return `Desde ${formatted}`;
  if (priceModel === "HOURLY") return `${formatted} / hora`;
  if (priceModel === "PER_UNIT") return `${formatted} / ${unit ?? "unidad"}`;
  return formatted;
}
