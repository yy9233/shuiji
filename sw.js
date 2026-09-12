/* 水机 · Service Worker
 * 策略：HTML 网络优先（改完代码立刻生效）；其它同源静态资源缓存优先；跨域一律不干预。
 * 更新提示：检测到新 SW 后由页面弹出「点此更新」，用户点击即 skipWaiting + reload。
 * 注意：Service Worker 仅在 HTTPS（或 localhost）下生效。
 */
const CACHE = 'shuiji-v11';
const ASSETS = [
  './index.html',
  './cet4.txt',
  './cet46.txt',
  './manifest.json',
  './icon-192.png',
  './icon-512.png'
];
/* HTML 统一用这一个 key，避免出现 './' 和 './index.html' 两条缓存 */
const INDEX = new URL('./index.html', self.location).href;

/* 安装：预缓存核心文件（逐个容错，单个 404 不会拖垮整个注册） */
self.addEventListener('install', e => {
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(a => c.add(a).catch(() => {}))))
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

/* 请求：HTML → 网络优先；其它同源资源 → 缓存优先；跨域 → 只走网络 */
self.addEventListener('fetch', e => {
  const req = e.request;
  if(req.method !== 'GET') return;
  const url = new URL(req.url);
  if(url.origin !== self.location.origin) return;   // 高德 / kamero / RSS 等跨域请求不干预

  /* HTML（含导航栏地址 /.）走网络优先：保证改完的代码能立刻被看到，离线时回退缓存 */
  const isHTML = req.mode === 'navigate' || url.pathname.endsWith('.html') || url.pathname.endsWith('/');
  if(isHTML){
    e.respondWith(
      fetch(req).then(res => {
        if(res && res.ok){
          const copy = res.clone();
          caches.open(CACHE).then(c => c.put(INDEX, copy)).catch(() => {});
        }
        return res;
      }).catch(() => caches.match(INDEX).then(h => h || caches.match('./')))
    );
    return;
  }

  /* 其它静态资源：缓存优先，未命中再走网络并回填 */
  e.respondWith(
    caches.match(req).then(hit => hit || fetch(req).then(res => {
      if(res && res.ok){
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(req, copy)).catch(() => {});
      }
      return res;
    }))
  );
});

/* 页面发来 SKIP_WAITING → 立刻接管，随后页面自行 reload */
self.addEventListener('message', e => {
  if(e.data && e.data.type === 'SKIP_WAITING') self.skipWaiting();
});
