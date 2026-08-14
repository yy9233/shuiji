/* 水机 · Service Worker
 * 策略：同源静态资源缓存优先 + 运行期缓存；跨域（高德 / kamero）一律走网络不缓存。
 * 注意：Service Worker 仅在 HTTPS（或 localhost）下生效。
 */
const CACHE = 'shuiji-v10';
const ASSETS = [
  './',
  './index.html',
  './cet4.txt',
  './cet46.txt',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];

/* 安装：预缓存核心文件 */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => c.addAll(ASSETS))
      .then(() => self.skipWaiting())
  );
});

/* 激活：清理旧版本缓存 */
self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

/* 请求：同源静态资源 → 缓存优先；跨域 → 只走网络 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // 高德/kamero 等跨域请求不干预
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      const copy = res.clone();
      caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      return res;
    }))
  );
});
