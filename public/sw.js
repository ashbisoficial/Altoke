// Service worker mínimo: no cachea datos ni páginas dinámicas (todo sigue
// yendo a la red como siempre), solo guarda una pantalla de "sin conexión"
// para mostrarla si el usuario navega sin internet. Esto es lo que activa
// el botón "Instalar" del navegador — sin caché de datos que se pueda
// volver viejo.
const CACHE_NAME = "altoke-shell-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll([OFFLINE_URL])));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  if (event.request.mode === "navigate") {
    event.respondWith(fetch(event.request).catch(() => caches.match(OFFLINE_URL)));
  }
});
