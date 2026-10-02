const rawBaseUrl = process.env.PREVIEW_URL;
if (!rawBaseUrl) {
  throw new Error(
    "PREVIEW_URL is required for the Phase 10 preview smoke test.",
  );
}

const baseUrl = new URL(rawBaseUrl);
// The smoke test must not depend on seeded content: the hosted database can be
// empty, so a missing public provider page is expected to be a clean 404.
const routes = [
  { path: "/health" },
  { path: "/" },
  { path: "/buscar" },
  { path: "/login" },
  { path: "/p/smoke-missing-provider/smoke-missing-service", status: 404 },
  { path: "/manifest.webmanifest" },
];

for (const { path: route, status: expectedStatus = 200 } of routes) {
  const response = await fetch(new URL(route, baseUrl), {
    redirect: "follow",
    headers: { "User-Agent": "changas-phase10-preview-smoke" },
  });
  if (response.status !== expectedStatus) {
    throw new Error(
      `${route} returned HTTP ${response.status}, expected ${expectedStatus}`,
    );
  }
  if (expectedStatus !== 200) {
    console.log(`preview smoke PASS ${route} (${expectedStatus})`);
    continue;
  }

  if (route === "/health") {
    const payload = await response.json();
    if (
      payload?.status !== "ok" ||
      payload?.service !== "changas-web" ||
      payload?.mode !== "liveness"
    ) {
      throw new Error(
        `/health returned an invalid liveness payload: ${JSON.stringify(payload)}`,
      );
    }
  } else {
    const body = await response.text();
    if (body.length === 0) {
      throw new Error(`${route} returned an empty response body`);
    }
  }

  console.log(`preview smoke PASS ${route}`);
}
