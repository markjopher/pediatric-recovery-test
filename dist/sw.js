const cacheName = "little-steps-v1";
const assets = ["./", "./index.html", "./app.js", "./engine.js", "./style.css",
  "./app.webmanifest", "./icon.svg", "./icon-192.png", "./icon-512.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(cacheName).then(cache => cache.addAll(assets)));
});
self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys
    .filter(key => key.startsWith("little-steps-") && key !== cacheName)
    .map(key => caches.delete(key)))));
});
self.addEventListener("fetch", event => {
  if (event.request.method !== "GET" || !assets.some(asset =>
    new URL(asset, self.registration.scope).href === event.request.url)) return;
  event.respondWith(caches.open(cacheName).then(async cache =>
    await cache.match(event.request) ?? fetch(event.request)));
});
self.addEventListener("notificationclick", event => {
  event.notification.close();
  event.waitUntil((async () => {
    const clients = await self.clients.matchAll({ type: "window", includeUncontrolled: true });
    const client = clients.find(window => window.url.startsWith(self.registration.scope));
    return client ? client.focus() : self.clients.openWindow(self.registration.scope);
  })());
});
