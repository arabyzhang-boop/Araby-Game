// Naval Chess — Service Worker
// 策略：
//   HTML/JS/CSS  → 网络优先（保证实时更新）
//   MP3/PNG 等媒体 → 缓存优先，后台更新（大文件秒加载）

const CACHE_NAME = 'naval-chess-v5';
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

// 安装：预缓存核心资源
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

// 接收消息
self.addEventListener('message', function(event) {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

// 激活：清理旧缓存，立即接管
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

// 请求：按文件类型分流策略
self.addEventListener('fetch', function(event) {
  if (event.request.method !== 'GET') return;
  var url = new URL(event.request.url);

  // 不拦截
  if (url.protocol === 'ws:' || url.protocol === 'wss:') return;
  if (/googletagmanager\.com|google-analytics\.com|analytics\.google\.com/.test(url.hostname)) return;

  var path = url.pathname.toLowerCase();

  // ── 媒体文件：缓存优先（大文件，极少变动） ──
  if (/\.(mp3|png|jpg|jpeg|gif|svg|ico|woff2?)$/i.test(path)) {
    event.respondWith(
      caches.match(event.request).then(function(cached) {
        if (cached) {
          // 后台静默更新缓存
          fetch(event.request).then(function(response) {
            if (response && response.status === 200) {
              caches.open(CACHE_NAME).then(function(cache) {
                cache.put(event.request, response);
              });
            }
          }).catch(function(){});
          return cached;
        }
        // 首次访问，无缓存则走网络
        return fetch(event.request).then(function(response) {
          if (response && response.status === 200) {
            var clone = response.clone();
            caches.open(CACHE_NAME).then(function(cache) {
              cache.put(event.request, clone);
            });
          }
          return response;
        }).catch(function() {
          return new Response('', { status: 408 });
        });
      })
    );
    return;
  }

  // ── HTML / JS / CSS / 其他：网络优先 ──
  event.respondWith(
    fetch(event.request).then(function(response) {
      if (response && response.status === 200) {
        var clone = response.clone();
        caches.open(CACHE_NAME).then(function(cache) {
          cache.put(event.request, clone);
        });
      }
      return response;
    }).catch(function() {
      return caches.match(event.request).then(function(cached) {
        if (cached) return cached;
        return new Response('', { status: 408 });
      });
    })
  );
});
