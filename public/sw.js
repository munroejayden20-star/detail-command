/* Detail Command service worker
 *
 * Handles:
 *  - "push" events → showNotification (the actual phone notification)
 *  - "notificationclick" → focuses an existing tab or opens a new one at linkUrl
 *  - basic install/activate lifecycle
 *
 * No offline caching here — that's a separate concern. Keep this small and
 * push-focused.
 */

const SW_VERSION = "1.0.0";

self.addEventListener("install", (event) => {
  // Take over from any prior version immediately on next reload
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

// No-op fetch handler — required for Chrome/Edge to consider the app
// installable. We don't cache; just pass through to the network.
self.addEventListener("fetch", () => {});

self.addEventListener("push", (event) => {
  let payload = {};
  try {
    payload = event.data ? event.data.json() : {};
  } catch (e) {
    payload = { title: "Detail Command", message: event.data ? event.data.text() : "" };
  }

  const title = payload.title || "Detail Command";
  const options = {
    body: payload.message || payload.body || "",
    icon: "/logo.svg",
    badge: "/favicon.svg",
    tag: payload.tag, // dedupe by tag — newer push with same tag replaces older
    data: {
      url: payload.linkUrl || payload.url || "/",
      notificationId: payload.notificationId,
    },
    requireInteraction: payload.requireInteraction === true,
    silent: payload.silent === true,
    timestamp: Date.now(),
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const targetUrl = event.notification.data?.url || "/";

  event.waitUntil(
    self.clients
      .matchAll({ type: "window", includeUncontrolled: true })
      .then((clients) => {
        // If we already have a tab open, focus it and route there
        for (const client of clients) {
          if ("focus" in client) {
            client.postMessage({ type: "navigate", url: targetUrl });
            return client.focus();
          }
        }
        // Otherwise open a new window
        if (self.clients.openWindow) {
          return self.clients.openWindow(targetUrl);
        }
      }),
  );
});
