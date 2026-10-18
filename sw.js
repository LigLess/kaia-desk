/* KAIA DESK service worker — 앱 화면을 저장해 두고 오프라인에서도 열리게 해요 */
const VER='kaia-desk-v20';
const SHELL=['./','./index.html','./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./icons/favicon-64.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(VER).then(c=>c.addAll(SHELL)).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET') return;
  if(u.hostname.includes('script.google')) return;            // 동기화 요청은 항상 네트워크로
  if(e.request.mode==='navigate'){                             // 화면: 새 버전 우선, 안 되면 저장본
    e.respondWith(fetch(e.request).then(r=>{ const cp=r.clone(); caches.open(VER).then(c=>c.put('./index.html',cp)); return r; }).catch(()=>caches.match('./index.html')));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{ if(r.ok&&(u.origin===location.origin||/cdnjs|jsdelivr|fonts\.g/.test(u.hostname))){ const cp=r.clone(); caches.open(VER).then(c=>c.put(e.request,cp)); } return r; })));
});
self.addEventListener('notificationclick',e=>{ e.notification.close(); e.waitUntil(self.clients.matchAll({type:'window'}).then(ws=>ws.length?ws[0].focus():self.clients.openWindow('./'))); });
