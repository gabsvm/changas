export function safeNextPath(
  value: FormDataEntryValue | string | null,
  fallback = "/account",
): string {
  const candidate = typeof value === "string" ? value : "";

  if (
    candidate.length === 0 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\")
  ) {
    return fallback;
  }

  return candidate;
}
