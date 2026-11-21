/* 초록스탠드 서비스 워커 — 앱 설치와 오프라인 사용을 위한 파일
 *
 * - 페이지(index.html): 네트워크 우선. 인터넷이 되면 항상 최신 버전을 받고, 끊기면 저장해 둔 버전을 보여 줘요.
 * - 아이콘·이미지 같은 이 사이트 파일: 저장해 둔 것을 먼저 쓰고 뒤에서 새로 받아 둬요.
 * - 글꼴·Chart.js(CDN): 한 번 받으면 저장해 두고 오프라인에서도 써요.
 * - Firebase·YouTube 같은 실시간/외부 서비스: 저장하지 않고 항상 네트워크로만 요청해요.
 *
 * 사이트를 크게 고쳤을 때 이전 저장본을 확실히 비우고 싶으면 아래 VERSION 숫자를 올리세요.
 */
const VERSION = 'chorokstand-v1';
const CORE = ['./', './index.html', './manifest.json', './icon-192.png', './icon-512.png', './apple-touch-icon.png', './favicon.png'];
const CDN_HOSTS = ['cdn.jsdelivr.net', 'fonts.googleapis.com', 'fonts.gstatic.com', 'www.gstatic.com'];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(VERSION)
      .then(cache => Promise.all(CORE.map(url => cache.add(url).catch(() => null))))   // 파일 하나가 없어도 설치는 계속
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== VERSION).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', event => {
  const req = event.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);

  // 1) 페이지 이동: 네트워크 우선, 실패하면 저장본
  if (req.mode === 'navigate') {
    event.respondWith(
      fetch(req)
        .then(res => { const copy = res.clone(); caches.open(VERSION).then(c => c.put('./index.html', copy)); return res; })
        .catch(() => caches.match('./index.html').then(r => r || caches.match('./')))
    );
    return;
  }

  // 2) 이 사이트의 파일: 저장본 먼저, 뒤에서 갱신
  if (url.origin === self.location.origin) {
    event.respondWith(
      caches.match(req).then(cached => {
        const fresh = fetch(req).then(res => {
          if (res && res.ok) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
          return res;
        }).catch(() => cached);
        return cached || fresh;
      })
    );
    return;
  }

  // 3) 글꼴·Chart.js 같은 CDN: 저장본이 있으면 그걸 쓰고, 없으면 받아서 저장
  if (CDN_HOSTS.includes(url.hostname) && !url.pathname.includes('firebase')) {
    event.respondWith(
      caches.match(req).then(cached => cached || fetch(req).then(res => {
        if (res && (res.ok || res.type === 'opaque')) { const copy = res.clone(); caches.open(VERSION).then(c => c.put(req, copy)); }
        return res;
      }))
    );
  }
  // 4) 그 밖의 요청(Firebase, YouTube 등)은 서비스 워커가 손대지 않아요.
});
