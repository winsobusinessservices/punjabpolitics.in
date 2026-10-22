// Service worker for browser notifications (the "Browser notification" channel of My interests).
// It only shows what the server pushes and opens the page when a notification is clicked.

self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", (event) => event.waitUntil(self.clients.claim()));

self.addEventListener("push", (event) => {
  let data = {};
  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = { title: "New update", body: event.data ? event.data.text() : "" };
  }
  const title = data.title || "New update";
  event.waitUntil(
    self.registration.showNotification(title, {
      body: data.body || "",
      icon: "/globe.svg",
      badge: "/globe.svg",
      data: { url: data.url || "/" },
    })
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const target = new URL((event.notification.data && event.notification.data.url) || "/", self.location.origin).href;
  event.waitUntil(
    self.clients.matchAll({ type: "window", includeUncontrolled: true }).then((windows) => {
      for (const client of windows) {
        if (client.url === target && "focus" in client) return client.focus();
      }
      return self.clients.openWindow(target);
    })
  );
});
