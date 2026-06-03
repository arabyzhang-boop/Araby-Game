// Naval Chess — Service Worker
// 策略：网络优先 + 缓存回退（确保用户始终获取最新版本）
// 在线：每次请求优先走网络，同时更新缓存
// 离线：回退到缓存

const CACHE_NAME = 'naval-chess-v3';
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

// 安装：预缓存核心资源作为离线兜底
self.addEventListener('install', function(event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function(cache) {
      return cache.addAll(PRECACHE_FILES).catch(function(err) {
        console.log('[SW] 预缓存部分失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// 接收主页面消息
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 激活：清理旧缓存，立即接管所有页面
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

// 请求：网络优先，失败时回退缓存
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  // 不拦截的协议和域名
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(url.hostname)) return;

  event.respondWith(
    fetch(event.request).then(function(response) {
      // 网络请求成功 — 更新缓存并返回
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      // 网络失败 — 尝试从缓存恢复
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        // 离线且无缓存时返回空响应
        return new Response('', { status: 408 });
      });
    })
  );
});
