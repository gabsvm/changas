export type ClientError = Error & { digest?: string };

export type ClientErrorEvent = {
  level: "error";
  event: "ui_error";
  scope: "route" | "global";
  timestamp: string;
  error_name: string;
  digest: string | null;
};

export function buildClientErrorEvent(
  scope: ClientErrorEvent["scope"],
  error: ClientError,
  timestamp = new Date().toISOString(),
): ClientErrorEvent {
  return {
    level: "error",
    event: "ui_error",
    scope,
    timestamp,
    error_name: error.name || "Error",
    digest: error.digest ?? null,
  };
}

export function reportClientError(
  scope: ClientErrorEvent["scope"],
  error: ClientError,
): void {
  // Do not log error.message or stack here: both can contain user-controlled/PII data.
  console.error(JSON.stringify(buildClientErrorEvent(scope, error)));
}
