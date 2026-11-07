// Central de Inventário — abre na hora com a cópia guardada (rápido e quase sem dados móveis)
// e confere por trás se o GitHub tem versão nova; se tiver, guarda e avisa o app (botão "Atualizar agora").
const CACHE = 'central-202611062341';
const LIBS = ["lib-xlsx-0.18.5.js", "lib-exceljs-4.4.0.js", "lib-html2canvas-1.4.1.js"];
const ARQUIVOS = ['./', './index.html', './manifest.webmanifest', './icone-ex-192.png', './icone-ex-512.png'].concat(LIBS.map(n=>'./' + n));
self.addEventListener('install', e=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(ARQUIVOS)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});
async function conferirNovaVersao(req, cache, guardado){
  try{
    const resp = await fetch(req, {cache:'no-cache'});   // pergunta ao GitHub; se não mudou, volta só um "304" pequeno
    if(!resp || !resp.ok) return;
    const novo = await resp.clone().text();
    const velho = guardado ? await guardado.clone().text() : '';
    if(novo === velho) return;
    await cache.put('./index.html', resp.clone()); await cache.put('./', resp);
    if(guardado) await cache.put('./__nova', new Response(String(Date.now())));
    if(guardado){ const cs = await self.clients.matchAll({type:'window'}); cs.forEach(c=>c.postMessage({tipo:'nova-versao'})); }
  }catch(e){}
}
self.addEventListener('fetch', e=>{
  const req = e.request, url = new URL(req.url);
  if(req.method !== 'GET' || url.origin !== location.origin) return;
  if(/\/__nova$/.test(url.pathname)){ e.respondWith(caches.open(CACHE).then(c=>c.match('./__nova')).then(r=>r || new Response('', {status:404}))); return; }
  const ehPagina = req.mode === 'navigate' || /\/(index\.html)?$/.test(url.pathname);
  e.respondWith((async()=>{
    const cache = await caches.open(CACHE);
    if(ehPagina){
      const guardado = await cache.match('./index.html');
      if(guardado) await cache.delete('./__nova');   // a tela que vai abrir já é a guardada mais nova
      const conferir = conferirNovaVersao(req, cache, guardado ? guardado.clone() : null);
      if(guardado){ e.waitUntil(conferir); return guardado; }
      await conferir;
      return (await cache.match('./index.html')) || fetch(req);
    }
    // bibliotecas e ícones: do cache (o nome muda quando a versão muda)
    const salvo = await cache.match(req, {ignoreSearch:true});
    if(salvo) return salvo;
    try{ const resp = await fetch(req); if(resp && resp.ok) cache.put(req, resp.clone()); return resp; }catch(err){ return Response.error(); }
  })());
});
