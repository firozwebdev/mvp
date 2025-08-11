// Service Worker for Real-Time Translation Chat MVP
const CACHE_NAME = "translation-chat-v1";
const STATIC_CACHE = "static-v1";
const DYNAMIC_CACHE = "dynamic-v1";

// Assets to cache immediately
const STATIC_ASSETS = [
  "/",
  "/index.html",
  "/src/main.js",
  "/src/App.vue",
  "/src/style.css",
];

// Install event - cache static assets
self.addEventListener("install", (event) => {
  console.log("🔧 Service Worker installing...");

  event.waitUntil(
    caches
      .open(STATIC_CACHE)
      .then((cache) => {
        console.log("📦 Caching static assets");
        return cache.addAll(STATIC_ASSETS);
      })
      .then(() => {
        console.log("✅ Static assets cached");
        return self.skipWaiting();
      })
      .catch((error) => {
        console.error("❌ Failed to cache static assets:", error);
      })
  );
});

// Activate event - clean up old caches
self.addEventListener("activate", (event) => {
  console.log("🚀 Service Worker activating...");

  event.waitUntil(
    caches
      .keys()
      .then((cacheNames) => {
        return Promise.all(
          cacheNames.map((cacheName) => {
            if (cacheName !== STATIC_CACHE && cacheName !== DYNAMIC_CACHE) {
              console.log("🗑️ Deleting old cache:", cacheName);
              return caches.delete(cacheName);
            }
          })
        );
      })
      .then(() => {
        console.log("✅ Service Worker activated");
        return self.clients.claim();
      })
  );
});

// Fetch event - serve from cache or network
self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Skip non-GET requests
  if (request.method !== "GET") {
    return;
  }

  // Skip non-cacheable requests (extensions, etc.)
  if (!isCacheableRequest(request)) {
    return;
  }

  // Skip WebSocket and Socket.io requests
  if (
    url.pathname.includes("socket.io") ||
    url.protocol === "ws:" ||
    url.protocol === "wss:"
  ) {
    return;
  }

  // Handle different types of requests
  if (STATIC_ASSETS.includes(url.pathname)) {
    // Static assets - cache first
    event.respondWith(cacheFirst(request));
  } else if (url.pathname.includes("/api/")) {
    // API requests - network first with cache fallback
    event.respondWith(networkFirst(request));
  } else {
    // Other requests - stale while revalidate
    event.respondWith(staleWhileRevalidate(request));
  }
});

// Cache strategies
async function cacheFirst(request) {
  try {
    const cachedResponse = await caches.match(request);
    if (cachedResponse) {
      return cachedResponse;
    }

    const networkResponse = await fetch(request);
    if (networkResponse.ok && isCacheableRequest(request)) {
      const cache = await caches.open(STATIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.error("Cache first strategy failed:", error);
    return new Response("Offline", { status: 503 });
  }
}

async function networkFirst(request) {
  try {
    const networkResponse = await fetch(request);

    if (networkResponse.ok && isCacheableRequest(request)) {
      const cache = await caches.open(DYNAMIC_CACHE);
      cache.put(request, networkResponse.clone());
    }

    return networkResponse;
  } catch (error) {
    console.log("Network failed, trying cache:", error);
    const cachedResponse = await caches.match(request);

    if (cachedResponse) {
      return cachedResponse;
    }

    return new Response("Offline", { status: 503 });
  }
}

async function staleWhileRevalidate(request) {
  const cache = await caches.open(DYNAMIC_CACHE);
  const cachedResponse = await cache.match(request);

  const networkResponsePromise = fetch(request)
    .then((response) => {
      if (response.ok && isCacheableRequest(request)) {
        cache.put(request, response.clone());
      }
      return response;
    })
    .catch(() => null);

  return cachedResponse || networkResponsePromise;
}

// Helper function to check if request can be cached
function isCacheableRequest(request) {
  const url = new URL(request.url);

  // Don't cache chrome-extension, moz-extension, or other browser extension schemes
  if (
    url.protocol === "chrome-extension:" ||
    url.protocol === "moz-extension:" ||
    url.protocol === "safari-extension:" ||
    url.protocol === "ms-browser-extension:"
  ) {
    return false;
  }

  // Only cache http/https requests
  return url.protocol === "http:" || url.protocol === "https:";
}

// Background sync for offline actions
self.addEventListener("sync", (event) => {
  console.log("🔄 Background sync triggered:", event.tag);

  if (event.tag === "translation-sync") {
    event.waitUntil(syncTranslations());
  }
});

async function syncTranslations() {
  try {
    // Get pending translations from IndexedDB
    const pendingTranslations = await getPendingTranslations();

    for (const translation of pendingTranslations) {
      try {
        await fetch("/api/translate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(translation),
        });

        // Remove from pending queue
        await removePendingTranslation(translation.id);
      } catch (error) {
        console.error("Failed to sync translation:", error);
      }
    }
  } catch (error) {
    console.error("Background sync failed:", error);
  }
}

// Placeholder functions for IndexedDB operations
async function getPendingTranslations() {
  // Implementation would use IndexedDB
  return [];
}

async function removePendingTranslation(id) {
  // Implementation would use IndexedDB
  console.log("Removing pending translation:", id);
}

// Push notifications
self.addEventListener("push", (event) => {
  console.log("📢 Push notification received");

  const options = {
    body: "New message in translation chat",
    icon: "/icon-192x192.png",
    badge: "/badge-72x72.png",
    vibrate: [100, 50, 100],
    data: {
      dateOfArrival: Date.now(),
      primaryKey: 1,
    },
    actions: [
      {
        action: "explore",
        title: "Open Chat",
        icon: "/icon-192x192.png",
      },
      {
        action: "close",
        title: "Close",
        icon: "/icon-192x192.png",
      },
    ],
  };

  event.waitUntil(
    self.registration.showNotification("Translation Chat", options)
  );
});

// Notification click handling
self.addEventListener("notificationclick", (event) => {
  console.log("🔔 Notification clicked:", event.action);

  event.notification.close();

  if (event.action === "explore") {
    event.waitUntil(clients.openWindow("/"));
  }
});

console.log("🔧 Service Worker loaded");
