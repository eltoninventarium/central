// Central de Inventário — funciona sem internet e se atualiza quando houver conexão
const CACHE = 'central-202610040820';
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone-192.png', './icone-512.png'];
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
// Rede primeiro (pega a versão nova), com limite de 4 s; sem internet usa a cópia salva
self.addEventListener('fetch', e=>{
  const req = e.request;
  if(req.method !== 'GET' || new URL(req.url).origin !== location.origin) return;
  e.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    try{
      const resp = await Promise.race([fetch(req), new Promise((_,rej)=>setTimeout(()=>rej(new Error('lento')), 4000))]);
      if(resp && resp.ok) cache.put(req, resp.clone());
      return resp;
    }catch(err){
      const salvo = await cache.match(req, {ignoreSearch:true}) || (req.mode==='navigate' ? await cache.match('./index.html') : null);
      return salvo || Response.error();
    }
  })());
});
