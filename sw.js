const C="shop-v2", IMGC="shop-img-v1";
const LIBS=/^https:\/\/(www\.gstatic\.com\/firebasejs\/|fonts\.googleapis\.com\/|fonts\.gstatic\.com\/)/;
const PICS=/^https:\/\/(m\.media-amazon\.com|lh3\.googleusercontent\.com|store\.storeimages\.cdn-apple\.com|image\.coolblue\.nl)\//;
self.addEventListener("install",e=>{e.waitUntil(caches.open(C).then(c=>c.addAll(["/","/icon-192.png"])).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>{e.waitUntil(caches.keys().then(k=>Promise.all(k.filter(n=>n!==C&&n!==IMGC).map(n=>caches.delete(n)))).then(()=>self.clients.claim()))});
async function trim(){const c=await caches.open(IMGC),k=await c.keys();for(let i=0;i<k.length-300;i++)await c.delete(k[i])}
self.addEventListener("fetch",e=>{
  const r=e.request; if(r.method!=="GET")return;
  if(r.mode==="navigate"){e.respondWith(fetch(r).then(x=>{const c=x.clone();caches.open(C).then(y=>y.put("/",c));return x}).catch(()=>caches.match("/")));return}
  if(LIBS.test(r.url)){e.respondWith(caches.open(C).then(c=>c.match(r).then(h=>h||fetch(r).then(x=>{if(x.ok||x.type==="opaque")c.put(r,x.clone());return x}))));return}
  if(PICS.test(r.url)){e.respondWith(caches.open(IMGC).then(c=>c.match(r).then(h=>{const f=fetch(r).then(x=>{if(x.ok||x.type==="opaque"){c.put(r,x.clone());trim()}return x}).catch(()=>h);return h||f})));return}
});
