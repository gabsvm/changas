export type HealthPayload = {
  status: "ok";
  service: "changas-web";
  timestamp: string;
};

export function getHealthPayload(
  timestamp = new Date().toISOString(),
): HealthPayload {
  return {
    status: "ok",
    service: "changas-web",
    timestamp,
  };
}
