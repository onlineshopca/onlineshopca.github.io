// Nojan offline helper · v93
const C = "shop-v4", IMGC = "shop-img-v1";
const LIBS = /^https:\/\/www\.gstatic\.com\/firebasejs\//;
const OWN = new RegExp("^" + self.location.origin.replace(/[.]/g, "\\.") + "\\/(app\\.css|app\\.js|fb\\.js|i18n\\.js)\\?v=");
const PICS = /^https:\/\/(m\.media-amazon\.com|lh3\.googleusercontent\.com|store\.storeimages\.cdn-apple\.com|image\.coolblue\.nl)\//;
self.addEventListener("install", e => { e.waitUntil(caches.open(C).then(c => c.addAll(["/", "/icon-192.png"])).then(() => self.skipWaiting())); });
self.addEventListener("activate", e => { e.waitUntil(caches.keys().then(k => Promise.all(k.filter(n => n !== C && n !== IMGC).map(n => caches.delete(n)))).then(() => self.clients.claim())); });
async function trim(name, max){ const c = await caches.open(name), k = await c.keys(); for (let i = 0; i < k.length - max; i++) await c.delete(k[i]); }
self.addEventListener("fetch", e => {
  const r = e.request; if (r.method !== "GET") return;
  if (r.mode === "navigate"){
    e.respondWith(fetch(r.url, {cache: "no-cache", credentials: "same-origin"}).then(x => { if (x.ok){ const c = x.clone(); caches.open(C).then(y => y.put(r.url.split("#")[0], c)); } return x; })
      .catch(() => caches.match(r.url.split("#")[0]).then(h => h || caches.match("/"))));
    return;
  }
  if (OWN.test(r.url) || LIBS.test(r.url)){ e.respondWith(caches.open(C).then(c => c.match(r).then(h => h || fetch(r).then(x => { if (x.ok || x.type === "opaque"){ c.put(r, x.clone()); trim(C, 80); } return x; })))); return; }
  if (PICS.test(r.url)){ e.respondWith(caches.open(IMGC).then(c => c.match(r).then(h => { const f = fetch(r).then(x => { if (x.ok || x.type === "opaque"){ c.put(r, x.clone()); trim(IMGC, 300); } return x; }).catch(() => h); return h || f; }))); return; }
});
