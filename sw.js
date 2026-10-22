/* KAIA DESK service worker — 앱 화면을 저장해 두고 오프라인에서도 열리게 해요 */
const VER='kaia-desk-261022-1153';
const SHELL=['./manifest.webmanifest','./icons/icon-192.png','./icons/icon-512.png','./icons/apple-touch-icon.png','./icons/favicon-64.png'];
self.addEventListener('install',e=>{ e.waitUntil(caches.open(VER).then(c=>Promise.all([c.addAll(SHELL),fetch('./index.html',{cache:'no-store'}).then(r=>c.put('./index.html',r))])).then(()=>self.skipWaiting())); });
self.addEventListener('activate',e=>{ e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==VER).map(k=>caches.delete(k)))).then(()=>self.clients.claim())); });
self.addEventListener('fetch',e=>{
  const u=new URL(e.request.url);
  if(e.request.method!=='GET') return;
  if(u.hostname.includes('script.google')) return;            // 동기화 요청은 항상 네트워크로
  if(e.request.mode==='navigate'){                             // 화면: 새 버전 우선, 안 되면 저장본
    const key=/\/(index\.html)?$/.test(u.pathname)?'./index.html':u.pathname;   // 앱 · 견적서 · 가이드는 각자 따로 저장
    e.respondWith(fetch(u.origin+u.pathname+(u.search||''),{cache:'no-store',credentials:'same-origin'}).then(r=>{ if(r.ok){ const cp=r.clone(); caches.open(VER).then(c=>c.put(key,cp)); } return r; }).catch(()=>caches.match(key)));
    return;
  }
  e.respondWith(caches.match(e.request).then(hit=>hit||fetch(e.request).then(r=>{ if(r.ok&&(u.origin===location.origin||/cdnjs|jsdelivr|fonts\.g/.test(u.hostname))){ const cp=r.clone(); caches.open(VER).then(c=>c.put(e.request,cp)); } return r; })));
});
self.addEventListener('notificationclick',e=>{ e.notification.close(); const d=e.notification.data||null; e.waitUntil(self.clients.matchAll({type:'window',includeUncontrolled:true}).then(ws=>{ if(ws.length){ const w=ws[0]; if(d&&d.go){ try{ w.postMessage({type:'kaia-go',go:d.go,tab:d.tab||''}); }catch(x){} } return w.focus(); } return self.clients.openWindow(d&&d.go?'./#'+d.go:'./'); })); });
