import type { Instrumentation } from "next";

// Structured server-side error log so a digest shown to a user ("Referencia:")
// can be matched to a log line. Never log error.message or stacks: they can
// carry user-controlled or personal data.
export const onRequestError: Instrumentation.onRequestError = async (
  error,
  request,
  context,
) => {
  const err = error as Error & { digest?: string };
  console.error(
    JSON.stringify({
      level: "error",
      event: "server_request_error",
      timestamp: new Date().toISOString(),
      digest: err.digest ?? null,
      error_name: err.name || "Error",
      method: request.method,
      path: request.path.split("?")[0],
      route_path: context.routePath,
      route_type: context.routeType,
      router_kind: context.routerKind,
    }),
  );
};
