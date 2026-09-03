export type AdminRpcError = {
  code?: string | null;
  message?: string | null;
} | null;

export type AdminAccessState = "UNAUTHENTICATED" | "FORBIDDEN" | "ADMIN";

export function classifyAdminAccess(
  userId: string | null,
  isAdmin: boolean,
): AdminAccessState {
  if (!userId) return "UNAUTHENTICATED";
  return isAdmin ? "ADMIN" : "FORBIDDEN";
}

export type AdminUiErrorCode =
  "UNAUTHORIZED" | "FORBIDDEN" | "NOT_FOUND" | "CONFLICT" | "TRANSIENT";

export class AdminUiError extends Error {
  constructor(
    readonly code: AdminUiErrorCode,
    message: string,
  ) {
    super(message);
    this.name = "AdminUiError";
  }
}

export function mapAdminRpcError(error: AdminRpcError): AdminUiError {
  switch (error?.code) {
    case "42501":
      return new AdminUiError(
        "FORBIDDEN",
        "No tenés permisos administrativos para realizar esta operación.",
      );
    case "P0002":
      return new AdminUiError(
        "NOT_FOUND",
        "No encontramos el registro solicitado.",
      );
    case "22023":
    case "23505":
    case "23514":
    case "55000":
      return new AdminUiError(
        "CONFLICT",
        "La operación no cumple las reglas actuales del sistema.",
      );
    default:
      return new AdminUiError(
        "TRANSIENT",
        "No pudimos completar la operación administrativa.",
      );
  }
}
