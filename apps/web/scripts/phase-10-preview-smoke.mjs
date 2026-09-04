const rawBaseUrl = process.env.PREVIEW_URL;
if (!rawBaseUrl) {
  throw new Error("PREVIEW_URL is required for the Phase 10 preview smoke test.");
}

const baseUrl = new URL(rawBaseUrl);
const routes = [
  "/health",
  "/",
  "/buscar",
  "/p/demo-proveedor/demo-revision-pc",
  "/manifest.webmanifest",
];

for (const route of routes) {
  const response = await fetch(new URL(route, baseUrl), {
    redirect: "follow",
    headers: { "User-Agent": "changas-phase10-preview-smoke" },
  });
  if (!response.ok) {
    throw new Error(`${route} returned HTTP ${response.status}`);
  }

  if (route === "/health") {
    const payload = await response.json();
    if (
      payload?.status !== "ok" ||
      payload?.service !== "changas-web" ||
      payload?.mode !== "liveness"
    ) {
      throw new Error(`/health returned an invalid liveness payload: ${JSON.stringify(payload)}`);
    }
  } else {
    const body = await response.text();
    if (body.length === 0) {
      throw new Error(`${route} returned an empty response body`);
    }
  }

  console.log(`preview smoke PASS ${route}`);
}
