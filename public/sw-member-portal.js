/* Action Plus Member Portal — Web Push service worker */
self.addEventListener("push", (event) => {
  let data = { title: "Action Plus Gym", body: "You have a new notification.", url: "/members" };
  try {
    if (event.data) data = { ...data, ...event.data.json() };
  } catch {
    /* ignore */
  }
  event.waitUntil(
    self.registration.showNotification(data.title || "Action Plus Gym", {
      body: data.body || "",
      icon: "/icon-192.png",
      data: { url: data.url || "/members" },
    }),
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();
  const url = (event.notification.data && event.notification.data.url) || "/members";
  event.waitUntil(clients.openWindow(url));
});
