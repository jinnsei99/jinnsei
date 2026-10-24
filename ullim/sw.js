// 울림 스튜디오 서비스 워커: 한 번 열어 두면 인터넷이 없어도 열린다.
// 인터넷이 되면 언제나 새 파일을 먼저 받고(그래서 고친 내용이 바로 보인다), 안 되면 저장해 둔 것을 쓴다.
// 파일을 더하거나 빼면 CORE를 고치고 CACHE 숫자를 올린다.
const CACHE = 'ullim-v7';
const CORE = [
  "./",
  "./index.html",
  "./app.css",
  "./manifest.webmanifest",
  "./icons/favicon.svg",
  "./icons/favicon-32.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
  "./icons/apple-touch-icon.png",
  "./js/util.js",
  "./js/gestures.js",
  "./js/devices.js",
  "./js/dsp.js",
  "./js/instruments.js",
  "./js/effects.js",
  "./js/acoustic.js",
  "./js/model.js",
  "./js/media.js",
  "./js/content.js",
  "./js/templates.js",
  "./js/engine.js",
  "./js/export.js",
  "./js/store.js",
  "./js/mysounds.js",
  "./js/recorder.js",
  "./js/tools.js",
  "./js/ui-core.js",
  "./js/actions.js",
  "./js/ui-shell.js",
  "./js/ui-transport.js",
  "./js/ui-session.js",
  "./js/ui-mixer.js",
  "./js/ui-arrange.js",
  "./js/ui-clip.js",
  "./js/ui-steps.js",
  "./js/ui-devices.js",
  "./js/ui-shape.js",
  "./js/ui-audioedit.js",
  "./js/ui-browser.js",
  "./js/ui-keys.js",
  "./js/ui-pads.js",
  "./js/ui-start.js",
  "./js/input.js",
  "./js/main.js"
];

self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(CORE)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(key => key.startsWith('ullim-') && key !== CACHE).map(key => caches.delete(key))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  const scope = new URL(self.registration.scope);

  // 글꼴: 저장본을 먼저 쓰고 뒤에서 새로 받아 둔다
  if (url.hostname === 'fonts.googleapis.com' || url.hostname === 'fonts.gstatic.com') {
    event.respondWith(caches.open(CACHE).then(async cache => {
      const cached = await cache.match(request);
      const network = fetch(request).then(response => {
        if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
        return response;
      }).catch(() => cached);
      return cached || network;
    }));
    return;
  }
  // 이 앱 폴더 밖(같은 사이트의 다른 앱 포함)은 건드리지 않는다
  if (url.origin !== scope.origin || !url.pathname.startsWith(scope.pathname)) return;

  const key = request.mode === 'navigate' ? './index.html' : request;
  event.respondWith(
    fetch(request)
      .then(response => {
        if (response.ok) {
          const copy = response.clone();
          caches.open(CACHE).then(cache => cache.put(key, copy));
        }
        return response;
      })
      .catch(() => caches.match(key, { ignoreSearch: true }).then(hit => hit || caches.match(request, { ignoreSearch: true })))
  );
});
