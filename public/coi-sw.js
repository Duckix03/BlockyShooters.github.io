/*
 * Service worker de isolamento cross-origin (COOP/COEP).
 * O GitHub Pages não permite configurar headers HTTP, então este SW intercepta
 * as respostas e injeta os headers. Com isso `crossOriginIsolated === true` e o
 * SharedArrayBuffer fica disponível para os Workers de física e IA.
 * Se o SW não puder ser registrado, o jogo cai no modo Transferable (mais lento, mas funciona).
 */
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (e) => e.waitUntil(self.clients.claim()));

self.addEventListener('fetch', (event) => {
  const req = event.request;
  // Requisições "only-if-cached" de outra origem quebram o fetch; ignora.
  if (req.cache === 'only-if-cached' && req.mode !== 'same-origin') return;

  event.respondWith(
    fetch(req).then((res) => {
      if (res.status === 0) return res; // resposta opaca: não dá pra mexer
      const headers = new Headers(res.headers);
      headers.set('Cross-Origin-Embedder-Policy', 'require-corp');
      headers.set('Cross-Origin-Opener-Policy', 'same-origin');
      headers.set('Cross-Origin-Resource-Policy', 'cross-origin');
      return new Response(res.body, { status: res.status, statusText: res.statusText, headers });
    }).catch((err) => {
      console.error('[coi-sw]', err);
      throw err;
    })
  );
});
