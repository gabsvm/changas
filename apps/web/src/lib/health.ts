export type HealthPayload = {
  status: "ok";
  service: "changas-web";
  mode: "liveness";
  timestamp: string;
  revision: string | null;
  environment: "production" | "preview" | "development" | "unknown";
};

type HealthRuntime = {
  revision?: string;
  environment?: string;
};

function normalizeEnvironment(
  value: string | undefined,
): HealthPayload["environment"] {
  if (value === "production" || value === "preview" || value === "development") {
    return value;
  }
  return "unknown";
}

export function getHealthPayload(
  timestamp = new Date().toISOString(),
  runtime: HealthRuntime = {
    revision: process.env.VERCEL_GIT_COMMIT_SHA,
    environment: process.env.VERCEL_ENV,
  },
): HealthPayload {
  return {
    status: "ok",
    service: "changas-web",
    mode: "liveness",
    timestamp,
    revision: runtime.revision?.slice(0, 12) ?? null,
    environment: normalizeEnvironment(runtime.environment),
  };
}
