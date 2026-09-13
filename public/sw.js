// Service worker do portal do paciente.
//
// Regra de ouro: o nome do cache é versionado e todo cache que não seja o da
// versão atual é apagado no `activate`. Cache órfão é a causa nº1 de "o app
// não atualiza sozinho".
const CACHE_VERSION = "protocolopro-v1";
const OFFLINE_URL = "/offline.html";

self.addEventListener("install", (event) => {
  event.waitUntil(
    caches.open(CACHE_VERSION).then((cache) => cache.addAll([OFFLINE_URL]))
  );
  // Assume o controle sem esperar todas as abas fecharem.
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE_VERSION).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener("fetch", (event) => {
  const { request } = event;
  const url = new URL(request.url);

  // Só mexe em GET do próprio domínio. Nunca intercepta ações do servidor,
  // rotas de API, PDFs ou checkout — esses precisam sempre da rede.
  if (
    request.method !== "GET" ||
    url.origin !== self.location.origin ||
    url.pathname.startsWith("/api/") ||
    url.pathname.startsWith("/auth/")
  ) {
    return;
  }

  // Assets estáticos e imutáveis do build: stale-while-revalidate — responde
  // instantâneo do cache e atualiza em segundo plano.
  if (url.pathname.startsWith("/_next/static/")) {
    event.respondWith(
      caches.open(CACHE_VERSION).then(async (cache) => {
        const cached = await cache.match(request);
        const network = fetch(request)
          .then((response) => {
            if (response.ok) cache.put(request, response.clone());
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      })
    );
    return;
  }

  // Páginas do portal: network-first com fallback pro cache — o paciente
  // sempre vê o protocolo mais recente quando tem sinal, e continua vendo o
  // último protocolo baixado quando está sem internet.
  if (url.pathname.startsWith("/p/")) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone();
            caches.open(CACHE_VERSION).then((cache) => cache.put(request, copy));
          }
          return response;
        })
        .catch(async () => {
          const cached = await caches.match(request);
          return cached ?? caches.match(OFFLINE_URL);
        })
    );
  }
});
