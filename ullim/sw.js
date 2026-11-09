// 울림 스튜디오는 https://jinnsei99.github.io/ullim/ 로 이사했다(2026-11-10).
// 이 파일은 옛 주소 /jinnsei/ullim/ 에 남아 있던 옛 서비스 워커를 대신한다.
// 옛 서비스 워커는 페이지를 열 때마다 sw.js가 바뀌었는지 확인하므로, 옛 주소를 한 번 열면 이 파일이 들어온다.
// 들어오면 ① 옛 주소 파일만 담긴 캐시를 지우고(새 주소의 캐시는 남긴다) ② 스스로 등록을 풀고
// ③ 열려 있던 옛 화면을 다시 불러서 이사 안내 페이지(→ 새 주소)로 보낸다.
// fetch 처리기가 없으므로, 들어온 순간부터 옛 화면을 저장본으로 보여 주지 않는다.
self.addEventListener('install', () => self.skipWaiting());

self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const here = self.registration.scope; // .../jinnsei/ullim/
    try {
      for (const name of await caches.keys()) {
        if (!name.startsWith('ullim-')) continue;
        const reqs = await (await caches.open(name)).keys();
        const inOld = r => r.url.startsWith(here);
        const otherSite = r => new URL(r.url).origin !== self.location.origin; // 글꼴 저장본
        if (reqs.some(inOld) && reqs.every(r => inOld(r) || otherSite(r))) await caches.delete(name);
      }
    } catch (e) { /* 캐시를 못 지워도 등록은 푼다 */ }
    try { await self.registration.unregister(); } catch (e) { /* 이미 풀렸으면 그대로 */ }
    const wins = await self.clients.matchAll({ type: 'window' });
    await Promise.all(wins.map(c => c.navigate(c.url).catch(() => null)));
  })());
});
