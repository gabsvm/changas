function assertPositiveSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value <= 0) {
    throw new Error(`${label} must be a positive safe integer.`);
  }
}

function assertNonNegativeSafeInteger(value: number, label: string): void {
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative safe integer.`);
  }
}

export function calculateMarketplaceFeeMinor(
  grossMinor: number,
  feeBps: number,
): number {
  assertPositiveSafeInteger(grossMinor, "Gross amount");
  if (!Number.isInteger(feeBps) || feeBps < 0 || feeBps > 10_000) {
    throw new Error(
      "Marketplace fee basis points must be an integer between 0 and 10000.",
    );
  }

  return Number((BigInt(grossMinor) * BigInt(feeBps)) / 10_000n);
}

export function calculateProviderExpectedNetMinor(
  grossMinor: number,
  marketplaceFeeMinor: number,
): number {
  assertPositiveSafeInteger(grossMinor, "Gross amount");
  assertNonNegativeSafeInteger(marketplaceFeeMinor, "Marketplace fee");
  if (marketplaceFeeMinor > grossMinor) {
    throw new Error("Marketplace fee cannot exceed gross amount.");
  }
  return grossMinor - marketplaceFeeMinor;
}
