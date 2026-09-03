const STATIC_CACHE = "changas-static-v2";
const OFFLINE_URL = "/offline";
const STATIC_URLS = [OFFLINE_URL, "/icon-192.svg", "/icon-512.svg"];
const SAFE_ACTION_ROOTS = ["/messages", "/jobs", "/account", "/provider"];

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => cache.addAll(STATIC_URLS)),
  );
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(
          keys
            .filter((key) => key !== STATIC_CACHE)
            .map((key) => caches.delete(key)),
        ),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener("message", (event) => {
  if (event.data?.type === "SKIP_WAITING") {
    self.skipWaiting();
  }
});

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  const isImmutableStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon-192.svg" ||
    url.pathname === "/icon-512.svg";

  if (!isImmutableStatic) {
    return;
  }

  event.respondWith(
    caches.open(STATIC_CACHE).then(async (cache) => {
      const cached = await cache.match(request);
      if (cached) return cached;

      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
      }
      return response;
    }),
  );
});

self.addEventListener("push", (event) => {
  event.waitUntil(
    self.registration.showNotification("Changas", {
      body: "Tenés una actualización importante.",
      icon: "/icon-192.svg",
      badge: "/icon-192.svg",
      data: { actionUrl: "/account/notifications" },
    }),
  );
});

function safeActionUrl(value) {
  if (
    typeof value !== "string" ||
    !value.startsWith("/") ||
    value.startsWith("//")
  ) {
    return "/account/notifications";
  }

  try {
    const parsed = new URL(value, self.location.origin);
    const allowed = SAFE_ACTION_ROOTS.some(
      (root) =>
        parsed.pathname === root || parsed.pathname.startsWith(`${root}/`),
    );
    return allowed
      ? `${parsed.pathname}${parsed.search}${parsed.hash}`
      : "/account/notifications";
  } catch {
    return "/account/notifications";
  }
}

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const actionUrl = safeActionUrl(event.notification.data?.actionUrl);

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then(async (windows) => {
        const matching = windows.find((client) => {
          try {
            return new URL(client.url).pathname === actionUrl;
          } catch {
            return false;
          }
        });

        if (matching) {
          await matching.focus();
          return;
        }

        await self.clients.openWindow(actionUrl);
      }),
  );
});
