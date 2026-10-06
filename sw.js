const CACHE_NAME = 'sekou2-app-v2.9.4';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './manifest.json',
  './version.json',
  './data/categories.json',
  './data/stages.json',
  './data/questions_1st.json',
  './data/questions_2nd.json',
  './data/essay_templates.json',
  './data/numbers_card.json',
  './data/terms_master.json',
  './qrcode_github.png'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(ASSETS);
    })
  );
  self.skipWaiting();
});

self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// アプリ本体からの更新指示
self.addEventListener('message', event => {
  if (event.data && event.data.action === 'skipWaiting') {
    self.skipWaiting();
  }
});

self.addEventListener('fetch', event => {
  // APIリクエストまたは version.json は常に最新をネットワークから取得
  if (event.request.url.includes('/api/') || event.request.url.includes('version.json')) {
    event.respondWith(
      fetch(event.request).catch(() => caches.match(event.request))
    );
    return;
  }

  // その他静的アセット：ネットワーク優先（更新があれば即保存）、オフライン時はキャッシュ
  event.respondWith(
    fetch(event.request)
      .then(response => {
        if (response && response.status === 200) {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        return caches.match(event.request);
      })
  );
});
