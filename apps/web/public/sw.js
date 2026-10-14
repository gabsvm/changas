const STATIC_CACHE = "yalo-static-v5";
// P1-08: el worker nunca cachea HTML navegacional. `/` y `/buscar` son
// force-dynamic personalizadas (saludo/sesión); servirlas desde caché filtra
// la sesión anterior. Solo assets inmutables + `/offline` precacheado.
const IMAGE_CACHE = "yalo-images-v2";
const OFFLINE_URL = "/offline";
const STATIC_URLS = [
  OFFLINE_URL,
  "/manifest.webmanifest",
  "/icon-192.png",
  "/icon-512.png",
  "/icon-maskable-512.png",
  "/brand/yalo-symbol.svg",
  "/screenshots/inicio-390x844.png",
  "/screenshots/buscar-1280x720.png",
];
// Rutas con estado privado o autenticado: el worker nunca las lee ni las
// escribe en ninguna caché (ni siquiera como fallback).
const PRIVATE_ROOTS = ["/account", "/messages", "/jobs", "/provider", "/api"];
// Raíces first-party válidas como destino de una notificación. safeActionUrl
// las usa para validar el actionUrl del payload; sin esto el click revienta
// con ReferenceError.
const SAFE_ACTION_ROOTS = ["/messages", "/jobs", "/account", "/provider"];
const FALLBACK_PUSH_TITLE = "YALO";
const FALLBACK_PUSH_BODY = "Tenés una actualización importante.";
const FALLBACK_ACTION_URL = "/account/notifications";
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
            .filter((key) => key !== STATIC_CACHE && key !== IMAGE_CACHE)
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
      return caches.match("/icon-192.png");
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
    // P1-08: HTML navegacional siempre de red — `/` y `/buscar` son
    // force-dynamic por sesión y un `cache.put` filtraría al usuario
    // anterior tras logout. Sin red cae al shell `/offline` precacheado.
    if (isPrivatePath(url.pathname)) {
      return;
    }
    event.respondWith(fetch(request).catch(() => caches.match(OFFLINE_URL)));
    return;
  }

  if (isPrivatePath(url.pathname)) {
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
  let title = FALLBACK_PUSH_TITLE;
  let body = FALLBACK_PUSH_BODY;
  let actionUrl = FALLBACK_ACTION_URL;

  if (event.data) {
    try {
      const payload = event.data.json();
      if (payload && typeof payload === "object") {
        if (typeof payload.title === "string" && payload.title.trim() !== "") {
          title = payload.title;
        }
        if (typeof payload.body === "string" && payload.body.trim() !== "") {
          body = payload.body;
        }
        actionUrl = safeActionUrl(payload.actionUrl);
      }
    } catch {
      // Payload ilegible: se muestra el fallback genérico.
    }
  }

  event.waitUntil(
    self.registration.showNotification(title, {
      body,
      icon: "/icon-192.png",
      badge: "/icon-192.png",
      data: { actionUrl },
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
