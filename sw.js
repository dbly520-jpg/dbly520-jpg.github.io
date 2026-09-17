// Service Worker - 嵌入式学习之旅
// 缓存版本号
const CACHE_VERSION = 'v1';
const STATIC_CACHE = `static-${CACHE_VERSION}`;
const DATA_CACHE = `data-${CACHE_VERSION}`;

// 核心静态资源列表（缓存优先）
const CORE_ASSETS = [
  './',
  './index.html',
  './week.html',
  './day.html',
  './css/style.css',
  './manifest.json',
  './js/data.js',
  './js/app.js',
  './js/progress.js',
  './js/notification.js',
  './js/quiz.js',
  './js/notes.js',
  './icons/icon-192.svg',
  './icons/icon-512.svg'
];

// 安装阶段：预缓存核心静态资源
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(STATIC_CACHE).then((cache) => {
      return cache.addAll(CORE_ASSETS).catch((err) => {
        // 单个资源缓存失败不影响整体安装
        console.warn('[SW] 部分核心资源预缓存失败:', err);
      });
    })
  );
  self.skipWaiting();
});

// 激活阶段：清理旧版本缓存
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys
          .filter((key) => key !== STATIC_CACHE && key !== DATA_CACHE)
          .map((key) => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

// 拦截请求，按资源类型采取不同缓存策略
self.addEventListener('fetch', (event) => {
  const request = event.request;

  // 仅处理同源 GET 请求
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);

  // 数据 JSON：网络优先策略（network-first）
  if (url.pathname.endsWith('.json') || url.pathname.includes('/data/')) {
    event.respondWith(
      fetch(request)
        .then((response) => {
          // 网络成功，更新缓存后返回
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(DATA_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // 网络失败，回退到缓存
          return caches.match(request);
        })
    );
    return;
  }

  // 静态资源：缓存优先策略（cache-first）
  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) {
        return cached;
      }
      // 缓存未命中，从网络获取并缓存
      return fetch(request)
        .then((response) => {
          if (response && response.status === 200 && response.type === 'basic') {
            const clone = response.clone();
            caches.open(STATIC_CACHE).then((cache) => cache.put(request, clone));
          }
          return response;
        })
        .catch(() => {
          // 离线回退到首页
          if (request.mode === 'navigate') {
            return caches.match('./index.html');
          }
        });
    })
  );
});
