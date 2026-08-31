export type DistanceBucket =
  "UNDER_2_KM" | "KM_2_TO_5" | "KM_5_TO_10" | "KM_10_TO_25" | "OVER_25_KM";

export const distanceBucketLabels: Record<DistanceBucket, string> = {
  UNDER_2_KM: "A menos de 2 km",
  KM_2_TO_5: "A 2–5 km aprox.",
  KM_5_TO_10: "A 5–10 km aprox.",
  KM_10_TO_25: "A 10–25 km aprox.",
  OVER_25_KM: "A más de 25 km aprox.",
};

export function adjustedRating(
  observedAverage: number,
  observedCount: number,
  priorAverage: number,
  priorWeight: number,
): number {
  for (const value of [
    observedAverage,
    priorAverage,
    observedCount,
    priorWeight,
  ]) {
    if (!Number.isFinite(value))
      throw new Error("Rating inputs must be finite");
  }
  if (observedAverage < 0 || observedAverage > 5) {
    throw new Error("Observed average must be between 0 and 5");
  }
  if (priorAverage < 0 || priorAverage > 5) {
    throw new Error("Prior average must be between 0 and 5");
  }
  if (observedCount < 0 || !Number.isInteger(observedCount)) {
    throw new Error("Observed count must be a non-negative integer");
  }
  if (priorWeight <= 0) throw new Error("Prior weight must be positive");
  return (
    (observedAverage * observedCount + priorAverage * priorWeight) /
    (observedCount + priorWeight)
  );
}
