export function safeNextPath(
  value: FormDataEntryValue | string | null,
  fallback = "/account",
): string {
  const candidate = typeof value === "string" ? value : "";

  if (
    candidate.length === 0 ||
    !candidate.startsWith("/") ||
    candidate.startsWith("//") ||
    candidate.includes("\\") ||
    /[\u0000-\u001f\u007f]/.test(candidate)
  ) {
    return fallback;
  }

  return candidate;
}
