// Naval Chess — Service Worker
// 缓存策略：安装时预缓存核心文件，请求时缓存优先

const CACHE_NAME = 'naval-chess-v2';
const PRECACHE_FILES = [
  './',
  'naval-chess.html',
  'naval-chess-styles.css',
  'naval-chess-config.js',
  'naval-chess-utils.js',
  'naval-chess-render.js',
  'naval-chess-ui.js',
  'naval-chess-combat.js',
  'naval-chess-actions.js',
  'naval-chess-fleet.js',
  'naval-chess-famous-ships.js',
  'naval-chess-ai.js',
  'naval-chess-campaign.js',
  'naval-chess-multiplayer.js',
  'naval-chess-main.js',
  'bgm1.mp3',
  'manifest.json'
];

// 安装：预缓存所有静态资源（不立即 skipWaiting，等用户确认更新）
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_FILES).catch(function(err) {
        console.log('[SW] 预缓存部分失败:', err);
      });
    })
  );
});

// 接收主页面消息
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 激活：清理旧缓存
self.addEventListener('activate', function(event) {
  event.waitUntil(
    caches.keys().then(function(names) {
      return Promise.all(
        names.filter(function(n) { return n !== CACHE_NAME; })
             .map(function(n) { return caches.delete(n); })
      );
    })
  );
  self.clients.claim();
});

// 请求：缓存优先，网络回退
self.addEventListener('fetch', function(event) {
  // 跳过 WebSocket 和非 GET 请求
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;

  event.respondWith(
    caches.match(event.request).then(function(cached) {
      if (cached) return cached;
      return fetch(event.request).then(function(response) {
        if (!response || response.status !== 200) return response;
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
        return response;
      }).catch(function() {
        // 离线且无缓存：返回空响应
        return new Response('', { status: 408 });
      });
    })
  );
});
