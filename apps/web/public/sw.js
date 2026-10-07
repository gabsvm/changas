const STATIC_CACHE = "changas-static-v3";
const RUNTIME_CACHE = "changas-pages-v1";
const IMAGE_CACHE = "changas-images-v1";
const OFFLINE_URL = "/offline";
const STATIC_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/screenshots/inicio-390x844.png",
  "/screenshots/buscar-1280x720.png",
];
// Rutas con estado privado o autenticado: el worker nunca las lee ni las
// escribe en ninguna caché (ni siquiera como fallback).
const PRIVATE_ROOTS = ["/account", "/messages", "/jobs", "/provider", "/api"];
// Únicas navegaciones públicas con revalidación en segundo plano.
const SWR_PATHS = new Set(["/", "/buscar", "/offline"]);
const RUNTIME_MAX_ENTRIES = 20;
const IMAGE_MAX_ENTRIES = 60;
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
            .filter(
              (key) =>
                key !== STATIC_CACHE &&
                key !== RUNTIME_CACHE &&
                key !== IMAGE_CACHE,
            )
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

function isPrivatePath(pathname) {
  return PRIVATE_ROOTS.some(
    (root) => pathname === root || pathname.startsWith(`${root}/`),
  );
}

function trimCache(cache, maxEntries) {
  return cache.keys().then((keys) => {
    if (keys.length <= maxEntries) return;
    return Promise.all(
      keys.slice(0, keys.length - maxEntries).map((key) => cache.delete(key)),
    );
  });
}

// Stale-while-revalidate para las páginas públicas listadas: responde al
// instante si hay copia y actualiza en segundo plano. Las navegaciones caen
// a /offline si no hay copia ni red.
function staleWhileRevalidate(request, { offlineFallback = false } = {}) {
  return caches.open(RUNTIME_CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    const network = fetch(request)
      .then(async (response) => {
        if (response.ok) {
          await cache.put(request, response.clone());
          await trimCache(cache, RUNTIME_MAX_ENTRIES);
        }
        return response;
      })
      .catch(() =>
        offlineFallback ? cached || caches.match(OFFLINE_URL) : cached,
      );
    return cached || network;
  });
}

// Cache-first solo para imágenes públicas (avatars y adjuntos se sirven por
// /api autenticado y quedan excluidos por isPrivatePath).
function cacheFirstImage(request) {
  return caches.open(IMAGE_CACHE).then(async (cache) => {
    const cached = await cache.match(request);
    if (cached) return cached;
    try {
      const response = await fetch(request);
      if (response.ok) {
        await cache.put(request, response.clone());
        await trimCache(cache, IMAGE_MAX_ENTRIES);
      }
      return response;
    } catch {
      return cache.match(STATIC_URLS[2]);
    }
  });
}

self.addEventListener("fetch", (event) => {
  const request = event.request;
  const url = new URL(request.url);

  if (request.method !== "GET" || url.origin !== self.location.origin) {
    return;
  }

  if (request.mode === "navigate") {
    if (isPrivatePath(url.pathname)) {
      return;
    }
    if (SWR_PATHS.has(url.pathname)) {
      event.respondWith(
        staleWhileRevalidate(request, { offlineFallback: true }),
      );
      return;
    }
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isPrivatePath(url.pathname)) {
    return;
  }

  if (SWR_PATHS.has(url.pathname)) {
    event.respondWith(staleWhileRevalidate(request));
    return;
  }

  if (request.destination === "image") {
    event.respondWith(cacheFirstImage(request));
    return;
  }

  const isImmutableStatic =
    url.pathname.startsWith("/_next/static/") ||
    url.pathname === "/icon-192.png" ||
    url.pathname === "/icon-512.png" ||
    url.pathname === "/icon-maskable-512.png";

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
      icon: "/icon-192.png",
      badge: "/icon-192.png",
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
