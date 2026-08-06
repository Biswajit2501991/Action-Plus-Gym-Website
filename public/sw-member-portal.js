/* Action Plus Member Portal — Web Push service worker */
self.addEventListener("install", (event) => {
  event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener("push", (event) => {
  // iOS/Safari require a user-visible notification for every push while the app is closed.
  let data = {
    title: "Action Plus Gym",
    body: "You have a new notification.",
    url: "/members",
    tag: "member-portal",
  };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    try {
      if (event.data) {
        const text = event.data.text();
        if (text) data.body = text;
      }
    } catch {
      /* ignore */
    }
  }

  const title = data.title || "Action Plus Gym";
  const options = {
    body: data.body || "",
    icon: "/apg-icon-v3-192.png",
    badge: "/apg-icon-v3-192.png",
    data: { url: data.url || "/members" },
    tag: data.tag || "member-portal",
    renotify: true,
    // Helps Safari surface the alert when the Home Screen app is not open.
    requireInteraction: false,
  };

  event.waitUntil(
    self.registration.showNotification(title, options).catch(() => {
      // Never leave a push unhandled — Apple drops the subscription if we fail silently.
      return self.registration.showNotification("Action Plus Gym", {
        body: "Open Member Portal for details.",
        data: { url: "/members" },
        tag: "member-portal-fallback",
      });
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/members";
  event.waitUntil(
    clients.matchAll({ type: "window", includeUncontrolled: true }).then((list) => {
      for (const client of list) {
        if ("focus" in client && String(client.url || "").includes("/members")) {
          return client.focus();
        }
      }
      if (clients.openWindow) return clients.openWindow(url);
      return undefined;
    }),
  );
});
