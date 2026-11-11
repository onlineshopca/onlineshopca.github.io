// Nojan · v96 · built 2026-11-10
/* =========================================================
   SETTINGS — edit these
   ========================================================= */
const SHOP_EMAIL = "online.shop.on.ca@gmail.com";   // orders and messages are emailed here
const CONTACT_EMAIL = "info@nojans.com";   // v89: email shown to customers
const SELLING_ON = false;   // v89: "Sell on Nojan" is turned off for now (set to true to bring it back)
const HST_RATE = 0;   // v93: no HST is charged for now (set back to 0.13 to charge it)
const REG_TAX = 0.13;   // v93: regular (market) prices are shown with Ontario HST included (shown as an estimate)

/* PRODUCT LIST — your items live in ONE Google Sheet. The site, and your Facebook/Instagram catalog, read from it.
   In Google Sheets: File > Share > Publish to web > choose the sheet > "Comma-separated values (.csv)" > Publish,
   then paste that link below (looks like https://docs.google.com/spreadsheets/d/e/2PACX-.../pub?output=csv).
   Columns (Meta catalog format): id, title, description, availability, condition, price, sale_price, image_link, link, brand, instagram_link
     condition:     new  or  used          -> which tab the item shows in
     availability:  in stock  or  out of stock   -> "out of stock" hides the item (use it when sold)
     price:         25  or  25.00 CAD      sale_price (optional) shows the old price crossed out
     image_link:    a direct photo link; Google Drive share links work too */
const SHEET_URL = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRy8QCPb-TspUOliG93AD3DH2p7UP6SCc2GlaExkujBGM654zqI_I3YohhM78S6bnbacIQ818DSeX_m/pub?gid=1259420577&single=true&output=csv";

/* Instagram accounts linked on the Brand New and Used pages */
const FEEDS = {
  shop: { account: "nojan_ca" },
  new:  { account: "nojan_ca" },
  used: { account: "nojan_ca" },
};

/* SAMPLE ITEMS — shown only while SHEET_URL is empty or the sheet can't be reached.
   icon: drawing shown when there is no photo (lamp, chair, headphones, mug, book, bike, phone, jacket, box) */
const SAMPLE_PRODUCTS = [
  {id:"n1", name:"Wireless Over-Ear Headphones", price:59.99, was:79.99, condition:"new", icon:"headphones", desc:"Bluetooth 5.3, 30-hour battery, sealed box."},
  {id:"n2", name:"Ceramic Coffee Mug Set (4)", price:24.99, condition:"new", icon:"mug", desc:"12 oz, dishwasher safe, matte finish."},
  {id:"n3", name:"LED Desk Lamp with USB Port", price:32.50, was:39.99, condition:"new", icon:"lamp", desc:"3 brightness levels, adjustable arm."},
  {id:"n4", name:"Water-Resistant Rain Jacket", price:44.00, condition:"new", icon:"jacket", desc:"Sizes S–XL, packable hood."},
  {id:"n5", name:"Phone Stand & Charging Dock", price:18.99, condition:"new", icon:"phone", desc:"Fits most phones, non-slip base."},
  {id:"u1", name:"Wooden Dining Chair", price:22.00, condition:"used", icon:"chair", desc:"Solid wood, light wear on the legs. Pickup in Richmond Hill."},
  {id:"u2", name:"Hardcover Novel Bundle (6 books)", price:15.00, condition:"used", icon:"book", desc:"Good condition, no torn pages."},
  {id:"u3", name:"Adult Commuter Bike", price:120.00, was:180.00, condition:"used", icon:"bike", desc:"21 speeds, recently tuned, new tubes."},
  {id:"u4", name:"Floor Lamp", price:19.50, condition:"used", icon:"lamp", desc:"Works perfectly, small scratch on the base."},
  {id:"u5", name:"Smartphone, 128 GB (Unlocked)", price:189.00, condition:"used", icon:"phone", desc:"Battery health 88%, screen protector on."},
].map(p => ({...p, sample:true}));

let PRODUCTS = SAMPLE_PRODUCTS.slice();
const feedState = { new:"loading", used:"loading" };   // loading | live | sample
Object.defineProperty(feedState, "shop", {get(){ return feedState.new === "loading" && feedState.used === "loading" ? "loading" : feedState.new === "loading" ? feedState.used : feedState.new; }, enumerable: false});
/* v84: Brand New and Used share one Shop page. Nojan's own items count as certified; members' items only once Nojan certifies them. */
const inCond = (p, cond) => !cond || cond === "shop" || p.condition === cond;
const isCert = p => !p.member || !!p.certified;
const sellerOf = p => p.member ? (p.seller || "A member") : "Nojan";
/* v85: every item has a Nojan item ID (e.g. NJ-7K3QXM). Items listed with the same ID show as ONE ad with several offers. */
const ID_CHARS = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ", ID_RE = /^NJ-[A-Z0-9]{3,12}$/;
const normId = v => { let x = String(v || "").toUpperCase().replace(/[^A-Z0-9]/g, ""); if (x.startsWith("NJ")) x = x.slice(2); return x ? "NJ-" + x.slice(0, 12) : ""; };
const fallbackId = id => "NJ-" + String(id || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 8);
const idOf = p => !p ? "" : p.itemId || fallbackId(p.mid || String(p.pid || p.id).replace(/^[sm]-/, ""));
const isItem = p => p && (p.condition === "new" || p.condition === "used");
function knownIds(){
  const k = new Set(PRODUCTS.map(idOf));
  (typeof ALL_PRODUCTS !== "undefined" ? ALL_PRODUCTS : []).forEach(d => k.add(normId(d.itemId) || fallbackId(d.id)));
  if (typeof MK !== "undefined" && Array.isArray(MK.mine)) MK.mine.forEach(d => k.add(normId(d.itemId) || fallbackId(d.id)));
  return k;
}
function newItemId(){
  const k = knownIds(), r = new Uint32Array(8); let id;
  do { crypto.getRandomValues(r); id = "NJ-" + [...r].map(x => ID_CHARS[x % ID_CHARS.length]).join(""); } while (k.has(id));
  return id;
}
const offersOf = p => { if (!p) return []; const id = idOf(p), l = PRODUCTS.filter(x => idOf(x) === id && x.active !== false); return l.length ? l : [p]; };
const offerRank = (a, b) => ((a.soldOut ? 1 : 0) - (b.soldOut ? 1 : 0)) || ((a.price ?? 1e9) - (b.price ?? 1e9));
function groupList(list){   // one card per item ID; the card shows the best offer (in stock, then cheapest)
  const g = new Map();
  list.forEach(p => { const k = idOf(p); if (!g.has(k)) g.set(k, []); g.get(k).push(p); });
  return [...g.values()].map(l => l.length === 1 ? l[0] : l.slice().sort(offerRank)[0]);
}
function idSuggest(title, cur, self){   // existing items whose title looks like this one
  const tok = t => [...new Set(String(t || "").toLowerCase().split(/[^a-z0-9\u0600-\u06ff]+/).filter(w => w.length > 1))];
  const T = tok(title); if (T.length < 2) return [];
  return groupList(PRODUCTS.filter(isItem)).filter(p => idOf(p) !== cur && idOf(p) !== self).map(p => {
    const P = tok(p.name), hit = T.filter(w => P.includes(w)).length; return {p, hit, sc: hit / Math.max(T.length, P.length)}; })
    .filter(x => x.hit >= 2 && x.sc >= 0.45).sort((a, b) => b.sc - a.sc).slice(0, 3).map(x => x.p);
}
function idHintHTML(title, cur, self){
  const id = normId(cur), on = id && id !== self ? PRODUCTS.find(p => idOf(p) === id) : null;
  if (on){ const n = offersOf(on).length;
    return `<div class="idm"><span>✓ Joins the ad for <b>${esc(on.name)}</b> (${n} offer${n === 1 ? "" : "s"} now).</span><button type="button" class="linkbtn" data-newid>Use a new ID instead</button></div>`; }
  const S = idSuggest(title, id, self);
  return S.length ? `<span>Selling one of these? Use its ID so it shows under the same ad:</span>${S.map(p => `<div class="idm"><code class="idcode">${esc(idOf(p))}</code><span>${esc(p.name)} · ${offersOf(p).length} offer${offersOf(p).length === 1 ? "" : "s"}</span><button type="button" class="linkbtn" data-useid="${esc(idOf(p))}">Use this ID</button></div>`).join("")}` : "";
}
function offersHTML(p){
  const all = offersOf(p).slice().sort(offerRank); if (all.length < 2) return "";
  const row = o => { const img = o.member ? o.thumb : imagesOf(o)[0], here = o.id === p.id;
    return `<a class="offerrow${here ? " here" : ""}" href="#item-${esc(o.id)}">${img ? `<img src="${esc(img)}" alt="">` : `<span class="noimg"></span>`}
      <span><b>${o.condition === "new" ? "Brand new" : "Used" + (o.grade ? " · " + esc(o.grade) : "")}${here ? " · you're viewing this one" : ""}</b><small>Sold by ${esc(sellerOf(o))}${isCert(o) ? " · Certified" : ""}${o.member && o.city ? " · " + esc(o.city) : ""}${o.soldOut ? " · Sold out" : ""}</small></span>
      <span class="op">${o.price == null ? "Ask" : money(o.price)}</span></a>`; };
  return `<section class="offers" id="offers"><h2>${all.length} offers for this item</h2><p>Same item, ID <code class="idcode">${esc(idOf(p))}</code>, from different sellers.</p>${all.map(row).join("")}</section>`;
}
function itemIdLine(p){
  return `<p class="itemid">Nojan item ID <code>${esc(idOf(p))}</code><button type="button" class="linkbtn" data-copyid="${esc(idOf(p))}">Copy</button>${!SELLING_ON || (USER && p.uid === USER.uid) ? "" : `<button type="button" class="linkbtn" data-mklike="${esc(p.id)}">Sell one like this</button>`}</p>`;
}

/* Read the Google Sheet */
function parseCSV(text){
  const rows = []; let row = [], f = "", q = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i];
    if (q){ if (c === '"'){ if (text[i+1] === '"'){ f += '"'; i++; } else q = false; } else f += c; }
    else if (c === '"') q = true;
    else if (c === ","){ row.push(f); f = ""; }
    else if (c === "\n" || c === "\r"){ if (c === "\r" && text[i+1] === "\n") i++; row.push(f); rows.push(row); row = []; f = ""; }
    else f += c;
  }
  if (f !== "" || row.length){ row.push(f); rows.push(row); }
  return rows.filter(r => r.some(x => x.trim() !== ""));
}
const num = v => { const m = String(v || "").replace(/,/g, "").match(/\d+(?:\.\d+)?/); return m ? parseFloat(m[0]) : null; };
function photoURL(u){
  u = (u || "").trim();
  const m = u.match(/drive\.google\.com\/(?:file\/d\/|open\?id=|uc\?(?:export=\w+&)?id=)([\w-]+)/);
  return m ? `https://lh3.googleusercontent.com/d/${m[1]}` : u;
}
function rowToItem(r, i){
  const cond = /^(used|refurbished)/i.test(r.condition || "") ? "used" : /^new/i.test(r.condition || "") ? "new" : null;
  if (!cond || !(r.title || "").trim()) return null;
  if (/out of stock|sold/i.test(r.availability || "")) return null;
  const price = num(r.price), sale = num(r.sale_price);
  const onSale = sale != null && price != null && sale < price;
  return { id: "s-" + ((r.id || "").trim() || i), name: r.title.trim(), desc: (r.description || "").trim(), brand: (r.brand || "").trim(),
    price: onSale ? sale : price, was: onSale ? price : undefined, condition: cond,
    images: [r.image_link, ...String(r.additional_image_link || "").split(/[\s,]+/)].map(photoURL).filter(Boolean).slice(0, 5),
    link: (r.instagram_link || "").trim() || undefined,
    type: (r.product_type || "").split(">").pop().trim() || guessType(r.title + " " + (r.brand || "")), grade: "" };
}
/* Product types: set in Admin; older items get one guessed from their name */
const TYPE_RULES = [   /* v60: first match wins, so the more specific shelves come first */
  ["Fragrances", /eau de|parfum|cologne|fragrance|perfume/i],
  ["Jewelry & gifts", /swarovski|crystal|pendant|necklace|jewel|bracelet|earring|figurine|ornament/i],
  ["Personal care & grooming", /shaver|trimmer|razor|epilator|hair ?dryer|supersonic|straightener|curling|toothbrush|oral-b|sonicare|waterpik|braun series/i],
  ["Health & fitness", /massage gun|percussion|fitness tracker|fitbit|body composition|smart scale|\bscale\b|sauna suit|twister bar|exerciser|dumbbell|kettlebell|treadmill|yoga|brain sensing|muse 2/i],
  ["Headphones & audio", /headphone|earbud|earphone|airpods|powerbeats|headset|speakerphone|speaker|soundbar/i],
  ["Computers & office", /laptop|macbook|computer|monitor|keyboard|mouse|webcam|power strip|desktop charger|usb hub|printer/i],
  ["Cameras & photo", /\blens\b|camera|microphone|lavalier|\bmic\b|tripod|gimbal/i],
  ["Phones, tablets & e-readers", /iphone|ipad|galaxy|tablet|\bphone\b|kindle|e-?reader/i],
  ["TVs", /\btv\b|television/i],
  ["Kitchen & cooking", /air ?fryer|\boven\b|toaster|kettle|blender|food processor|nutri|juic|coffee|espresso|nespresso|keurig|microwave|sodastream|sparkling water|grill|smoker|griddle|cookware|\bpan\b|mixer|cooker/i],
  ["Air purifiers & humidifiers", /purifier|humidifier|\bfan\b|heater/i],
  ["Home & cleaning", /vacuum|\bmop\b|spot cleaner|carpet|upholstery|steam iron|\biron\b|picture frame|\blamp\b/i],
  ["Clothing & shoes", /\bshoe|sneaker|\bboots?\b|jacket|\bcoat\b|hoodie|pants|shirt|dress\b/i],
  ["Sports & outdoors", /\bbike\b|bicycle|scooter|badminton|racquet|racket|tennis|golf|camping|swiss army|multi-?tool/i],
  ["Toys, games & LEGO", /lego|\btoy|\bgame\b|console|playstation|xbox|nintendo|puzzle|speed cube|starry night/i],
  ["Furniture", /chair|\btable\b|\bdesk\b|sofa|couch|shelf|dresser|\bbed\b/i],
  ["Books", /\bbooks?\b|novel/i]
];
const TYPE_LIST = TYPE_RULES.map(r => r[0]);
function fixType(saved, guess){ return !saved || !TYPE_LIST.includes(saved) ? guess : saved; }   // v60: types from the old list are re-sorted into the new shelves   // older saves guessed "Furniture" for purifiers
function guessType(name){ const r = TYPE_RULES.find(([, re]) => re.test(name || "")); return r ? r[0] : "Other"; }
const GRADES = ["Like new", "Good", "Fair"];
async function loadSheet(){
  if (!SHEET_URL){ feedState.new = feedState.used = "sample"; return; }
  try {
    const res = await fetch(SHEET_URL + "&t=" + Date.now(), {cache: "no-store"});
    if (!res.ok) throw 0;
    const rows = parseCSV(await res.text());
    const head = rows.shift().map(h => h.trim().toLowerCase().replace(/\s+/g, "_"));
    const items = rows.map(r => Object.fromEntries(head.map((h, j) => [h, r[j] || ""]))).map(rowToItem).filter(Boolean);
    PRODUCTS = items; if (typeof mkMerge === "function") mkMerge();
    feedState.new = feedState.used = "live";
  } catch(_) { feedState.new = feedState.used = "sample"; }
}
/* Products from the site database (managed on the Admin page) */
let ALL_PRODUCTS = [], productSource = "loading";   // loading | db | sheet
function fsToItem(d){
  const price = d.price == null ? null : +d.price, sale = d.salePrice == null || d.salePrice === "" ? null : +d.salePrice;
  const onSale = sale != null && price != null && sale < price;
  const stock = Math.max(0, parseInt(d.stock, 10) || 0);
  return { id: "s-" + d.id, pid: d.id, itemId: normId(d.itemId) || fallbackId(d.id), name: d.title || "", desc: d.description || "", brand: d.brand || "",
    price: onSale ? sale : price, was: onSale ? price : undefined, condition: d.condition === "used" ? "used" : "new",
    images: (d.images || []).slice(0, 5), thumb: d.thumb || "", stock, soldOut: stock <= 0, active: d.active !== false,
    order: d.order || 0, added: tsMs(d.createdAt), type: fixType((d.type || "").trim(), guessType((d.title || "") + " " + (d.brand || ""))), grade: d.condition === "used" ? (d.grade || "") : "" };
}
function useProducts(list){
  ALL_PRODUCTS = list;
  const act98 = list.map(fsToItem).filter(p => p.active);
  SOLD = act98.filter(p => p.soldOut);   // v98: sold items are off the shop
  PRODUCTS = act98.filter(p => !p.soldOut).sort((a,b) => (a.order - b.order) || a.pid.localeCompare(b.pid));
  productSource = "db"; feedState.new = feedState.used = "live"; mkMerge();
  Object.keys(cart).forEach(id => { const p = PRODUCTS.find(x=>x.id===id); if (p) cart[id].snap = p; });
  saveCart();
}
let SOLD = [];
const stockOf = id => { const p = PRODUCTS.find(x => x.id === id); return p && p.stock != null ? p.stock : SOLD.some(x => x.id === id) ? 0 : Infinity; };

/* ========================================================= */
const ICONS = {
  headphones:'<path d="M14 40v-6a18 18 0 0 1 36 0v6"/><rect x="10" y="38" width="10" height="16" rx="3"/><rect x="44" y="38" width="10" height="16" rx="3"/>',
  mug:'<path d="M14 20h30v26a8 8 0 0 1-8 8H22a8 8 0 0 1-8-8z"/><path d="M44 26h4a6 6 0 0 1 0 12h-4"/>',
  lamp:'<path d="M22 12h20l6 18H16z"/><path d="M32 30v20"/><path d="M20 54h24"/>',
  jacket:'<path d="M24 10l8 6 8-6 12 8-4 10-4-2v28H20V26l-4 2-4-10z"/><path d="M32 16v38"/>',
  phone:'<rect x="20" y="8" width="24" height="48" rx="4"/><path d="M29 50h6"/>',
  chair:'<path d="M20 8v28h24V8"/><path d="M18 36h28"/><path d="M20 36v20M44 36v20"/><path d="M20 16h24"/>',
  book:'<path d="M12 14h16a4 4 0 0 1 4 4v34a4 4 0 0 0-4-4H12z"/><path d="M52 14H36a4 4 0 0 0-4 4v34a4 4 0 0 1 4-4h16z"/>',
  bike:'<circle cx="16" cy="42" r="10"/><circle cx="48" cy="42" r="10"/><path d="M16 42l10-18h14l8 18M26 24l8 18h-18M38 18h6"/>',
  box:'<path d="M10 20l22-10 22 10v26L32 56 10 46z"/><path d="M10 20l22 10 22-10M32 30v26"/>'
};
const $ = s => document.querySelector(s);
const money = n => "$" + n.toFixed(2);
const esc = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
/* Photos: web links, or "img:<id>" for photos uploaded in Admin (kept in the database, loaded when needed) */
const IMG = {}, IMG_PENDING = {};
const BLANK = "data:image/gif;base64,R0lGODlhAQABAIAAAP///wAAACH5BAEAAAAALAAAAAABAAEAAAICRAEAOw==";
const refsOf = p => (p.images && p.images.length) ? p.images : (p.image ? [p.image] : []);
/* v58: ask image hosts for a phone-sized copy instead of the full-size original */
function sizeImg(u, w){
  try {
    const x = String(u);
    if (/^https:\/\/m\.media-amazon\.com\//.test(x)) return x.replace(/\._[^/]*_\.(jpg|jpeg|png|webp)$/i, `._AC_SL${w}_.$1`);
    if (/^https:\/\/lh3\.googleusercontent\.com\/d\/[^=?]+$/.test(x)) return x + `=w${w}`;
    if (/^https:\/\/store\.storeimages\.cdn-apple\.com\//.test(x)){ const q = new URL(x); q.searchParams.set("wid", w); q.searchParams.set("hei", w); return q.href; }
    if (/^https:\/\/image\.coolblue\.nl\/max\/\d+xauto\//.test(x)) return x.replace(/\/max\/\d+xauto\//, `/max/${w}xauto/`);
    return x;
  } catch (e) { return u; }
}
const IMGDB = (() => {   // v92: small IndexedDB store for product photos kept in the database
  let p;
  const open = () => p || (p = new Promise((res, rej) => { try { const r = indexedDB.open("nojan", 1); r.onupgradeneeded = () => r.result.createObjectStore("img"); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); } catch (e){ rej(e); } }));
  return {
    get: id => open().then(db => new Promise(res => { try { const q = db.transaction("img").objectStore("img").get(id); q.onsuccess = () => res(q.result || null); q.onerror = () => res(null); } catch (_) { res(null); } })).catch(() => null),
    put: (id, v) => open().then(db => { try { db.transaction("img", "readwrite").objectStore("img").put(v, id); } catch (_) {} }).catch(() => {})
  };
})();
function imgSrc(ref, p, i){
  if (!String(ref).startsWith("img:")) return sizeImg(ref, 800);
  const id = ref.slice(4);
  if (IMG[id]) return IMG[id];
  if (!IMG_PENDING[id]){   // v92: photos are saved in the browser after the first download
    IMG_PENDING[id] = 1;
    const show = d => { IMG[id] = d; document.querySelectorAll(`img[data-ref="img:${CSS.escape(id)}"]`).forEach(el => el.src = d); };
    IMGDB.get(id).then(d => {
      if (d) return show(d);
      if (!FB){ delete IMG_PENDING[id]; return; }
      return FB.getImage(id).then(d => { if (!d) return; show(d); IMGDB.put(id, d); });
    }).catch(() => { delete IMG_PENDING[id]; });
  }
  return (i === 0 && p && p.thumb) ? p.thumb : BLANK;
}
const imagesOf = p => refsOf(p).map((r, i) => imgSrc(r, p, i));
function picHTML(p, gallery){
  const imgs = imagesOf(p), refs = refsOf(p);
  if (imgs.length && gallery && imgs.length > 1) return `<div class="pic gal" data-gal="${esc(p.id)}" data-i="0">
    <img src="${esc(imgs[0])}" data-ref="${esc(refs[0])}" alt="${esc(p.name)}, photo 1 of ${imgs.length}" loading="lazy">
    <button type="button" class="gnav gprev" data-gstep="-1" aria-label="Previous photo">‹</button>
    <button type="button" class="gnav gnext" data-gstep="1" aria-label="Next photo">›</button>
    <div class="gdots" aria-hidden="true">${imgs.map((_, i) => `<span${i ? "" : ' class="on"'}></span>`).join("")}</div>
  </div>`;
  if (imgs.length) return `<div class="pic"><img src="${esc(imgs[0])}" data-ref="${esc(refs[0])}" alt="${esc(p.name)}" loading="lazy"></div>`;
  const c = p.condition === "used" ? "var(--used)" : "var(--new)";
  return `<div class="pic" aria-hidden="true"><svg viewBox="0 0 64 64" fill="none" stroke="${c}" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round">${ICONS[p.icon]||ICONS.box}</svg></div>`;
}
function priceHTML(p){
  if (p.price == null) return `<div class="price" style="font-size:1rem">Price on request</div>`;
  const [d,c] = p.price.toFixed(2).split(".");
  return `<div class="price"><sup>$</sup>${d}<sup>${c}</sup>${p.was?`<span class="was">${money(p.was)}</span>`:""}</div>`;
}

/* Cart (kept in this browser) */
let cart = {};
try { cart = JSON.parse(localStorage.getItem("shopCart2") || "{}") || {}; } catch(e) { cart = {}; }
function saveCart(){ try { localStorage.setItem("shopCart2", JSON.stringify(cart)); } catch(e){} updateCount(); }
function cartItems(){ return Object.entries(cart).map(([id,c]) => ({p:PRODUCTS.find(x=>x.id===id) || c.snap, q:c.q})).filter(x=>x.p && x.q>0); }
function updateCount(){ const n = cartItems().reduce((a,x)=>a+x.q,0); $("#cartCount").textContent = n;
  { const bt = $("#bagTxt"); if (bt) bt.textContent = n ? `${n} item${n === 1 ? "" : "s"} in your bag · ${money(totals().sub)}` : "Your bag is empty"; } document.querySelectorAll("[data-cartnum]").forEach(el=>{ el.textContent=n; el.toggleAttribute("data-zero", n===0); }); }
function totals(){ const it = cartItems(); const sub = it.reduce((a,x)=>a+(x.p.price||0)*x.q,0); const tax = sub*HST_RATE; const unpriced = it.filter(x=>x.p.price==null).length; return {sub,tax,total:sub+tax,unpriced}; }
const lineTotal = (p,q) => p.price==null ? "Price on request" : money(p.price*q);
const unpricedNote = t => t.unpriced ? `<p class="note">${t.unpriced} item${t.unpriced>1?"s are":" is"} priced on request and not included in the total.</p>` : "";
const TRASH = '<svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/></svg>';
const qtyOf = id => (cart[id] && cart[id].q) || 0;
function cardAction(id){
  if (String(id).startsWith("m-")) return `<a class="btn small addbtn" href="#item-${esc(id)}">View</a>`;
  const q = qtyOf(id);
  if (stockOf(id) <= 0) return `<button class="btn small addbtn" type="button" disabled>Sold out</button>`;
  if (!q) return `<button class="btn small addbtn" type="button" data-add="${id}">Add</button>`;
  return `<div class="stepper" role="group" aria-label="Quantity in cart">
    <button type="button" data-dec="${id}" class="${q===1?"del":""}" aria-label="${q===1?"Remove from cart":"Decrease quantity"}">${q===1?TRASH:"−"}</button>
    <span aria-live="polite"><b>${q}</b></span>
    <button type="button" data-inc="${id}" aria-label="Increase quantity">+</button>
  </div>`;
}
function refreshCards(id, focusKind){
  document.querySelectorAll(`[data-act="${CSS.escape(id)}"]`).forEach(el => {
    const hadFocus = el.contains(document.activeElement);
    el.innerHTML = cardAction(id);
    if (hadFocus){
      const t = el.querySelector(`[data-${focusKind}]`) || el.querySelector("[data-inc]") || el.querySelector("[data-add]");
      t && t.focus();
    }
  });
}
function addToCart(id){ const p = PRODUCTS.find(x=>x.id===id); if (!p || p.member) return; const q = (cart[id]&&cart[id].q)||0;
  if (q >= stockOf(id)){ toast(stockOf(id) <= 0 ? "Sorry, this item is sold out" : `Only ${stockOf(id)} available`); return; }
  cart[id] = {q:q+1, snap:p}; saveCart(); toast("Added to cart"); }
function toast(t){ const el=$("#toast"); el.textContent=t; el.hidden=false; clearTimeout(toast._t); toast._t=setTimeout(()=>el.hidden=true,1800); }

function withHST(v){ return Math.round(v * (1 + REG_TAX) * 100) / 100; }
function saveHST(p){ if (!(p.was && p.price != null)) return 0; const v = Math.round((withHST(p.was) - p.price) * 100) / 100; return v > 0 ? v : 0; }
function stockTxt(p){
  if (p.stock != null && p.stock <= 0) return `<b class="sout">Sold out</b>`;
  return "";
}
function stockNote(p){
  if (p.stock == null) return "";
  if (p.stock <= 0) return `<span class="stocknote out">Sold out</span>`;
  return `<span class="stocknote">${p.stock} in stock</span>`;
}
let query = "";
function productGrid(list, opts){
  if (!list.length) return query.trim() ? `<div class="empty">No items match “${esc(query)}”. Try another word.</div>` : `<div class="empty">New items are added often. Check back soon.</div>`;
  return `<div class="grid">${productCards(list, opts)}</div>`;
}
function cardTag(p){
  if (p.stock != null && p.stock <= 0) return ["Sold out", "out"];
  if (p.condition === "used" && p.grade) return [p.grade, ""];
  if (p.stock != null && p.stock <= 3 && !(p.was && p.price != null)) return [`Only ${p.stock} left`, ""];
  if (p.was && p.price != null) return [p.stock === 1 ? "Only 1 left" : "Save " + money(p.was - p.price), ""];
  if (p.stock === 1) return ["Only 1 left", ""];
  return [p.condition === "new" ? "Brand new" : "Used", ""];
}
function productCards(list, opts){
  const showBrand = opts && opts.brand;
  return groupList(list).map(p => { const [tg, tc] = cardTag(p), O = offersOf(p), many = O.length > 1;
    const lo = many ? O.filter(o => !o.soldOut && o.price != null).reduce((m, o) => Math.min(m, o.price), Infinity) : null;
    const h = many ? O.find(o => !o.member) || O.slice().sort((a, b) => b.order - a.order)[0] : p; return `
    <article class="card">
      <a class="piclink tile" href="#item-${esc(p.id)}" aria-label="View ${esc(h.name)}">${!many && saveHST(p) > 0 ? `<span class="pctpill">${Math.round(saveHST(p) / withHST(p.was) * 100)}% off</span>` : ""}${picHTML(h, false)}</a>
      <div class="body">
        <a class="name namelink" href="#item-${esc(p.id)}">${esc(h.name)}</a>
        <span class="cbrand">${[p.condition === "used" && p.grade && !many ? esc(p.grade) : "", showBrand && p.brand ? esc(p.brand) : "", stockTxt(p)].filter(Boolean).join(" · ")}</span>${many ? `<span class="cseller"><a class="coffers" href="#item-${esc(p.id)}">${O.length} offers${O.some(o => o.condition === "new") && O.some(o => o.condition === "used") ? " · new &amp; used" : ""}</a></span>` : `<span class="cseller">${isCert(p) ? certBadge(true) : ""}<span>${p.condition === "new" ? "Brand new" : "Used"} · by ${esc(sellerOf(p))}${p.member && p.city ? " · " + esc(p.city) : ""}</span></span>`}
        <div class="cfoot"><span class="cpwrap"><span class="cprice">${many && lo !== Infinity ? "From " + money(lo) : p.price == null ? "Ask for price" : money(p.price)}</span>${saveHST(p) > 0 ? `<span class="chst">Regular <s>${money(withHST(p.was))}</s> incl. HST</span><span class="csave">Save ${money(saveHST(p))}</span>` : ""}</span>
          <div class="cardact" data-act="${p.id}">${cardAction(p.id)}</div></div>
      </div></article>`; }).join("");
}
let sortBy = "featured";
const priceRange = { shop:{min:null,max:null,scale:null}, new:{min:null,max:null,scale:null}, used:{min:null,max:null,scale:null} };   // null = no limit
function priceBound(cond){
  const m = Math.max(0, ...PRODUCTS.filter(p=>inCond(p, cond) && p.price!=null).map(p=>p.price));
  return Math.max(10, Math.ceil(m/10)*10);
}
const priceStep = B => B <= 100 ? 1 : B <= 500 ? 5 : 10;
function rangeOf(cond){
  const r = priceRange[cond], B = Math.max(priceBound(cond), r.scale || 0);   // slider scale: top item price, or a bigger typed number
  const min = Math.max(0, r.min ?? 0);                 // any number, 0 or more
  const max = r.max == null ? Infinity : r.max;         // any number, or no limit
  const top = Math.max(0, ...PRODUCTS.filter(p=>inCond(p, cond) && p.price!=null).map(p=>p.price));
  return {B, min, max, active: min > 0 || max < top};
}
/* ---- Filter panel: product type → brand → condition → price → more ---- */
const FLT = { shop:{types:[],brands:[],grades:[],conds:[],sellers:[],sale:false,stock:false,cert:false}, new:{types:[],brands:[],grades:[],sale:false,stock:false}, used:{types:[],brands:[],grades:[],sale:false,stock:false},
  services:{cats:[],provs:[],fmts:[],sizes:[],levels:[],min:null,max:null} };
let fltOpen = false;
const typeOf = p => (p.type && TYPE_LIST.includes(p.type)) ? p.type : guessType(p.name + " " + (p.brand || ""));
const brandOf = p => (p.brand || "").trim();
function inPrice(cond, p){ const {min, max, active} = rangeOf(cond); return !active || (p.price != null && p.price >= min && p.price <= max); }
function facetList(cond, skip){          // everything that passes the other filters (so counts stay honest)
  const F = FLT[cond];
  return filtered(cond).filter(p =>
    (skip === "price" || inPrice(cond, p)) &&
    (skip === "types" || !F.types.length || F.types.includes(typeOf(p))) &&
    (skip === "brands" || !F.brands.length || F.brands.includes(brandOf(p))) &&
    (skip === "grades" || !F.grades.length || F.grades.includes(p.grade)) &&
    (skip === "sale" || !F.sale || p.was != null) &&
    (skip === "stock" || !F.stock || !p.soldOut) &&
    (skip === "conds" || !(F.conds || []).length || F.conds.includes(p.condition)) &&
    (skip === "sellers" || !(F.sellers || []).length || F.sellers.includes(p.member ? "Members" : "Nojan")) &&
    (skip === "cert" || !F.cert || isCert(p)));
}
const tally = (list, fn) => list.reduce((m, p) => { const k = fn(p); if (k) m[k] = (m[k] || 0) + 1; return m; }, {});
function activeFilters(cond){
  const F = FLT[cond], out = [];
  if (cond === "services"){
    ["cats","provs","fmts","sizes","levels"].forEach(k => F[k].forEach(v => out.push([k, v, v])));
    if (F.min != null || F.max != null) out.push(["price", "", F.max == null ? `${fmtP(F.min)} and up` : `${fmtP(F.min || 0)} – ${fmtP(F.max)}`]);
    return out;
  }
  (F.conds || []).forEach(v => out.push(["conds", v, v === "new" ? "Brand new" : "Used"]));
  (F.sellers || []).forEach(v => out.push(["sellers", v, "Sold by " + v]));
  if (F.cert) out.push(["cert", "", "Certified only"]);
  F.types.forEach(v => out.push(["types", v, v]));
  F.brands.forEach(v => out.push(["brands", v, v]));
  F.grades.forEach(v => out.push(["grades", v, v]));
  const R = rangeOf(cond); if (R.active) out.push(["price", "", R.max === Infinity ? `${fmtP(R.min)} and up` : `${fmtP(R.min)} – ${fmtP(R.max)}`]);
  if (F.sale) out.push(["sale", "", "On sale"]);
  if (F.stock) out.push(["stock", "", "In stock"]);
  return out;
}
function optBtns(kind, counts, selected, order, all){
  const keys = order ? order.filter(k => counts[k] || selected.includes(k) || (all || []).includes(k)) : [...new Set([...(all || []), ...Object.keys(counts)])].sort((a,b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
  selected.forEach(s => { if (!keys.includes(s)) keys.push(s); });
  return keys.map(k => `<button type="button" class="fopt${counts[k] ? "" : " zero"}" data-f="${kind}" data-v="${esc(k)}" aria-pressed="${selected.includes(k)}">${esc(k)} <i>${counts[k] || 0}</i></button>`).join("");
}
function fltListsHTML(cond, part){
  const F = FLT[cond];
  if (part === "more"){
    const sale = facetList(cond, "sale").filter(p => p.was != null).length;
    const inStock = facetList(cond, "stock").filter(p => !p.soldOut).length;
    return `<div class="fsec"><h3>More</h3>
      <div class="fopts">
        <button type="button" class="fopt" data-f="sale" aria-pressed="${F.sale}">On sale <i>${sale}</i></button>
        <button type="button" class="fopt" data-f="stock" aria-pressed="${F.stock}">In stock only <i>${inStock}</i></button>
        ${cond === "shop" ? `<button type="button" class="fopt" data-f="cert" aria-pressed="${F.cert}">Certified only <i>${facetList(cond, "cert").filter(isCert).length}</i></button>` : ""}
      </div></div>`;
  }
  const types = tally(facetList(cond, "types"), typeOf);
  const brands = tally(facetList(cond, "brands"), brandOf);
  const grades = tally(facetList(cond, "grades"), p => p.grade);
  const allTypes = [...new Set(filtered(cond).map(typeOf))];                                            // every type in this tab stays listed
  const allBrands = [...new Set(filtered(cond).filter(p => !F.types.length || F.types.includes(typeOf(p))).map(brandOf).filter(Boolean))];  // brands of the chosen types
  const forTypes = F.types.length ? `<small>for ${esc(F.types.join(", "))}</small>` : "";
  const condBox = cond !== "shop" ? "" : (() => { const cc = tally(facetList(cond, "conds"), p => p.condition), sc = tally(facetList(cond, "sellers"), p => p.member ? "Members" : "Nojan");
    return `<div class="fsec"><h3>New or used</h3><div class="fopts" role="group" aria-label="New or used">${["new", "used"].map(k => `<button type="button" class="fopt${cc[k] ? "" : " zero"}" data-f="conds" data-v="${k}" aria-pressed="${F.conds.includes(k)}">${k === "new" ? "Brand new" : "Used"} <i>${cc[k] || 0}</i></button>`).join("")}</div></div>
      <div class="fsec"><h3>Sold by</h3><div class="fopts" role="group" aria-label="Sold by">${optBtns("sellers", sc, F.sellers, ["Nojan", "Members"])}</div></div>`; })();
  return `${condBox}
    <div class="fsec"><h3>Product type</h3>
      ${allTypes.length || F.types.length ? `<div class="fopts" role="group" aria-label="Product type">${optBtns("types", types, F.types, null, allTypes)}</div>` : `<p class="hint">No items to filter yet.</p>`}</div>
    <div class="fsec"><h3>Brand ${forTypes}</h3>
      ${allBrands.length || F.brands.length ? `<div class="fopts" role="group" aria-label="Brand">${optBtns("brands", brands, F.brands, null, allBrands)}</div>` : `<p class="hint">${F.types.length ? "No brands listed for this type." : "No brands listed yet."}</p>`}</div>
    ${cond === "used" || cond === "shop" ? `<div class="fsec"><h3>${cond === "shop" ? "Condition of used items" : "Condition"}</h3>
      ${Object.keys(grades).length || F.grades.length ? `<div class="fopts" role="group" aria-label="Condition">${optBtns("grades", grades, F.grades, GRADES)}</div>` : `<p class="hint">Condition grades appear here once items have one.</p>`}</div>` : ""}`;
}
function fltChipsHTML(cond){
  const a = activeFilters(cond).filter(x => cond === "services" || cond === "used" || cond === "new" || cond === "shop" || (x[0] !== "types" && x[0] !== "brands")); if (!a.length) return "";
  return a.map(([k, v, label]) => `<button type="button" class="fchip" data-fchip="${k}" data-v="${esc(v)}" aria-label="Remove filter ${esc(label)}">${esc(label)} <span aria-hidden="true">×</span></button>`).join("")
    + `<button type="button" class="linkbtn" data-fclear>Clear all</button>`;
}
function refreshFilterUI(cond){
  const n = activeFilters(cond).length, total = listFor(cond).length;
  const lists = $("#fltLists"); if (lists) lists.innerHTML = fltLists(cond);
  const more = $("#fltMore"); if (more) more.innerHTML = fltLists(cond, "more");
  const chips = $("#fltChips"); if (chips) chips.innerHTML = fltChipsHTML(cond);
  const badge = $("#fltBadge"); if (badge) badge.textContent = (cond === "services" || cond === "used" || cond === "new" || cond === "shop" ? n : activeFilters(cond).filter(x => x[0] !== "types" && x[0] !== "brands").length) || "";
  const qb = $("#qbar"); if (qb && cond !== "services") qb.innerHTML = quickBarHTML(cond);
  const show = $("#fltShow"); if (show) show.textContent = `Show ${total} ${cond === "services" ? "service" : "item"}${total === 1 ? "" : "s"}`;
  const clr = $("#fltClearAll"); if (clr) clr.disabled = !n;
}
function quickBarHTML(cond){
  const F = FLT[cond], all = filtered(cond);
  if (cond === "used" || cond === "new" || cond === "shop") return `<div class="qrow qonly"><button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${activeFilters(cond).length || ""}</span></button></div>`;
  const types = [...new Set(all.map(typeOf))].sort((a, b) => a === "Other" ? 1 : b === "Other" ? -1 : a.localeCompare(b));
  const pool = all.filter(p => !F.types.length || F.types.includes(typeOf(p)));
  const brands = [...new Set(pool.map(brandOf).filter(Boolean))].sort();
  const t1 = F.types.length === 1 ? F.types[0] : F.types.length ? null : "All";
  return `<div class="qrow" role="group" aria-label="Product type">
      <button type="button" class="chip" data-qt="" aria-pressed="${t1 === "All"}">All <i>${all.length}</i></button>
      ${types.map(t => `<button type="button" class="chip" data-qt="${esc(t)}" aria-pressed="${F.types.includes(t)}">${esc(t)} <i>${all.filter(p => typeOf(p) === t).length}</i></button>`).join("")}
    </div>
    <div class="qrow qbrands"><span class="qlab">Brand</span>
      ${brands.length ? brands.map(b => `<button type="button" class="chip small" data-qb="${esc(b)}" aria-pressed="${F.brands.includes(b)}">${esc(b)}</button>`).join("") : `<span class="note">No brands listed yet.</span>`}
      <button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${activeFilters(cond).filter(x => x[0] !== "types" && x[0] !== "brands").length || ""}</span></button>
    </div>`;
}
function filterBarHTML(cond, what){
  if (cond !== "services") return `<div class="qbar" id="qbar">${quickBarHTML(cond)}</div>
  <div class="fltchips" id="fltChips">${fltChipsHTML(cond)}</div>
  <div class="fltback" id="fltBack" data-fclose ${fltOpen ? "" : "hidden"}></div>
  <section class="fltpanel" id="fltPanel" role="dialog" aria-label="Filter ${what}" ${fltOpen ? "" : "hidden"}>
    <div class="flthead"><h2>More filters</h2><button type="button" class="fltx" data-fclose aria-label="Close filters">×</button></div>
    <div class="fltbody">
      <div id="fltLists">${fltLists(cond)}</div>`;
  return `<div class="qbar" id="qbar"><div class="qrow qonly"><button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${activeFilters(cond).length || ""}</span></button></div></div>
  <div class="fltchips" id="fltChips">${fltChipsHTML(cond)}</div>
  <div class="fltback" id="fltBack" data-fclose ${fltOpen ? "" : "hidden"}></div>
  <section class="fltpanel" id="fltPanel" role="dialog" aria-label="Filter ${what}" ${fltOpen ? "" : "hidden"}>
    <div class="flthead"><h2>More filters</h2><button type="button" class="fltx" data-fclose aria-label="Close filters">×</button></div>
    <div class="fltbody">
      <div id="fltLists">${fltLists(cond)}</div>`;
}
function filterFootHTML(cond){
  const n = listFor(cond).length, word = cond === "services" ? "service" : "item";
  return `<div id="fltMore">${fltLists(cond, "more")}</div>
    </div>
    <div class="fltfoot"><button type="button" class="linkbtn" id="fltClearAll" data-fclear ${activeFilters(cond).length ? "" : "disabled"}>Clear all</button><button type="button" class="btn" id="fltShow" data-fclose>Show ${n} ${word}${n === 1 ? "" : "s"}</button></div>
  </section>`;
}
const fltLists = (cond, part) => cond === "services" ? svcListsHTML(part) : fltListsHTML(cond, part);
/* Services facets: category → provider → format → class size → level → price (all built from the services you add) */
const SVC_FACETS = {
  cats:   s => [s.category],
  provs:  s => [s.providerName],
  fmts:   s => s.format === "both" ? ["Online", "In person"] : s.format === "online" ? ["Online"] : ["In person"],
  sizes:  s => [s.classType === "group" ? "Group class" : "1-on-1"],
  levels: s => [s.level]
};
function svcFacet(skip){
  const F = FLT.services, q = query.trim().toLowerCase();
  return SERVICES.filter(s =>
    (!q || [s.title, s.summary, s.category, s.providerName, s.description].join(" ").toLowerCase().includes(q)) &&
    Object.entries(SVC_FACETS).every(([k, fn]) => k === skip || !F[k].length || fn(s).some(v => F[k].includes(v))) &&
    (skip === "price" || ((F.min == null || (s.price ?? 0) >= F.min) && (F.max == null || (s.price ?? 0) <= F.max))));
}
function svcListsHTML(part){
  if (part === "more") return "";
  const F = FLT.services;
  const count = k => svcFacet(k).reduce((m, s) => { SVC_FACETS[k](s).forEach(v => m[v] = (m[v] || 0) + 1); return m; }, {});
  const every = (k, list) => [...new Set(list.flatMap(SVC_FACETS[k]))];
  const provPool = SERVICES.filter(s => !F.cats.length || F.cats.includes(s.category));
  const sec = (k, title, all, sub, order) => all.length < 1 && !F[k].length ? "" : `<div class="fsec"><h3>${title} ${sub || ""}</h3>
      <div class="fopts" role="group" aria-label="${title}">${optBtns(k, count(k), F[k], order, all)}</div></div>`;
  return sec("cats", "Category", every("cats", SERVICES))
    + sec("provs", "Provider", every("provs", provPool), F.cats.length ? `<small>for ${esc(F.cats.join(", "))}</small>` : "")
    + sec("fmts", "How it's held", ["Online", "In person"], "", ["Online", "In person"])
    + sec("sizes", "Class size", every("sizes", SERVICES), "", ["1-on-1", "Group class"])
    + sec("levels", "Level", every("levels", SERVICES));
}
function afterFilterChange(c){ if (priceRange[c]) afterPriceChange(c); else updateResults(c); }
function setFltOpen(open){
  fltOpen = open;
  const p = $("#fltPanel"), bk = $("#fltBack"), btn = $("#fltBtn");
  if (p) p.hidden = !open; if (bk) bk.hidden = !open;
  if (btn) btn.setAttribute("aria-expanded", open);
  document.body.classList.toggle("fltopen", open);
  if (open && p){ if (priceRange[current()]) syncPriceUI(current()); p.querySelector(".fltx").focus({preventScroll:true}); }
  else if (!open && btn && p) btn.focus({preventScroll:true});
}
function clearFilters(cond){
  if (cond === "services"){ FLT.services = {cats:[],provs:[],fmts:[],sizes:[],levels:[],min:null,max:null}; return; }
  FLT[cond] = cond === "shop" ? {types:[],brands:[],grades:[],conds:[],sellers:[],sale:false,stock:false,cert:false} : {types:[],brands:[],grades:[],sale:false,stock:false};
  priceRange[cond] = {min:null,max:null,scale:null};
}
function listFor(cond){
  let list = cond === "services" ? svcFacet(null) : facetList(cond, null);
  if (sortBy === "low") list = list.slice().sort((a,b)=>(a.price??1e9)-(b.price??1e9));
  if (sortBy === "high") list = list.slice().sort((a,b)=>(b.price??-1)-(a.price??-1));
  return list;
}
/* v60: Brand New, Used and Services show one row per category, like the home page; every item is in its row */
function shelvesHTML(list, catOf, cards, word){
  const groups = new Map();
  if (cards === productCards) list = groupList(list);
  list.forEach(x => { const c = catOf(x) || "Other"; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(x); });
  const cats = [...groups.keys()].sort((a, b) => (a === "Other") - (b === "Other") || groups.get(b).length - groups.get(a).length || a.localeCompare(b));
  const n = k => `${k} ${word}${k === 1 ? "" : "s"}`;
  return `<p class="count">${n(list.length)} in ${cats.length} categor${cats.length === 1 ? "y" : "ies"}</p>
    <nav class="shelfnav" aria-label="Jump to a category">${cats.map((c, i) => `<button type="button" data-shelf="shelf${i}">${esc(c)} <i>${groups.get(c).length}</i></button>`).join("")}</nav>
    ${cats.map((c, i) => `<section class="hsec shelf" id="shelf${i}" data-cat="${esc(c)}"><div class="hhead"><h2>${esc(c)}</h2><span>${n(groups.get(c).length)}</span></div>
      <div class="homegrid">${cards(groups.get(c))}</div></section>`).join("")}`;
}
function resultsHTML(cond){
  if (cond === "services"){
    const list = listFor("services"), q = query.trim();
    if (list.length && !activeFilters("services").length && !q) return shelvesHTML(list, s => s.category || "Other services", serviceCards, "service");
    return `<p class="count">${list.length} service${list.length === 1 ? "" : "s"}${q ? ` matching “${esc(q)}” <button class="linkbtn" data-clear>Clear search</button>` : ""}</p>
      ${list.length ? serviceGrid(list) : `<div class="empty">No services match these filters. <button class="linkbtn" type="button" data-fclear>Clear filters</button></div>`}`;
  }
  const f = FEEDS[cond], st = feedState[cond], ig = `https://www.instagram.com/${f.account}/`;
  if (st === "loading") return `<div class="empty">Loading items…</div>`;
  const list = listFor(cond);
  if (list.length && !activeFilters(cond).length && !query.trim()) return shelvesHTML(list, typeOf, productCards, "item");
  const ads = groupList(list).length;
  return `<p class="count">${ads} item${ads===1?"":"s"}${query.trim()?` matching “${esc(query.trim())}”`:""}</p>
  ${list.length ? productGrid(list, {brand: true}) : activeFilters(cond).length ? `<div class="empty">No items match these filters. <button class="linkbtn" type="button" data-reset>Clear filters</button> to see everything.</div>` : `<div class="empty">No items here yet. Follow <a href="${ig}" target="_blank" rel="noopener">@${f.account}</a> for new posts.</div>`}`;
}
const fmtP = n => "$" + (Number.isInteger(n) ? n : n.toFixed(2));
function syncPriceUI(cond){
  const {B, min, max} = rangeOf(cond);
  const box = document.querySelector(".pricebox"); if (!box) return;
  const step = priceStep(B);
  ["#pmin","#pmax"].forEach(sel => { const el = $(sel); el.max = B; el.step = step; });
  const sMin = Math.min(min, B), sMax = Math.min(Math.max(max, sMin), B);   // slider shows what fits on its scale
  box.querySelector(".dual").style.setProperty("--a", (sMin/B*100)+"%");
  box.querySelector(".dual").style.setProperty("--b", (sMax/B*100)+"%");
  $("#pmin").value = sMin; $("#pmax").value = sMax;
  if (document.activeElement !== $("#pminN")) $("#pminN").value = min;
  if (document.activeElement !== $("#pmaxN")) $("#pmaxN").value = max === Infinity ? "" : max;
  $("#pmin").style.zIndex = sMin >= B - priceStep(B) ? 3 : 1;
  $("#priceLbl").textContent = max === Infinity ? (min <= 0 ? "Any price" : `${fmtP(min)} and up`) : `${fmtP(min)} – ${fmtP(max)}`;
  $("#pmin").setAttribute("aria-valuetext", fmtP(min)); $("#pmax").setAttribute("aria-valuetext", fmtP(max));
}
function updateResults(cond){
  const el = $("#results"); if (el) el.innerHTML = resultsHTML(cond);
  if (FLT[cond]) refreshFilterUI(cond);
}
const PAGE = {
  shop: {title:"Shop", lead:"Brand new and used items in one place. Every item shows its condition, who sells it, and whether Nojan has certified it."},
  new: {
    eyebrow:"Brand new · never used", title:"Brand New",
    lead:"Sealed, never used, and priced below market.",
    perks:[["Sealed & unused","Original packaging, never opened."],["Everyday low prices","We keep our margins small."],["Checked before listing","Model and contents confirmed."]],
    icons:["box","mug","headphones"]
  },
  used: {
    eyebrow:"Pre-owned & checked", title:"Used",
    lead:"Pre-owned, tested, and honestly described.",
    perks:[["Tested to work","Powered on, assembled or tried out."],["Wear is disclosed","Scratches and marks named in the listing."],["Pickup in Richmond Hill","See it in person before you pay."]],
    icons:["chair","bike","book"]
  }
};
const svgIcon = (name, cls="") => `<svg class="${cls}" viewBox="0 0 64 64" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${ICONS[name]||ICONS.box}</svg>`;
function listView(cond){
  const f = FEEDS[cond], st = feedState[cond], P = PAGE[cond];
  const ig = `https://www.instagram.com/${f.account}/`;
  const R = rangeOf(cond), step = priceStep(R.B);
  const status = st==="loading" ? "Loading items from Instagram…"
    : st==="live" ? `Up to date · see posts on <a href="${ig}" target="_blank" rel="noopener">@${f.account}</a>`
    : `Example items · latest posts on <a href="${ig}" target="_blank" rel="noopener">@${f.account}</a>`;
  const guide = cond === "shop" ? "" : cond === "used" ? `
    <section class="guide" aria-label="Condition guide">
      <h2>How we describe condition</h2>
      <div class="guidegrid">
        <div><span class="grade g1">Like new</span><p>No visible wear. Works perfectly, often with box or accessories.</p></div>
        <div><span class="grade g2">Good</span><p>Light signs of use such as small scratches. Fully working.</p></div>
        <div><span class="grade g3">Fair</span><p>Noticeable wear, priced lower. Works as described in the post.</p></div>
      </div>
    </section>` : `
    <section class="guide" aria-label="Buying new">
      <h2>Buying new with us</h2>
      <div class="guidegrid">
        <div><span class="grade g1">Confirm</span><p>We contact you to confirm stock and your total.</p></div>
        <div><span class="grade g2">Pay</span><p>Pay by e-Transfer or cash at pickup. No card details are entered online.</p></div>
        <div><span class="grade g3">Receive</span><p>Pick up in Richmond Hill or arrange local delivery.</p></div>
      </div>
    </section>`;
  return `
  <section class="pagehero lhero ${cond}">
    <div class="phtext"><h1>${P.title}</h1><p>${P.lead}</p></div>
    <label class="sortlbl hsort">Sort by
      <select id="sort"><option value="featured"${sortBy==="featured"?" selected":""}>Featured</option><option value="low"${sortBy==="low"?" selected":""}>Price: low to high</option><option value="high"${sortBy==="high"?" selected":""}>Price: high to low</option></select>
    </label>
  </section>
  ${filterBarHTML(cond, cond === "new" ? "brand new items" : cond === "used" ? "used items" : "items")}
      <div class="fsec"><h3>Price</h3>
    <div class="pricebox" role="group" aria-labelledby="priceTitle">
      <div class="pricehead"><span id="priceTitle">Price</span><output id="priceLbl" aria-live="polite"></output></div>
      <div class="dual">
        <input type="range" id="pmin" min="0" max="${R.B}" step="${step}" value="${R.min}" aria-label="Lowest price">
        <input type="range" id="pmax" min="0" max="${R.B}" step="${step}" value="${R.max}" aria-label="Highest price">
      </div>
      <div class="pricein">
        <label class="pnum"><span>From $</span><input id="pminN" type="number" inputmode="decimal" min="0" step="any" value="${R.min}" placeholder="0"></label>
        <span class="pto">to</span>
        <label class="pnum"><span>To $</span><input id="pmaxN" type="number" inputmode="decimal" min="0" step="any" value="${R.max===Infinity?"":R.max}" placeholder="Any"></label>
        <button type="button" class="linkbtn" data-fchip="price" data-v="" ${R.active?"":"hidden"}>Clear</button>
      </div>
    </div>
      </div>
  ${filterFootHTML(cond)}
  <div id="results">${resultsHTML(cond)}</div>`;
}
function descHTML(d){
  d = (d || "No description yet. Ask us about this item.").trim();
  const lines = d.split(/\n+/).map(s => s.trim()).filter(Boolean);
  let html = "", list = [];
  const flush = () => { if (list.length){ html += `<ul class="bullets">${list.join("")}</ul>`; list = []; } };
  for (const l of lines){
    if (/^[\u2022\-*]\s*/.test(l)){
      const t = l.replace(/^[\u2022\-*]\s*/, "");
      const m = t.match(/^([^:]{2,40}):\s*(.*)$/);
      list.push(m ? `<li><b>${esc(m[1])}:</b> ${esc(m[2])}</li>` : `<li>${esc(t)}</li>`);
    } else { flush(); html += `<p>${esc(l)}</p>`; }
  }
  flush(); return html;
}
function filtered(cond){
  const q = query.trim().toLowerCase();
  return PRODUCTS.filter(p => inCond(p, cond) && (!q || [p.name, p.desc, p.brand, typeOf(p), p.grade, idOf(p)].join(" ").toLowerCase().includes(q)));
}

const ITEMQ = {id: null, q: 1, added: false};
const POL = {"returns":{"en":{"title":"Test before you pay","upd":"Last updated November 9, 2026","html":"<p class=\"lead\">You test and accept every item before you pay. Nothing is charged online.<\/p>\n<h2>At pickup<\/h2>\n<ul>\n<li>Take as much time as you need to look at the item and test it. You can open the box, turn it on and try it.<\/li>\n<li>If the item works and matches its description, you pay for it and it's yours.<\/li>\n<li>If something is wrong, for example it doesn't work or isn't as described, you don't have to buy it.<\/li>\n<li>If we deliver, you can test the item when it arrives, before you pay.<\/li>\n<\/ul>\n<h2>Sealed items<\/h2>\n<p>Brand new items come sealed. You may open a sealed box to check and test the item. Once a sealed box is opened, you agree to buy the item, unless it doesn't work or isn't as described.<\/p>\n<h2>After you pay<\/h2>\n<p>Because you test and accept the item before paying, the sale is final once you have paid. We don't offer refunds or exchanges after that, and Nojan doesn't give its own warranty after the sale. A manufacturer's warranty may apply to some brand new items. Ask us before you buy.<\/p>\n<p>Nothing on this page limits your rights under Ontario consumer protection law.<\/p>\n<h2>Questions<\/h2>\n<p>Ask before you order: <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a> or <a href=\"#contact-us\">send us a message<\/a>.<\/p>"},"fr":{"title":"Testez avant de payer","upd":"Dernière mise à jour : 9 novembre 2026","html":"<p class=\"lead\">Vous testez et acceptez chaque article avant de payer. Rien n'est facturé en ligne.<\/p>\n<h2>À la cueillette<\/h2>\n<ul>\n<li>Prenez tout le temps nécessaire pour examiner et tester l'article. Vous pouvez ouvrir la boîte, l'allumer et l'essayer.<\/li>\n<li>Si l'article fonctionne et correspond à sa description, vous le payez et il est à vous.<\/li>\n<li>S'il y a un problème, par exemple s'il ne fonctionne pas ou ne correspond pas à la description, vous n'êtes pas obligé de l'acheter.<\/li>\n<li>Si nous livrons, vous pouvez tester l'article à son arrivée, avant de payer.<\/li>\n<\/ul>\n<h2>Articles scellés<\/h2>\n<p>Les articles neufs sont scellés. Vous pouvez ouvrir une boîte scellée pour vérifier et tester l'article. Une fois la boîte ouverte, vous vous engagez à acheter l'article, sauf s'il ne fonctionne pas ou ne correspond pas à sa description.<\/p>\n<h2>Après le paiement<\/h2>\n<p>Comme vous testez et acceptez l'article avant de payer, la vente est finale une fois le paiement fait. Nous n'offrons ni remboursement ni échange par la suite, et Nojan n'offre pas sa propre garantie après la vente. La garantie du fabricant peut s'appliquer à certains articles neufs. Renseignez-vous avant d'acheter.<\/p>\n<p>Rien sur cette page ne limite vos droits en vertu des lois de l'Ontario sur la protection du consommateur.<\/p>\n<h2>Questions<\/h2>\n<p>Posez vos questions avant de commander : <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a> ou <a href=\"#contact-us\">écrivez-nous<\/a>.<\/p>"}},"privacy":{"en":{"title":"Privacy policy","upd":"Last updated November 9, 2026","html":"<p class=\"lead\">We collect only what we need to handle your account and orders. We never sell, rent or share your information for advertising or marketing.<\/p>\n<h2>What we collect<\/h2>\n<ul>\n<li><b>Account:<\/b> your name, email address and how you sign in (email, Google or Microsoft). Passwords are handled by the sign-in service; we never see them.<\/li>\n<li><b>Orders and bookings:<\/b> your name, phone number, email, city, the items or services you chose and any notes you add.<\/li>\n<li><b>Messages:<\/b> what you send us through the contact form.<\/li>\n<\/ul>\n<p>We don't collect payment card or bank details. We don't use advertising, tracking cookies or visitor statistics.<\/p>\n<h2>How we use it<\/h2>\n<p>Only to confirm and complete your orders and bookings, arrange pickup or delivery, answer your messages and keep the business records the law requires.<\/p>\n<h2>Who handles it for us<\/h2>\n<p>We don't give your information to anyone else. A few services are needed to run the site, and they handle it only for that purpose:<\/p>\n<ul>\n<li><b>Google Firebase<\/b> stores accounts, orders and bookings.<\/li>\n<li><b>FormSubmit<\/b> delivers order and contact emails to us.<\/li>\n<li><b>GitHub Pages<\/b> hosts the website.<\/li>\n<li><b>Google<\/b> or <b>Microsoft<\/b> sign you in, if you choose them.<\/li>\n<\/ul>\n<p>Some product photos load from other websites, such as the brand's own site or photo storage. Like any website, they can see your device's internet address. Some of these services may store information outside Canada.<\/p>\n<p>We may disclose information if the law requires it.<\/p>\n<h2>On your device<\/h2>\n<p>Your cart, your language choice and a copy of the catalogue are saved in your browser so the site works quickly. You can clear them in your browser settings at any time.<\/p>\n<h2>How long we keep it<\/h2>\n<p>Account information is kept while your account is open. Order records are kept as long as Canadian tax rules require, generally six years.<\/p>\n<h2>Your choices<\/h2>\n<p>You can ask to see, correct or delete your information, or to close your account, by emailing <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>. We answer within 30 days.<\/p>\n<h2>Security<\/h2>\n<p>The site uses encrypted connections (HTTPS), and we limit who can access your information.<\/p>\n<h2>Questions or concerns<\/h2>\n<p>Email <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>. If you're not satisfied with our answer, you can contact the <a href=\"https://www.priv.gc.ca/\" target=\"_blank\" rel=\"noopener\">Office of the Privacy Commissioner of Canada<\/a>.<\/p>"},"fr":{"title":"Politique de confidentialité","upd":"Dernière mise à jour : 9 novembre 2026","html":"<p class=\"lead\">Nous recueillons seulement ce qu'il faut pour gérer votre compte et vos commandes. Nous ne vendons, ne louons et ne partageons jamais vos renseignements à des fins de publicité ou de marketing.<\/p>\n<h2>Ce que nous recueillons<\/h2>\n<ul>\n<li><b>Compte :<\/b> votre nom, votre adresse courriel et votre mode de connexion (courriel, Google ou Microsoft). Les mots de passe sont gérés par le service de connexion; nous ne les voyons jamais.<\/li>\n<li><b>Commandes et réservations :<\/b> votre nom, votre numéro de téléphone, votre courriel, votre ville, les articles ou services choisis et les notes que vous ajoutez.<\/li>\n<li><b>Messages :<\/b> ce que vous nous envoyez par le formulaire de contact.<\/li>\n<\/ul>\n<p>Nous ne recueillons aucune donnée de carte de paiement ni de compte bancaire. Nous n'utilisons ni publicité, ni témoins de suivi, ni statistiques de visite.<\/p>\n<h2>Comment nous les utilisons<\/h2>\n<p>Uniquement pour confirmer et compléter vos commandes et réservations, organiser la cueillette ou la livraison, répondre à vos messages et tenir les registres exigés par la loi.<\/p>\n<h2>Qui les traite pour nous<\/h2>\n<p>Nous ne donnons vos renseignements à personne d'autre. Quelques services sont nécessaires au fonctionnement du site et ne les traitent qu'à cette fin :<\/p>\n<ul>\n<li><b>Google Firebase<\/b> conserve les comptes, les commandes et les réservations.<\/li>\n<li><b>FormSubmit<\/b> nous transmet les courriels de commande et de contact.<\/li>\n<li><b>GitHub Pages<\/b> héberge le site.<\/li>\n<li><b>Google<\/b> ou <b>Microsoft<\/b> vous connectent, si vous les choisissez.<\/li>\n<\/ul>\n<p>Certaines photos de produits proviennent d'autres sites, comme celui de la marque ou un service de stockage de photos. Comme tout site web, ils peuvent voir l'adresse Internet de votre appareil. Certains de ces services peuvent conserver des renseignements à l'extérieur du Canada.<\/p>\n<p>Nous pouvons communiquer des renseignements si la loi l'exige.<\/p>\n<h2>Sur votre appareil<\/h2>\n<p>Votre panier, votre choix de langue et une copie du catalogue sont enregistrés dans votre navigateur pour que le site soit rapide. Vous pouvez les effacer en tout temps dans les réglages de votre navigateur.<\/p>\n<h2>Durée de conservation<\/h2>\n<p>Les renseignements de compte sont conservés tant que votre compte est ouvert. Les registres de commande sont conservés aussi longtemps que l'exigent les règles fiscales canadiennes, généralement six ans.<\/p>\n<h2>Vos choix<\/h2>\n<p>Vous pouvez demander à consulter, corriger ou supprimer vos renseignements, ou à fermer votre compte, en écrivant à <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>. Nous répondons dans les 30 jours.<\/p>\n<h2>Sécurité<\/h2>\n<p>Le site utilise des connexions chiffrées (HTTPS) et nous limitons l'accès à vos renseignements.<\/p>\n<h2>Questions ou préoccupations<\/h2>\n<p>Écrivez à <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>. Si notre réponse ne vous satisfait pas, vous pouvez communiquer avec le <a href=\"https://www.priv.gc.ca/\" target=\"_blank\" rel=\"noopener\">Commissariat à la protection de la vie privée du Canada<\/a>.<\/p>"}},"terms":{"en":{"title":"Terms of use","upd":"Last updated November 9, 2026","html":"<p class=\"lead\">By using nojans.com you agree to these terms. Please read them together with <a href=\"#returns\">Test before you pay<\/a> and our <a href=\"#privacy\">Privacy policy<\/a>.<\/p>\n<h2>Who we are<\/h2>\n<p>Nojan is a small Canadian business in Richmond Hill, Ontario. You can reach us at <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>.<\/p>\n<h2>Accounts<\/h2>\n<p>You need a free account to place an order or book a service. Give accurate information, keep your sign-in private and tell us if someone else uses your account. We may close accounts that are misused.<\/p>\n<h2>Orders<\/h2>\n<ul>\n<li>Placing an order sends us a request. It isn't a payment, and the order is confirmed when we contact you.<\/li>\n<li>Most items are one of a kind or limited in number. If an item sells before we confirm your order, we'll tell you and nothing is owed.<\/li>\n<li>We work to show prices and details correctly. If we find a mistake, we'll tell you before you pay, and you can cancel.<\/li>\n<li>Prices are in Canadian dollars. No sales tax is added at this time.<\/li>\n<li>Regular prices shown for comparison are the item's usual market price, including tax.<\/li>\n<\/ul>\n<h2>Payment, pickup and delivery<\/h2>\n<p>Nothing is charged online. You pay by Interac e-Transfer or cash at pickup, after testing the item. Pickup is in Richmond Hill, and local delivery can be arranged.<\/p>\n<h2>Testing and final sales<\/h2>\n<p>You test and accept items before you pay. Opening a sealed box means you buy the item unless it doesn't work or isn't as described. Sales are final once paid. The details are on <a href=\"#returns\">Test before you pay<\/a>.<\/p>\n<h2>Services<\/h2>\n<p>Bookings are requests until we confirm them. Pay the provider as shown on the service page. If your plans change, cancel from My orders and bookings.<\/p>\n<h2>Product information<\/h2>\n<p>Brand names and trademarks belong to their owners. Unless a listing says otherwise, photos show the model, not the exact unit.<\/p>\n<h2>Using the site<\/h2>\n<p>Please don't misuse the site, try to reach other people's accounts or information, or copy the site's content for commercial use.<\/p>\n<h2>Limits<\/h2>\n<p>As far as the law allows, Nojan isn't responsible for indirect losses from using the site. Nothing in these terms limits your rights under Ontario consumer protection law.<\/p>\n<h2>Changes<\/h2>\n<p>We may update these terms. The date at the top shows the current version.<\/p>\n<h2>Law<\/h2>\n<p>These terms are governed by the laws of Ontario and the federal laws of Canada that apply there.<\/p>"},"fr":{"title":"Conditions d'utilisation","upd":"Dernière mise à jour : 9 novembre 2026","html":"<p class=\"lead\">En utilisant nojans.com, vous acceptez ces conditions. Lisez-les avec <a href=\"#returns\">Testez avant de payer<\/a> et notre <a href=\"#privacy\">Politique de confidentialité<\/a>.<\/p>\n<h2>Qui nous sommes<\/h2>\n<p>Nojan est une petite entreprise canadienne de Richmond Hill, en Ontario. Vous pouvez nous joindre à <a href=\"mailto:info@nojans.com\">info@nojans.com<\/a>.<\/p>\n<h2>Comptes<\/h2>\n<p>Un compte gratuit est nécessaire pour commander ou réserver un service. Donnez des renseignements exacts, gardez votre connexion privée et avisez-nous si quelqu'un d'autre utilise votre compte. Nous pouvons fermer un compte utilisé de façon abusive.<\/p>\n<h2>Commandes<\/h2>\n<ul>\n<li>Passer une commande nous envoie une demande. Ce n'est pas un paiement, et la commande est confirmée lorsque nous communiquons avec vous.<\/li>\n<li>La plupart des articles sont uniques ou en quantité limitée. Si un article est vendu avant la confirmation de votre commande, nous vous en informons et vous ne devez rien.<\/li>\n<li>Nous veillons à afficher des prix et des détails exacts. Si nous trouvons une erreur, nous vous en informons avant le paiement et vous pouvez annuler.<\/li>\n<li>Les prix sont en dollars canadiens. Aucune taxe de vente n'est ajoutée pour le moment.<\/li>\n<li>Les prix courants affichés à titre de comparaison sont le prix habituel de l'article sur le marché, taxes incluses.<\/li>\n<\/ul>\n<h2>Paiement, cueillette et livraison<\/h2>\n<p>Rien n'est facturé en ligne. Vous payez par virement Interac ou comptant à la cueillette, après avoir testé l'article. La cueillette se fait à Richmond Hill, et la livraison locale peut être organisée.<\/p>\n<h2>Tests et ventes finales<\/h2>\n<p>Vous testez et acceptez les articles avant de payer. Ouvrir une boîte scellée signifie que vous achetez l'article, sauf s'il ne fonctionne pas ou ne correspond pas à sa description. La vente est finale une fois payée. Les détails se trouvent sur <a href=\"#returns\">Testez avant de payer<\/a>.<\/p>\n<h2>Services<\/h2>\n<p>Les réservations sont des demandes jusqu'à ce que nous les confirmions. Payez le fournisseur comme indiqué sur la page du service. Si vos plans changent, annulez dans Mes commandes et réservations.<\/p>\n<h2>Renseignements sur les produits<\/h2>\n<p>Les noms de marque et les marques de commerce appartiennent à leurs propriétaires. Sauf indication contraire dans l'annonce, les photos montrent le modèle et non l'unité exacte.<\/p>\n<h2>Utilisation du site<\/h2>\n<p>Veuillez ne pas utiliser le site de façon abusive, tenter d'accéder aux comptes ou aux renseignements d'autres personnes, ni copier le contenu du site à des fins commerciales.<\/p>\n<h2>Limites<\/h2>\n<p>Dans la mesure permise par la loi, Nojan n'est pas responsable des pertes indirectes liées à l'utilisation du site. Rien dans ces conditions ne limite vos droits en vertu des lois de l'Ontario sur la protection du consommateur.<\/p>\n<h2>Modifications<\/h2>\n<p>Nous pouvons mettre à jour ces conditions. La date en haut de la page indique la version en vigueur.<\/p>\n<h2>Loi applicable<\/h2>\n<p>Ces conditions sont régies par les lois de l'Ontario et les lois fédérales du Canada qui s'y appliquent.<\/p>"}},"about":{"en":{"title":"About Nojan","upd":"","html":"<p class=\"lead\">Nojan is a small Canadian-owned business in Richmond Hill, Ontario. We sell brand-name items, new and used, for less, and we give part of our profit back to the community.<\/p>\n<h2>What we sell<\/h2>\n<p>Electronics, kitchen appliances, fragrances, personal care and more. Brand new items come sealed. Used items are tested, cleaned and graded before they're listed. <a href=\"#certified\">See what Certified means<\/a>.<\/p>\n<h2>How buying works<\/h2>\n<ol>\n<li>Add items to your bag and send an order request. Nothing is charged online.<\/li>\n<li>We contact you, usually within one business day, to set a pickup time.<\/li>\n<li>At pickup in Richmond Hill, test the item. If it works, pay by e-Transfer or cash. <a href=\"#returns\">Test before you pay<\/a>.<\/li>\n<\/ol>\n<h2>Services<\/h2>\n<p>Classes and expert help, online or in person, are on our <a href=\"#services\">Services<\/a> page.<\/p>\n<h2>Giving back<\/h2>\n<p>We give 10% of our profit to the community, and we'll share where it goes on our <a href=\"#news\">News<\/a> page. We're just starting. If you'd like to help us grow, you can <a href=\"https://gofund.me/dbbc9cd49\" target=\"_blank\" rel=\"noopener\">support us on GoFundMe<\/a>.<\/p>\n<h2>Contact<\/h2>\n<p><a href=\"mailto:info@nojans.com\">info@nojans.com<\/a> · Instagram <a href=\"https://www.instagram.com/nojan_ca/\" target=\"_blank\" rel=\"noopener\">@nojan_ca<\/a><\/p>"},"fr":{"title":"À propos de Nojan","upd":"","html":"<p class=\"lead\">Nojan est une petite entreprise canadienne de Richmond Hill, en Ontario. Nous vendons des articles de marque, neufs et d'occasion, pour moins cher, et nous remettons une partie de nos profits à la communauté.<\/p>\n<h2>Ce que nous vendons<\/h2>\n<p>Électronique, électroménagers de cuisine, parfums, soins personnels et plus. Les articles neufs sont scellés. Les articles d'occasion sont testés, nettoyés et évalués avant d'être affichés. <a href=\"#certified\">Voir ce que veut dire « Certifié »<\/a>.<\/p>\n<h2>Comment acheter<\/h2>\n<ol>\n<li>Ajoutez des articles à votre sac et envoyez une demande de commande. Rien n'est facturé en ligne.<\/li>\n<li>Nous communiquons avec vous, habituellement en moins d'un jour ouvrable, pour fixer un moment de cueillette.<\/li>\n<li>À la cueillette à Richmond Hill, testez l'article. S'il fonctionne, payez par virement Interac ou comptant. <a href=\"#returns\">Testez avant de payer<\/a>.<\/li>\n<\/ol>\n<h2>Services<\/h2>\n<p>Des cours et l'aide d'experts, en ligne ou en personne, se trouvent sur notre page <a href=\"#services\">Services<\/a>.<\/p>\n<h2>Redonner<\/h2>\n<p>Nous remettons 10 % de nos profits à la communauté, et nous indiquerons où ils vont sur notre page <a href=\"#news\">Nouvelles<\/a>. Nous commençons à peine. Pour nous aider à grandir, vous pouvez <a href=\"https://gofund.me/dbbc9cd49\" target=\"_blank\" rel=\"noopener\">nous soutenir sur GoFundMe<\/a>.<\/p>\n<h2>Nous joindre<\/h2>\n<p><a href=\"mailto:info@nojans.com\">info@nojans.com<\/a> · Instagram <a href=\"https://www.instagram.com/nojan_ca/\" target=\"_blank\" rel=\"noopener\">@nojan_ca<\/a><\/p>"}},"certified":{"en":{"title":"What “Certified” means","upd":"","html":"<p class=\"lead\">A Certified badge means Nojan checked the item before listing it.<\/p>\n<h2>Used items<\/h2>\n<ul>\n<li><b>Tested to work:<\/b> powered on, charged, paired, assembled or tried out, depending on the item.<\/li>\n<li><b>Cleaned<\/b> before listing.<\/li>\n<li><b>Graded<\/b> Like new, Good or Fair, with any wear named in the listing.<\/li>\n<li><b>Contents listed:<\/b> what's included is in the description.<\/li>\n<\/ul>\n<h2>Brand new items<\/h2>\n<ul>\n<li><b>Sealed<\/b> in the original packaging, never used.<\/li>\n<li><b>Model and contents confirmed<\/b> before listing.<\/li>\n<\/ul>\n<h2>Condition grades<\/h2>\n<ul>\n<li><b>Like new:<\/b> no visible wear. Works perfectly, often with box or accessories.<\/li>\n<li><b>Good:<\/b> light signs of use, such as small scratches. Fully working.<\/li>\n<li><b>Fair:<\/b> noticeable wear, priced lower. Works as described.<\/li>\n<\/ul>\n<p>Either way, you test the item yourself before you pay. <a href=\"#returns\">Test before you pay<\/a>.<\/p>"},"fr":{"title":"Ce que veut dire « Certifié »","upd":"","html":"<p class=\"lead\">Le badge Certifié signifie que Nojan a vérifié l'article avant de l'afficher.<\/p>\n<h2>Articles d'occasion<\/h2>\n<ul>\n<li><b>Testés :<\/b> allumés, chargés, jumelés, assemblés ou essayés, selon l'article.<\/li>\n<li><b>Nettoyés<\/b> avant d'être affichés.<\/li>\n<li><b>Évalués<\/b> Comme neuf, Bon ou Passable, et toute usure est indiquée dans l'annonce.<\/li>\n<li><b>Contenu indiqué :<\/b> ce qui est inclus figure dans la description.<\/li>\n<\/ul>\n<h2>Articles neufs<\/h2>\n<ul>\n<li><b>Scellés<\/b> dans l'emballage d'origine, jamais utilisés.<\/li>\n<li><b>Modèle et contenu confirmés<\/b> avant d'être affichés.<\/li>\n<\/ul>\n<h2>Cotes d'état<\/h2>\n<ul>\n<li><b>Comme neuf :<\/b> aucune usure visible. Fonctionne parfaitement, souvent avec la boîte ou les accessoires.<\/li>\n<li><b>Bon :<\/b> légers signes d'usure, comme de petites égratignures. Entièrement fonctionnel.<\/li>\n<li><b>Passable :<\/b> usure visible, prix plus bas. Fonctionne comme décrit.<\/li>\n<\/ul>\n<p>Dans tous les cas, vous testez l'article vous-même avant de payer. <a href=\"#returns\">Testez avant de payer<\/a>.<\/p>"}}};
function polView(k){
  const P = POL[k]; if (!P) return views.notfound();
  const blk = (l, x) => `<div class="l-${l}" lang="${l === "fr" ? "fr-CA" : "en"}" data-noi18n><h1>${x.title}</h1>${x.upd ? `<p class="upd">${x.upd}</p>` : ""}${x.html}</div>`;
  return `<article class="policy">${blk("en", P.en)}${blk("fr", P.fr)}</article>`;
}
const nextStepsHTML = () => `<div class="nextwrap"><b>What happens next</b><ol class="nextsteps"><li>Send your order request. Nothing is charged.</li><li>We contact you, usually within one business day, to set a pickup time in Richmond Hill.</li><li>Test the item at pickup, then pay by e-Transfer or cash.</li></ol><a class="msglink" href="#returns">Test before you pay ›</a></div>`;
function simHTML(p){
  const t = typeOf(p), list = groupList(PRODUCTS.filter(x => x.id !== p.id && !x.soldOut && !x.member && typeOf(x) === t && x.itemId !== p.itemId)).slice(0, 4);
  return list.length ? `<section class="hsec simsec"><div class="h5row"><h2>Similar items</h2><a href="#shop">See all ›</a></div><div class="homegrid">${productCards(list)}</div></section>` : "";
}
const TITLES = {home: "Nojan · Brand-name items for less in Richmond Hill", shop: "Shop new and used items · Nojan", services: "Services and classes · Nojan", contact: "Contact us · Nojan", news: "News · Nojan", cart: "Your cart · Nojan", checkout: "Checkout · Nojan", account: "Your account · Nojan", orders: "My orders and bookings · Nojan", about: "About Nojan", returns: "Test before you pay · Nojan", privacy: "Privacy policy · Nojan", terms: "Terms of use · Nojan", certified: "What Certified means · Nojan", notfound: "Page not found · Nojan"};
const views = {
  home(){
    const q = query.trim();
    if (q){ const svcs = SERVICES.filter(s => [s.title, s.summary, s.category, s.providerName, s.description].join(" ").toLowerCase().includes(q.toLowerCase())), items = filtered();
      return `<div class="sectionhead"><h1>Results for “${esc(q)}”</h1><button class="linkbtn" data-clear>Clear search</button></div>
        ${items.length || (!svcs.length && !(evOn() && EVENTS.some(e => evMatchQ(e, q.toLowerCase())))) ? productGrid(items) : ""}${svcs.length ? `<div class="sectionhead" style="margin-top:24px"><h2>Services</h2></div>${serviceGrid(svcs)}` : ""}${(() => { const evs = evOn() ? EVENTS.filter(e => evMatchQ(e, q.toLowerCase())) : []; return evs.length ? `<div class="sectionhead" style="margin-top:24px"><h2>Events</h2></div><div class="evgrid">${evs.map(evCardHTML).join("")}</div>` : ""; })()}`; }
    return homeHTML();
  },
  news(){ return `<div class="sectionhead"><h1>News</h1><p>What's new at Nojan.</p></div><div class="newslist">${newsList().map(newsCard).join("")}</div>`; },
  events(){ return evOn() ? eventsView() : offHTML("events"); },
  dating(){ return dtOpen() ? datingView() : dtArchivedHTML(); },
  person(){ return dtOpen() ? personView() : dtArchivedHTML(); },
  matches(){ return dtOpen() ? matchesView() : dtArchivedHTML(); },
  chat(){ return dtOpen() ? chatView() : dtArchivedHTML(); },
  datingprofile(){ return dtOpen() ? datingProfileView() : dtArchivedHTML(); },
  homes(){ return hmOn() ? homesView() : offHTML("homes"); },
  listing(){ return hmOn() ? listingView() : offHTML("homes"); },
  listhome(){ return hmOn() ? listHomeView() : offHTML("homes"); },
  mylistings(){ return hmOn() ? myListingsView() : offHTML("homes"); },
  hchat(){ return hchatView(); },
  selling(){ return SELLING_ON ? sellingView() : sellOff(); },
  sell(){ return SELLING_ON ? sellView() : sellOff(); },
  event(){ return evOn() ? eventView() : offHTML("events"); },
  shop(){ return listView("shop"); },
  new(){ return listView("shop"); },
  used(){ return listView("shop"); },
  cart(){
    const items = cartItems();
    if (!items.length) return `<h1>Your cart</h1><div class="empty" style="margin-top:16px">Your cart is empty. <a href="#home" style="color:var(--link)">Continue shopping</a></div>`;
    const t = totals();
    return `<div class="sectionhead"><h1>Your cart</h1></div>
    <div class="two">
      <div class="panel">${items.map(({p,q})=>`
        <div class="line">${picHTML(p)}
          <div style="min-width:0;display:grid;gap:6px">
            <div class="name">${esc(p.name)}</div>
            <span class="tag ${p.condition}">${p.condition==="new"?"Brand new":"Used"+(p.grade?" · "+esc(p.grade):"")}</span>
            <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap">
              <span class="qty"><button type="button" data-dec="${p.id}" aria-label="${q===1?"Remove from cart":"Decrease"}">${q===1?TRASH:"−"}</button><span>${q}</span><button type="button" data-inc="${p.id}" aria-label="Increase">+</button></span>
              <button class="linkbtn" type="button" data-rm="${p.id}">Remove</button>
            </div>
          </div>
          <strong style="font-variant-numeric:tabular-nums">${lineTotal(p,q)}</strong>
        </div>`).join("")}
      </div>
      <aside class="panel">
        <div class="sum total"><span>Total</span><span>${money(t.total)}</span></div>
        <p class="notax">No tax added. Nothing is charged online.</p>
        ${unpricedNote(t)}
        <a class="btn primary" href="#checkout">Proceed to checkout</a>
        ${nextStepsHTML()}
      </aside>
    </div>`;
  },
  checkout(){
    const items = cartItems();
    if (!items.length) return views.cart();
    const t = totals();
    const pr = PROFILE || {};
    const left = !authReady ? `<div class="panel"><p class="note">${fbFailed ? "We couldn't connect to the account service. Check your connection and refresh the page." : "Loading your account…"}</p></div>`
      : !USER ? `<div class="panel signinprompt">
        <h2>Sign in to place your order</h2>
        <p class="note">Browsing is open to everyone. To place an order, sign in or create a free account so you can track your orders and we can reach you.</p>
        ${googleBtn()}
        <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-auth="signin" data-next="checkout">Sign in with email</button><button class="btn ghost" type="button" data-auth="signup" data-next="checkout" style="color:var(--fg)">Create account</button></div>
        <div id="authMsg" hidden></div>
      </div>`
      : `<div class="panel">
        <h2>Your contact information</h2>
        <p class="note">Signed in as <b>${esc(USER.email || "")}</b>. We don't ask for card or bank details. After you place the order, we'll email or call you to confirm availability, payment and pickup or delivery.</p>
        <form id="orderForm" novalidate>
          <div class="row">
            <label>Full name<input id="o-name" name="name" required autocomplete="name" value="${esc(pr.name || USER.displayName || "")}"></label>
            <label>Phone<input id="o-phone" name="phone" type="tel" required autocomplete="tel" value="${esc(pr.phone || "")}"></label>
          </div>
          <label>Email<input id="o-email" name="email" type="email" required autocomplete="email" value="${esc(pr.email || USER.email || "")}"></label>
          <div class="row">
            <label>City<input id="o-city" name="city" autocomplete="address-level2" value="${esc(pr.city || "")}"></label>
            <label>Best way to reach you
              <select id="o-pref" name="contact_preference"><option>Phone call</option><option>Text message</option><option>Email</option></select>
            </label>
          </div>
          <label>Notes <small>(optional — pickup time, questions)</small><textarea id="o-notes" name="notes"></textarea></label>
          <p class="note">By placing an order you agree to our <a href="#terms">Terms</a> and to <a href="#returns">Test before you pay</a>.</p>
          <div id="orderMsg" hidden></div>
          <button class="btn primary" type="submit" id="orderSubmit">Place order request</button>
        </form>
      </div>`;
    return `<div class="sectionhead"><h1>Checkout</h1><a class="linkbtn" href="#cart">Back to cart</a></div>
    <div class="two">
      ${left}
      <aside class="panel">
        <h2>Order summary</h2>
        ${items.map(({p,q})=>`<div class="sum"><span style="min-width:0">${q} × ${esc(p.name)}</span><span>${lineTotal(p,q)}</span></div>`).join("")}
        <div class="sum total"><span>Total</span><span>${money(t.total)}</span></div>
        <p class="notax">No tax added. Nothing is charged online.</p>
        ${nextStepsHTML()}
      </aside>
    </div>`;
  },
  item(){
    if (String(itemId).startsWith("m-")) return mkDetailView(String(itemId).slice(2));
    const p = PRODUCTS.find(x => x.id === itemId);
    if (!p){
      if (feedState.new === "loading") return `<div class="empty">Loading item…</div>`;
      const s98 = SOLD.find(x => x.id === itemId);
      if (s98) return `<div class="soldnote"><h1>This item has sold</h1><p>${esc(s98.name)}</p><a class="btn" href="#shop">See what's in stock</a></div>${simHTML(s98)}`;
      return `<div class="empty">This item is no longer available. It may have sold. <a href="#home" style="color:var(--link)">See what's in stock</a></div>`;
    }
    if (ITEMQ.id !== p.id){ ITEMQ.id = p.id; ITEMQ.q = 1; ITEMQ.added = false; }
    const imgs = imagesOf(p), refs = refsOf(p), used = p.condition === "used";
    const save = p.was && p.price != null ? p.was - p.price : 0;
    const left = stockOf(p.id), out = left <= 0;
    const lines = (p.desc || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
    const summary = lines.find(l => !/^[\u2022\-*]/.test(l)) || "";
    const feats = lines.filter(l => /^[\u2022\-*]/.test(l)).map(l => { const t = l.replace(/^[\u2022\-*]\s*/, ""), m = t.match(/^([^:]{2,40}):\s*(.*)$/);
      return m ? {t: m[1] === m[1].toUpperCase() ? m[1].split(" ").map((w, i) => w.length <= 3 && /[A-Z]/.test(w) ? w : i ? w.toLowerCase() : w.charAt(0) + w.slice(1).toLowerCase()).join(" ") : m[1], d: m[2].charAt(0).toUpperCase() + m[2].slice(1)} : {t: "", d: t}; });
    const extra = lines.filter(l => !/^[\u2022\-*]/.test(l) && l !== summary);
    const stage = imgs.length ? `
        <div class="pic big stage${imgs.length > 1 ? " gal" : ""}" data-gal="${esc(p.id)}" data-i="0">
          <img src="${esc(imgs[0])}" data-ref="${esc(refs[0])}" alt="${esc(p.name)}, photo 1 of ${imgs.length}">
          ${imgs.length > 1 ? `<button type="button" class="gnav gprev" data-gstep="-1" aria-label="Previous photo">‹</button><button type="button" class="gnav gnext" data-gstep="1" aria-label="Next photo">›</button>` : ""}
        </div>
        ${imgs.length > 1 ? `<div class="thumbs" data-for="${esc(p.id)}">${imgs.map((src, i) => `<button type="button" data-thumb="${i}" class="${i ? "" : "on"}" aria-pressed="${!i}" aria-label="Show photo ${i + 1}"><img src="${esc(src)}" data-ref="${esc(refs[i])}" alt=""></button>`).join("")}</div>` : ""}`
      : `<div class="pic big stage">${picHTML(p).replace(/^<div class="pic"[^>]*>|<\/div>$/g, "")}</div>`;
    const ICP = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/></svg>';
    const ICC = '<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="6" width="18" height="12" rx="2"/><path d="M3 10h18M7 15h3"/></svg>';
    const ICT = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg>';
    return `
    <article class="itemview">
      <div class="itemgal">${stage}</div>
      <div class="iteminfo">
        <span class="badge">${used ? "Used" + (p.grade ? " · " + esc(p.grade) : "") : "Brand new"}</span>
        <h1>${esc(p.name)}</h1>
        <p class="soldby">Sold by <b>Nojan</b> ${certBadge(true)}</p>
        ${itemIdLine(p)}${offersOf(p).length > 1 ? `<p class="itemid"><button type="button" class="linkbtn coffers" data-gooffers>See all ${offersOf(p).length} offers for this item ›</button></p>` : ""}
        ${summary ? `<p class="lead">${esc(summary)}</p>` : ""}
        <div class="itemprice"><span class="bigp">${p.price == null ? "Ask for price" : money(p.price)}</span></div>
        ${saveHST(p) > 0 ? `<div class="isave"><em>Regular <s>${money(withHST(p.was))}</s> incl. HST · <b>Save ${money(saveHST(p))}</b></em></div>` : ""}
        <p class="itax">No tax added · <a href="#returns">Test before you pay ›</a></p>
        ${!out && p.condition === "new" && left <= 3 ? `<span class="lowstock">Only ${left} left</span>` : ""}
        <span class="meta">${p.brand ? esc(p.brand) : ""}${out ? `${p.brand ? " · " : ""}<b>Sold out</b>` : ""}</span>
        <div class="qtyrow"><span>Quantity</span><span class="qty"><button type="button" data-iq="-1" aria-label="One fewer"${out ? " disabled" : ""}>−</button><span id="iqv">${ITEMQ.q}</span><button type="button" data-iq="1" aria-label="One more"${out ? " disabled" : ""}>+</button></span></div>
        <button type="button" class="btn bagbtn" data-addbag="${esc(p.id)}"${out ? " disabled" : ""}>${out ? "Sold out" : ITEMQ.added ? "Added to Bag ✓" : "Add to Bag"}</button>
        <div class="infobox">
          <div><span class="ibic">${ICP}</span><span><b>Pickup in Richmond Hill</b><br><span>We'll email you to confirm a pickup time, or ask about local delivery.</span></span></div>
          <div><span class="ibic alt">${ICC}</span><span><b>Pay at pickup</b><br><span>e-Transfer or cash, after you test the item. Nothing is charged online.</span></span></div>
          <div><span class="ibic">${ICT}</span><span><b>Test before you pay</b><br><span>Open it and try it at pickup. Once you pay, the sale is final.</span></span></div>
        </div>
        <a class="msglink" href="#contact-us">Questions about this item? Message us ›</a>
      </div>
    </article>
    ${offersHTML(p)}
    ${feats.length || extra.length ? `<section class="hl"><h2>Highlights</h2><div class="hlgrid">
      ${feats.map(f => `<div class="hlcard"><span class="hlbar"></span><span>${f.t ? `<b>${esc(f.t)}</b>` : ""}<span>${esc(f.d)}</span></span></div>`).join("")}
      ${extra.map(x => `<div class="hlcard"><span class="hlbar"></span><span><span>${esc(x)}</span></span></div>`).join("")}
    </div></section>` : ""}${simHTML(p)}`;
  },
  thanks(){ return `<div class="panel" style="max-width:640px;margin:20px auto;text-align:center">
      <h1>Thank you! Your order request was sent.</h1>
      ${lastOrderNo ? `<p style="margin:0;font-size:1.1rem">Order number <b>#${lastOrderNo}</b></p>` : ""}
      <p class="note">We'll contact you soon to confirm your items and arrange payment and pickup or delivery. You can follow its status in My orders.</p>
      <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><a class="btn" href="#my-orders">View my orders</a><a class="btn ghost" href="#home" style="color:var(--fg)">Continue shopping</a></div></div>`; },
  services(){ return servicesView(); },
  service(){ return serviceView(); },
  provider(){ return providerView(); },
  booked(){ return bookedView(); },
  account(){ return accountView(); },
  orders(){ return myOrdersView(); },
  admin(){ return adminView(); },
  about(){ return polView("about"); }, returns(){ return polView("returns"); }, privacy(){ return polView("privacy"); }, terms(){ return polView("terms"); }, certified(){ return polView("certified"); },
  notfound(){ return `<div class="nf"><h1>Page not found</h1><p class="note">This page doesn't exist or has moved.</p><div class="nfbtns"><a class="btn primary" href="#shop">Go to the shop</a><a class="btn" href="#contact-us">Contact us</a></div></div>`; },
  contact(){ return `
    <section class="pagehero contact">
      <div class="phtext">
        <span class="eyebrow">We're here to help</span>
        <h1>Contact us</h1>
        <p>Ask about an item, an order, or holding something for pickup. A real person answers every message.</p>
      </div>
      <div class="pharts" aria-hidden="true"><span>${svgIcon("phone")}</span><span>${svgIcon("box")}</span></div>
    </section>
    <div class="ways">
      <div class="way"><span class="wayic em" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M4 7l8 6 8-6"/></svg></span><b>Email</b><span class="sel">${esc(CONTACT_EMAIL)}</span><button type="button" class="linkbtn" data-copy="${esc(CONTACT_EMAIL)}">Copy address</button></div>
      <div class="way"><span class="wayic ig" aria-hidden="true"><svg viewBox="0 0 24 24"><rect x="3.5" y="3.5" width="17" height="17" rx="5"/><circle cx="12" cy="12" r="4"/><circle cx="17.3" cy="6.7" r=".6"/></svg></span><b>Instagram</b><a href="https://www.instagram.com/nojan_ca/" target="_blank" rel="noopener">@nojan_ca</a><span class="note">Send us a DM</span></div>
    </div>
    <div class="two">
      <div class="panel">
        <h2>Send us a message</h2>
        <form id="contactForm" novalidate>
          <div class="row">
            <label>Name<input id="c-name" name="name" required autocomplete="name"></label>
            <label>Email<input id="c-email" name="email" type="email" required autocomplete="email"></label>
          </div>
          <div class="row">
            <label>Phone <small>(optional)</small><input id="c-phone" name="phone" type="tel" autocomplete="tel"></label>
            <label>Topic
              <select id="c-topic" name="topic"><option>Question about an item</option><option>An order I placed</option><option>Something else</option></select>
            </label>
          </div>
          <label>Message<textarea id="c-msg" name="message" required></textarea></label>
          <div id="contactMsg" hidden></div>
          <button class="btn" type="submit">Send message</button>
        </form>
      </div>
      <aside class="panel faq">
        <h2>Common questions</h2>
        <details open><summary>How do I pay?</summary><p>After you place an order, we contact you to confirm. You can pay by Interac e-Transfer or cash at pickup.</p></details>
        <details><summary>Can I see a used item before buying?</summary><p>Yes. Pick it up in person and check it before you pay.</p></details>
        <details><summary>Can I test an item before I pay?</summary><p>Yes, always. Take as long as you need at pickup. If it works and matches the listing, you pay. If not, you don't have to buy it.</p></details>
        <details><summary>Can I return an item?</summary><p>Because you test and accept items before paying, sales are final once paid. Opening a sealed box means you buy the item unless it's faulty. <a href="#returns">Read the details</a></p></details>
        <details><summary>Do you deliver?</summary><p>Local delivery around Richmond Hill can be arranged when we confirm your order.</p></details>
        <details><summary>Is an item still available?</summary><p>Items shown here are available. Sold items are removed from the shop.</p></details>
        <p class="note">We usually reply within one business day.</p>
      </aside>
    </div>`; }
};

/* Sending email (uses FormSubmit.co — free, no account. The first message asks you to confirm your address once.) */
const MAIL_URL = "https://script.google.com/macros/s/AKfycbxvHu5BN9-l6MjcKR2cwabkfBsC9MJhj45NE7iIQaD3uFGDCFX8_zXf0oJxqgggE9g/exec";   // v97: Nojan mailer (Google script in the shop account)
async function sendEmail(subject, fields){
  try {   // v97: send from the shop Gmail as "Nojan"; FormSubmit below stays as the backup
    const f = {...fields}, cc = f._cc || "", replyTo = f._replyto || "";
    delete f._cc; delete f._replyto; delete f._template;
    let idToken = ""; try { idToken = await window.SHOP_FB.idToken(); } catch (e) {}
    const r = await fetch(MAIL_URL, {method:"POST", headers:{"Content-Type":"text/plain;charset=utf-8"}, body: JSON.stringify({subject, fields:f, cc, replyTo, idToken})});
    const j = await r.json();
    if (j && j.ok) return;
  } catch (e) {}
  const res = await fetch("https://formsubmit.co/ajax/" + encodeURIComponent(SHOP_EMAIL), {
    method:"POST", headers:{"Content-Type":"application/json","Accept":"application/json"},
    body: JSON.stringify({_subject:subject, _template:"table", _captcha:"false", ...fields})
  });
  if (!res.ok) throw new Error("send failed");
  const j = await res.json().catch(()=>({}));
  if (j.success === "false" || j.success === false) throw new Error(j.message || "send failed");
}
function showMsg(el, ok, text){ el.hidden=false; el.className="msg "+(ok?"ok":"err"); el.textContent=text; }
function validate(form){
  for (const el of form.querySelectorAll("[required]")){
    if (!el.value.trim()) { el.focus(); return el.closest("label").childNodes[0].textContent.trim() + " is required."; }
    if (el.type==="email" && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(el.value)) { el.focus(); return "Enter a valid email address, like name@example.com."; }
  }
  return "";
}

document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "searchForm"){ e.preventDefault(); query = $("#q").value; toggleSearch(false); if (!["home","new","used","services","events","dating","homes"].includes(current())) go("home", null, true); else { render(); window.scrollTo(0,0); } return; }
  if (f.id === "orderForm"){
    e.preventDefault();
    const msg = $("#orderMsg"), err = validate(f);
    if (err) return showMsg(msg,false,err);
    if (!USER || !FB) return showMsg(msg,false,"Please sign in to place your order.");
    await catFresh();   // v92: newest prices and stock before checking the cart
    const t = totals(), d = Object.fromEntries(new FormData(f));
    const its = cartItems();
    const over = its.filter(({p,q}) => q > stockOf(p.id));
    if (over.length) return showMsg(msg,false, over.map(({p}) => stockOf(p.id) <= 0 ? `${p.name} just sold out.` : `Only ${stockOf(p.id)} of ${p.name} available.`).join(" ") + " Update your cart and try again.");
    const lines = its.map(({p,q})=>`${q} x ${p.name} (${p.condition}) — ${lineTotal(p,q)}`).join("\n");
    const btn = $("#orderSubmit"); btn.disabled = true; btn.textContent = "Sending…";
    let placed;
    try {
      placed = await FB.placeOrder({
        uid: USER.uid, name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), city: (d.city||"").trim(),
        contactBy: d.contact_preference, notes: (d.notes||"").trim(),
        items: its.map(({p,q}) => ({id:p.id, name:p.name, condition:p.condition, qty:q, price:p.price==null?null:p.price, image:(/^https?:/.test(refsOf(p)[0]||"") ? refsOf(p)[0] : "")})),
        subtotal: +t.sub.toFixed(2), tax: +t.tax.toFixed(2), total: +t.total.toFixed(2), unpriced: t.unpriced
      });
    } catch(err) {
      console.error(err);
      btn.disabled = false; btn.textContent = "Place order request";
      return showMsg(msg,false,`We couldn't save your order. Check your connection and try again, or email us at ${CONTACT_EMAIL}.`);
    }
    FB.saveProfile(USER.uid, {name:d.name.trim(), phone:d.phone.trim(), city:(d.city||"").trim()}).catch(()=>{});
    PROFILE = {...(PROFILE||{}), name:d.name.trim(), phone:d.phone.trim(), city:(d.city||"").trim()};
    sendEmail(`New order #${placed.number} from ${d.name} — ${money(t.total)}`, {
      Order:"#"+placed.number, Name:d.name, Phone:d.phone, Email:d.email, City:d.city, "Contact by":d.contact_preference,
      Items:lines, Total:money(t.total)+(t.unpriced?` (+${t.unpriced} item(s) priced on request)`:""), Notes:d.notes||"—",
      "Manage it":location.origin + "/#admin", _replyto:d.email
    }).catch(()=>{});
    lastOrderNo = placed.number;
    cart = {}; saveCart(); go("thanks");
  }
  if (f.id === "contactForm"){
    e.preventDefault();
    const msg = $("#contactMsg"), err = validate(f);
    if (err) return showMsg(msg,false,err);
    const d = Object.fromEntries(new FormData(f));
    try {
      await sendEmail(`Website message: ${d.topic} — ${d.name}`, {Name:d.name, Email:d.email, Phone:d.phone||"—", Topic:d.topic, Message:d.message, _replyto:d.email});
      f.reset(); showMsg(msg,true,"Message sent. We'll get back to you soon.");
    } catch(_) { showMsg(msg,false,`We couldn't send your message. Try again, or email us at ${CONTACT_EMAIL}.`); }
  }
});
document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.gstep){ stepGallery(b.closest(".gal"), +b.dataset.gstep); return; }
  if (b.dataset.shelf){ const t = document.getElementById(b.dataset.shelf); if (t) t.scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if (b.dataset.thumb != null){ const g = document.querySelector(".itemgal .gal"); if (g) stepGallery(g, +b.dataset.thumb - +g.dataset.i); return; }
  const inCard = !!b.closest(".cardact");
  if (b.dataset.add){ addToCart(b.dataset.add); refreshCards(b.dataset.add, "inc"); }
  else if (b.dataset.inc){ const id = b.dataset.inc; if (!cart[id]) return;
    if (cart[id].q >= stockOf(id)){ toast(`Only ${stockOf(id)} available`); return; }
    cart[id].q++; saveCart();
    if (inCard){ refreshCards(id, "inc"); toast(`${cart[id].q} in cart`); } else render(); }
  else if (b.dataset.dec){ const id = b.dataset.dec, c = cart[id]; if (!c) return; c.q--;
    const gone = c.q <= 0; if (gone) delete cart[id]; saveCart();
    if (inCard){ refreshCards(id, gone ? "add" : "dec"); toast(gone ? "Removed from cart" : `${c.q} in cart`); } else { render(); if (gone) toast("Removed from cart"); } }
  else if (b.dataset.rm){ delete cart[b.dataset.rm]; saveCart(); render(); toast("Removed from cart"); }
  else if (b.hasAttribute("data-reset")){ const c = current(); if (FLT[c]) clearFilters(c); sortBy="featured"; render(); }
  else if (b.hasAttribute("data-fopen")){ setFltOpen(!fltOpen); }
  else if (b.hasAttribute("data-fclose")){ setFltOpen(false); }
  else if (b.hasAttribute("data-fclear")){ const c = current(); if (!FLT[c]) return; clearFilters(c); afterFilterChange(c);
    if (c === "services"){ const a = $("#sMinN"), z = $("#sMaxN"); if (a) a.value = ""; if (z) z.value = ""; } }
  else if (b.dataset.f){ const c = current(), F = FLT[c]; if (!F) return; const k = b.dataset.f, v = b.dataset.v;
    if (k === "sale" || k === "stock" || k === "cert") F[k] = !F[k];
    else { F[k] = F[k].includes(v) ? F[k].filter(x => x !== v) : [...F[k], v];
      if (k === "types"){ const ok = new Set(facetList(c, "brands").map(brandOf)); F.brands = F.brands.filter(x => ok.has(x)); }   // brands follow the chosen type
      if (k === "cats"){ const ok = new Set(svcFacet("provs").map(s => s.providerName)); F.provs = F.provs.filter(x => ok.has(x)); } }   // providers follow the category
    const keepY = b.closest(".fltbody") ? b.closest(".fltbody").scrollTop : 0;
    updateResults(c);
    const body = document.querySelector(".fltbody"); if (body) body.scrollTop = keepY;
    const again = document.querySelector(`.fopt[data-f="${k}"]${v != null ? `[data-v="${CSS.escape(v)}"]` : ""}`); if (again) again.focus({preventScroll:true}); }
  else if (b.dataset.fchip){ const c = current(), F = FLT[c]; if (!F) return; const k = b.dataset.fchip, v = b.dataset.v;
    if (k === "price"){ if (c === "services"){ F.min = F.max = null; const a = $("#sMinN"), z = $("#sMaxN"); if (a) a.value = ""; if (z) z.value = ""; } else priceRange[c] = {min:null,max:null,scale:null}; }
    else if (k === "sale" || k === "stock" || k === "cert") F[k] = false;
    else F[k] = F[k].filter(x => x !== v);
    afterFilterChange(c); }
  else if (b.dataset.copy){ const t=b.dataset.copy; (navigator.clipboard?navigator.clipboard.writeText(t):Promise.reject()).then(()=>toast("Email address copied"),()=>{ const r=document.createRange(); r.selectNodeContents(b.previousElementSibling); const sel=getSelection(); sel.removeAllRanges(); sel.addRange(r); toast("Address selected — press copy"); }); }
  else if (b.hasAttribute("data-clear")){ query=""; $("#q").value=""; render(); }
});


/* ---- Glass top menu: hover drop-downs built from what's in the store ---- */
const MEGA = { key: null, t: null };
const mgEsc = v => esc(String(v));
function megaCols(key){
  const top = (arr, fn, n) => Object.entries(arr.reduce((m, x) => { const k = fn(x); if (k) m[k] = (m[k] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, n);
  if (key === "shop"){
    /* v87: the Shop menu shows only the main categories, most items first, in columns of 6 */
    const types = top(PRODUCTS, typeOf, 99).filter(([t]) => t !== "Other"), cols = [];
    if (!types.length) return [{big: true, h: "Shop", links: [{href: "#shop", label: "All items"}]}];
    for (let i = 0; i < types.length; i += 6) cols.push({cat: true, h: i ? "\u00a0" : "Shop by category", links: types.slice(i, i + 6).map(([t, n]) => ({go: "shop|types|" + t, label: t, n}))});
    cols.push({cat: true, h: "\u00a0", links: [{href: "#shop", label: "See all items (" + PRODUCTS.length + ")", all: true}]});
    return cols;
  }
  if (key === "new" || key === "used"){
    const list = PRODUCTS.filter(p => p.condition === key), word = key === "new" ? "Brand New" : "Used";
    const types = top(list, typeOf, 7), brands = top(list, brandOf, 8);
    const cols = [{big: true, h: "Shop " + word, links: types.length ? types.map(([t, n]) => ({go: key + "|types|" + t, label: t, n})) : [{href: key === "new" ? "#new-items" : "#used-items", label: key === "used" ? "Used items are coming soon" : "All items"}]}];
    if (brands.length) cols.push({h: "Shop by brand", links: brands.map(([b, n]) => ({go: key + "|brands|" + b, label: b, n}))});
    if (key === "used") cols.push({h: "By condition", links: GRADES.map(g => ({go: "used|grades|" + g, label: g}))});
    cols.push({h: "Quick links", links: [
      {href: key === "new" ? "#new-items" : "#used-items", label: "All " + word.toLowerCase() + " items" + (list.length ? " (" + list.length + ")" : "")},
      list.some(p => p.was != null) ? {go: key + "|sale|1", label: "On sale"} : null,
      {href: "#contact-us", label: "Pickup & delivery"},
      {href: "#contact-us", label: "How ordering works"}].filter(Boolean)});
    return cols;
  }
  if (key === "services"){
    const cats = SERVICES.length ? top(SERVICES, s => s.category, 7).map(([c, n]) => ({go: "services|cats|" + c, label: c, n})) : SVC_CATS.slice(0, 6).map(c => ({href: "#services", label: c}));
    return [{big: true, h: "Explore Services", links: cats},
      {h: "How it's held", links: [{go: "services|fmts|Online", label: "Online classes"}, {go: "services|fmts|In person", label: "In person"}, {go: "services|sizes|1-on-1", label: "One-on-one"}, {go: "services|sizes|Group class", label: "Small groups"}]},
      {h: "Quick links", links: [{href: "#services", label: "All services" + (SERVICES.length ? " (" + SERVICES.length + ")" : "")}, {href: "#my-orders", label: "My bookings"}, {href: "#contact-us", label: "Offer a service"}]}];
  }
  return [{big: true, h: "Get help", links: [{href: "#contact-us", label: "Contact us"}, {href: "#contact-us", label: "Pickup & delivery"}, {href: "#contact-us", label: "Paying for your order"}, {href: "#contact-us", label: "Questions & answers"}]},
    {h: "Your account", links: [{href: "#account", label: USER ? "Your account" : "Sign in"}, {href: "#my-orders", label: "My orders & bookings"}, {href: "#cart", label: "Bag"}]},
    {h: "Follow us", links: [{href: "https://www.instagram.com/nojan_ca/", label: "@nojan_ca", ext: true}]}];
}
function megaHTML(key){
  return `<div class="mwrap">${megaCols(key).map(c => `<div class="mcol${c.big ? " big" : ""}${c.cat ? " cat" : ""}"><h4>${mgEsc(c.h)}</h4>${c.links.map(l => l.go
    ? `<a href="${l.go.startsWith("services") ? "#services" : l.go.startsWith("shop") ? "#shop" : l.go.startsWith("new") ? "#new-items" : "#used-items"}" data-mgo="${mgEsc(l.go)}">${mgEsc(l.label)}${l.n && !c.big ? `<i>${l.n}</i>` : ""}</a>`
    : `<a href="${mgEsc(l.href)}"${l.all ? ' class="mall"' : ""}${l.ext ? ' target="_blank" rel="noopener"' : ""}>${mgEsc(l.label)}</a>`).join("")}</div>`).join("")}</div>`;
}
const megaWide = () => matchMedia("(min-width: 821px)").matches;
function megaOpen(key){
  clearTimeout(MEGA.t);
  if (!megaWide() || !key) return;
  if (MEGA.key !== key){ $("#mega").innerHTML = megaHTML(key); }
  MEGA.key = key; $("#mega").hidden = false; $("#megaVeil").hidden = false; $("#gbar").classList.add("open");
  document.querySelectorAll(".gtabs a").forEach(a => { a.classList.toggle("hot", a.dataset.menu === key); if (a.dataset.menu) a.setAttribute("aria-expanded", String(a.dataset.menu === key)); });
}
function megaClose(){
  clearTimeout(MEGA.t); MEGA.key = null;
  const m = $("#mega"); if (!m) return;
  m.hidden = true; $("#megaVeil").hidden = true; $("#gbar").classList.remove("open");
  document.querySelectorAll(".gtabs a").forEach(a => { a.classList.remove("hot"); if (a.dataset.menu) a.setAttribute("aria-expanded", "false"); });
}
const megaLater = () => { clearTimeout(MEGA.t); MEGA.t = setTimeout(megaClose, 450); };
document.addEventListener("mouseover", e => {
  const tab = e.target.closest(".gtabs a");
  if (tab){ tab.dataset.menu ? megaOpen(tab.dataset.menu) : megaLater(); return; }
  if (e.target.closest(".gtools, .gbar .logo")) { if (MEGA.key) megaLater(); return; }
  if (e.target.closest("#gbar")) { clearTimeout(MEGA.t); return; }
  if (MEGA.key) megaLater();
});
document.addEventListener("focusin", e => { const tab = e.target.closest(".gtabs a[data-menu]"); if (tab) megaOpen(tab.dataset.menu); });
document.addEventListener("keydown", e => { if (e.key === "Escape" && MEGA.key) megaClose(); });
document.addEventListener("click", e => {
  if (e.target.closest("#megaVeil")) { megaClose(); return; }
  const g = e.target.closest("[data-mgo]");
  if (g){
    e.preventDefault(); e.stopPropagation();
    const [cond, k, v] = g.dataset.mgo.split("|");
    clearFilters(cond);
    if (k === "sale" || k === "cert") FLT[cond][k] = true; else FLT[cond][k] = [v];
    megaClose(); go(cond); return;
  }
  if (e.target.closest("#gbar a")) megaClose();
}, true);

/* Quick type / brand chips on Brand New and Used, and the search panel */
document.addEventListener("click", e => {
  const t = e.target.closest("[data-qt]"), b = e.target.closest("[data-qb]");
  if (t || b){
    const c = current(), F = FLT[c]; if (!F) return;
    if (t){ const v = t.dataset.qt; F.types = !v || (F.types.length === 1 && F.types[0] === v) ? [] : [v];
      const ok = new Set(filtered(c).filter(p => !F.types.length || F.types.includes(typeOf(p))).map(brandOf)); F.brands = F.brands.filter(x => ok.has(x)); }
    else { const v = b.dataset.qb; F.brands = F.brands.length === 1 && F.brands[0] === v ? [] : [v]; }
    updateResults(c);
    const again = document.querySelector(t ? `[data-qt="${CSS.escape(t.dataset.qt)}"]` : `[data-qb="${CSS.escape(b.dataset.qb)}"]`); if (again) again.focus({preventScroll: true});
    return;
  }
  const sb = e.target.closest("[data-search]");
  if (sb){ e.preventDefault(); toggleSearch(); return; }
});
function toggleSearch(force){
  const p = $("#gsearch"), open = force != null ? force : p.hidden;
  p.hidden = !open; $("#searchBtn").setAttribute("aria-expanded", String(open));
  if (open){
    
    const v = current(), ph = {new: "Search brand new items", used: "Search used items", services: "Search services", events: "Search events", dating: "Search people by name, city or interest", homes: "Search homes by city, street or type"}[v] || "Search items and services";
    $("#q").placeholder = ph; $("#q").setAttribute("aria-label", ph);
    megaClose(); setTimeout(() => $("#q").focus(), 30);
  }
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && !$("#gsearch").hidden) toggleSearch(false); });

document.addEventListener("click", e => {
  const iq = e.target.closest("[data-iq]");
  if (iq){ const p = PRODUCTS.find(x => x.id === itemId); if (!p) return; const max = Math.max(1, stockOf(p.id) - qtyOf(p.id));
    ITEMQ.q = Math.min(max, Math.max(1, ITEMQ.q + (+iq.dataset.iq))); const v = $("#iqv"); if (v) v.textContent = ITEMQ.q;
    if (+iq.dataset.iq > 0 && ITEMQ.q === max) toast(`Only ${stockOf(p.id)} available`); return; }
  const ab = e.target.closest("[data-addbag]");
  if (ab){ const id = ab.dataset.addbag, p = PRODUCTS.find(x => x.id === id); if (!p) return;
    const have = qtyOf(id), n = Math.min(ITEMQ.q, stockOf(id) - have);
    if (n <= 0){ toast(stockOf(id) <= 0 ? "Sorry, this item is sold out" : `You already have all ${stockOf(id)} in your bag`); return; }
    cart[id] = {q: have + n, snap: p}; saveCart(); ITEMQ.added = true; ab.textContent = "Added to Bag ✓"; toast(n === 1 ? "Added to your bag" : `${n} added to your bag`); }
});
/* Page navigation — handled in script so it works inside embeds and previews too */
const SLUG = {home:"home", news:"news", shop:"shop", new:"new-items", used:"used-items", contact:"contact-us", cart:"cart", checkout:"checkout", thanks:"order-sent", account:"account", orders:"my-orders", admin:"admin", services:"services", booked:"booking-sent", events:"events", dating:"dating", matches:"matches", datingprofile:"dating-profile", homes:"homes", listhome:"list-your-home", mylistings:"my-listings", selling:"selling", sell:"sell", about:"about", returns:"returns", privacy:"privacy", terms:"terms", certified:"certified"};
const VIEW_OF = Object.fromEntries(Object.entries(SLUG).map(([v,sl])=>[sl,v]));
Object.keys(SLUG).forEach(v => VIEW_OF[v] = VIEW_OF[v] || v);   // old links like #new still work
let bookingId = null, itemId = null, serviceId = null, providerId = null, eventId = null, personId = null, chatId = null, listingId = null, hchatId = null, PROVIDERS = [], providersLoaded = false;
// v93: real page addresses (nojans.com/shop, nojans.com/item-s-U002). preview.html keeps the old #addresses.
const PREVIEW = /^\/preview(\.html)?$/.test(location.pathname);
const PATH_MODE = !PREVIEW && /^https?:$/.test(location.protocol);
const isRouteSlug = s => /^(item|service|provider|event|person|chat|listing|hchat|mybooking)-./.test(s) || Object.prototype.hasOwnProperty.call(VIEW_OF, s);
const pathFor = s => !s || s === "home" ? "/" : "/" + encodeURIComponent(s);
function slugNow(){
  let h = location.hash.slice(1); try { h = decodeURIComponent(h); } catch (_) {}
  if (!PATH_MODE) return h;
  if (h && isRouteSlug(h)) return h;
  let p = location.pathname.replace(/^\/+|\/+$/g, "").replace(/\.html$/, ""); try { p = decodeURIComponent(p); } catch (_) {}
  return p === "index" ? "" : p;
}
function viewFromHash(){
  const h = slugNow();
  if (h.startsWith("mybooking-")){ bookingId = h.slice(10); return "mybooking"; }
  if (h.startsWith("item-")){ itemId = h.slice(5); return "item"; }
  if (h.startsWith("service-")){ serviceId = h.slice(8); return "service"; }
  if (h.startsWith("provider-")){ providerId = h.slice(9); return "provider"; }
  if (h.startsWith("event-")){ eventId = h.slice(6); return "event"; }
  if (h.startsWith("person-")){ personId = h.slice(7); DT.gi = 0; return "person"; }
  if (h.startsWith("chat-")){ chatId = h.slice(5); return "chat"; }
  if (h.startsWith("listing-")){ listingId = h.slice(8); HM.gi = 0; return "listing"; }
  if (h.startsWith("hchat-")){ hchatId = h.slice(6); return "hchat"; }
  const vv = VIEW_OF[h] || (h && PATH_MODE ? "notfound" : "home");
  if (vv === "new" || vv === "used"){ clearFilters("shop"); FLT.shop.conds = [vv]; return "shop"; }
  return vv;
}
let currentView = viewFromHash();
if (PATH_MODE && location.hash.length > 1 && isRouteSlug(slugNow())) { try { history.replaceState(null, "", pathFor(slugNow())); } catch (_) {} }
function current(){ return views[currentView] ? currentView : "home"; }
// v94: Back (and Forward) return to the same place on the page instead of the top
const SCR = {key: "", pend: null, from: null, busy: false};
const SCR_RAILS = ".homegrid,.explore,.news3,.h5tabs";
try { history.scrollRestoration = "manual"; } catch (_) {}
function scrStateKey(){ try { return (history.state && history.state.k) || ""; } catch (_) { return ""; } }
function scrNewKey(){ return Date.now().toString(36) + Math.random().toString(36).slice(2, 6); }
function scrMark(){ let k = scrStateKey(); if (!k){ k = scrNewKey(); try { history.replaceState({k}, ""); } catch (_) {} } SCR.key = k; }
function scrAll(){ try { return JSON.parse(sessionStorage.getItem("nojanScroll") || "{}") || {}; } catch (_) { return {}; } }
function scrPend(){ if (SCR.pend && Date.now() - SCR.pend.t > 15000) SCR.pend = null; return SCR.pend; }
function scrSave(){
  if (!SCR.key || scrPend()) return;
  const rails = []; document.querySelectorAll("#view " + SCR_RAILS).forEach((el, i) => { if (el.scrollLeft > 0) rails.push([i, Math.round(el.scrollLeft)]); });
  const all = scrAll(); delete all[SCR.key]; all[SCR.key] = [Math.round(window.scrollY || 0), rails];
  const keys = Object.keys(all); while (keys.length > 60) delete all[keys.shift()];
  try { sessionStorage.setItem("nojanScroll", JSON.stringify(all)); } catch (_) {}
}
function scrApply(){
  const p = scrPend(); if (!p) return;
  const els = document.querySelectorAll("#view " + SCR_RAILS);
  p.x.forEach(([i, left]) => { if (els[i]) els[i].scrollLeft = left; });
  window.scrollTo({top: p.y, left: 0, behavior: "instant"});
}
function scrBack(k){ const p = k && scrAll()[k]; if (!p) return false; SCR.pend = {y: p[0], x: p[1] || [], t: Date.now()}; scrApply(); return true; }
["wheel", "touchstart", "keydown", "mousedown"].forEach(t => window.addEventListener(t, () => { SCR.pend = null; }, {passive: true, capture: true}));
window.addEventListener("pagehide", scrSave);
try { new ResizeObserver(() => scrApply()).observe(document.getElementById("view") || document.body); } catch (_) {}   // the page grows as items load: keep going to the saved place
function go(v, id, keepQuery){
  scrSave(); SCR.pend = null; const fromView = current();
  if (v === "new" || v === "used"){ clearFilters("shop"); FLT.shop.conds = [v]; v = "shop"; }
  if (!views[v]) v = "home";
  if (!keepQuery){ if (query){ query = ""; const qi = $("#q"); if (qi) qi.value = ""; } const gs = $("#gsearch"); if (gs && !gs.hidden) toggleSearch(false); }
  if (v === "item") itemId = id;
  if (v === "mybooking" && id != null) bookingId = id;
  if (v === "service" && id != null && id !== serviceId){ serviceId = id; resetBooking(); }
  if (v === "provider" && id != null) providerId = id;
  if (v === "event" && id != null) eventId = id;
  if (v === "person" && id != null){ personId = id; DT.gi = 0; }
  if (v === "chat" && id != null) chatId = id;
  if (v === "listing" && id != null){ listingId = id; HM.gi = 0; }
  if (v === "hchat" && id != null) hchatId = id;
  currentView = v; render(); window.scrollTo(0,0); pageIn();
  const slug = v === "mybooking" ? "mybooking-" + bookingId : v === "item" ? "item-" + id : v === "service" ? "service-" + serviceId : v === "provider" ? "provider-" + providerId : v === "event" ? "event-" + eventId : v === "person" ? "person-" + personId : v === "chat" ? "chat-" + chatId : v === "listing" ? "listing-" + listingId : v === "hchat" ? "hchat-" + hchatId : SLUG[v];
  try {
    const k = scrNewKey();
    if (PATH_MODE){ const u = pathFor(slug); if (location.pathname !== u || location.hash){ history.pushState({k}, "", u); SCR.key = k; SCR.from = fromView; } }
    else if (location.hash.slice(1) !== slug){ SCR.busy = true; try { location.hash = slug; history.replaceState({k}, ""); } finally { SCR.busy = false; } SCR.key = k; SCR.from = fromView; }
  } catch(_) {}
}
document.addEventListener("click", e => {
  if (e.defaultPrevented || e.button || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
  const a = e.target.closest('a[href^="#"], a[data-r]');
  if (!a || a.hasAttribute("data-top")) return;
  const h = a.hasAttribute("data-r") ? a.dataset.r : a.getAttribute("href").slice(1);
  if (h.startsWith("mybooking-")){ e.preventDefault(); go("mybooking", decodeURIComponent(h.slice(10))); return; }
  if (h.startsWith("item-")){ e.preventDefault(); go("item", decodeURIComponent(h.slice(5))); return; }
  if (h.startsWith("service-")){ e.preventDefault(); go("service", decodeURIComponent(h.slice(8))); return; }
  if (h.startsWith("provider-")){ e.preventDefault(); go("provider", decodeURIComponent(h.slice(9))); return; }
  if (h.startsWith("event-")){ e.preventDefault(); go("event", decodeURIComponent(h.slice(6))); return; }
  if (h.startsWith("person-")){ e.preventDefault(); go("person", decodeURIComponent(h.slice(7))); return; }
  if (h.startsWith("chat-")){ e.preventDefault(); go("chat", decodeURIComponent(h.slice(5))); return; }
  if (h.startsWith("listing-")){ e.preventDefault(); go("listing", decodeURIComponent(h.slice(8))); return; }
  if (h.startsWith("hchat-")){ e.preventDefault(); go("hchat", decodeURIComponent(h.slice(6))); return; }
  const v = VIEW_OF[h];
  if (!v) return;
  if (a.closest("#crumbs") && SCR.from && SCR.from === (v === "new" || v === "used" ? "shop" : v) && ["item", "service", "provider"].includes(current())){ e.preventDefault(); history.back(); return; }
  if (v === "shop" && FLT.shop){ FLT.shop.conds = []; }
  e.preventDefault(); go(v);
});
document.addEventListener("click", e => {
  const card = e.target.closest(".card");
  if (!card || e.target.closest("button, a, input, select, .cardact")) return;
  const a = card.querySelector(".piclink"); if (!a) return;
  go("item", decodeURIComponent(a.getAttribute("href").slice(6)));
});
// v93: in-site links get real addresses so they can be opened in a new tab, shared and found by search engines
const R_OK = /^(home|shop|services|contact-us|news|cart|checkout|account|my-orders|about|returns|privacy|terms|certified|new-items|used-items|(item|service|provider|mybooking)-.+)$/;
function relink(root){
  if (!PATH_MODE || !root || root.nodeType !== 1) return;
  const fix = a => { const h = a.getAttribute("href"); if (!h || h[0] !== "#") return; let s = h.slice(1); try { s = decodeURIComponent(s); } catch (_) {} if (!R_OK.test(s)) return; a.dataset.r = s; a.setAttribute("href", pathFor(s)); };
  if (root.matches("a[href]")) fix(root);
  root.querySelectorAll('a[href^="#"]').forEach(fix);
}
if (PATH_MODE){ relink(document.body); new MutationObserver(l => { for (const r of l){ if (r.type === "attributes") relink(r.target); else r.addedNodes.forEach(relink); } }).observe(document.body, {subtree: true, childList: true, attributes: true, attributeFilter: ["href"]}); }
document.addEventListener("click", e => {
  const a = e.target.closest("[data-goshelf]"); if (!a || e.button || e.metaKey || e.ctrlKey || e.shiftKey) return;
  e.preventDefault(); e.stopPropagation(); clearFilters("shop"); go("shop");
  requestAnimationFrame(() => { const s = document.querySelector(`.shelf[data-cat="${CSS.escape(a.dataset.goshelf)}"]`); if (s) s.scrollIntoView({block: "start"}); });
}, true);
function stepGallery(gal, step){
  if (!gal) return;
  const p = PRODUCTS.find(x => x.id === gal.dataset.gal); if (!p) return;
  const imgs = imagesOf(p), n = imgs.length, i = ((+gal.dataset.i + step) % n + n) % n;
  gal.dataset.i = i;
  const img = gal.querySelector("img"); img.dataset.ref = refsOf(p)[i]; img.src = imgs[i]; img.alt = `${p.name}, photo ${i + 1} of ${n}`;
  gal.querySelectorAll(".gdots span").forEach((d, j) => d.classList.toggle("on", j === i));
  document.querySelectorAll(`.thumbs[data-for="${CSS.escape(p.id)}"] button`).forEach((t, j) => { t.classList.toggle("on", j === i); t.setAttribute("aria-pressed", j === i); });
}
let swipeX = null;
document.addEventListener("touchstart", e => { const g = e.target.closest(".gal"); swipeX = g ? [g, e.touches[0].clientX] : null; }, {passive:true});
document.addEventListener("touchend", e => { if (!swipeX) return; const [g, x0] = swipeX, dx = e.changedTouches[0].clientX - x0; swipeX = null; if (Math.abs(dx) > 40) stepGallery(g, dx < 0 ? 1 : -1); }, {passive:true});
function pageIn(){ const el = $("#view"); if (!el) return; el.classList.remove("vin"); void el.offsetWidth; el.classList.add("vin"); }
function render(){
  const v = current();
  document.body.dataset.view = v;
  if (v !== render.last) fltOpen = false;   // the panel closes when you change page
  render.last = v;
  document.body.classList.toggle("fltopen", !!((FLT[v] || v === "events" || v === "dating" || v === "homes") && fltOpen));
  if (v !== "hchat" && HM.chat.unsub){ HM.chat.unsub(); HM.chat = {id: null, msgs: null, unsub: null}; }
  if (v !== "listhome" && HM.form && !HM.busy){ HM.form = null; HM.editId = null; }
  if (v !== "mylistings" && v !== "admin") HM.arm = "";
  if (v !== "selling" && v !== "admin") MK.arm = "";
  if (v !== "sell" && MK.form && !MK.busy){ MK.form = null; MK.editId = null; }
  if (HM.map){ try { HM.map.remove(); } catch (_) {} HM.map = null; }
  if (HM.mini){ try { HM.mini.remove(); } catch (_) {} HM.mini = null; }
  if (v !== "chat" && DT.chat.unsub){ DT.chat.unsub(); DT.chat = {id: null, msgs: null, unsub: null}; }
  if (v !== "datingprofile" && DT.form && !DT.busy){ DT.form = null; DT.err = ""; }
  if (!["datingprofile", "chat"].includes(v)) DT.delArm = false;
  $("#view").innerHTML = views[v]();
  invTab();
  if (HM_VIEWS.includes(v)) hmAfterRender(v);
  if (v === "home") homeRowsInit();
  if (priceRange[v]) syncPriceUI(v);
  const it = v === "item" ? PRODUCTS.find(p => p.id === itemId) : null;
  const hct = v === "hchat" && (HM.threads || []).find(x => x.id === hchatId), mkt = hct && hct.marketId;
  const navV = it || v === "item" ? "shop" : v === "hchat" && mkt ? "account" : ["service", "booked", "provider"].includes(v) ? "services" : v === "event" ? "events" : ["person", "matches", "chat", "datingprofile"].includes(v) ? "dating" : ["listing", "listhome", "mylistings", "hchat"].includes(v) ? "homes" : v;
  if (v === "service") afterServiceRender();
  if (v === "provider") renderLinkedInBadges();
  document.querySelectorAll("header nav a, .tabbar a").forEach(a => (a.dataset.tab===navV || a.dataset.also===navV) ? a.setAttribute("aria-current","page") : a.removeAttribute("aria-current"));
  document.title = it ? `${it.name} · Nojan` : TITLES[v] || "Nojan";
  ["new","used"].forEach(c => { const el = document.querySelector(`[data-count="${c}"]`); if (el) el.textContent = feedState[c]==="loading" ? "" : PRODUCTS.filter(p=>p.condition===c).length; });
  { const el = document.querySelector('[data-count="services"]'); if (el) el.textContent = SERVICES.length || ""; }
  if (v === "service"){ const s = SERVICES.find(x => x.id === serviceId); if (s) document.title = `${s.title} · Nojan`; }
  if (v === "provider"){ const pp = providerById(providerId); if (pp) document.title = `${pp.name} · Nojan`; }
  if (v === "event"){ const ee = eventById(eventId); if (ee) document.title = `${ee.title} · Nojan`; }
  if (v === "events") document.title = "Events · Nojan";
  if (MK_VIEWS.includes(v)) document.title = (v === "sell" ? "New listing" : "Sell on Nojan") + " · Nojan";
  { const mid = v === "item" && String(itemId).startsWith("m-") ? itemId : v === "service" && String(serviceId).startsWith("m-") ? serviceId : v === "event" && String(eventId).startsWith("m-") ? eventId : ""; const md = mid && mkFind(mid.slice(2)); if (md) document.title = md.title + " · Nojan"; }
  if (HM_VIEWS.includes(v)){ const hh = v === "listing" && ((HM.list || []).find(x => x.id === listingId) || HM.extra[listingId]); document.title = (hh ? hh.title : {homes: "Homes", listing: "Home", listhome: "List your home", mylistings: "My listings", hchat: "Messages"}[v]) + " · Nojan"; }
  if (DT_VIEWS.includes(v)) document.title = (v === "person" && dtProfile(personId) ? dtProfile(personId).name : {dating: "Dating", matches: "Matches", chat: "Chat", datingprofile: "My dating profile", person: "Dating"}[v]) + " · Nojan";
  const trail = v === "item" ? (it ? [["Shop", "#shop"], [it.name]] : [["Shop", "#shop"], ["Item"]])
    : {shop:[["Shop"]], new:[["Shop"]], used:[["Shop"]], contact:[["Contact us"]], news:[["News"]], cart:[["Cart"]], checkout:[["Cart","#cart"],["Checkout"]], thanks:[["Cart","#cart"],["Order sent"]], account:[["Your account"]], orders:[["My orders & bookings"]], admin:[["Admin"]], services:[["Services"]], booked:[["Services","#services"],["Booking sent"]],
         service:[["Services","#services"],[(SERVICES.find(s=>s.id===serviceId)||{}).title || "Service"]],
         provider:[["Services","#services"],[(providerById(providerId)||{}).name || "Provider"]],
         events:[["Events"]], event:[["Events","#events"],[(eventById(eventId)||{}).title || "Event"]],
         dating:[["Dating"]], person:[["Dating","#dating"],[(dtProfile(personId)||{}).name || "Profile"]], matches:[["Dating","#dating"],["Matches"]],
         chat:[["Dating","#dating"],["Matches","#matches"],["Chat"]], datingprofile:[["Dating","#dating"],["My profile"]],
         homes:[["Homes"]], listing:[["Homes","#homes"],[(((HM.list || []).find(x => x.id === listingId) || HM.extra[listingId] || {}).city) || "Listing"]], listhome:[["Homes","#homes"],["List your home"]],
         mylistings:[["Homes","#homes"],["My listings"]], hchat: mkt ? [["Sell on Nojan","#selling"],["Messages"]] : [["Homes","#homes"],["My listings","#my-listings"],["Messages"]],
         mybooking:[["My orders & bookings","#my-orders"],["Booking"]],
         about:[["About Nojan"]], returns:[["Test before you pay"]], privacy:[["Privacy policy"]], terms:[["Terms of use"]], certified:[["What Certified means"]], notfound:[["Page not found"]],
         selling:[["Your account","#account"],["Sell on Nojan"]], sell:[["Sell on Nojan","#selling"],[MK.form && MK.form.id ? "Edit listing" : "New listing"]]}[v];
  const cr = $("#crumbs");
  if (trail){ cr.innerHTML = `<li><a href="#home">Home</a></li>` + trail.map(([t,h])=> h?`<li><a href="${h}">${esc(t)}</a></li>`:`<li aria-current="page">${esc(t)}</li>`).join(""); cr.hidden = false; }
  else cr.hidden = true;
  scrApply();
}
document.addEventListener("click", e => { const a = e.target.closest("a[data-top]"); if (a){ e.preventDefault(); window.scrollTo({top:0, behavior: matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth"}); } });
function afterPriceChange(cond){
  syncPriceUI(cond); updateResults(cond);
  const clr = document.querySelector('.pricein [data-fchip="price"]'); if (clr) clr.hidden = !rangeOf(cond).active;
}
document.addEventListener("keydown", e => { if (e.key === "Escape" && fltOpen) setFltOpen(false); });
document.addEventListener("input", e => {
  const id = e.target.id, cond = current();
  if ((id !== "pmin" && id !== "pmax") || !priceRange[cond]) return;
  const r = priceRange[cond], {B, min, max} = rangeOf(cond), natural = priceBound(cond);
  const v = +e.target.value;
  if (id === "pmin"){
    const a = Math.min(v, Math.min(max, B));          // can't pass the right handle
    r.min = a <= 0 ? null : a;
  } else {
    const b = Math.max(v, Math.min(min, B));          // can't pass the left handle
    r.max = (b >= B && B === natural) ? null : b;     // far right on the normal scale = no limit
  }
  afterPriceChange(cond);
});
document.addEventListener("change", e => {
  const id = e.target.id, cond = current();
  if (id === "sort"){ sortBy = e.target.value; updateResults(cond); return; }
  if (id === "sMinN" || id === "sMaxN"){ const F = FLT.services, v = parseFloat(e.target.value);
    if (id === "sMinN") F.min = isNaN(v) || v <= 0 ? null : v; else F.max = isNaN(v) ? null : Math.max(0, v);
    if (F.min != null && F.max != null && F.min > F.max){ const t = F.min; F.min = F.max; F.max = t; $("#sMinN").value = F.min; $("#sMaxN").value = F.max; }
    updateResults("services"); return; }
  if ((id === "pminN" || id === "pmaxN") && priceRange[cond]){
    const v = parseFloat(e.target.value), r = priceRange[cond];
    if (id === "pminN") r.min = isNaN(v) || v <= 0 ? null : v;          // empty or 0 = from $0
    else r.max = isNaN(v) ? null : Math.max(0, v);                       // empty = no upper limit
    if (r.min != null && r.max != null && r.min > r.max){ const t = r.min; r.min = r.max || null; r.max = t; }  // swapped? fix order
    const top = Math.max(r.min ?? 0, r.max ?? 0), nat = priceBound(cond);
    r.scale = top > nat ? Math.ceil(top / priceStep(top)) * priceStep(top) : null;
    afterPriceChange(cond);
    $("#pminN").value = r.min ?? 0; $("#pmaxN").value = r.max ?? "";
  }
});
function onRouteChange(){ if (PATH_MODE && location.hash.length > 1 && isRouteSlug(slugNow())) { try { history.replaceState(null, "", pathFor(slugNow())); } catch (_) {} }
  const sk = scrStateKey(), moved = !SCR.busy && sk !== SCR.key; if (moved){ scrSave(); SCR.pend = null; SCR.from = null; }
  const prevBk = bookingId, prevItem = itemId, prevSvc = serviceId, prevProv = providerId, prevEv = eventId, prevPer = personId, prevChat = chatId, prevLst = listingId, prevHc = hchatId, v = viewFromHash();
  if (v !== currentView && query){ query = ""; const qi = $("#q"); if (qi) qi.value = ""; } if (v !== currentView || (v === "mybooking" && bookingId !== prevBk) || (v === "item" && itemId !== prevItem) || (v === "service" && serviceId !== prevSvc) || (v === "provider" && providerId !== prevProv) || (v === "event" && eventId !== prevEv) || (v === "person" && personId !== prevPer) || (v === "chat" && chatId !== prevChat) || (v === "listing" && listingId !== prevLst) || (v === "hchat" && hchatId !== prevHc)){ if (v === "service" && serviceId !== prevSvc) resetBooking(); currentView = v; render(); if (!(moved && scrBack(sk))) window.scrollTo(0,0); pageIn(); }
  if (moved){ if (sk) SCR.key = sk; else scrMark(); } }
window.addEventListener("hashchange", onRouteChange);
window.addEventListener("popstate", onRouteChange);
{ const k = scrStateKey(); scrMark(); if (k) scrBack(k); }   // v94: a reload or a Back into a freshly loaded page also returns to its place
/* =========================================================
   ACCOUNTS, ORDERS AND ADMIN (Firebase)
   ========================================================= */
const ADMIN_EMAILS = ["online.shop.on.ca@gmail.com", "moe.naghavi@outlook.com"];   // these accounts see the Admin page
const STATUSES = ["New", "Contacted", "Ready for pickup", "Completed", "Cancelled"];
const STATUS_TEXT = {
  "New": "We received your order and will contact you soon to confirm it.",
  "Contacted": "We've reached out to confirm your order. Please check your phone and email.",
  "Ready for pickup": "Your order is ready for pickup in Richmond Hill. Reply to this email to set a pickup time.",
  "Completed": "Your order is complete. Thank you for shopping with Nojan!",
  "Cancelled": "Your order was cancelled. If this is a mistake, just reply to this email."
};
let FB = null, fbFailed = false, USER = null, PROFILE = null, authReady = false;
let authMode = "signin", afterLogin = null, lastOrderNo = null, signingUp = false;
let MY = {orders:null, unsub:null};
let ADM = {orders:null, users:null, unsubO:null, unsubU:null, tab:"orders", status:"Open", q:"", uid:null, open:new Set(), pending:false, notes:{}};

const stClass = s => "st-" + String(s).split(" ")[0];
const pill = s => `<span class="pill ${stClass(s)}">${esc(s)}</span>`;
const isAdmin = () => !!USER && USER.emailVerified && ADMIN_EMAILS.includes(String(USER.email||"").toLowerCase());
const fmtDate = ts => { const d = ts && ts.toDate ? ts.toDate() : (ts ? new Date(ts) : null); return d ? d.toLocaleString("en-CA", {month:"short", day:"numeric", year:"numeric", hour:"numeric", minute:"2-digit"}) : "just now"; };
const tsNum = ts => ts && ts.toMillis ? ts.toMillis() : (ts ? +new Date(ts) : Date.now());
const itemPrice = it => it.price == null ? "Price on request" : money(it.price * it.qty);
function googleBtn(next){ return `<button type="button" class="gbtn" data-google${next ? ` data-next="${next}"` : ""}><svg viewBox="0 0 48 48" aria-hidden="true"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.2 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.4-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.7 15.1 19 12 24 12c3.1 0 5.8 1.2 7.9 3.1l5.7-5.7C34 6.1 29.3 4 24 4 16.3 4 9.7 8.3 6.3 14.7z"/><path fill="#4CAF50" d="M24 44c5.2 0 9.9-2 13.4-5.2l-6.2-5.2C29.2 35.1 26.7 36 24 36c-5.2 0-9.6-3.3-11.3-8l-6.5 5C9.5 39.6 16.2 44 24 44z"/><path fill="#69696a" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.2-4.1 5.6l6.2 5.2C37 39.2 44 34 44 24c0-1.3-.1-2.4-.4-3.5z"/></svg>Continue with Google</button>${msBtn(next)}`; }
/* v76: Microsoft sign-in (Outlook, Hotmail, Live and work or school accounts) */
function msBtn(next){ return `<button type="button" class="gbtn msbtn" data-microsoft${next ? ` data-next="${next}"` : ""}><svg viewBox="0 0 21 21" aria-hidden="true"><path fill="#f25022" d="M1 1h9v9H1z"/><path fill="#7fba00" d="M11 1h9v9h-9z"/><path fill="#878788" d="M1 11h9v9H1z"/><path fill="#ffb900" d="M11 11h9v9h-9z"/></svg>Continue with Microsoft</button>`; }
function authError(e){
  const c = (e && e.code) || "";
  return ({
    "auth/invalid-credential":"That email and password don't match. Try again, or reset your password.",
    "auth/wrong-password":"That email and password don't match. Try again, or reset your password.",
    "auth/user-not-found":"No account uses that email. Create an account instead.",
    "auth/email-already-in-use":"An account already uses that email. Sign in instead, or reset your password.",
    "auth/weak-password":"Use a password with at least 6 characters.",
    "auth/invalid-email":"Enter a valid email address, like name@example.com.",
    "auth/too-many-requests":"Too many tries. Wait a few minutes and try again.",
    "auth/network-request-failed":"No connection. Check your internet and try again.",
    "auth/popup-blocked":"Your browser blocked the sign-in window. Allow pop-ups for this site and try again.",
    "auth/unauthorized-domain":"This sign-in option isn't enabled for this web address yet.",
    "auth/account-exists-with-different-credential":"You already have an account with this email. Sign in the way you did before (Google or email and password).",
    "auth/operation-not-allowed":"This sign-in option isn't switched on yet. Please use Google or email for now."
  })[c] || "Something went wrong. Please try again.";
}
function updateAcct(){
  const hello = $("#acctHello"), lab = $("#acctLabel");
  if (USER){ const n = (PROFILE && PROFILE.name) || USER.displayName || (USER.email||"").split("@")[0]; hello.textContent = "Hello, " + n.split(" ")[0]; lab.textContent = "Account"; }
  else { hello.textContent = "Hello, sign in"; lab.textContent = "Account"; }
  $("#acctBtn").setAttribute("aria-label", USER ? "Your account" : "Sign in or create an account");
  $("#navAdmin").hidden = !isAdmin();
}
function needSignIn(next, title, text){
  if (!authReady) return `<div class="empty">${fbFailed ? "We couldn't connect to the account service. Check your connection and refresh the page." : "Loading your account…"}</div>`;
  return `<div class="panel authbox signinprompt"><h1 style="font-size:1.5rem">${esc(title)}</h1><p class="note">${esc(text)}</p>${googleBtn(next)}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-auth="signin" data-next="${next}">Sign in with email</button><button class="btn ghost" type="button" data-auth="signup" data-next="${next}" style="color:var(--fg)">Create account</button></div><div id="authMsg" hidden></div></div>`;
}

/* ---- Account page ---- */
function accountView(){
  if (!authReady) return needSignIn("account", "Your account", "");
  if (!USER){
    const up = authMode === "signup", reset = authMode === "reset";
    return `<div class="panel authbox">
      <h1 style="font-size:1.6rem">${reset ? "Reset your password" : up ? "Create your account" : "Sign in"}</h1>
      ${reset ? `<p class="note">Enter your email and we'll send you a link to set a new password.</p>
        <form id="resetForm" novalidate><label>Email<input name="email" type="email" required autocomplete="email"></label><div id="authMsg" hidden></div><button class="btn" type="submit">Send reset link</button></form>
        <button class="linkbtn" type="button" data-mode="signin">Back to sign in</button>` : `
      <div class="authtabs" role="group" aria-label="Sign in or create account"><button type="button" data-mode="signin" aria-pressed="${!up}">Sign in</button><button type="button" data-mode="signup" aria-pressed="${up}">Create account</button></div>
      ${googleBtn()}
      <div class="orsep">or use your email</div>
      ${up ? `<form id="signupForm" novalidate>
          <label>Full name<input name="name" required autocomplete="name"></label>
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <label>Phone <small>(optional, so we can call about orders)</small><input name="phone" type="tel" autocomplete="tel"></label>
          <label>Password <small>(at least 6 characters)</small><input name="password" type="password" required minlength="6" autocomplete="new-password"></label>
          <div id="authMsg" hidden></div>
          <button class="btn" type="submit">Create account</button>
        </form>` : `<form id="signinForm" novalidate>
          <label>Email<input name="email" type="email" required autocomplete="email"></label>
          <label>Password<input name="password" type="password" required autocomplete="current-password"></label>
          <div id="authMsg" hidden></div>
          <button class="btn" type="submit">Sign in</button>
        </form>
        <button class="linkbtn" type="button" data-mode="reset" style="justify-self:start">Forgot your password?</button>`}
      <p class="note">You can browse without an account. You need one to place an order.</p>`}
    </div>`;
  }
  const pr = PROFILE || {};
  const viaGoogle = (USER.providerData||[]).some(p => p.providerId === "google.com");
  return `<div class="sectionhead"><h1>Your account</h1><button class="linkbtn" type="button" data-signout>Sign out</button></div>
  <div class="two">
    <div class="panel">
      <h2>Your details</h2>
      ${!USER.emailVerified && !viaGoogle ? `<div class="verify"><span>Please confirm your email address. We sent a link to ${esc(USER.email)}.</span><span style="display:flex;gap:14px"><button class="linkbtn" type="button" data-recheck>I've confirmed it</button><button class="linkbtn" type="button" data-resend>Send it again</button></span></div>` : ""}
      <form id="profileForm" novalidate>
        <div class="row">
          <label>Full name<input name="name" required autocomplete="name" value="${esc(pr.name || USER.displayName || "")}"></label>
          <label>Phone<input name="phone" type="tel" autocomplete="tel" value="${esc(pr.phone || "")}"></label>
        </div>
        <div class="row">
          <label>Email <small>(sign-in address)</small><input value="${esc(USER.email || "")}" disabled></label>
          <label>Date of birth <small id="ageOut">${ageOf(pr.dob) != null ? "Age " + ageOf(pr.dob) : ""}</small><input name="dob" type="date" min="1900-01-01" max="${new Date().toLocaleDateString("en-CA")}" autocomplete="bday" value="${esc(pr.dob || "")}"></label>
        </div>
        <div class="addrrow">
          <div class="addrwrap"><label for="addrIn">Street address <small>(type it, then pick from the list)</small></label>
            <input id="addrIn" name="street" autocomplete="off" role="combobox" aria-autocomplete="list" aria-expanded="false" aria-controls="addrList" placeholder="e.g. 10268 Yonge Street" maxlength="100" value="${esc(pr.street != null ? pr.street : pr.address || "")}">
            <ul id="addrList" class="addrsug" role="listbox" aria-label="Address suggestions" hidden></ul></div>
          <label>Unit / Apt <small>(optional)</small><input name="unit" maxlength="12" autocomplete="address-line2" value="${esc(pr.unit || "")}"></label>
        </div>
        <input type="hidden" name="lat" value="${pr.lat != null ? pr.lat : ""}"><input type="hidden" name="lng" value="${pr.lng != null ? pr.lng : ""}">
        <div class="addrrow3">
          <label>City<input name="city" autocomplete="address-level2" maxlength="40" value="${esc(pr.city || "")}"></label>
          <label>Province<select name="province" autocomplete="address-level1"><option value=""></option>${PROVS.map(([c, n]) => `<option value="${c}"${(pr.province || "ON") === c ? " selected" : ""}>${n}</option>`).join("")}</select></label>
          <label>Postal code<input name="postal" maxlength="7" autocomplete="postal-code" placeholder="L4C 3B2" value="${esc(pr.postal || "")}"></label>
        </div>
        <div id="profileMsg" hidden></div>
        <button class="btn" type="submit" style="justify-self:start">Save details</button>
      </form>
    </div>
    <aside class="panel">
      <h2>Shortcuts</h2>
      <a class="btn" href="#my-orders">My orders</a>
      ${SELLING_ON ? `<a class="btn ghost" href="#selling" style="color:var(--fg)">Sell on Nojan${(() => { mkEnsureSeller(); const m = MK.me; return m && m.status === "approved" ? " ✓" : m && m.status === "pending" ? " · waiting for approval" : ""; })()}</a>` : ""}
      ${isAdmin() ? `<a class="btn ghost" href="#admin" style="color:var(--fg)">Admin: manage orders</a>` : ""}
      <a class="linkbtn" href="#cart" style="text-align:left">Go to cart</a>
      <p class="note">Signed in ${viaGoogle ? "with Google" : "with email"} as ${esc(USER.email || "")}.</p>
    </aside>
  </div>`;
}


/* =========================================================
   SERVICE PROVIDER PROFILES (LinkedIn-style) — added and edited by the shop's admins only.
   Stored with the services (kind: "provider"), so only admins can change them.
   ========================================================= */
let ALL_PROVIDERS = [];
let PED = {id:null, data:null, photo:null};
const EMP_TYPES = ["Full-time", "Part-time", "Self-employed", "Freelance", "Contract", "Internship", "Volunteer"];
const MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const safeUrl = u => { u = String(u || "").trim(); if (!u) return ""; if (!/^https?:\/\//i.test(u)) u = "https://" + u; try { const x = new URL(u); return /^https?:$/.test(x.protocol) ? x.href : ""; } catch(_) { return ""; } };
const listTxt = s => String(s || "").split(/[,\n]/).map(x => x.trim()).filter(Boolean).slice(0, 50);
const ym = s => { const m = /^(\d{4})-(\d{2})/.exec(s || ""); return m ? {y: +m[1], m: +m[2]} : null; };
const ymTxt = s => { const d = ym(s); return d ? `${MONTHS[d.m - 1]} ${d.y}` : (/^\d{4}$/.test(s || "") ? s : ""); };
function spanTxt(start, end){
  const a = ym(start); if (!a) return "";
  const now = new Date(), b = ym(end) || {y: now.getFullYear(), m: now.getMonth() + 1};
  let n = (b.y - a.y) * 12 + (b.m - a.m) + 1; if (n < 1) return "";
  const y = Math.floor(n / 12), mo = n % 12;
  return [y ? `${y} yr${y > 1 ? "s" : ""}` : "", mo ? `${mo} mo${mo > 1 ? "s" : ""}` : ""].filter(Boolean).join(" ");
}
function blankProvider(){
  return {name: "", headline: "", location: "", providerType: "Individual", about: "", photo: "", languages: [], skills: [], website: "", linkedin: "", active: true,
    experience: [{title:"", company:"", type:"Full-time", location:"", start:"", end:"", current:false, description:""}], education: [], certifications: []};
}
function useProviders(list){
  ALL_PROVIDERS = list.map(d => ({...blankProvider(), ...d, experience: d.experience || [], education: d.education || [], certifications: d.certifications || []}));
  PROVIDERS = ALL_PROVIDERS.filter(p => p.active !== false).sort((a, b) => String(a.name).localeCompare(b.name));
  providersLoaded = true;
}
function provAvatar(p, size){
  const src = p.photo ? imgSrc(p.photo) : "";
  return `<span class="pav" style="width:${size}px;height:${size}px;font-size:${Math.round(size * .36)}px">${src ? `<img src="${esc(src)}" data-ref="${esc(p.photo)}" alt="">` : esc(initials(p.name))}</span>`;
}
function providerById(id){
  const p = PROVIDERS.find(x => x.id === id);
  if (p) return p;
  if (isAdmin()){ const a = ALL_PROVIDERS.find(x => x.id === id); if (a) return {...a, _hidden: true}; }
  return null;
}
const servicesOf = id => SERVICES.filter(s => s.providerUid === id);
const liVanity = u => { const m = /linkedin\.com\/in\/([A-Za-z0-9\-_%.]+)/i.exec(String(u || "")); return m ? decodeURIComponent(m[1]).replace(/[^A-Za-z0-9\-_.]/g, "") : ""; };
/* LinkedIn's official profile badge: LinkedIn draws it and keeps it up to date */
function liBadgeHTML(p){
  const v = liVanity(p.linkedin); if (!v) return "";
  return `<section class="pcard libadge"><div class="phd"><h2>On LinkedIn</h2><span class="pmuted">Live from LinkedIn · updates automatically</span></div>
    <div class="libox"><div class="badge-base LI-profile-badge" data-locale="en_US" data-size="large" data-theme="light" data-type="HORIZONTAL" data-vanity="${esc(v)}" data-version="v1"><a class="badge-base__link LI-simple-link" href="https://www.linkedin.com/in/${esc(v)}?trk=profile-badge" target="_blank" rel="noopener">${esc(p.name)} on LinkedIn ↗</a></div></div></section>`;
}
let liLoading = false;
function renderLinkedInBadges(){
  if (!document.querySelector(".LI-profile-badge")) return;
  if (window.LIRenderAll){ try { window.LIRenderAll(); } catch(_) {} return; }
  if (liLoading) return; liLoading = true;
  const sc = document.createElement("script"); sc.src = "https://platform.linkedin.com/badges/js/profile.js"; sc.async = true; sc.defer = true;
  sc.onload = () => { if (window.LIRenderAll){ try { window.LIRenderAll(); } catch(_) {} } };
  document.head.appendChild(sc);
}

/* ---- Cards on the Services page ---- */
function providerCards(list){
  return list.map(p => `<a class="provcard" href="#provider-${esc(p.id)}">
      ${provAvatar(p, 72)}
      <b>${esc(p.name)}</b>
      ${p.headline ? `<span class="ph">${esc(p.headline)}</span>` : ""}
      ${p.location ? `<span class="pl">${esc(p.location)}</span>` : ""}
      ${(p.skills || []).length ? `<span class="psk">${p.skills.slice(0, 3).map(esc).join(" · ")}</span>` : ""}
      <span class="pgo">View profile ›</span></a>`).join("");
}
function providersSectionHTML(){
  if (!PROVIDERS.length) return "";
  return `<section class="provsec"><div class="sectionhead"><h2>Meet our providers</h2></div><div class="provgrid">${providerCards(PROVIDERS)}</div></section>`;
}

/* ---- Public profile page ---- */
function providerView(){
  const p = providerById(providerId);
  if (!p) return providersLoaded ? `<div class="empty">This profile isn't available. <a href="#services" style="color:var(--link)">See all services</a></div>` : `<div class="empty">Loading…</div>`;
  const svcs = servicesOf(p.id), admin = isAdmin(), pinfo = provInfo(p); startAllSlots();
  const sec = (title, body) => body ? `<section class="pcard"><h2>${title}</h2>${body}</section>` : "";
  const exp = (p.experience || []).filter(x => x.title || x.company).map(x => `<li class="pitem">
      <span class="plogo">${esc(initials(x.company || x.title))}</span>
      <div><b>${esc(x.title)}</b>
        <span>${esc(x.company)}${x.type ? ` · ${esc(x.type)}` : ""}</span>
        ${x.start ? `<span class="pmuted">${ymTxt(x.start)} – ${x.current || !x.end ? "Present" : ymTxt(x.end)}${spanTxt(x.start, x.current ? "" : x.end) ? ` · ${spanTxt(x.start, x.current ? "" : x.end)}` : ""}</span>` : ""}
        ${x.location ? `<span class="pmuted">${esc(x.location)}</span>` : ""}
        ${x.description ? `<p>${esc(x.description)}</p>` : ""}</div></li>`).join("");
  const edu = (p.education || []).filter(x => x.school).map(x => `<li class="pitem">
      <span class="plogo">${esc(initials(x.school))}</span>
      <div><b>${esc(x.school)}</b>
        ${x.degree || x.field ? `<span>${esc([x.degree, x.field].filter(Boolean).join(", "))}</span>` : ""}
        ${x.start || x.end ? `<span class="pmuted">${esc([x.start, x.end].filter(Boolean).join(" – "))}</span>` : ""}
        ${x.description ? `<p>${esc(x.description)}</p>` : ""}</div></li>`).join("");
  const certs = (p.certifications || []).filter(x => x.name).map(x => { const u = safeUrl(x.url); return `<li class="pitem">
      <span class="plogo">${esc(initials(x.issuer || x.name))}</span>
      <div><b>${esc(x.name)}</b>
        ${x.issuer ? `<span>${esc(x.issuer)}</span>` : ""}
        ${x.issued ? `<span class="pmuted">Issued ${ymTxt(x.issued)}</span>` : ""}
        ${u ? `<a class="pcred" href="${esc(u)}" target="_blank" rel="noopener nofollow">Show credential ↗</a>` : ""}</div></li>`; }).join("");
  const web = safeUrl(p.website), li = safeUrl(p.linkedin);
  return `<div class="pprofile">
    ${p._hidden ? `<div class="msg err" style="margin-bottom:14px">This profile is hidden from the website. Only admins can see it.</div>` : ""}
    <section class="pcard phead">
      <div class="pcover"></div>
      <div class="pheadin">
        ${provAvatar(p, 132)}
        <h1>${esc(p.name)}${p.checked ? CHK : ""}</h1>
        ${p.headline ? `<p class="phl">${esc(p.headline)}</p>` : ""}
        <p class="pmuted">${esc([p.location, p.providerType === "Company" ? "Company" : ""].filter(Boolean).join(" · "))}</p>
        ${provHeadExtra(p, pinfo)}<div class="pbtns">${svcs.length === 1 ? `<a class="btn" href="#service-${esc(svcs[0].id)}">Book a session</a>` : svcs.length ? `<a class="btn" href="#psvcs">Book a session</a>` : ""}<a class="btn ghost" href="#contact-us">Message the shop</a>${admin ? `<button class="btn ghost" type="button" data-pedit="${esc(p.id)}">Edit profile</button>` : ""}</div>
        ${web || li ? `<p class="plinks">${web ? `<a href="${esc(web)}" target="_blank" rel="noopener nofollow">Website ↗</a>` : ""}${li ? `<a href="${esc(li)}" target="_blank" rel="noopener nofollow">LinkedIn ↗</a>` : ""}</p>` : ""}
      </div>
    </section>
    ${provBookHTML(p, pinfo)}
    ${liBadgeHTML(p)}
    ${sec("About", p.about ? `<p class="pabout">${esc(p.about)}</p>` : "")}
    ${svcs.length ? `<section class="pcard" id="psvcs"><h2>Services</h2><div class="svcgrid">${serviceCards(svcs)}</div></section>` : ""}
    ${provTrustHTML(p, pinfo)}
    ${sec("Experience", exp ? `<ul class="plist">${exp}</ul>` : "")}
    ${sec("Education", edu ? `<ul class="plist">${edu}</ul>` : "")}
    ${sec("Licences &amp; certifications", certs ? `<ul class="plist">${certs}</ul>` : "")}
    ${sec("Skills", (p.skills || []).length ? `<ul class="pskills">${p.skills.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : "")}
    ${sec("Languages", (p.languages || []).length ? `<ul class="pskills">${p.languages.map(s => `<li>${esc(s)}</li>`).join("")}</ul>` : "")}
  </div>`;
}

/* ---- Admin: list, add and edit profiles ---- */
function pedRow(sec, x, i){
  const f = (name, label, val, attrs) => `<label>${label}<input data-f="${name}" value="${esc(val || "")}"${attrs || ""}></label>`;
  const ta = (name, label, val, ph) => `<label>${label}<textarea data-f="${name}" placeholder="${ph || ""}">${esc(val || "")}</textarea></label>`;
  const rm = `<button type="button" class="linkbtn prm" data-prm="${sec}" data-i="${i}">Remove</button>`;
  if (sec === "experience") return `<fieldset class="pfs" data-sec="experience" data-i="${i}">
      <div class="row">${f("title", "Title", x.title, ' placeholder="e.g. Microsoft Office Trainer"')}${f("company", "Company or organization", x.company)}</div>
      <div class="row"><label>Employment type<select data-f="type">${EMP_TYPES.map(t => `<option${t === x.type ? " selected" : ""}>${t}</option>`).join("")}</select></label>${f("location", "Location", x.location, ' placeholder="e.g. Toronto, ON · Remote"')}</div>
      <div class="row">${f("start", "Start date", x.start, ' type="month"')}${f("end", "End date", x.end, ' type="month"' + (x.current ? " disabled" : ""))}</div>
      <label class="chk"><input type="checkbox" data-f="current"${x.current ? " checked" : ""}> Currently works here</label>
      ${ta("description", "Description", x.description, "What they did, results, tools used")}${rm}</fieldset>`;
  if (sec === "education") return `<fieldset class="pfs" data-sec="education" data-i="${i}">
      ${f("school", "School", x.school, ' placeholder="e.g. Centennial College"')}
      <div class="row">${f("degree", "Degree or certificate", x.degree)}${f("field", "Field of study", x.field)}</div>
      <div class="row">${f("start", "Start year", x.start, ' inputmode="numeric" maxlength="4" placeholder="2023"')}${f("end", "End year (or expected)", x.end, ' inputmode="numeric" maxlength="4" placeholder="2025"')}</div>
      ${ta("description", "Description", x.description, "Activities, awards, focus")}${rm}</fieldset>`;
  return `<fieldset class="pfs" data-sec="certifications" data-i="${i}">
      <div class="row">${f("name", "Name", x.name, ' placeholder="e.g. Microsoft Office Specialist: Excel Expert"')}${f("issuer", "Issuing organization", x.issuer, ' placeholder="e.g. Microsoft"')}</div>
      <div class="row">${f("issued", "Issue date", x.issued, ' type="month"')}${f("url", "Credential link", x.url, ' type="url" placeholder="https://"')}</div>${rm}</fieldset>`;
}
function pedCollect(){
  const f = $("#provForm"); if (!f || !PED.data) return;
  const g = n => (f.querySelector(`[name="${n}"]`) || {}).value || "";
  Object.assign(PED.data, {name: g("name").trim(), headline: g("headline").trim(), location: g("location").trim(), providerType: g("providerType") || "Individual",
    about: g("about").trim(), website: g("website").trim(), linkedin: g("linkedin").trim(), skills: listTxt(g("skills")), languages: listTxt(g("languages")),
    active: !!(f.querySelector('[name="active"]') || {}).checked});
  const lines = n => g(n).split("\n").map(x => x.trim()).filter(Boolean);
  Object.assign(PED.data, {checked: !!(f.querySelector('[name="checked"]') || {}).checked, checks: lines("checks").slice(0, 10), reply: g("reply").trim(),
    reviews: lines("reviews").slice(0, 50).map(l => { const a = l.split("|").map(x => x.trim()); return {name: a[0] || "", stars: Math.min(5, Math.max(1, parseInt(a[1], 10) || 5)), date: a[2] || "", text: a.slice(3).join(" | ")}; })});
  ["experience", "education", "certifications"].forEach(sec => {
    PED.data[sec] = [...f.querySelectorAll(`fieldset[data-sec="${sec}"]`)].map(fs => {
      const o = {}; fs.querySelectorAll("[data-f]").forEach(el => o[el.dataset.f] = el.type === "checkbox" ? el.checked : el.value.trim());
      if (o.current) o.end = ""; return o; });
  });
}
function providerFormHTML(){
  const d = PED.data, isNew = PED.id === "new";
  const photo = PED.photo || (d.photo ? imgSrc(d.photo) : "");
  return `<div class="sectionhead"><h2>${isNew ? "Add a provider profile" : "Edit " + esc(d.name || "profile")}</h2><button class="linkbtn" type="button" data-pcancel>Back to providers</button></div>
  <form id="provForm" class="pform" novalidate>
    <section class="panel lipanel"><h2>Start with their LinkedIn</h2>
      <label>LinkedIn profile link <small>(paste it and a preview pops up; the profile must be public on LinkedIn)</small><input name="linkedin" id="liUrl" type="url" value="${esc(d.linkedin)}" placeholder="https://www.linkedin.com/in/…" autocomplete="off"></label>
      <div id="liPrev">${LIP.html || ""}</div>
    </section>
    <section class="panel"><h2>Intro</h2>
      <div class="pphoto">${photo ? `<img src="${esc(photo)}" alt="Profile photo">` : `<span class="pav" style="width:96px;height:96px;font-size:34px">${esc(initials(d.name || "?"))}</span>`}
        <label class="btn ghost small">Upload photo<input type="file" id="provPhoto" accept="image/*" hidden></label>${photo ? `<button type="button" class="linkbtn" data-prphoto-rm>Remove photo</button>` : ""}</div>
      <div class="row"><label>Full name or business name<input name="name" required maxlength="80" value="${esc(d.name)}"></label>
        <label>Provider is<select name="providerType"><option${d.providerType !== "Company" ? " selected" : ""}>Individual</option><option${d.providerType === "Company" ? " selected" : ""}>Company</option></select></label></div>
      <label>Headline <small>(one line under the name)</small><input name="headline" maxlength="160" value="${esc(d.headline)}" placeholder="e.g. Microsoft Certified Trainer · Office & legal admin specialist"></label>
      <label>Location<input name="location" maxlength="80" value="${esc(d.location)}" placeholder="e.g. Richmond Hill, Ontario"></label>
    </section>
    <section class="panel"><h2>About</h2>
      <label>About this provider <small>(up to 2,600 characters)</small><textarea name="about" maxlength="2600" style="min-height:140px" placeholder="Background, how they teach or work, who they help">${esc(d.about)}</textarea></label>
    </section>
    <section class="panel"><div class="phd"><h2>Experience</h2><button type="button" class="btn ghost small" data-padd="experience">+ Add position</button></div>
      ${(d.experience || []).map((x, i) => pedRow("experience", x, i)).join("") || `<p class="note">Add jobs and roles that show their expertise.</p>`}</section>
    <section class="panel"><div class="phd"><h2>Education</h2><button type="button" class="btn ghost small" data-padd="education">+ Add education</button></div>
      ${(d.education || []).map((x, i) => pedRow("education", x, i)).join("") || `<p class="note">Add schools, colleges and programs.</p>`}</section>
    <section class="panel"><div class="phd"><h2>Licences &amp; certifications</h2><button type="button" class="btn ghost small" data-padd="certifications">+ Add certification</button></div>
      ${(d.certifications || []).map((x, i) => pedRow("certifications", x, i)).join("") || `<p class="note">Add certifications such as Microsoft Office Specialist.</p>`}</section>
    <section class="panel"><h2>Skills &amp; languages</h2>
      <label>Skills <small>(separate with commas)</small><input name="skills" value="${esc((d.skills || []).join(", "))}" placeholder="e.g. Microsoft Excel, Word, Legal documents, Teaching"></label>
      <label>Languages <small>(separate with commas)</small><input name="languages" value="${esc((d.languages || []).join(", "))}" placeholder="e.g. English, Farsi, French"></label>
    </section>
    <section class="panel"><h2>Trust and reviews</h2>
      <label class="chk"><input type="checkbox" name="checked"${d.checked ? " checked" : ""}> Show the "Checked by Nojan" mark</label>
      <label>What Nojan checked <small>(one per line)</small><textarea name="checks" placeholder="Identity, in person">${esc((d.checks || []).join("\n"))}</textarea></label>
      <label>Usual reply time <small>(optional)</small><input name="reply" maxlength="30" value="${esc(d.reply || "")}" placeholder="e.g. Same day"></label>
      <label>Reviews <small>(one per line: name | stars 1 to 5 | month and year | what they said)</small><textarea name="reviews" style="min-height:110px" placeholder="Mina | 5 | Oct 2026 | Very patient and clear.">${esc((d.reviews || []).map(r => [r.name, r.stars, r.date, r.text].join(" | ")).join("\n"))}</textarea></label>
    </section>
    <section class="panel"><h2>Links</h2>
      <label>Website<input name="website" type="url" value="${esc(d.website)}" placeholder="https://"></label>
      <label class="chk"><input type="checkbox" name="active"${d.active !== false ? " checked" : ""}> Show this profile on the website</label>
    </section>
    <div id="provMsg" hidden></div>
    <div style="display:flex;gap:12px;flex-wrap:wrap"><button class="btn" type="submit">${isNew ? "Add profile" : "Save profile"}</button>${!isNew ? `<button class="btn ghost" type="button" data-pdel="${esc(PED.id)}" style="color:var(--danger)!important">Delete profile</button>` : ""}</div>
  </form>`;
}
/* LinkedIn link preview (like the preview you get when you paste a link in a chat) */
let LIP = {url:"", html:"", data:null, t:null};
function liParse(j){
  const d = (j && j.data) || {}, t = String(d.title || "").replace(/\s*\|\s*LinkedIn\s*$/i, "");
  const i = t.indexOf(" - "), name = (i > 0 ? t.slice(0, i) : t).trim(), headline = i > 0 ? t.slice(i + 3).trim() : "";
  return {name, headline, desc: String(d.description || "").trim(), image: d.image && d.image.url || ""};
}
function liCardHTML(x, url){
  return `<div class="licard">
    ${x.image ? `<img src="${esc(x.image)}" alt="" referrerpolicy="no-referrer">` : `<span class="pav" style="width:64px;height:64px;font-size:22px">${esc(initials(x.name || "?"))}</span>`}
    <div class="lit"><span class="lisrc">linkedin.com</span><b>${esc(x.name || "LinkedIn profile")}</b>${x.headline ? `<span>${esc(x.headline)}</span>` : ""}${x.desc && x.desc !== x.headline ? `<span class="pmuted">${esc(x.desc.slice(0, 180))}${x.desc.length > 180 ? "…" : ""}</span>` : ""}
      <div class="liact"><button type="button" class="btn small" data-liuse>Use name, headline &amp; photo</button><a class="linkbtn" href="${esc(url)}" target="_blank" rel="noopener">Open on LinkedIn ↗</a></div></div></div>`;
}
async function liPreview(url){
  const box = $("#liPrev"); if (!box) return;
  const u = safeUrl(url);
  if (!liVanity(u)){ LIP = {url:"", html:"", data:null, t:null}; box.innerHTML = url.trim() ? `<p class="note">Paste a profile link that looks like https://www.linkedin.com/in/name</p>` : ""; return; }
  if (u === LIP.url && LIP.html){ box.innerHTML = LIP.html; return; }
  LIP.url = u; box.innerHTML = `<div class="licard loading"><span class="pav" style="width:64px;height:64px"></span><div class="lit"><span class="lisrc">linkedin.com</span><b>Loading preview…</b></div></div>`;
  try {
    const r = await fetch("https://api.microlink.io/?url=" + encodeURIComponent(u)), j = await r.json();
    if (LIP.url !== u) return;
    if (j.status !== "success" || !j.data || !j.data.title || /sign up|log in|join linkedin/i.test(j.data.title)) throw new Error("no-preview");
    LIP.data = liParse(j); LIP.html = liCardHTML(LIP.data, u);
    const f = $("#provForm");
    if (f){ const n = f.querySelector('[name="name"]'), h = f.querySelector('[name="headline"]');   // fill empty boxes right away
      if (n && !n.value.trim() && LIP.data.name) n.value = LIP.data.name;
      if (h && !h.value.trim() && LIP.data.headline) h.value = LIP.data.headline; }
  } catch(e){
    if (LIP.url !== u) return;
    LIP.data = null; LIP.html = `<div class="licard"><span class="pav" style="width:64px;height:64px;font-size:22px">in</span><div class="lit"><span class="lisrc">linkedin.com</span><b>No preview from LinkedIn</b><span class="pmuted">LinkedIn only shares previews of public profiles. Ask the provider to turn on public visibility (LinkedIn → Settings → Visibility → Edit your public profile), then paste the link again. You can still save the link.</span></div></div>`;
  }
  const b2 = $("#liPrev"); if (b2) b2.innerHTML = LIP.html;
}
document.addEventListener("input", e => { if (e.target.id !== "liUrl") return; clearTimeout(LIP.t); const v = e.target.value; LIP.t = setTimeout(() => liPreview(v), 600); });
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-liuse]"); if (!b || !LIP.data) return;
  const f = $("#provForm"); if (!f) return;
  if (LIP.data.name) f.querySelector('[name="name"]').value = LIP.data.name;
  if (LIP.data.headline) f.querySelector('[name="headline"]').value = LIP.data.headline;
  pedCollect();
  if (LIP.data.image){ b.disabled = true; b.textContent = "Getting photo…";
    try { const blob = await (await fetch(LIP.data.image)).blob(); PED.photo = await resizeImage(blob, 400, 0.85); }
    catch(er){ console.error(er); toast("Couldn't copy the photo. Upload it instead."); } }
  refreshAdmin(true); toast("Filled in from LinkedIn. Check the details, then save.");
});
function providersAdminHTML(){
  if (PED.id && PED.data) return providerFormHTML();
  return `<div class="sectionhead"><p class="note" style="margin:0">Add the people and companies who give your services, with their job history, education and certifications. Link a service to a profile in Admin → Services.</p><button class="btn small" type="button" data-pedit="new">+ Add provider</button></div>
    ${!ALL_PROVIDERS.length ? `<div class="empty">No provider profiles yet.</div>` : `<div class="ordlist">${ALL_PROVIDERS.slice().sort((a, b) => String(a.name).localeCompare(b.name)).map(p => `<div class="prow2">${provAvatar(p, 48)}<div class="pinfo"><b>${esc(p.name)}</b><span class="note">${esc(p.headline || "")}</span><span class="note">${servicesOf(p.id).length} service(s) · <b>${p.active !== false ? "Shown on website" : "Hidden"}</b></span></div>
      <div class="pact"><a class="btn ghost small" href="#provider-${esc(p.id)}">View</a><button class="btn small" type="button" data-pedit="${esc(p.id)}">Edit</button></div></div>`).join("")}</div>`}`;
}
function openProviderEditor(id){
  const src = id === "new" ? blankProvider() : ALL_PROVIDERS.find(x => x.id === id);
  if (!src) return;
  PED = {id, data: JSON.parse(JSON.stringify({...blankProvider(), ...src})), photo: null};
  LIP = {url:"", html:"", data:null, t:null}; setTimeout(() => { const i = $("#liUrl"); if (i && i.value) liPreview(i.value); }, 50);
  ADM.tab = "providers";
  if (current() !== "admin") go("admin"); else { render(); window.scrollTo(0, 0); }
}
document.addEventListener("click", async e => {
  const ed = e.target.closest("[data-pedit]");
  if (ed){ e.preventDefault(); openProviderEditor(ed.dataset.pedit); return; }
  if (e.target.closest("[data-pcancel]")){ PED = {id:null, data:null, photo:null}; refreshAdmin(true); window.scrollTo(0, 0); return; }
  const add = e.target.closest("[data-padd]");
  if (add){ pedCollect(); const sec = add.dataset.padd;
    PED.data[sec] = [...(PED.data[sec] || []), sec === "experience" ? {title:"", company:"", type:"Full-time", location:"", start:"", end:"", current:false, description:""} : sec === "education" ? {school:"", degree:"", field:"", start:"", end:"", description:""} : {name:"", issuer:"", issued:"", url:""}];
    refreshAdmin(true); const rows = document.querySelectorAll(`fieldset[data-sec="${sec}"]`); const last = rows[rows.length - 1]; if (last){ last.scrollIntoView({block:"center"}); const i = last.querySelector("input"); if (i) i.focus(); } return; }
  const rm = e.target.closest("[data-prm]");
  if (rm){ pedCollect(); PED.data[rm.dataset.prm].splice(+rm.dataset.i, 1); refreshAdmin(true); return; }
  if (e.target.closest("[data-prphoto-rm]")){ pedCollect(); PED.photo = ""; PED.data.photo = ""; refreshAdmin(true); return; }
  const del = e.target.closest("[data-pdel]");
  if (del){ const id = del.dataset.pdel, p = ALL_PROVIDERS.find(x => x.id === id), n = servicesOf(id).length;
    if (!confirmInline(del, n ? `Delete? ${n} service(s) will just show the provider's name.` : "Click again to delete")) return;
    try { await FB.deleteService(id, p && String(p.photo).startsWith("img:") ? [p.photo.slice(4)] : []); toast("Profile deleted"); PED = {id:null, data:null, photo:null}; refreshAdmin(true); }
    catch(er){ console.error(er); toast("Couldn't delete. Try again."); } return; }
  const ps = e.target.closest('a[href="#psvcs"]');
  if (ps){ e.preventDefault(); const t = $("#psvcs"); if (t) t.scrollIntoView({behavior:"smooth"}); }
});
function confirmInline(btn, text){
  if (btn.dataset.armed){ return true; }
  btn.dataset.armed = "1"; const old = btn.textContent; btn.textContent = text;
  setTimeout(() => { if (btn.isConnected){ delete btn.dataset.armed; btn.textContent = old; } }, 4000);
  return false;
}
document.addEventListener("change", async e => {
  if (e.target.matches('#provForm [data-f="current"]')){ const end = e.target.closest("fieldset").querySelector('[data-f="end"]'); if (end){ end.disabled = e.target.checked; if (e.target.checked) end.value = ""; } return; }
  if (e.target.id === "provPhoto" && e.target.files[0]){
    try { pedCollect(); PED.photo = await resizeImage(e.target.files[0], 400, 0.85); refreshAdmin(true); }
    catch(er){ console.error(er); toast("Couldn't read that photo. Try a JPG or PNG."); }
  }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "provForm") return;
  e.preventDefault(); pedCollect();
  const d = PED.data, m = $("#provMsg"), btn = e.target.querySelector("button[type=submit]");
  if (!d.name) return showMsg(m, false, "Enter the provider's name.");
  for (const x of d.experience) if ((x.title || x.company) && !(x.title && x.company)) return showMsg(m, false, "Each position needs a title and a company.");
  for (const x of d.experience) if (x.start && x.end && x.end < x.start) return showMsg(m, false, "Check the experience dates: the end date must be after the start date.");
  btn.disabled = true; btn.textContent = "Saving…";
  try {
    const isNew = PED.id === "new";
    const id = isNew ? "PRV" + String(Math.max(0, ...ALL_PROVIDERS.map(x => parseInt(String(x.id).replace(/^PRV/, ""), 10) || 0)) + 1).padStart(3, "0") : PED.id;
    let photo = d.photo || "";
    if (PED.photo){ const imgId = await FB.saveImage(PED.photo); IMG[imgId] = PED.photo; photo = "img:" + imgId; }
    const clip = (s, n) => String(s || "").slice(0, n);
    const data = {kind: "provider", name: clip(d.name, 80), headline: clip(d.headline, 160), location: clip(d.location, 80), providerType: d.providerType === "Company" ? "Company" : "Individual",
      about: clip(d.about, 2600), photo, website: safeUrl(d.website), linkedin: safeUrl(d.linkedin), active: !!d.active,
      checked: !!d.checked, checks: (d.checks || []).map(x => clip(x, 120)), reply: clip(d.reply, 30), reviews: (d.reviews || []).map(r => ({name: clip(r.name, 40), stars: r.stars, date: clip(r.date, 20), text: clip(r.text, 600)})),
      skills: d.skills.slice(0, 50).map(s => clip(s, 60)), languages: d.languages.slice(0, 20).map(s => clip(s, 40)),
      experience: d.experience.filter(x => x.title || x.company).slice(0, 30).map(x => ({title: clip(x.title, 100), company: clip(x.company, 100), type: x.type || "", location: clip(x.location, 80), start: x.start || "", end: x.current ? "" : (x.end || ""), current: !!x.current, description: clip(x.description, 2000)})),
      education: d.education.filter(x => x.school).slice(0, 20).map(x => ({school: clip(x.school, 120), degree: clip(x.degree, 100), field: clip(x.field, 100), start: clip(x.start, 4), end: clip(x.end, 4), description: clip(x.description, 1000)})),
      certifications: d.certifications.filter(x => x.name).slice(0, 30).map(x => ({name: clip(x.name, 150), issuer: clip(x.issuer, 100), issued: x.issued || "", url: safeUrl(x.url)}))};
    await FB.saveService(id, data, isNew);
    toast(isNew ? "Profile added" : "Profile saved"); PED = {id:null, data:null, photo:null}; refreshAdmin(true); window.scrollTo(0, 0);
  } catch(er){ console.error(er); btn.disabled = false; btn.textContent = PED.id === "new" ? "Add profile" : "Save profile"; showMsg(m, false, "Couldn't save the profile. Check your connection and try again."); }
});

/* ---- Events (v65): listing with filters, event pages, tickets (reserve and pay later, or pay by card through a Stripe link), admin ---- */
let ALL_EVENTS = [], EVENTS = [], eventsLoaded = false, EV_SOLD = {}, EV_UNSUB = [], EV_SOLD_KEY = "";
const EV_CATS = ["Music & concerts", "Food & drink", "Business & networking", "Tech & digital", "Arts & culture", "Classes & workshops", "Family & kids", "Sports & fitness", "Community", "Culture & heritage", "Nightlife", "Other"];
const EVI = {
  "Music & concerts": '<path d="M9 18V5l11-2v13"/><circle cx="6.5" cy="18" r="2.5"/><circle cx="17.5" cy="16" r="2.5"/>',
  "Food & drink": '<path d="M5 3v8a3 3 0 0 0 6 0V3M8 3v18M17 3c-2 2-2 6 0 8v10"/>',
  "Business & networking": '<rect x="3" y="7" width="18" height="13" rx="2"/><path d="M9 7V5a2 2 0 0 1 2-2h2a2 2 0 0 1 2 2v2M3 13h18"/>',
  "Tech & digital": '<rect x="4" y="4" width="16" height="16" rx="2"/><path d="M9 9h6v6H9zM9 1v3M15 1v3M9 20v3M15 20v3M1 9h3M1 15h3M20 9h3M20 15h3"/>',
  "Arts & culture": '<circle cx="12" cy="12" r="9"/><circle cx="8" cy="10" r="1.3"/><circle cx="12" cy="7.5" r="1.3"/><circle cx="16" cy="10" r="1.3"/><path d="M12 21c-1.5-2 0-4 2-4h2a4 4 0 0 0 4-4"/>',
  "Classes & workshops": '<path d="M2 9l10-5 10 5-10 5z"/><path d="M6 11v5c3 2.5 9 2.5 12 0v-5"/>',
  "Family & kids": '<circle cx="8" cy="6" r="2.5"/><circle cx="17" cy="8" r="2"/><path d="M4 21v-6a4 4 0 0 1 8 0v6M14 21v-5a3 3 0 0 1 6 0v5"/>',
  "Sports & fitness": '<circle cx="12" cy="12" r="9"/><path d="M12 3v18M3 12h18M5.6 5.6c3.5 3.5 3.5 9.3 0 12.8M18.4 5.6c-3.5 3.5-3.5 9.3 0 12.8"/>',
  "Community": '<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c3 0 5 1.5 5.5 4.5"/>',
  "Culture & heritage": '<path d="M3 21h18M5 21V10M19 21V10M9 21V10M15 21V10M2 10l10-7 10 7z"/>',
  "Nightlife": '<path d="M20 15A8 8 0 1 1 9 4a6.5 6.5 0 0 0 11 11z"/>',
  "Other": '<path d="M12 2l3 6.5 7 .9-5.1 4.8 1.3 7L12 17.8 5.8 21.2l1.3-7L2 9.4l7-.9z"/>'
};
const evIcon = c => `<svg viewBox="0 0 24 24" aria-hidden="true">${EVI[c] || EVI.Other}</svg>`;
const TICKET_SVG = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8a2 2 0 0 0 2-2h14a2 2 0 0 0 2 2v2a2 2 0 0 0 0 4v2a2 2 0 0 0-2 2H5a2 2 0 0 0-2-2v-2a2 2 0 0 0 0-4z"/><path d="M14 6v12" stroke-dasharray="2 2"/></svg>';

function fsToEvent(d){
  const tickets = (Array.isArray(d.tickets) ? d.tickets : []).filter(t => t && (t.name || t.price != null)).map((t, i) => ({i, name: String(t.name || "General admission"), price: Math.max(0, +t.price || 0), stripe: String(t.stripe || "").trim()}));
  if (!tickets.length) tickets.push({i: 0, name: "General admission", price: 0, stripe: ""});
  const prices = tickets.map(t => t.price);
  return {id: d.id, title: String(d.title || "Untitled event"), category: EV_CATS.includes(d.category) ? d.category : "Other",
    startMs: +d.startMs || 0, endMs: +d.endMs || (+d.startMs || 0) + 2 * 3600000, venue: d.venue || "", address: d.address || "", city: d.city || "",
    format: d.format === "online" ? "online" : "in-person", onlineInfo: d.onlineInfo || "", cover: d.cover || "", summary: d.summary || "", description: d.description || "",
    organizer: d.organizer || "Nojan", capacity: Math.max(1, +d.capacity || 100), tickets, minPrice: Math.min(...prices), maxPrice: Math.max(...prices),
    free: Math.max(...prices) === 0, featured: !!d.featured, active: d.active !== false, sample: !!d.sample};
}
function useEvents(list){
  ALL_EVENTS = list; eventsLoaded = true;
  const now = Date.now();
  let evs = list.map(fsToEvent).filter(e => e.active);
  if (!evs.length && /[?&]demo\b/.test(location.search)) evs = sampleEvents();
  EVENTS = evs.filter(e => e.endMs >= now || e.sample).sort((a, b) => a.startMs - b.startMs);
  watchEventSold();
}
function eventById(id){ const d = ALL_EVENTS.find(x => x.id === id); return d ? fsToEvent(d) : EVENTS.find(e => e.id === id) || null; }
function watchEventSold(){
  if (!FB || !FB.watchSlotsIn) return;
  const ids = EVENTS.filter(e => !e.sample && !e.member).map(e => e.id), key = ids.join(",");
  if (key === EV_SOLD_KEY) return;
  EV_SOLD_KEY = key; EV_UNSUB.forEach(u => { try { u(); } catch(_) {} }); EV_UNSUB = [];
  for (let i = 0; i < ids.length; i += 10) EV_UNSUB.push(FB.watchSlotsIn(ids.slice(i, i + 10), m => {
    Object.entries(m).forEach(([k, v]) => { if (k.startsWith("ev_")) EV_SOLD[k.slice(3)] = v; });
    if (["events", "event", "home"].includes(current())) { const box = $("#evResults"); if (box && current() === "events") box.innerHTML = evResultsHTML(); else if (current() !== "event" || !EVQ.done) render(); }
  }, err => console.error(err)));
}
const evLeft = e => e.sample || e.member ? null : (EV_SOLD[e.id] == null ? e.capacity : Math.max(0, e.capacity - EV_SOLD[e.id]));
function sampleEvents(){   // shown only on the preview page (?demo) while there are no real events yet
  const t = Date.now(), day = 86400000, at = (dd, h) => { const p = tzParts(t + dd * day); return torontoMs(`${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`, `${String(h).padStart(2, "0")}:00`); };
  const mk = (i, o) => ({id: "SAMPLE" + i, sample: true, active: true, capacity: 80, organizer: "Nojan", summary: "Sample event for the preview.", description: "This is a sample so you can see how events look. Real events you add in Admin replace these.", ...o});
  return [
    mk(1, {title: "Persian Night: Live Music & Dinner", category: "Culture & heritage", startMs: at(4, 19), venue: "Richmond Hill Centre for the Performing Arts", city: "Richmond Hill", featured: true, tickets: [{name: "General", price: 45}, {name: "VIP table", price: 85}]}),
    mk(2, {title: "Intro to Excel: Free Workshop", category: "Classes & workshops", startMs: at(1, 18), format: "online", tickets: [{name: "Free spot", price: 0}]}),
    mk(3, {title: "Small Business Networking Breakfast", category: "Business & networking", startMs: at(2, 8), venue: "Downtown Markham", city: "Markham", tickets: [{name: "Ticket", price: 15}]}),
    mk(4, {title: "Saturday Farmers Market", category: "Food & drink", startMs: at(5, 9), venue: "Mill Pond Park", city: "Richmond Hill", tickets: [{name: "Free entry", price: 0}]}),
    mk(5, {title: "Family Movie Afternoon", category: "Family & kids", startMs: at(6, 14), venue: "Community Centre", city: "Vaughan", tickets: [{name: "Child", price: 5}, {name: "Adult", price: 8}]}),
    mk(6, {title: "Toronto Tech Meetup: AI for Small Shops", category: "Tech & digital", startMs: at(9, 18), venue: "MaRS Discovery District", city: "Toronto", featured: true, tickets: [{name: "Ticket", price: 0}]}),
    mk(7, {title: "Morning Run Club", category: "Sports & fitness", startMs: at(0, 23), venue: "Lake Wilcox", city: "Richmond Hill", tickets: [{name: "Join", price: 0}]}),
    mk(8, {title: "Jazz on the Patio", category: "Music & concerts", startMs: at(12, 20), venue: "Distillery District", city: "Toronto", tickets: [{name: "General", price: 30}]})
  ].map(fsToEvent);
}

/* dates in Toronto time */
const evKey = ms => { const p = tzParts(ms); return `${p.y}-${String(p.m).padStart(2, "0")}-${String(p.d).padStart(2, "0")}`; };
const evFmt = (ms, o) => new Date(ms).toLocaleString("en-CA", {timeZone: TZ, ...o});
const evTime = ms => evFmt(ms, {hour: "numeric", minute: "2-digit"}).replace(/\s/g, " ");
const evDayLong = ms => evFmt(ms, {weekday: "long", month: "long", day: "numeric"});
const evDayShort = ms => evFmt(ms, {weekday: "short", month: "short", day: "numeric"});
function evDayLabel(ms){
  const k = evKey(ms), today = evKey(Date.now()), tom = evKey(Date.now() + 86400000);
  return k === today ? "Today" : k === tom ? "Tomorrow" : evFmt(ms, {weekday: "long"});
}
function evInWhen(e, w){
  if (w === "any") return true;
  const now = Date.now(), k = evKey(e.startMs), today = evKey(now);
  if (w === "today") return k === today || (e.startMs <= now && e.endMs >= now);
  if (w === "tomorrow") return k === evKey(now + 86400000);
  if (w === "week") return e.startMs <= now + 7 * 86400000;
  if (w === "month") return e.startMs <= now + 30 * 86400000;
  if (w === "weekend"){
    const wd = new Date(now).toLocaleString("en-CA", {timeZone: TZ, weekday: "short"}), idx = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].findIndex(x => wd.startsWith(x));
    const toSat = idx === 0 ? -1 : 6 - idx, keys = [evKey(now + toSat * 86400000), evKey(now + (toSat + 1) * 86400000)];
    if (idx === 5) keys.push(today);   // Friday evening counts
    return keys.includes(k);
  }
  return true;
}
const EVF = {when: "any", cats: [], price: "any", format: "any", city: "", sort: "soon"};
const evActive = () => EVF.when !== "any" || EVF.cats.length || EVF.price !== "any" || EVF.format !== "any" || EVF.city || query.trim();
function evMatchQ(e, q){ return !q || [e.title, e.category, e.venue, e.city, e.organizer, e.summary, e.description].join(" ").toLowerCase().includes(q); }
function evFiltered(skip){
  const q = query.trim().toLowerCase();
  let l = EVENTS.filter(e => (skip === "when" || evInWhen(e, EVF.when)) && (skip === "cats" || !EVF.cats.length || EVF.cats.includes(e.category))
    && (EVF.price === "any" || (EVF.price === "free" ? e.free : !e.free)) && (EVF.format === "any" || e.format === EVF.format)
    && (!EVF.city || (EVF.city === "Online" ? e.format === "online" : e.city === EVF.city)) && evMatchQ(e, q));
  if (EVF.sort === "price") l = l.slice().sort((a, b) => a.minPrice - b.minPrice || a.startMs - b.startMs);
  return l;
}
const evPriceTxt = e => e.free ? "Free" : e.minPrice === e.maxPrice ? money(e.minPrice) : (e.minPrice === 0 ? "Free – " + money(e.maxPrice) : "From " + money(e.minPrice));
const evWhere = e => e.format === "online" ? "Online" : [e.venue, e.city].filter(Boolean).join(" · ") || "Location to be announced";
function evCover(e, cls){
  if (e.cover) return `<img class="${cls || ""}" src="${esc(imgSrc(e.cover, null, 1))}" data-ref="${esc(e.cover)}" alt="" loading="lazy">`;
  return `<span class="evph c${EV_CATS.indexOf(e.category) % 6}">${evIcon(e.category)}</span>`;
}
function evDateBadge(ms){
  return `<span class="evdate"><small>${evFmt(ms, {month: "short"})}</small><b>${evFmt(ms, {day: "numeric"})}</b><small>${evFmt(ms, {weekday: "short"})}</small></span>`;
}
function evAvail(e){
  const l = evLeft(e);
  if (l == null) return "";
  if (l <= 0) return `<span class="evtag sold">Sold out</span>`;
  if (l <= Math.max(5, Math.round(e.capacity * .15))) return `<span class="evtag hot">Only ${l} left</span>`;
  return "";
}
function evCardHTML(e){
  return `<article class="evcard" data-ev="${esc(e.id)}">
    <a class="evimg" href="#event-${esc(e.id)}" aria-label="${esc(e.title)}">${evCover(e)}${evDateBadge(e.startMs)}<span class="evprice${e.free ? " free" : ""}">${evPriceTxt(e)}</span></a>
    <div class="evbody">
      <span class="evcat">${evIcon(e.category)}${esc(e.category)}</span>
      <h3><a href="#event-${esc(e.id)}">${esc(e.title)}</a></h3>
      <p class="evline">${svgI("clock")}${evDayShort(e.startMs)} · ${evTime(e.startMs)}</p>
      <p class="evline">${svgI(e.format === "online" ? "video" : "pin")}${esc(evWhere(e))}</p>
      ${e.member ? `<p class="evline evby">${e.certified ? certBadge(true) : ""}by ${esc(e.organizer)}</p>` : ""}${evAvail(e)}${e.sample ? `<span class="evtag">Sample</span>` : ""}
    </div></article>`;
}
function evFeatHTML(e){
  return `<a class="evfeat" href="#event-${esc(e.id)}" data-ev="${esc(e.id)}">
    <span class="evfbg">${evCover(e)}</span><span class="evfshade"></span>
    <span class="evftext"><span class="evcat light">${evIcon(e.category)}${esc(e.category)}${e.sample ? " · Sample" : ""}</span>
      <b>${esc(e.title)}</b>
      <span>${evDayLong(e.startMs)} · ${evTime(e.startMs)}</span><span>${esc(evWhere(e))}</span>
      <span class="evfcta"><i>${evPriceTxt(e)}</i><em>${e.free ? "Reserve a spot" : "Get tickets"} →</em></span></span></a>`;
}
const evChip = (k, v, label, on, extra) => `<button type="button" class="evchip" data-evf="${k}" data-v="${esc(v)}" aria-pressed="${on}">${extra || ""}${esc(label)}</button>`;
function eventsView(){
  const sort = `<label class="sortlbl hsort">Sort by
        <select data-evs="sort"><option value="soon">Soonest first</option><option value="price"${EVF.sort === "price" ? " selected" : ""}>Lowest price</option></select>
      </label>`;
  const hero = `<section class="pagehero lhero events"><div class="phtext"><h1>Events</h1><p>Concerts, classes, meetups and more, in person or online. Reserve a spot or get tickets.</p></div>${sort}</section>`;
  if (!eventsLoaded && !fbFailed) return hero + `<div class="empty">Loading events…</div>`;
  const n = evFiltered().length;
  return hero + `<div class="qbar" id="qbar"><div class="qrow qonly"><button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${evFltCount() || ""}</span></button></div></div>
  <div class="fltback" id="fltBack" data-fclose ${fltOpen ? "" : "hidden"}></div>
  <section class="fltpanel" id="fltPanel" role="dialog" aria-label="Filter events" ${fltOpen ? "" : "hidden"}>
    <div class="flthead"><h2>More filters</h2><button type="button" class="fltx" data-fclose aria-label="Close filters">×</button></div>
    <div class="fltbody" id="evPanel">${evPanelHTML()}</div>
    <div class="fltfoot" id="evFoot">${evFootHTML(n)}</div>
  </section>
  <div id="evResults">${evResultsHTML()}</div>`;
}
const evFltCount = () => (EVF.when !== "any") + EVF.cats.length + (EVF.price !== "any") + (EVF.format !== "any") + (!!EVF.city);
const evFootHTML = n => `<button type="button" class="linkbtn" data-evclear ${evFltCount() ? "" : "disabled"}>Clear all</button><button type="button" class="btn" data-fclose>Show ${n} event${n === 1 ? "" : "s"}</button>`;
function evPanelHTML(){
  const opt = (k, v, label, on, cnt) => `<button type="button" class="fopt${cnt === 0 ? " zero" : ""}" data-evf="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}${cnt != null ? ` <i>${cnt}</i>` : ""}</button>`;
  const sec = (title, inner) => inner ? `<div class="fsec"><h3>${title}</h3><div class="fopts" role="group" aria-label="${title}">${inner}</div></div>` : "";
  const when = [["any", "Any time"], ["today", "Today"], ["tomorrow", "Tomorrow"], ["weekend", "This weekend"], ["week", "This week"], ["month", "Next 30 days"]];
  const cats = EV_CATS.map(c => [c, evFiltered("cats").filter(e => e.category === c).length]).filter(([c, n]) => n || EVF.cats.includes(c));
  const cities = [...new Set(EVENTS.filter(e => e.format !== "online" && e.city).map(e => e.city))].sort();
  return sec("When", when.map(([v, l]) => opt("when", v, l, EVF.when === v)).join(""))
    + sec("Category", cats.map(([c, n]) => opt("cat", c, c, EVF.cats.includes(c), n)).join(""))
    + sec("Price", [["any", "Any price"], ["free", "Free"], ["paid", "Paid"]].map(([v, l]) => opt("price", v, l, EVF.price === v)).join(""))
    + sec("How it's held", [["any", "In person or online"], ["in-person", "In person"], ["online", "Online"]].map(([v, l]) => opt("format", v, l, EVF.format === v)).join(""))
    + sec("Where", [["", "Anywhere"], ...cities.map(c => [c, c]), ["Online", "Online"]].map(([v, l]) => opt("city", v, l, EVF.city === v)).join(""));
}
function evRefresh(){
  const r = $("#evResults"); if (!r){ render(); return; }
  r.innerHTML = evResultsHTML();
  const pnl = $("#evPanel"), top = pnl ? pnl.scrollTop : 0; if (pnl){ pnl.innerHTML = evPanelHTML(); pnl.scrollTop = top; }
  const f = $("#evFoot"); if (f) f.innerHTML = evFootHTML(evFiltered().length);
  const bd = $("#fltBadge"); if (bd) bd.textContent = evFltCount() || "";
}
function evResultsHTML(){
  const list = evFiltered();
  if (!EVENTS.length) return `<div class="evempty">${TICKET_SVG}<b>New events are coming soon</b><span>Check back shortly, or <a href="#contact-us">tell us</a> what you'd like to see.</span></div>`;
  if (!list.length) return `<div class="evempty">${TICKET_SVG}<b>No events match these filters</b><button type="button" class="btn small" data-evclear>Clear filters</button></div>`;
  const feat = !evActive() && EVF.sort === "soon" ? list.filter(e => e.featured).slice(0, 4) : [];
  const n = list.length;
  let html = `<p class="count">${n} event${n === 1 ? "" : "s"}${query.trim() ? ` matching “${esc(query.trim())}” <button class="linkbtn" data-clear>Clear search</button>` : ""}</p>`;
  if (feat.length) html += `<section class="evsec"><h2>Featured</h2><div class="evfeats">${feat.map(evFeatHTML).join("")}</div></section>`;
  if (EVF.sort === "price") return html + `<div class="evgrid">${list.map(evCardHTML).join("")}</div>`;
  const now = Date.now(), B = [["Today", e => evInWhen(e, "today")], ["Tomorrow", e => evInWhen(e, "tomorrow")], ["This weekend", e => evInWhen(e, "weekend")], ["This week", e => evInWhen(e, "week")], ["Later this month", e => evInWhen(e, "month")], ["Coming up", () => true]];
  const groups = B.map(([l]) => [l, []]); list.forEach(e => { const i = B.findIndex(([, f]) => f(e)); groups[i][1].push(e); });
  const sub = {Today: evDayLong(now), Tomorrow: evDayLong(now + 86400000)};
  groups.filter(([, evs]) => evs.length).forEach(([l, evs]) => {
    html += `<section class="evsec evday"><h2><span>${l}</span><small>${sub[l] || evs.length + " event" + (evs.length === 1 ? "" : "s")}</small></h2><div class="evgrid">${evs.map(evCardHTML).join("")}</div></section>`; });
  return html;
}

/* event page */
const EVQ = {id: null, qty: {}, busy: false, done: null, err: ""};
function evResetQ(id){ EVQ.id = id; EVQ.qty = {}; EVQ.busy = false; EVQ.done = null; EVQ.err = ""; }
function eventView(){
  if (String(eventId).startsWith("m-")) return mkDetailView(String(eventId).slice(2));
  const e = eventById(eventId);
  if (!e) return eventsLoaded || fbFailed ? `<div class="empty">This event isn't available anymore. <a href="#events" style="color:var(--link)">See all events</a></div>` : `<div class="empty">Loading…</div>`;
  if (EVQ.id !== e.id) evResetQ(e.id);
  const past = e.endMs < Date.now(), maps = "https://www.google.com/maps/search/?api=1&query=" + encodeURIComponent([e.venue, e.address, e.city].filter(Boolean).join(", "));
  return `<article class="evpage">
    <div class="evcover"><span class="evcbg">${evCover(e)}</span><span class="evcimg">${evCover(e)}</span></div>
    <div class="evlayout">
      <div class="evmain">
        <span class="evcat">${evIcon(e.category)}${esc(e.category)}${e.sample ? " · Sample" : ""}</span>
        <h1>${esc(e.title)}</h1>
        ${e.summary ? `<p class="evsum">${esc(e.summary)}</p>` : ""}
        <div class="evfacts">
          <div>${svgI("calendar")}<span><b>${evDayLong(e.startMs)}</b><small>${evTime(e.startMs)} – ${evTime(e.endMs)} (Toronto time)</small></span></div>
          <div>${svgI(e.format === "online" ? "video" : "pin")}<span><b>${esc(e.format === "online" ? "Online event" : e.venue || "Location to be announced")}</b><small>${esc(e.format === "online" ? (e.onlineInfo ? "Joining details are sent with your ticket" : "Link sent with your ticket") : [e.address, e.city].filter(Boolean).join(", "))}</small>${e.format !== "online" && (e.venue || e.address) ? `<a href="${maps}" target="_blank" rel="noopener">Open in Google Maps</a>` : ""}</span></div>
          <div>${svgI("user")}<span><b>Hosted by ${esc(e.organizer)}</b><small>Questions? <a href="#contact-us">Contact us</a></small></span></div>
          <div>${TICKET_SVG}<span><b>${evPriceTxt(e)}</b><small>${e.free ? "Free, but please reserve so we know you're coming" : "Reserve now and pay later, or pay by card"}</small></span></div>
        </div>
        <button class="btn evjump" type="button" data-evjump>${TICKET_SVG}${past ? "This event has ended" : e.free ? "Reserve a spot" : "Get tickets"}</button>
        <section class="evsect"><h2>About this event</h2><div class="itemdesc">${descHTML(e.description || e.summary)}</div></section>
        <section class="evsect"><h2>Good to know</h2><ul class="bullets">
          <li><b>Your ticket:</b> you get a ticket number right away. It's also in My orders &amp; bookings.</li>
          <li><b>Paying:</b> ${e.free ? "this event is free." : `pay by card online, or by e-Transfer to ${esc(SHOP_EMAIL)} or at the door. Your spot is held when you reserve.`}</li>
          <li><b>Plans changed?</b> Cancel from My orders &amp; bookings before the event starts and your spot goes to someone else.</li>
        </ul></section>
        <div style="display:flex;gap:10px;flex-wrap:wrap;margin-top:6px"><button type="button" class="btn ghost small" data-evshare>Share</button><button type="button" class="btn ghost small" data-evics="${esc(e.id)}">Add to calendar</button><a class="btn ghost small" href="#events">All events</a></div>
      </div>
      <aside class="evbox" id="evBox">${evBoxHTML(e)}</aside>
    </div></article>`;
}
function evBoxHTML(e){
  const left = evLeft(e), past = e.endMs < Date.now();
  if (EVQ.done) return evDoneHTML(e);
  if (past) return `<h2>Tickets</h2><p class="note">This event has ended.</p>`;
  if (left === 0) return `<h2>Tickets</h2><div class="evtag sold" style="font-size:1rem">Sold out</div><p class="note" style="margin-top:8px">All spots are taken. <a href="#events">See other events</a></p>`;
  const qty = i => EVQ.qty[i] || 0, n = e.tickets.reduce((a, t) => a + qty(t.i), 0), total = e.tickets.reduce((a, t) => a + qty(t.i) * t.price, 0);
  const max = left == null ? 10 : Math.min(10, left);
  const cardOK = n > 0 && total > 0 && e.tickets.filter(t => qty(t.i) && t.price > 0).every(t => /^https:\/\/(buy|checkout)\.stripe\.com\//.test(t.stripe));
  return `<h2>${e.free ? "Reserve your spot" : "Tickets"}</h2>${left != null && left <= 20 ? `<p class="evleft">${left} spot${left === 1 ? "" : "s"} left</p>` : ""}
    <div class="evtix">${e.tickets.map(t => `<div class="evtrow"><span><b>${esc(t.name)}</b><small>${t.price ? money(t.price) : "Free"}</small></span>
      <span class="stepper"><button type="button" data-evq="${t.i}" data-d="-1" aria-label="Fewer ${esc(t.name)}" ${qty(t.i) ? "" : "disabled"}>−</button><output>${qty(t.i)}</output><button type="button" data-evq="${t.i}" data-d="1" aria-label="More ${esc(t.name)}" ${n >= max ? "disabled" : ""}>+</button></span></div>`).join("")}</div>
    <div class="evtotal"><span>${n} ticket${n === 1 ? "" : "s"}</span><b>${total ? money(total) : n ? "Free" : "—"}</b></div>
    ${e.sample ? `<p class="note">This is a sample event for the preview, so tickets can't be reserved.</p>` : !USER ? `<p class="note">Sign in to reserve, so your tickets are saved to your account.</p>
      <div style="display:grid;gap:8px">${typeof googleBtn === "function" ? googleBtn("event") : ""}<button class="btn" type="button" data-auth="signin" data-next="event">Sign in with email</button><button class="btn ghost" type="button" data-auth="signup" data-next="event" style="color:var(--fg)">Create account</button></div>` : `
      <form id="evForm" class="evform">
        <label>Name<input name="name" required autocomplete="name" value="${esc((PROFILE && PROFILE.name) || USER.displayName || "")}"></label>
        <label>Phone <small>(optional)</small><input name="phone" type="tel" autocomplete="tel" value="${esc((PROFILE && PROFILE.phone) || "")}"></label>
        <p class="note" style="margin:0">Tickets go to ${esc(USER.email)}</p>
        ${EVQ.err ? `<p class="evtag sold" role="alert">${esc(EVQ.err)}</p>` : ""}
        <button class="btn" type="submit" name="pay" value="later" ${n && !EVQ.busy ? "" : "disabled"}>${EVQ.busy ? "Reserving…" : total ? `Reserve, pay later · ${money(total)}` : "Reserve free spot" + (n > 1 ? "s" : "")}</button>
        ${total ? `<button class="btn ghost" type="submit" name="pay" value="card" ${cardOK && !EVQ.busy ? "" : "disabled"} style="color:var(--fg)">Pay by card · ${money(total)}</button>${n && !cardOK ? `<p class="note" style="margin:0">Card payment isn't set up for this ticket yet. Reserve now and pay later.</p>` : ""}` : ""}
      </form>`}`;
}
function evDoneHTML(e){
  const r = EVQ.done, stripe = r.payment === "card" ? r.items.filter(t => t.price > 0 && t.stripe) : [];
  return `<div class="evdone"><span class="evok">✓</span><h2>${r.total ? "Tickets reserved" : "You're in!"}</h2>
    <p class="evtnum">Ticket #T${r.number}</p>
    <p class="note">${r.items.map(t => `${t.qty} × ${esc(t.name)}`).join(", ")} · ${evDayShort(e.startMs)}, ${evTime(e.startMs)}</p>
    ${e.format === "online" && e.onlineInfo ? `<p class="note" style="color:var(--fg)"><b>How to join:</b> ${esc(e.onlineInfo)}</p>` : ""}
    ${stripe.length ? `<p class="note" style="color:var(--fg)">Finish paying by card:</p>${stripe.map(t => `<a class="btn" href="${esc(stripeUrl(t.stripe, r.number, USER && USER.email))}" target="_blank" rel="noopener">Pay ${money(t.price * t.qty)} by card${stripe.length > 1 ? " · " + esc(t.name) : ""}</a>`).join("")}<p class="note">Opens Stripe's secure checkout. Choose quantity ${stripe.map(t => t.qty).join(" / ")} there.</p>`
      : r.total ? `<p class="note" style="color:var(--fg)">Pay ${money(r.total)} by e-Transfer to ${esc(SHOP_EMAIL)} (message: T${r.number}) or at the door.</p>` : ""}
    <div style="display:grid;gap:8px;margin-top:6px"><button class="btn ghost" type="button" data-evics="${esc(e.id)}" style="color:var(--fg)">Add to calendar</button><a class="btn ghost" href="#my-orders" style="color:var(--fg)">My tickets</a></div></div>`;
}
const stripeUrl = (u, num, email) => { try { const x = new URL(u); x.searchParams.set("client_reference_id", "T" + num); if (email) x.searchParams.set("prefilled_email", email); return x.href; } catch(_) { return u; } };
function evICS(e, num){
  const dt = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, ""), tx = s => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  const ics = ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nojan//Events//EN", "BEGIN:VEVENT", `UID:${e.id}-${num || "x"}@nojan`, `DTSTAMP:${dt(Date.now())}`,
    `DTSTART:${dt(e.startMs)}`, `DTEND:${dt(e.endMs)}`, `SUMMARY:${tx(e.title)}`, `DESCRIPTION:${tx((num ? `Ticket #T${num}. ` : "") + location.origin + "/#event-" + e.id)}`,
    `LOCATION:${tx(e.format === "online" ? "Online" : [e.venue, e.address, e.city].filter(Boolean).join(", "))}`, "END:VEVENT", "END:VCALENDAR"].join("\r\n");
  const url = URL.createObjectURL(new Blob([ics], {type: "text/calendar"})), a = document.createElement("a");
  a.href = url; a.download = "event.ics"; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
}
function refreshEvBox(){ const e = eventById(eventId), box = $("#evBox"); if (e && box) box.innerHTML = evBoxHTML(e); }

/* clicks and inputs for events */
document.addEventListener("click", async ev => {
  const card = ev.target.closest("[data-ev]");
  const b = ev.target.closest("button");
  if (!b && card && !ev.target.closest("a")){ go("event", card.dataset.ev); return; }
  if (!b) return;
  if (b.dataset.evf){
    const k = b.dataset.evf, v = b.dataset.v;
    if (k === "when") EVF.when = v;
    if (k === "cat") EVF.cats = !v ? [] : EVF.cats.includes(v) ? EVF.cats.filter(x => x !== v) : [...EVF.cats, v];
    if (k === "price" || k === "format" || k === "city") EVF[k] = v;
    evRefresh(); return;
  }
  if (b.hasAttribute("data-evclear")){ const inPanel = !!b.closest("#fltPanel"); Object.assign(EVF, {when: "any", cats: [], price: "any", format: "any", city: ""}); if (!inPanel){ query = ""; const qi = $("#q"); if (qi) qi.value = ""; } if (inPanel) evRefresh(); else render(); return; }
  if (b.dataset.evq != null){
    const e = eventById(eventId); if (!e) return;
    const i = +b.dataset.evq, left = evLeft(e), max = left == null ? 10 : Math.min(10, left), n = Object.values(EVQ.qty).reduce((a, x) => a + x, 0);
    const next = Math.max(0, (EVQ.qty[i] || 0) + (+b.dataset.d));
    if (+b.dataset.d > 0 && n >= max) return;
    EVQ.qty[i] = next; EVQ.err = ""; refreshEvBox(); return;
  }
  if (b.hasAttribute("data-evjump")){ const x = $("#evBox"); if (x) x.scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if (b.dataset.evics){ const e = eventById(b.dataset.evics); if (e) evICS(e, EVQ.done && EVQ.done.number); return; }
  if (b.hasAttribute("data-evshare")){
    const e = eventById(eventId), url = location.origin + "/#event-" + eventId;
    try { if (navigator.share){ await navigator.share({title: e ? e.title : "Event", url}); return; } await navigator.clipboard.writeText(url); toast("Link copied"); } catch(_) {}
    return;
  }
});
document.addEventListener("change", e => {
  const s = e.target.closest("[data-evs]"); if (!s) return;
  EVF[s.dataset.evs] = s.value; render();
});
document.addEventListener("submit", async ev => {
  const f = ev.target;
  if (f.id !== "evForm") return;
  ev.preventDefault();
  const e = eventById(eventId); if (!e || !USER || !FB || EVQ.busy) return;
  const pay = (ev.submitter && ev.submitter.value) || "later";
  const items = e.tickets.filter(t => EVQ.qty[t.i]).map(t => ({i: t.i, name: t.name, price: t.price, qty: EVQ.qty[t.i], stripe: t.stripe || ""}));
  const qty = items.reduce((a, t) => a + t.qty, 0), total = items.reduce((a, t) => a + t.qty * t.price, 0);
  if (!qty) return;
  EVQ.busy = true; EVQ.err = ""; refreshEvBox();
  const fd = new FormData(f);
  const b = {kind: "event", uid: USER.uid, eventId: e.id, serviceId: e.id, serviceTitle: e.title, providerName: e.organizer, startMs: e.startMs, durationMin: Math.max(30, Math.round((e.endMs - e.startMs) / 60000)),
    format: e.format === "online" ? "online" : "in-person", venue: e.venue, address: [e.address, e.city].filter(Boolean).join(", "), location: e.venue, items: items.map(({stripe, ...t}) => t), qty, total, payment: total ? pay : "free",
    name: String(fd.get("name") || "").trim(), phone: String(fd.get("phone") || "").trim(), email: USER.email || "", slotKey: "ev_" + e.id};
  try {
    const r = await FB.reserveTickets(b, qty, e.capacity);
    EVQ.done = {...b, items, number: r.number, id: r.id}; EVQ.busy = false; EVQ.qty = {};
    refreshEvBox(); const box = $("#evBox"); if (box) box.scrollIntoView({behavior: "smooth", block: "start"});
  } catch (err) {
    console.error(err); EVQ.busy = false;
    EVQ.err = String(err && err.message).includes("sold-out") ? "Sorry, there aren't enough spots left for that many tickets." : "We couldn't reserve your tickets. Check your connection and try again.";
    refreshEvBox();
  }
});

/* My tickets (in My orders & bookings) */
function myTicketsHTML(){
  if (!MY.bookings) return `<div class="empty">Loading your tickets…</div>`;
  const t = MY.bookings.filter(b => b.kind === "event");
  if (!t.length) return `<div class="empty">No event tickets yet. <a href="#events" style="color:var(--link)">Find an event</a></div>`;
  const now = Date.now(), up = t.filter(b => b.startMs + b.durationMin * 60000 >= now && b.status !== "Cancelled"), past = t.filter(b => !up.includes(b)).reverse();
  const card = b => {
    const e = eventById(b.eventId), st = b.status === "Requested" ? (b.total ? "Reserved · not paid" : "Reserved") : b.status === "Confirmed" ? (b.total ? "Paid" : "Confirmed") : b.status;
    const stripe = b.status === "Requested" && b.payment === "card" && e ? e.tickets.filter(x => x.stripe && (b.items || []).some(i => i.i === x.i && i.price > 0)) : [];
    return `<div class="evmyt">
      <a class="evmyimg" href="#event-${esc(b.eventId)}">${e ? evCover(e) : TICKET_SVG}${evDateBadge(b.startMs)}</a>
      <div class="evmyb"><b><a href="#event-${esc(b.eventId)}">${esc(b.serviceTitle)}</a></b>
        <span class="note">${evDayShort(b.startMs)} · ${evTime(b.startMs)} · ${esc(b.format === "online" ? "Online" : b.venue || b.address || "")}</span>
        <span class="note">Ticket #T${b.number} · ${(b.items || []).map(i => `${i.qty} × ${esc(i.name)}`).join(", ")}${b.total ? " · " + money(b.total) : " · Free"}</span>
        ${e && e.format === "online" && e.onlineInfo && b.status !== "Cancelled" ? `<span class="note" style="color:var(--fg)"><b>How to join:</b> ${esc(e.onlineInfo)}</span>` : ""}
        <span>${pill(st)}</span>
        <span class="evmya">${stripe.map(x => `<a class="btn small" href="${esc(stripeUrl(x.stripe, b.number, USER && USER.email))}" target="_blank" rel="noopener">Pay by card</a>`).join("")}
          ${e ? `<button type="button" class="linkbtn" data-evics="${esc(e.id)}">Add to calendar</button>` : ""}
          ${["Requested", "Confirmed"].includes(b.status) && b.startMs > now ? `<button type="button" class="linkbtn" data-evcancel="${esc(b.id)}" style="color:var(--danger)">Cancel</button>` : ""}</span></div></div>`;
  };
  return `${up.length ? `<div class="evmylist">${up.map(card).join("")}</div>` : `<div class="empty">No upcoming tickets. <a href="#events" style="color:var(--link)">Find an event</a></div>`}
    ${past.length ? `<details style="margin-top:12px"><summary class="note" style="cursor:pointer">Past and cancelled (${past.length})</summary><div class="evmylist" style="margin-top:10px">${past.map(card).join("")}</div></details>` : ""}`;
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest("[data-evcancel]"); if (!b) return;
  if (!confirmInline(b, "Click again to cancel")) return;
  b.disabled = true;
  try { await FB.cancelMyTicket(b.dataset.evcancel); toast("Ticket cancelled"); } catch (err) { console.error(err); toast("Couldn't cancel. Try again."); b.disabled = false; }
});

/* Admin: events */
const EVADM = {edit: null, att: null, photo: null, q: ""};
function nextEventId(){ const n = Math.max(0, ...ALL_EVENTS.map(d => parseInt(String(d.id).replace(/\D/g, ""), 10) || 0)); return "EV" + String(n + 1).padStart(3, "0"); }
function eventsAdminHTML(){
  if (EVADM.edit) return eventFormHTML();
  if (EVADM.att) return attendeesHTML();
  const now = Date.now(), list = ALL_EVENTS.map(fsToEvent).sort((a, b) => (a.endMs < now) - (b.endMs < now) || a.startMs - b.startMs);
  const tix = id => (ADM.bookings || []).filter(x => x.kind === "event" && x.eventId === id && x.status !== "Cancelled");
  return `<div class="admintools"><span class="note">${list.length} event${list.length === 1 ? "" : "s"} · customers see them at <a href="#events">Events</a></span><button class="btn small" type="button" data-evnew>+ Add event</button></div>
    ${list.length ? `<div class="evadmlist">${list.map(e => { const t = tix(e.id), sold = t.reduce((a, x) => a + (x.qty || 1), 0), rev = t.reduce((a, x) => a + (x.total || 0), 0);
      const st = !e.active ? "Hidden" : e.endMs < now ? "Ended" : "Live";
      return `<div class="evadmrow"><span class="evadmimg">${evCover(e)}</span>
        <span><b>${esc(e.title)}</b><small>${evDayShort(e.startMs)} · ${evTime(e.startMs)} · ${esc(evWhere(e))}</small><small>${pill(st)} ${sold}/${e.capacity} reserved${rev ? " · " + money(rev) + " in tickets" : ""}${e.featured ? " · Featured" : ""}</small></span>
        <span class="evadmact"><button class="btn small ghost" type="button" data-evatt="${esc(e.id)}">Attendees (${t.length})</button><button class="btn small ghost" type="button" data-evedit="${esc(e.id)}">Edit</button><a class="btn small ghost" href="#event-${esc(e.id)}">View</a></span></div>`; }).join("")}</div>`
    : `<div class="empty">No events yet. Click “Add event” to create your first one.</div>`}`;
}
function eventFormHTML(){
  const isNew = EVADM.edit === "new", d = isNew ? {} : (ALL_EVENTS.find(x => x.id === EVADM.edit) || {}), e = fsToEvent({id: EVADM.edit, ...d});
  const p = e.startMs ? tzParts(e.startMs) : null, pe = e.endMs ? tzParts(e.endMs) : null, pad = n => String(n).padStart(2, "0");
  const date = p ? `${p.y}-${pad(p.m)}-${pad(p.d)}` : "", st = p ? `${pad(p.H)}:${pad(p.M)}` : "19:00", en = pe ? `${pad(pe.H)}:${pad(pe.M)}` : "21:00";
  const tk = (isNew ? [{name: "General admission", price: 0, stripe: ""}] : (d.tickets || e.tickets)).concat([{}, {}, {}]).slice(0, 4);
  const cover = EVADM.photo || (e.cover ? imgSrc(e.cover, null, 1) : "");
  return `<form id="evAdmForm" class="panel" style="display:grid;gap:14px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:10px"><h2 style="margin:0">${isNew ? "New event" : "Edit event"}</h2><button type="button" class="linkbtn" data-evback>← Back to events</button></div>
    <label>Event name<input name="title" required value="${esc(d.title || "")}" placeholder="e.g. Persian Night: Live Music & Dinner"></label>
    <div class="pfs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Category<select name="category">${EV_CATS.map(c => `<option${e.category === c ? " selected" : ""}>${esc(c)}</option>`).join("")}</select></label>
      <label>Date<input name="date" type="date" required value="${date}"></label>
      <label>Starts<input name="start" type="time" required value="${st}"></label>
      <label>Ends<input name="end" type="time" required value="${en}"></label>
    </div>
    <div class="pfs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Format<select name="format"><option value="in-person">In person</option><option value="online"${e.format === "online" ? " selected" : ""}>Online</option></select></label>
      <label>Venue<input name="venue" value="${esc(d.venue || "")}" placeholder="e.g. Mill Pond Park"></label>
      <label>Street address<input name="address" value="${esc(d.address || "")}" placeholder="e.g. 10 Mill St"></label>
      <label>City<input name="city" value="${esc(d.city || "Richmond Hill")}" list="evCities"></label>
    </div>
    <datalist id="evCities"><option>Richmond Hill</option><option>Toronto</option><option>Markham</option><option>Vaughan</option><option>Aurora</option><option>Newmarket</option><option>Mississauga</option></datalist>
    <label>Online joining details <small>(only shown on tickets; for online events)</small><input name="onlineInfo" value="${esc(d.onlineInfo || "")}" placeholder="e.g. Zoom link sent the day before"></label>
    <label>One-line summary<input name="summary" maxlength="160" value="${esc(d.summary || "")}" placeholder="Shown under the title"></label>
    <label>Description <small>(start a line with • for bullet points)</small><textarea name="description" rows="7">${esc(d.description || "")}</textarea></label>
    <div class="pfs" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(170px,1fr));gap:12px">
      <label>Hosted by<input name="organizer" value="${esc(d.organizer || "Nojan")}"></label>
      <label>Total spots<input name="capacity" type="number" min="1" step="1" required value="${d.capacity || 100}"></label>
      <label style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" name="featured" ${d.featured ? "checked" : ""}> Feature at the top</label>
      <label style="display:flex;gap:8px;align-items:center;margin-top:22px"><input type="checkbox" name="active" ${d.active === false ? "" : "checked"}> Show on the site</label>
    </div>
    <fieldset style="border:1px solid var(--line);border-radius:14px;padding:12px;display:grid;gap:10px"><legend style="padding:0 6px;font-weight:600">Tickets</legend>
      <p class="note" style="margin:0">Price 0 = free. For card payments, paste a Stripe Payment Link for that ticket (from your Stripe dashboard → Payment links). Leave it empty and people reserve and pay later.</p>
      ${tk.map((t, i) => `<div style="display:grid;grid-template-columns:2fr 1fr 3fr;gap:8px"><input name="tname${i}" placeholder="${i ? "Another ticket type (optional)" : "Ticket name"}" value="${esc(t.name || "")}"><input name="tprice${i}" type="number" min="0" step="0.01" placeholder="Price $" value="${t.name ? (+t.price || 0) : ""}"><input name="tstripe${i}" type="url" placeholder="https://buy.stripe.com/… (optional)" value="${esc(t.stripe || "")}"></div>`).join("")}
    </fieldset>
    <div style="display:grid;gap:8px"><b>Cover photo</b>
      ${cover ? `<img src="${esc(cover)}" alt="" style="width:100%;max-width:420px;aspect-ratio:16/9;object-fit:cover;border-radius:14px">` : ""}
      <label>Photo link<input name="coverUrl" type="url" placeholder="https://…" value="${esc(String(d.cover || "").startsWith("img:") ? "" : d.cover || "")}"></label>
      <label>or upload a photo<input type="file" id="evPhoto" accept="image/*"></label></div>
    <p id="evAdmMsg" class="note" hidden></p>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:space-between"><button class="btn" type="submit">${isNew ? "Create event" : "Save changes"}</button>${isNew ? "" : `<button class="btn ghost" type="button" data-evdel="${esc(EVADM.edit)}" style="color:var(--danger)">Delete event</button>`}</div>
  </form>`;
}
function attendeesHTML(){
  const e = eventById(EVADM.att); if (!e) { EVADM.att = null; return eventsAdminHTML(); }
  const all = (ADM.bookings || []).filter(x => x.kind === "event" && x.eventId === e.id).sort((a, b) => (a.number || 0) - (b.number || 0));
  const live = all.filter(x => x.status !== "Cancelled"), sold = live.reduce((a, x) => a + (x.qty || 1), 0);
  const paid = live.filter(x => x.status !== "Requested").reduce((a, x) => a + (x.total || 0), 0), owed = live.filter(x => x.status === "Requested").reduce((a, x) => a + (x.total || 0), 0);
  return `<div class="panel" style="display:grid;gap:12px">
    <div style="display:flex;justify-content:space-between;gap:10px;flex-wrap:wrap;align-items:center"><div><h2 style="margin:0">${esc(e.title)}</h2><span class="note">${evDayShort(e.startMs)} · ${evTime(e.startMs)} · ${sold}/${e.capacity} reserved · ${money(paid)} paid${owed ? " · " + money(owed) + " still to pay" : ""}</span></div>
      <span style="display:flex;gap:8px"><button type="button" class="btn small ghost" data-evcsv="${esc(e.id)}">Download list</button><button type="button" class="linkbtn" data-evback>← Back</button></span></div>
    ${all.length ? `<div class="tablewrap"><table class="ctable"><thead><tr><th>#</th><th>Name</th><th>Contact</th><th>Tickets</th><th>Total</th><th>Status</th><th></th></tr></thead><tbody>
      ${all.map(x => `<tr><td>T${x.number}</td><td>${esc(x.name || "")}</td><td>${esc(x.email || "")}${x.phone ? "<br>" + esc(x.phone) : ""}</td><td>${(x.items || []).map(i => `${i.qty} × ${esc(i.name)}`).join("<br>")}</td>
        <td>${x.total ? money(x.total) : "Free"}<br><small class="note">${x.payment === "card" ? "Card" : x.payment === "free" ? "" : "Pay later"}</small></td><td>${pill(x.status === "Requested" ? (x.total ? "Not paid" : "Reserved") : x.status === "Confirmed" ? (x.total ? "Paid" : "Confirmed") : x.status)}</td>
        <td style="white-space:nowrap">${x.status === "Requested" && x.total ? `<button class="linkbtn" type="button" data-evst="${x.id}" data-s="Confirmed">Mark paid</button> ` : ""}${["Requested", "Confirmed"].includes(x.status) ? `<button class="linkbtn" type="button" data-evst="${x.id}" data-s="Checked in">Check in</button> <button class="linkbtn" type="button" data-evst="${x.id}" data-s="Cancelled" style="color:var(--danger)">Cancel</button>` : x.status === "Cancelled" ? `<button class="linkbtn" type="button" data-evst="${x.id}" data-s="Requested">Restore</button>` : ""}</td></tr>`).join("")}
    </tbody></table></div>` : `<div class="empty">No tickets yet.</div>`}</div>`;
}
document.addEventListener("click", async ev => {
  const b = ev.target.closest("button"); if (!b || !isAdmin()) return;
  if (b.hasAttribute("data-evnew")){ EVADM.edit = "new"; EVADM.photo = null; refreshAdmin(true); return; }
  if (b.dataset.evedit){ EVADM.edit = b.dataset.evedit; EVADM.photo = null; refreshAdmin(true); return; }
  if (b.dataset.evatt){ EVADM.att = b.dataset.evatt; refreshAdmin(true); return; }
  if (b.hasAttribute("data-evback")){ EVADM.edit = EVADM.att = null; EVADM.photo = null; refreshAdmin(true); return; }
  if (b.dataset.evdel){ if (!confirmInline(b, "Click again to delete")) return; try { const d = ALL_EVENTS.find(x => x.id === b.dataset.evdel) || {}; await FB.deleteService(b.dataset.evdel, String(d.cover || "").startsWith("img:") ? [d.cover.slice(4)] : []); EVADM.edit = null; toast("Event deleted"); refreshAdmin(true); } catch (err) { console.error(err); toast("Couldn't delete"); } return; }
  if (b.dataset.evst){ b.disabled = true; try { await FB.setTicketStatus(b.dataset.evst, b.dataset.s); toast("Updated"); } catch (err) { console.error(err); toast(String(err.message).includes("sold-out") ? "No spots left to restore this ticket" : "Couldn't update"); b.disabled = false; } return; }
  if (b.dataset.evcsv){
    const e = eventById(b.dataset.evcsv), rows = (ADM.bookings || []).filter(x => x.kind === "event" && x.eventId === b.dataset.evcsv);
    const q = s => `"${String(s ?? "").replace(/"/g, '""')}"`;
    const csv = [["Ticket", "Name", "Email", "Phone", "Tickets", "Total", "Payment", "Status"].join(",")].concat(rows.map(x => [`T${x.number}`, x.name, x.email, x.phone, (x.items || []).map(i => `${i.qty} x ${i.name}`).join("; "), x.total || 0, x.payment, x.status].map(q).join(","))).join("\n");
    const url = URL.createObjectURL(new Blob([csv], {type: "text/csv"})), a = document.createElement("a"); a.href = url; a.download = `attendees-${b.dataset.evcsv}.csv`; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(url), 2000);
    return;
  }
});
document.addEventListener("change", async ev => {
  if (ev.target.id !== "evPhoto" || !ev.target.files[0]) return;
  try { EVADM.photo = await resizeImage(ev.target.files[0], 1600, .82); const f = $("#evAdmForm"); if (f){ const keep = Object.fromEntries(new FormData(f)); refreshAdmin(true); const g = $("#evAdmForm"); if (g) Object.entries(keep).forEach(([k, v]) => { const el = g.elements[k]; if (el && el.type !== "file" && el.type !== "checkbox") el.value = v; }); } } catch (err) { console.error(err); toast("Couldn't read that photo"); }
});
document.addEventListener("submit", async ev => {
  if (ev.target.id !== "evAdmForm") return;
  ev.preventDefault(); if (!isAdmin()) return;
  const f = ev.target, g = n => String(f.elements[n] ? f.elements[n].value : "").trim(), msg = $("#evAdmMsg");
  const isNew = EVADM.edit === "new", id = isNew ? nextEventId() : EVADM.edit, old = ALL_EVENTS.find(x => x.id === id) || {};
  const startMs = torontoMs(g("date"), g("start")); let endMs = torontoMs(g("date"), g("end")); if (endMs <= startMs) endMs += 86400000;   // ends after midnight
  const tickets = [0, 1, 2, 3].map(i => ({name: g("tname" + i), price: Math.round((+g("tprice" + i) || 0) * 100) / 100, stripe: g("tstripe" + i)})).filter(t => t.name);
  if (!tickets.length){ msg.hidden = false; msg.textContent = "Add at least one ticket (price 0 for free)."; return; }
  const btn = f.querySelector('button[type="submit"]'); btn.disabled = true; msg.hidden = false; msg.textContent = "Saving…";
  try {
    let cover = g("coverUrl") || (String(old.cover || "").startsWith("img:") ? old.cover : "");
    if (EVADM.photo){ const imgId = await FB.saveImage(EVADM.photo); IMG[imgId] = EVADM.photo; cover = "img:" + imgId; }
    const data = {kind: "event", title: g("title"), category: g("category"), startMs, endMs, format: g("format"), venue: g("venue"), address: g("address"), city: g("city"), onlineInfo: g("onlineInfo"),
      summary: g("summary"), description: f.elements.description.value.trim(), organizer: g("organizer") || "Nojan", capacity: Math.max(1, parseInt(g("capacity"), 10) || 100),
      featured: f.elements.featured.checked, active: f.elements.active.checked, tickets, cover};
    await FB.saveService(id, data, isNew);
    EVADM.edit = null; EVADM.photo = null; toast(isNew ? "Event created" : "Saved"); refreshAdmin(true);
  } catch (err) { console.error(err); msg.textContent = "Couldn't save: " + (err.code || err.message); btn.disabled = false; }
});

/* ---- Dating (v70): profiles, like or pass, matches and chat ---- */
const DT = {uid: null, me: undefined, people: null, extra: {}, acts: {}, blockedMe: new Set(), matches: null, unsubM: null, loading: false, failedAt: 0, peopleAt: 0,
  photos: {}, gi: 0, chat: {id: null, msgs: null, unsub: null}, form: null, busy: false, err: "", f: null, sort: "new", delArm: false, adm: null, rep: null};
const DT_GENDERS = ["Woman", "Man", "Non-binary"];
const DT_SHOW = {Women: ["Woman"], Men: ["Man"], Everyone: ["Woman", "Man", "Non-binary"]};
const DT_INTENTS = ["Long-term relationship", "Something casual", "New friends", "Not sure yet"];
const DT_INTERESTS = ["Music", "Travel", "Food", "Coffee", "Cooking", "Fitness", "Sports", "Outdoors", "Movies", "Reading", "Gaming", "Art", "Photography", "Dancing", "Pets", "Tech", "Fashion", "Volunteering"];
const DT_HEART = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 20.5s-7.5-4.6-9.3-9.2C1.4 7.9 3.6 4.5 7.1 4.5c2 0 3.6 1.1 4.9 2.8 1.3-1.7 2.9-2.8 4.9-2.8 3.5 0 5.7 3.4 4.4 6.8-1.8 4.6-9.3 9.2-9.3 9.2z"/></svg>`;
const DT_X = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>`;
const DT_VIEWS = ["dating", "person", "matches", "chat", "datingprofile"];
/* v75: the dating section is archived. Set DATING_ON to true to bring it back; the admin can still open it to test. */
const DATING_ON = false;
/* v83: Events and Homes are archived for now (set to true to bring them back). Admins can still open them. */
const EVENTS_ON = false, HOMES_ON = false;
const evOn = () => EVENTS_ON || isAdmin(), hmOn = () => HOMES_ON || isAdmin();
const offHTML = what => `<div class="empty">The ${what} section isn't available right now. <a href="#home" style="color:var(--link)">Back to the home page</a></div>`;
const dtOpen = () => DATING_ON || isAdmin();
const dtArchivedHTML = () => `<div class="empty">The dating section isn't available right now. <a href="#home" style="color:var(--link)">Back to the home page</a></div>`;
const tsMs = t => !t ? 0 : t.toMillis ? t.toMillis() : t.seconds ? t.seconds * 1000 : typeof t === "number" ? t : 0;
const dtCity = c => String(c || "").trim().replace(/\s+/g, " ").replace(/\b\w/g, m => m.toUpperCase());
const dtAgeFrom = dob => { if (!dob) return null; const b = new Date(dob + "T12:00:00"), n = new Date(); let a = n.getFullYear() - b.getFullYear(); if (n.getMonth() < b.getMonth() || (n.getMonth() === b.getMonth() && n.getDate() < b.getDate())) a--; return a; };

function dtReset(){
  if (DT.unsubM) DT.unsubM(); if (DT.chat.unsub) DT.chat.unsub();
  Object.assign(DT, {uid: null, me: undefined, people: null, extra: {}, acts: {}, blockedMe: new Set(), matches: null, unsubM: null, loading: false, failedAt: 0, peopleAt: 0,
    photos: {}, gi: 0, chat: {id: null, msgs: null, unsub: null}, form: null, busy: false, err: "", f: null, delArm: false});
}
function dtGate(next){
  if (!authReady) return `<div class="empty">${fbFailed ? "We couldn't connect. Check your connection and refresh the page." : "Loading…"}</div>`;
  if (!USER) return needSignIn(next, "Sign in to start dating", "Create a free dating profile, like the people you're interested in, and chat when it's mutual.");
  if (!USER.emailVerified) return `<div class="panel dtgate"><h2>Confirm your email first</h2><p class="note">To keep the dating section safe, only members with a confirmed email can join. We sent a link to ${esc(USER.email || "your email")}.</p>
    <div style="display:flex;gap:14px;flex-wrap:wrap"><button class="btn small" type="button" data-recheck>I've confirmed it</button><button class="linkbtn" type="button" data-resend>Send the link again</button></div></div>`;
  if (!FB) return `<div class="empty">We couldn't connect. Check your connection and refresh the page.</div>`;
  return "";
}
async function dtEnsure(force){
  if (!authReady || !USER || !USER.emailVerified || !FB) return;
  if (DT.uid !== USER.uid){ dtReset(); DT.uid = USER.uid; }
  if (DT.loading) return;
  if (!force && DT.me !== undefined && DT.people && Date.now() - DT.peopleAt < 120000) return;
  if (!force && DT.failedAt && Date.now() - DT.failedAt < 30000) return;
  DT.loading = true;
  try {
    const [me, people, acts, blk] = await Promise.all([FB.dtGetMe(USER.uid), FB.dtPeople(), FB.dtMyActs(USER.uid), FB.dtBlockedMe(USER.uid).catch(() => [])]);
    DT.me = me; DT.people = people; DT.peopleAt = Date.now(); DT.failedAt = 0; DT.err = "";
    DT.acts = Object.fromEntries(acts.map(a => [a.to, a.kind]));
    DT.blockedMe = new Set(blk.map(a => a.from));
    if (me && !DT.f) dtDefaultFilters();
    if (me && !DT.unsubM) DT.unsubM = FB.dtWatchMatches(USER.uid, l => { DT.matches = l; dtOnMatches(); }, e => { console.error(e); DT.matches = []; dtOnMatches(); });
  } catch (e) {
    console.error(e); DT.failedAt = Date.now(); DT.err = e && e.code === "permission-denied" ? "perm" : "load";
    if (DT.me === undefined) DT.me = null; if (!DT.people) DT.people = [];
  }
  DT.loading = false;
  if (DT_VIEWS.includes(current())) render();
}
function dtDefaultFilters(){
  const me = DT.me || {};
  DT.f = {show: [...(me.showMe || [])], ageMin: me.ageMin || 18, ageMax: me.ageMax || 99, intents: [], cities: [], interests: [], photos: false};
}
const dtFltCount = () => !DT.f ? 0 : (DT.f.show.length && DT.f.show.length < 3 && DT.f.show.join() !== ((DT.me && DT.me.showMe) || []).join() ? 1 : 0) + (DT.f.ageMin > 18 || DT.f.ageMax < 99 ? 1 : 0) + DT.f.intents.length + DT.f.cities.length + DT.f.interests.length + (DT.f.photos ? 1 : 0);
function dtVisible(skip){
  const me = DT.me, F = DT.f, q = query.trim().toLowerCase();
  if (!me || !F) return [];
  const l = (DT.people || []).filter(p => p.uid !== USER.uid && p.active !== false && !DT.acts[p.uid] && !DT.blockedMe.has(p.uid)
    && (!(p.showMe || []).length || p.showMe.includes(me.gender))
    && (!p.ageMin || me.age >= p.ageMin) && (!p.ageMax || me.age <= p.ageMax)
    && (skip === "show" || !F.show.length || F.show.includes(p.gender))
    && (skip === "age" || (p.age >= F.ageMin && p.age <= F.ageMax))
    && (skip === "intents" || !F.intents.length || F.intents.includes(p.intent))
    && (skip === "cities" || !F.cities.length || F.cities.includes(dtCity(p.city)))
    && (skip === "interests" || !F.interests.length || (p.interests || []).some(i => F.interests.includes(i)))
    && (!F.photos || p.photoCount > 0)
    && (!q || [p.name, p.city, p.bio, p.intent, (p.interests || []).join(" ")].join(" ").toLowerCase().includes(q)));
  if (DT.sort === "young") l.sort((a, b) => a.age - b.age);
  else if (DT.sort === "old") l.sort((a, b) => b.age - a.age);
  else if (DT.sort === "active") l.sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt));
  else l.sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt));
  return l;
}
const dtProfile = uid => (DT.people || []).find(p => p.uid === uid) || DT.extra[uid] || (DT.me && DT.me.uid === uid ? DT.me : null);
async function dtFetchProfile(uid){
  if (DT.extra[uid] !== undefined) return;
  DT.extra[uid] = null;
  try { const p = await FB.dtGetMe(uid); DT.extra[uid] = p || false; } catch (e) { DT.extra[uid] = false; }
  if (DT_VIEWS.includes(current())) render();
}
async function dtLoadPhotos(p){
  if (!p || DT.photos[p.uid] || !p.photoCount) return;
  DT.photos[p.uid] = "loading";
  const out = [];
  for (let i = 0; i < Math.min(4, p.photoCount); i++){ try { const d = await FB.dtGetPhoto(p.uid, i); if (d) out.push(d); } catch (_) {} }
  DT.photos[p.uid] = out;
  if (current() === "person" && personId === p.uid){ const g = $("#dtGallery"); if (g) g.outerHTML = dtGalleryHTML(p); }
  if (current() === "datingprofile" && DT.form && !DT.form.photosLoaded && p.uid === USER.uid){ DT.form.photos = out.map(data => ({data})); DT.form.photosLoaded = true; const s = $("#dtPhotos"); if (s) s.innerHTML = dtPhotoStrip(); }
}
function dtMatchWith(uid){ return (DT.matches || []).find(m => m.status !== "closed" && m.users.includes(uid)); }
const dtOther = m => m.users.find(u => u !== USER.uid);
const dtIsUnread = m => m.status !== "closed" && m.lastFrom && m.lastFrom !== USER.uid && tsMs(m.lastAt) > ((m.seen || {})[USER.uid] || 0);
const dtUnread = () => (DT.matches || []).filter(dtIsUnread).length;
function dtOnMatches(){
  const n = dtUnread();
  document.querySelectorAll('a[data-tab="dating"]').forEach(a => a.classList.toggle("hasdot", n > 0));
  const b = $("#dtMatchBadge"); if (b) b.textContent = n || "";
  const v = current();
  if (v === "matches") render();
  if (v === "chat"){ const m = (DT.matches || []).find(x => x.id === chatId); const h = $("#dtChatState"); if (h && m) h.innerHTML = dtChatStateHTML(m); if (m && dtIsUnread(m)) FB.dtSeen(m.id, USER.uid).catch(() => {}); }
  if (v === "person"){ const box = $("#dtPActs"); const p = dtProfile(personId); if (box && p) box.innerHTML = dtPersonActs(p); }
}

/* list */
function dtHero(){
  return `<section class="pagehero lhero dating"><div class="phtext"><h1>Dating</h1><p>Meet people near you. Like someone, and if they like you back, it's a match and you can chat.</p></div>
    <label class="sortlbl hsort">Sort by
      <select data-dts="sort"><option value="new">Newest</option><option value="active"${DT.sort === "active" ? " selected" : ""}>Recently active</option><option value="young"${DT.sort === "young" ? " selected" : ""}>Age: youngest first</option><option value="old"${DT.sort === "old" ? " selected" : ""}>Age: oldest first</option></select>
    </label></section>`;
}
function datingView(){
  const gate = dtGate("dating"); if (gate) return dtHero() + gate;
  dtEnsure();
  if (DT.me === undefined) return dtHero() + `<div class="empty">Loading people…</div>`;
  if (DT.err === "perm") return dtHero() + `<div class="empty">The dating section isn't switched on yet. Please check back soon.</div>`;
  if (!DT.me) return dtHero() + `<div class="panel dtintro">
      <div><h2>Create your dating profile</h2><p class="note">It takes about two minutes. Add a few photos, say a little about yourself, and choose who you'd like to meet.</p>
      <a class="btn" href="#dating-profile">Create my profile</a></div>
      <ul class="bullets"><li><b>18+ only.</b> Everyone confirms they're at least 18.</li><li><b>Chat only when it's mutual.</b> Nobody can message you unless you both liked each other.</li><li><b>You're in control.</b> Pause or delete your profile, and block or report anyone, any time.</li><li><b>We only show your city,</b> never your address, email or phone.</li></ul></div>`;
  const n = dtVisible().length, un = dtUnread();
  return dtHero() + `<div class="qbar" id="qbar"><div class="qrow qonly dtbar">
      <button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${dtFltCount() || ""}</span></button>
      <a class="morefl" href="#matches">${DT_HEART}Matches <span class="fltbadge" id="dtMatchBadge">${un || ""}</span></a>
      <a class="morefl" href="#dating-profile">My profile</a>
    </div></div>
    <div class="fltback" id="fltBack" data-fclose ${fltOpen ? "" : "hidden"}></div>
    <section class="fltpanel" id="fltPanel" role="dialog" aria-label="Filter people" ${fltOpen ? "" : "hidden"}>
      <div class="flthead"><h2>More filters</h2><button type="button" class="fltx" data-fclose aria-label="Close filters">×</button></div>
      <div class="fltbody" id="dtPanel">${dtPanelHTML()}</div>
      <div class="fltfoot" id="dtFoot">${dtFootHTML(n)}</div>
    </section>
    ${DT.me.active === false ? `<div class="dtnote">Your profile is paused, so others can't see you. <a href="#dating-profile">Turn it back on</a></div>` : ""}
    <div id="dtResults">${dtResultsHTML()}</div>`;
}
const dtFootHTML = n => `<button type="button" class="linkbtn" data-dtclear ${dtFltCount() ? "" : "disabled"}>Clear all</button><button type="button" class="btn" data-fclose>Show ${n} ${n === 1 ? "person" : "people"}</button>`;
function dtPanelHTML(){
  const F = DT.f;
  const opt = (k, v, label, on, cnt) => `<button type="button" class="fopt${cnt === 0 ? " zero" : ""}" data-dtf="${k}" data-v="${esc(v)}" aria-pressed="${on}">${esc(label)}${cnt != null ? ` <i>${cnt}</i>` : ""}</button>`;
  const sec = (title, inner) => inner ? `<div class="fsec"><h3>${title}</h3><div class="fopts" role="group" aria-label="${title}">${inner}</div></div>` : "";
  const cnt = (skip, fn) => { const m = {}; dtVisible(skip).forEach(p => [].concat(fn(p)).forEach(v => { if (v) m[v] = (m[v] || 0) + 1; })); return m; };
  const cG = cnt("show", p => p.gender), cI = cnt("intents", p => p.intent), cC = cnt("cities", p => dtCity(p.city)), cT = cnt("interests", p => p.interests || []);
  const cities = [...new Set([...Object.keys(cC), ...F.cities])].sort();
  const ages = []; for (let a = 18; a <= 99; a++) ages.push(a);
  const ageSel = (k, val) => `<select data-dts="${k}" aria-label="${k === "ageMin" ? "Youngest" : "Oldest"}">${ages.map(a => `<option${a === val ? " selected" : ""}>${a}</option>`).join("")}</select>`;
  return sec("Show me", DT_GENDERS.map(g => opt("show", g, g === "Woman" ? "Women" : g === "Man" ? "Men" : "Non-binary people", F.show.includes(g), cG[g] || 0)).join(""))
    + `<div class="fsec"><h3>Age</h3><div class="dtage">${ageSel("ageMin", F.ageMin)}<span>to</span>${ageSel("ageMax", F.ageMax)}</div></div>`
    + sec("Looking for", DT_INTENTS.map(i => opt("intents", i, i, F.intents.includes(i), cI[i] || 0)).join(""))
    + sec("City", cities.map(c => opt("cities", c, c, F.cities.includes(c), cC[c] || 0)).join(""))
    + sec("Interests", DT_INTERESTS.filter(i => cT[i] || F.interests.includes(i)).map(i => opt("interests", i, i, F.interests.includes(i), cT[i] || 0)).join(""))
    + sec("Photos", opt("photos", "1", "Has photos", F.photos));
}
function dtResultsHTML(){
  const list = dtVisible(), n = list.length, passed = Object.values(DT.acts).filter(k => k === "pass").length;
  let html = `<p class="count">${n} ${n === 1 ? "person" : "people"}${query.trim() ? ` matching “${esc(query.trim())}” <button class="linkbtn" data-clear>Clear search</button>` : ""}</p>`;
  if (!n) return html + `<div class="evempty dtempty">${DT_HEART}<b>${(DT.people || []).length > 1 ? "You've seen everyone who fits your filters" : "You're one of the first here"}</b>
    <span>${(DT.people || []).length > 1 ? "Try widening your filters, or check back later as new people join." : "New people are joining. Check back soon."}</span>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${dtFltCount() ? `<button type="button" class="btn small" data-fopen>Change filters</button>` : ""}${passed ? `<button type="button" class="btn ghost small" data-dtresetpass>See people you passed again</button>` : ""}</div></div>`;
  return html + `<div class="dtgrid">${list.map(dtCard).join("")}</div>`;
}
function dtCard(p){
  return `<article class="dtcard" data-person="${esc(p.uid)}">
    <a class="dtpic" href="#person-${esc(p.uid)}" aria-label="View ${esc(p.name)}'s profile">${p.thumb ? `<img src="${esc(p.thumb)}" alt="" loading="lazy">` : `<span class="dtnoimg">${esc((p.name || "?").charAt(0).toUpperCase())}</span>`}
      <span class="dtcap"><b>${esc(p.name)}, ${p.age}</b>${p.city ? `<small>${esc(dtCity(p.city))}</small>` : ""}</span></a>
    <div class="dtbody">${p.intent ? `<span class="dtintent">${esc(p.intent)}</span>` : ""}${p.bio ? `<p>${esc(p.bio.length > 90 ? p.bio.slice(0, 88) + "…" : p.bio)}</p>` : ""}
      <div class="dtacts"><button type="button" class="dtno" data-dtact="pass" data-uid="${esc(p.uid)}" aria-label="Pass on ${esc(p.name)}">${DT_X}</button><button type="button" class="dtyes" data-dtact="like" data-uid="${esc(p.uid)}" aria-label="Like ${esc(p.name)}">${DT_HEART}</button></div>
    </div></article>`;
}
function dtRefresh(){
  const r = $("#dtResults"); if (!r){ render(); return; }
  r.innerHTML = dtResultsHTML();
  const pnl = $("#dtPanel"), top = pnl ? pnl.scrollTop : 0; if (pnl){ pnl.innerHTML = dtPanelHTML(); pnl.scrollTop = top; }
  const f = $("#dtFoot"); if (f) f.innerHTML = dtFootHTML(dtVisible().length);
  const bd = $("#fltBadge"); if (bd) bd.textContent = dtFltCount() || "";
}
async function dtAct(uid, kind){
  const p = dtProfile(uid); if (!p || DT.busy) return;
  const prev = DT.acts[uid]; DT.acts[uid] = kind;
  const card = document.querySelector(`.dtcard[data-person="${CSS.escape(uid)}"]`);
  if (card){ card.classList.add(kind === "like" ? "gone-like" : "gone-pass"); setTimeout(() => { if (current() === "dating") dtRefresh(); }, 260); }
  else if (current() === "person"){ const box = $("#dtPActs"); if (box) box.innerHTML = dtPersonActs(p); }
  try {
    const m = await FB.dtAct(USER.uid, uid, kind);
    if (m) dtShowMatch(p, m);
    else if (kind === "like" && current() === "person") toast(`You liked ${p.name}`);
  } catch (e) { console.error(e); if (prev) DT.acts[uid] = prev; else delete DT.acts[uid]; toast("That didn't go through. Please try again."); if (current() === "dating") dtRefresh(); else render(); }
}
function dtShowMatch(p, id){
  const old = $("#dtMatch"); if (old) old.remove();
  const me = DT.me || {};
  const ph = x => x && x.thumb ? `<img src="${esc(x.thumb)}" alt="">` : `<span class="dtnoimg">${esc(((x && x.name) || "?").charAt(0).toUpperCase())}</span>`;
  const d = document.createElement("div"); d.className = "dtmatch"; d.id = "dtMatch"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "It's a match");
  d.innerHTML = `<div class="dtmbox"><div class="dtmpics">${ph(me)}${ph(p)}</div><h2>It's a match!</h2><p>You and ${esc(p.name)} like each other.</p>
    <a class="btn" href="#chat-${esc(id)}" data-dtmclose>Send a message</a><button type="button" class="linkbtn" data-dtmclose>Keep looking</button></div>`;
  document.body.appendChild(d);
}

/* person page */
function personView(){
  const gate = dtGate("dating"); if (gate) return gate;
  dtEnsure();
  if (DT.me === undefined) return `<div class="empty">Loading…</div>`;
  const p = dtProfile(personId);
  if (!p){ if (DT.extra[personId] === undefined) dtFetchProfile(personId); return DT.extra[personId] === false ? `<div class="empty">This profile isn't available anymore. <a href="#dating" style="color:var(--link)">Back to Dating</a></div>` : `<div class="empty">Loading…</div>`; }
  if (DT.blockedMe.has(p.uid) || DT.acts[p.uid] === "block") return `<div class="empty">This profile isn't available. <a href="#dating" style="color:var(--link)">Back to Dating</a></div>`;
  dtLoadPhotos(p);
  const self = p.uid === USER.uid;
  const facts = [p.intent && ["Looking for", p.intent], p.city && ["Lives in", dtCity(p.city)], p.height && ["Height", p.height + " cm"], p.languages && ["Speaks", p.languages], p.work && ["Work", p.work]].filter(Boolean);
  return `<article class="dtperson">
    ${dtGalleryHTML(p)}
    <div class="dtpinfo">
      ${self ? `<div class="dtnote">This is how other people see your profile. <a href="#dating-profile">Edit it</a></div>` : ""}
      <h1>${esc(p.name)}, ${p.age}</h1>
      ${p.city ? `<p class="dtpcity">${esc(dtCity(p.city))}</p>` : ""}
      ${self ? "" : `<div class="dtpacts" id="dtPActs">${dtPersonActs(p)}</div>`}
      ${p.bio ? `<section class="dtsect"><h2>About me</h2><p>${esc(p.bio).replace(/\n/g, "<br>")}</p></section>` : ""}
      ${facts.length ? `<section class="dtsect"><h2>Basics</h2><dl class="dtfacts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join("")}</dl></section>` : ""}
      ${(p.interests || []).length ? `<section class="dtsect"><h2>Interests</h2><div class="dtchips">${p.interests.map(i => `<span>${esc(i)}</span>`).join("")}</div></section>` : ""}
      ${self ? "" : `<div class="dtsafety"><button type="button" class="linkbtn" data-dtreport="${esc(p.uid)}">Report</button><button type="button" class="linkbtn" data-dtblock="${esc(p.uid)}">Block ${esc(p.name)}</button></div>`}
      <a class="linkbtn" href="#dating" style="margin-top:6px;display:inline-block">← Back to Dating</a>
    </div></article>`;
}
function dtGalleryHTML(p){
  const ph = Array.isArray(DT.photos[p.uid]) && DT.photos[p.uid].length ? DT.photos[p.uid] : p.thumb ? [p.thumb] : [];
  const i = Math.min(DT.gi, Math.max(0, ph.length - 1));
  return `<div class="dtgallery" id="dtGallery">${ph.length ? `<div class="dtmain"><img src="${esc(ph[i])}" alt="${esc(p.name)}, photo ${i + 1}"></div>
    ${ph.length > 1 ? `<div class="dtthumbs">${ph.map((u, k) => `<button type="button" data-dtimg="${k}" aria-label="Photo ${k + 1}" aria-pressed="${k === i}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}`
    : `<div class="dtmain dtnoimg big">${esc((p.name || "?").charAt(0).toUpperCase())}</div>`}</div>`;
}
function dtPersonActs(p){
  const m = dtMatchWith(p.uid), a = DT.acts[p.uid];
  if (m) return `<p class="dtstate">${DT_HEART}You and ${esc(p.name)} matched.</p><a class="btn" href="#chat-${esc(m.id)}">Send a message</a>`;
  if (a === "like") return `<p class="dtstate">${DT_HEART}You liked ${esc(p.name)}. If they like you back, it's a match.</p>`;
  const pass = `<button type="button" class="btn ghost dtbtnno" data-dtact="pass" data-uid="${esc(p.uid)}">${DT_X}Pass</button>`, like = `<button type="button" class="btn dtbtnyes" data-dtact="like" data-uid="${esc(p.uid)}">${DT_HEART}Like</button>`;
  if (a === "pass") return `<p class="dtstate">You passed on ${esc(p.name)}.</p>${like}`;
  return pass + like;
}

/* profile form */
function datingProfileView(){
  const gate = dtGate("datingprofile"); if (gate) return gate;
  dtEnsure();
  if (DT.me === undefined) return `<div class="empty">Loading…</div>`;
  const me = DT.me || {}, isNew = !DT.me;
  if (!DT.form){ const have = !isNew && Array.isArray(DT.photos[me.uid]) ? DT.photos[me.uid] : null;
    DT.form = {photos: have ? have.map(data => ({data})) : [], photosLoaded: isNew || !me.photoCount || !!have, interests: [...(me.interests || [])]}; if (!isNew && !have) dtLoadPhotos(me); }
  const dob = (PROFILE && PROFILE.dob) || "";
  const show = me.showLabel || "", sel = (v, cur) => v === cur ? " selected" : "";
  const max = new Date(); max.setFullYear(max.getFullYear() - 18);
  const ages = []; for (let a = 18; a <= 99; a++) ages.push(a);
  return `<section class="pagehero lhero"><div class="phtext"><h1>${isNew ? "Create your dating profile" : "My dating profile"}</h1><p>${isNew ? "Tell people a little about yourself. Only your first name, age and city are shown, never your email or phone." : "Changes show to others as soon as you save."}</p></div></section>
  <form class="panel dtform" id="dtForm" novalidate>
    <div class="fsec"><h3>Photos <small>up to 4 · the first one is your main photo</small></h3><div class="dtphotos" id="dtPhotos">${dtPhotoStrip()}</div></div>
    <div class="dtgrid2">
      <label>First name<input name="name" required maxlength="40" autocomplete="given-name" value="${esc(me.name || (PROFILE && PROFILE.name ? PROFILE.name.split(" ")[0] : ""))}"></label>
      <label>Date of birth<input name="dob" type="date" required max="${max.toISOString().slice(0, 10)}" value="${esc(dob)}"><small>Only your age is shown.</small></label>
      <label>I am<select name="gender" required><option value="">Choose</option>${DT_GENDERS.map(g => `<option${sel(g, me.gender)}>${g}</option>`).join("")}</select></label>
      <label>Show me<select name="show" required><option value="">Choose</option>${Object.keys(DT_SHOW).map(k => `<option${sel(k, show)}>${k}</option>`).join("")}</select></label>
      <label>Ages I'd like to meet<span class="dtage"><select name="ageMin">${ages.map(a => `<option${a === (me.ageMin || 18) ? " selected" : ""}>${a}</option>`).join("")}</select><span>to</span><select name="ageMax">${ages.map(a => `<option${a === (me.ageMax || 99) ? " selected" : ""}>${a}</option>`).join("")}</select></span></label>
      <label>Looking for<select name="intent" required><option value="">Choose</option>${DT_INTENTS.map(i => `<option${sel(i, me.intent)}>${i}</option>`).join("")}</select></label>
      <label>City<input name="city" required maxlength="40" placeholder="e.g. Richmond Hill" value="${esc(me.city || (PROFILE && PROFILE.city) || "")}"></label>
      <label>Height in cm <small>(optional)</small><input name="height" type="number" min="120" max="230" inputmode="numeric" value="${me.height || ""}"></label>
      <label>Languages <small>(optional)</small><input name="languages" maxlength="60" placeholder="e.g. English, Farsi" value="${esc(me.languages || "")}"></label>
      <label>Work <small>(optional)</small><input name="work" maxlength="60" value="${esc(me.work || "")}"></label>
    </div>
    <label>About me<textarea name="bio" rows="4" maxlength="600" placeholder="A few lines about you and what you enjoy">${esc(me.bio || "")}</textarea></label>
    <div class="fsec"><h3>Interests <small>pick up to 8</small></h3><div class="fopts" id="dtInts">${dtIntsHTML()}</div></div>
    ${isNew ? "" : `<label class="dtcheck"><input type="checkbox" name="active"${me.active === false ? "" : " checked"}> Show my profile to other people</label>`}
    <label class="dtcheck"><input type="checkbox" name="adult" required${me.adult ? " checked" : ""}> I'm 18 or older, I'll be respectful, and I understand that people I report can be removed.</label>
    <p class="formerr" id="dtErr" ${DT.err && DT.err !== "perm" && DT.err !== "load" ? "" : "hidden"}>${esc(DT.err || "")}</p>
    <div class="dtformfoot"><button class="btn" type="submit" ${DT.busy ? "disabled" : ""}>${DT.busy ? "Saving…" : isNew ? "Create my profile" : "Save changes"}</button><a class="linkbtn" href="#dating">Cancel</a></div>
  </form>
  ${isNew ? "" : `<section class="panel dtdanger"><h2>More options</h2>
    ${Object.values(DT.acts).some(k => k === "pass") ? `<p><button type="button" class="linkbtn" data-dtresetpass>See people you passed again</button></p>` : ""}
    <p><button type="button" class="linkbtn" data-dtdelete style="color:var(--danger)">${DT.delArm ? "Click again to delete your dating profile for good" : "Delete my dating profile"}</button></p></section>`}`;
}
const dtIntsHTML = () => DT_INTERESTS.map(i => `<button type="button" class="fopt" data-dtint="${esc(i)}" aria-pressed="${DT.form.interests.includes(i)}">${esc(i)}</button>`).join("");
function dtPhotoStrip(){
  const f = DT.form;
  if (!f.photosLoaded) return `<span class="note">Loading your photos…</span>`;
  return f.photos.map((ph, i) => `<div class="dtph"><img src="${esc(ph.data)}" alt="Photo ${i + 1}">${i === 0 ? `<span class="dtmainlbl">Main</span>` : `<button type="button" class="dtphmain" data-dtphmain="${i}">Make main</button>`}<button type="button" class="dtphx" data-dtphx="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join("")
    + (f.photos.length < 4 ? `<label class="dtphadd"><input type="file" accept="image/*" multiple id="dtPhIn" hidden><span>+</span><small>Add photo</small></label>` : "");
}
async function dtShrink(src, max, q, cap){
  const img = await new Promise((ok, no) => { const i = new Image(); i.onload = () => ok(i); i.onerror = no; i.src = src; });
  const s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
  const c = document.createElement("canvas"); c.width = Math.round(img.naturalWidth * s); c.height = Math.round(img.naturalHeight * s);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(img, 0, 0, c.width, c.height);
  let url = c.toDataURL("image/jpeg", q); while (url.length > cap && q > 0.35){ q -= 0.08; url = c.toDataURL("image/jpeg", q); }
  return url;
}
async function dtAddPhotos(files){
  const f = DT.form;
  for (const file of [...files].slice(0, 4 - f.photos.length)){
    if (!/^image\//.test(file.type)) continue;
    try { const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      f.photos.push({data: await dtShrink(raw, 1000, 0.75, 240000), isNew: true}); f.changed = true; }
    catch (e) { toast("That photo couldn't be added. Try a JPG or PNG."); }
  }
  const s = $("#dtPhotos"); if (s) s.innerHTML = dtPhotoStrip();
}
async function dtSave(form){
  const fd = new FormData(form), g = k => String(fd.get(k) || "").trim(), err = $("#dtErr");
  const say = t => { DT.err = t; if (err){ err.textContent = t; err.hidden = false; err.scrollIntoView({block: "center", behavior: "smooth"}); } };
  const age = dtAgeFrom(g("dob"));
  if (!g("name")) return say("Please enter your first name.");
  if (age == null) return say("Please enter your date of birth.");
  if (age < 18) return say("You must be 18 or older to use the dating section.");
  if (age > 100) return say("Please check your date of birth.");
  if (!g("gender") || !g("show") || !g("intent")) return say("Please choose who you are, who you'd like to see, and what you're looking for.");
  if (!g("city")) return say("Please enter your city.");
  if (!fd.get("adult")) return say("Please confirm you're 18 or older and agree to be respectful.");
  if (!DT.form.photosLoaded) return say("Your photos are still loading. Try again in a moment.");
  let ageMin = +g("ageMin") || 18, ageMax = +g("ageMax") || 99; if (ageMin > ageMax) [ageMin, ageMax] = [ageMax, ageMin];
  const isNew = !DT.me, ph = DT.form.photos, uid = USER.uid;
  DT.busy = true; DT.err = ""; const btn = form.querySelector('button[type="submit"]'); if (btn){ btn.disabled = true; btn.textContent = "Saving…"; }
  try {
    const thumb = ph.length ? await dtShrink(ph[0].data, 420, 0.7, 45000) : "";
    const data = {name: g("name").split(" ")[0].slice(0, 40), age, gender: g("gender"), showLabel: g("show"), showMe: DT_SHOW[g("show")], ageMin, ageMax, intent: g("intent"),
      city: dtCity(g("city")), height: +g("height") || null, languages: g("languages"), work: g("work"), bio: g("bio").slice(0, 600), interests: DT.form.interests.slice(0, 8),
      active: isNew ? true : !!fd.get("active"), adult: true, thumb, photoCount: ph.length};
    if (isNew || DT.form.changed){
      for (let i = 0; i < ph.length; i++) await FB.dtSavePhoto(uid, i, ph[i].data);
      for (let i = ph.length; i < 4; i++) await FB.dtDelPhoto(uid, i).catch(() => {});
    }
    await FB.dtSaveMe(uid, data, isNew);
    FB.saveProfile(uid, {dob: g("dob")}).catch(() => {}); if (PROFILE) PROFILE.dob = g("dob");
    DT.me = {...(DT.me || {}), ...data, uid, createdAt: (DT.me && DT.me.createdAt) || {seconds: Date.now() / 1000}, updatedAt: {seconds: Date.now() / 1000}};
    DT.photos[uid] = ph.map(p => p.data); DT.form = null; DT.busy = false; DT.f = null; dtDefaultFilters();
    if (!DT.unsubM) DT.unsubM = FB.dtWatchMatches(uid, l => { DT.matches = l; dtOnMatches(); }, e => { console.error(e); DT.matches = []; });
    toast(isNew ? "Your dating profile is ready" : "Profile saved"); go("dating");
  } catch (e) {
    console.error(e); DT.busy = false;
    say(e && e.code === "permission-denied" ? "The dating section isn't switched on yet, so your profile couldn't be saved." : "Your profile couldn't be saved. Check your connection and try again.");
    if (btn){ btn.disabled = false; btn.textContent = isNew ? "Create my profile" : "Save changes"; }
  }
}

/* matches and chat */
function matchesView(){
  const gate = dtGate("matches"); if (gate) return gate;
  dtEnsure();
  if (DT.me === undefined || (DT.me && DT.matches === null)) return `<div class="empty">Loading your matches…</div>`;
  if (!DT.me) return `<div class="empty">Create your dating profile first. <a href="#dating-profile" style="color:var(--link)">Create my profile</a></div>`;
  const list = DT.matches.filter(m => m.status !== "closed" && !DT.blockedMe.has(dtOther(m)) && DT.acts[dtOther(m)] !== "block").sort((a, b) => tsMs(b.lastAt) - tsMs(a.lastAt));
  list.forEach(m => { if (!dtProfile(dtOther(m))) dtFetchProfile(dtOther(m)); });
  const row = m => { const o = dtProfile(dtOther(m)) || {name: "…"}, un = dtIsUnread(m);
    return `<a class="dtmrow${un ? " unread" : ""}" href="#chat-${esc(m.id)}">${o.thumb ? `<img src="${esc(o.thumb)}" alt="">` : `<span class="dtnoimg">${esc((o.name || "?").charAt(0).toUpperCase())}</span>`}
      <span class="dtmtxt"><b>${esc(o.name || "…")}</b><small>${m.lastText ? (m.lastFrom === USER.uid ? "You: " : "") + esc(m.lastText) : "New match! Say hello."}</small></span>
      <span class="dtmwhen">${tsMs(m.lastAt) ? dtWhen(tsMs(m.lastAt)) : ""}${un ? `<i class="dtdot" aria-label="Unread"></i>` : ""}</span></a>`; };
  return `<section class="pagehero lhero"><div class="phtext"><h1>Matches</h1><p>People who liked you back. Say hello!</p></div></section>
    ${list.length ? `<div class="panel dtmlist">${list.map(row).join("")}</div>` : `<div class="evempty dtempty">${DT_HEART}<b>No matches yet</b><span>When someone you liked likes you back, they'll show up here.</span><a class="btn small" href="#dating">Find people</a></div>`}`;
}
function dtWhen(ms){
  const d = new Date(ms), n = new Date();
  if (d.toDateString() === n.toDateString()) return d.toLocaleTimeString("en-CA", {hour: "numeric", minute: "2-digit"});
  if (n - d < 6 * 86400000) return d.toLocaleDateString("en-CA", {weekday: "short"});
  return d.toLocaleDateString("en-CA", {month: "short", day: "numeric"});
}
function dtChatStateHTML(m){ return m.status === "closed" ? `<p class="dtnote">This conversation has ended.</p>` : ""; }
function chatView(){
  const gate = dtGate("matches"); if (gate) return gate;
  dtEnsure();
  if (DT.me === undefined || DT.matches === null) return `<div class="empty">Loading…</div>`;
  const m = DT.matches.find(x => x.id === chatId);
  if (!m) return `<div class="empty">This conversation isn't available. <a href="#matches" style="color:var(--link)">Back to Matches</a></div>`;
  const ou = dtOther(m), o = dtProfile(ou); if (!o) dtFetchProfile(ou);
  if (DT.chat.id !== m.id){
    if (DT.chat.unsub) DT.chat.unsub();
    DT.chat = {id: m.id, msgs: null, unsub: FB.dtWatchMsgs(m.id, l => { DT.chat.msgs = l; const box = $("#dtMsgs"); if (box && current() === "chat"){ box.innerHTML = dtMsgsHTML(); box.scrollTop = box.scrollHeight; } }, e => { console.error(e); DT.chat.msgs = []; })};
  }
  if (dtIsUnread(m)) FB.dtSeen(m.id, USER.uid).catch(() => {});
  const nm = (o && o.name) || "…";
  setTimeout(() => { const box = $("#dtMsgs"); if (box) box.scrollTop = box.scrollHeight; }, 0);
  return `<section class="dtchat panel">
    <header class="dtchead"><a class="dtback" href="#matches" aria-label="Back to Matches">‹</a>
      <a class="dtcwho" href="#person-${esc(ou)}">${o && o.thumb ? `<img src="${esc(o.thumb)}" alt="">` : `<span class="dtnoimg">${esc(nm.charAt(0).toUpperCase())}</span>`}<b>${esc(nm)}</b></a>
      <span class="dtcmenu"><button type="button" class="linkbtn" data-dtreport="${esc(ou)}">Report</button><button type="button" class="linkbtn" data-dtunmatch="${esc(m.id)}">${DT.delArm === m.id ? "Click again to unmatch" : "Unmatch"}</button></span></header>
    <div id="dtChatState">${dtChatStateHTML(m)}</div>
    <div class="dtmsgs" id="dtMsgs" aria-live="polite">${dtMsgsHTML()}</div>
    ${m.status === "closed" ? "" : `<form class="dtsend" id="dtSend"><input id="dtText" maxlength="2000" autocomplete="off" placeholder="Message ${esc(nm)}" aria-label="Message"><button class="btn" type="submit">Send</button></form>`}
    <p class="dttip">Keep chats on this site until you trust someone. Never send money, and meet in a public place.</p>
  </section>`;
}
function dtMsgsHTML(){
  const l = DT.chat.msgs;
  if (!l) return `<p class="note" style="text-align:center">Loading messages…</p>`;
  if (!l.length) return `<p class="note" style="text-align:center">You matched! Say hello.</p>`;
  let last = "";
  return l.map(x => { const ms = tsMs(x.at) || Date.now(), day = new Date(ms).toDateString(), sep = day !== last ? `<div class="dtday">${new Date(ms).toLocaleDateString("en-CA", {weekday: "long", month: "short", day: "numeric"})}</div>` : ""; last = day;
    return sep + `<div class="dtmsg${x.from === USER.uid ? " mine" : ""}"><span>${esc(x.text).replace(/\n/g, "<br>")}</span><small>${new Date(ms).toLocaleTimeString("en-CA", {hour: "numeric", minute: "2-digit"})}</small></div>`; }).join("");
}

/* admin */
function datingAdminHTML(){
  if (!DT.adm){ DT.adm = "loading"; Promise.all([FB.dtAllProfiles(), FB.dtReports().catch(() => [])]).then(([p, r]) => { DT.adm = {profiles: p, reports: r.filter(x => !String(x.about).startsWith("home:"))}; if (current() === "admin") refreshAdmin(); }).catch(e => { console.error(e); DT.adm = {profiles: [], reports: [], err: true}; if (current() === "admin") refreshAdmin(); }); }
  if (DT.adm === "loading") return `<div class="empty">Loading dating profiles…</div>`;
  const P = DT.adm.profiles.slice().sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt)), R = DT.adm.reports, nameOf = uid => (P.find(p => p.uid === uid) || {}).name || uid.slice(0, 6);
  return `${DT.adm.err ? `<p class="formerr">Couldn't load the dating data. Make sure the new database rules are published.</p>` : ""}
    <div class="admintools"><span class="note">${P.length} dating profile${P.length === 1 ? "" : "s"} · ${R.length} report${R.length === 1 ? "" : "s"}</span><button class="btn small ghost" type="button" data-dtadmreload>Refresh</button></div>
    <h3 style="margin:18px 0 8px">Reports</h3>
    ${R.length ? `<div class="tablewrap"><table class="ctable"><thead><tr><th>Date</th><th>About</th><th>From</th><th>Reason</th><th></th></tr></thead><tbody>${R.map(r => `<tr><td>${tsMs(r.at) ? new Date(tsMs(r.at)).toLocaleDateString("en-CA") : ""}</td><td>${String(r.about).startsWith("home:") ? `<a href="#listing-${esc(r.about.slice(5))}">Home listing</a>` : `<a href="#person-${esc(r.about)}">${esc(nameOf(r.about))}</a>`}</td><td>${esc(nameOf(r.from))}</td><td>${esc(r.reason || "")}${r.text ? `<br><small>${esc(r.text)}</small>` : ""}</td><td style="white-space:nowrap">${String(r.about).startsWith("home:") ? "" : `<button class="linkbtn" type="button" data-dtadmdel="${esc(r.about)}" style="color:var(--danger)">Remove profile</button> `}<button class="linkbtn" type="button" data-dtadmdismiss="${esc(r.id)}">Dismiss</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="note">No reports.</p>`}
    <h3 style="margin:18px 0 8px">Profiles</h3>
    ${P.length ? `<div class="tablewrap"><table class="ctable"><thead><tr><th></th><th>Name</th><th>Age</th><th>City</th><th>Joined</th><th>Shown</th><th></th></tr></thead><tbody>${P.map(p => `<tr><td>${p.thumb ? `<img src="${esc(p.thumb)}" alt="" style="width:40px;height:40px;object-fit:cover;border-radius:8px">` : ""}</td><td><a href="#person-${esc(p.uid)}">${esc(p.name)}</a></td><td>${p.age}</td><td>${esc(dtCity(p.city))}</td><td>${tsMs(p.createdAt) ? new Date(tsMs(p.createdAt)).toLocaleDateString("en-CA") : ""}</td><td>${p.active === false ? "Paused" : "Yes"}</td><td><button class="linkbtn" type="button" data-dtadmdel="${esc(p.uid)}" style="color:var(--danger)">${DT.delArm === "adm" + p.uid ? "Click again to remove" : "Remove"}</button></td></tr>`).join("")}</tbody></table></div>` : `<p class="note">No dating profiles yet.</p>`}`;
}
function dtReportForm(uid){
  const isHome = /^(home|market):/.test(String(uid)), p = isHome ? {name: "this listing"} : dtProfile(uid) || {name: "this person"}, old = $("#dtMatch"); if (old) old.remove();
  const d = document.createElement("div"); d.className = "dtmatch"; d.id = "dtMatch"; d.setAttribute("role", "dialog"); d.setAttribute("aria-label", "Report");
  d.innerHTML = `<form class="dtmbox dtrep" id="dtRepForm" data-uid="${esc(uid)}"><h2>Report ${esc(p.name)}</h2><p class="note">Reports are private. ${isHome ? "The lister won't know who reported it." : esc(p.name) + " won't know you reported them."}</p>
    <div class="dtrepopts">${(isHome ? ["Scam or fake listing", "Wrong price or details", "Already sold or rented", "Inappropriate photos", "Something else"] : ["Fake profile or scam", "Inappropriate photos", "Rude or harassing messages", "Under 18", "Something else"]).map((r, i) => `<label><input type="radio" name="reason" value="${r}"${i ? "" : " checked"}> ${r}</label>`).join("")}</div>
    <textarea name="text" rows="3" maxlength="500" placeholder="Anything else we should know? (optional)"></textarea>
    ${isHome ? "" : `<label class="dtcheck"><input type="checkbox" name="block" checked> Also block ${esc(p.name)}</label>`}
    <div style="display:flex;gap:12px;align-items:center"><button class="btn" type="submit">Send report</button><button type="button" class="linkbtn" data-dtmclose>Cancel</button></div></form>`;
  document.body.appendChild(d);
}
async function dtBlock(uid, silent){
  try {
    DT.acts[uid] = "block"; await FB.dtAct(USER.uid, uid, "block");
    const m = dtMatchWith(uid); if (m) await FB.dtClose(m.id, USER.uid);
    if (!silent) toast("Blocked. You won't see each other anymore.");
    go(current() === "chat" || current() === "matches" ? "matches" : "dating");
  } catch (e) { console.error(e); toast("That didn't go through. Please try again."); }
}

/* clicks, inputs and forms for dating */
document.addEventListener("click", async ev => {
  const t = ev.target;
  if (t.closest("[data-dtmclose]")){ const d = $("#dtMatch"); if (d) d.remove(); if (t.closest("a")) return; return; }
  if (t.classList && t.classList.contains("dtmatch")){ t.remove(); return; }
  const b = t.closest("button"); if (!b) return;
  if (b.dataset.dtact){ dtAct(b.dataset.uid, b.dataset.dtact); return; }
  if (b.dataset.dtf){
    const F = DT.f, k = b.dataset.dtf, v = b.dataset.v; if (!F) return;
    if (k === "photos") F.photos = !F.photos;
    else F[k] = F[k].includes(v) ? F[k].filter(x => x !== v) : [...F[k], v];
    dtRefresh(); return;
  }
  if (b.hasAttribute("data-dtclear")){ DT.f = {show: [], ageMin: 18, ageMax: 99, intents: [], cities: [], interests: [], photos: false}; dtRefresh(); return; }
  if (b.dataset.dtimg != null){ DT.gi = +b.dataset.dtimg; const p = dtProfile(personId), g = $("#dtGallery"); if (p && g) g.outerHTML = dtGalleryHTML(p); return; }
  if (b.dataset.dtint){ const i = b.dataset.dtint, L = DT.form.interests; if (L.includes(i)) DT.form.interests = L.filter(x => x !== i); else if (L.length < 8) L.push(i); else toast("You can pick up to 8"); $("#dtInts").innerHTML = dtIntsHTML(); return; }
  if (b.dataset.dtphx != null){ DT.form.photos.splice(+b.dataset.dtphx, 1); DT.form.changed = true; $("#dtPhotos").innerHTML = dtPhotoStrip(); return; }
  if (b.dataset.dtphmain != null){ const i = +b.dataset.dtphmain, [x] = DT.form.photos.splice(i, 1); DT.form.photos.unshift(x); DT.form.changed = true; $("#dtPhotos").innerHTML = dtPhotoStrip(); return; }
  if (b.hasAttribute("data-dtresetpass")){
    const ids = Object.entries(DT.acts).filter(([, k]) => k === "pass").map(([u]) => u);
    b.disabled = true; try { await Promise.all(ids.map(u => FB.dtUndoPass(USER.uid, u))); ids.forEach(u => delete DT.acts[u]); toast(`${ids.length} ${ids.length === 1 ? "person is" : "people are"} back in your list`); go("dating"); } catch (e) { console.error(e); toast("That didn't go through. Please try again."); b.disabled = false; }
    return;
  }
  if (b.hasAttribute("data-dtdelete")){
    if (!DT.delArm){ DT.delArm = true; b.textContent = "Click again to delete your dating profile for good"; return; }
    b.disabled = true; try { await FB.dtDeleteProfile(USER.uid); if (DT.unsubM) DT.unsubM(); DT.unsubM = null; DT.me = null; DT.matches = null; DT.form = null; DT.delArm = false; toast("Your dating profile was deleted"); go("dating"); } catch (e) { console.error(e); toast("That didn't go through. Please try again."); b.disabled = false; }
    return;
  }
  if (b.dataset.dtunmatch){
    if (DT.delArm !== b.dataset.dtunmatch){ DT.delArm = b.dataset.dtunmatch; b.textContent = "Click again to unmatch"; return; }
    DT.delArm = false; const m = (DT.matches || []).find(x => x.id === b.dataset.dtunmatch); if (m) dtBlock(dtOther(m)); return;
  }
  if (b.dataset.dtblock){ if (b.dataset.armed){ dtBlock(b.dataset.dtblock); } else { b.dataset.armed = "1"; b.textContent = "Click again to block"; } return; }
  if (b.dataset.dtreport){ dtReportForm(b.dataset.dtreport); return; }
  if (b.hasAttribute("data-dtadmreload")){ DT.adm = null; refreshAdmin(); return; }
  if (b.dataset.dtadmdel){
    const uid = b.dataset.dtadmdel;
    if (DT.delArm !== "adm" + uid){ DT.delArm = "adm" + uid; b.textContent = "Click again to remove"; return; }
    DT.delArm = false; try { await FB.dtDeleteProfile(uid); DT.adm.profiles = DT.adm.profiles.filter(p => p.uid !== uid); toast("Profile removed"); refreshAdmin(); } catch (e) { console.error(e); toast("Couldn't remove it. Check the database rules."); }
    return;
  }
  if (b.dataset.dtadmdismiss){ try { await FB.dtDelReport(b.dataset.dtadmdismiss); DT.adm.reports = DT.adm.reports.filter(r => r.id !== b.dataset.dtadmdismiss); refreshAdmin(); } catch (e) { toast("Couldn't dismiss it."); } return; }
});
document.addEventListener("change", e => {
  if (e.target.id === "dtPhIn"){ dtAddPhotos(e.target.files); return; }
  const s = e.target.closest("[data-dts]"); if (!s) return;
  const k = s.dataset.dts;
  if (k === "sort"){ DT.sort = s.value; if ($("#dtResults")) $("#dtResults").innerHTML = dtResultsHTML(); return; }
  if (DT.f){ DT.f[k] = +s.value; if (DT.f.ageMin > DT.f.ageMax){ if (k === "ageMin") DT.f.ageMax = DT.f.ageMin; else DT.f.ageMin = DT.f.ageMax; } dtRefresh(); }
});
document.addEventListener("submit", async ev => {
  const f = ev.target;
  if (f.id === "dtForm"){ ev.preventDefault(); if (!DT.busy) dtSave(f); return; }
  if (f.id === "dtSend"){
    ev.preventDefault(); const inp = $("#dtText"), text = inp.value.trim(); if (!text || !DT.chat.id) return;
    inp.value = ""; try { await FB.dtSend(DT.chat.id, USER.uid, text); } catch (e) { console.error(e); inp.value = text; toast("Your message wasn't sent. Please try again."); }
    return;
  }
  if (f.id === "dtRepForm"){
    ev.preventDefault(); const fd = new FormData(f), uid = f.dataset.uid, btn = f.querySelector('button[type="submit"]'); btn.disabled = true;
    if (!USER){ toast("Please sign in to send a report"); return; }
    try { await FB.dtReport({from: USER.uid, about: uid, reason: String(fd.get("reason") || ""), text: String(fd.get("text") || "").slice(0, 500)});
      const d = $("#dtMatch"); if (d) d.remove(); toast("Thanks. We'll review your report.");
      if (fd.get("block")) dtBlock(uid, true);
    } catch (e) { console.error(e); btn.disabled = false; toast("Your report wasn't sent. Please try again."); }
  }
});
document.addEventListener("keydown", e => { if (e.key === "Escape"){ const d = $("#dtMatch"); if (d) d.remove(); } });

/* ---- Homes (v71): homes for sale, for rent and rooms, on a map ---- */
const HM = {list: null, loading: false, failedAt: 0, at: 0, extra: {}, mine: null, photos: {}, gi: 0, f: null, sort: "new", move: true, bounds: null, mapView: false,
  map: null, layer: null, pins: {}, mini: null, form: null, busy: false, err: "", threads: null, unsubT: null, tuid: null, chat: {id: null, msgs: null, unsub: null}, adm: null, arm: ""};
const HM_DEALS = {sale: "For sale", rent: "For rent", room: "Room for rent"};
const HM_TYPES = ["Detached house", "Semi-detached house", "Townhouse", "Condo apartment", "Apartment", "Basement apartment", "Room"];
const HM_FEATS = ["Laundry in unit", "Air conditioning", "Dishwasher", "Furnished", "Utilities included", "Internet included", "Pets allowed", "Private entrance", "Private bathroom", "Balcony", "Backyard", "Garage", "Gym", "Pool", "Near transit", "Near schools"];
const HM_PRICES = [0, 500, 750, 1000, 1250, 1500, 2000, 2500, 3000, 4000, 5000, 200000, 400000, 500000, 600000, 700000, 800000, 900000, 1000000, 1250000, 1500000, 2000000, 3000000];
const HM_VIEWS = ["homes", "listing", "listhome", "mylistings", "hchat"];
const HM_PIN = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 21s-7-6.2-7-11.5A7 7 0 0 1 19 9.5C19 14.8 12 21 12 21z"/><circle cx="12" cy="9.5" r="2.5"/></svg>`;
const HM_BED = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 18V7M3 13h18v5M21 18v-3a3 3 0 0 0-3-3h-7v1"/><circle cx="7" cy="10.5" r="1.6"/></svg>`;
const HM_BATH = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 12h16v3a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4zM6 12V6a2 2 0 0 1 3.5-1.3M7 19l-1 2M17 19l1 2"/></svg>`;
const HM_CAR = `<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 16V11l2-5h10l2 5v5M4 16h16v2H4zM5 11h14"/><circle cx="8" cy="14" r=".8"/><circle cx="16" cy="14" r=".8"/></svg>`;
const hmMoney = n => "$" + Math.round(n).toLocaleString("en-CA");
const hmShort = h => { const p = +h.price || 0; return h.deal === "sale" ? (p >= 1e6 ? "$" + (p / 1e6).toFixed(p >= 1e7 ? 0 : 2).replace(/\.?0+$/, "") + "M" : "$" + Math.round(p / 1000) + "K") : hmMoney(p); };
const hmPriceTxt = h => hmMoney(+h.price || 0) + (h.deal === "sale" ? "" : "/mo");
const hmWhere = h => [h.showStreet && h.street, h.city].filter(Boolean).join(", ") || "Location on request";
const hmSaved = () => (PROFILE && Array.isArray(PROFILE.savedHomes)) ? PROFILE.savedHomes : [];

async function hmEnsure(force){
  if (!FB) return;
  if (HM.loading) return;
  if (!force && HM.list && Date.now() - HM.at < 120000) return;
  if (!force && HM.failedAt && Date.now() - HM.failedAt < 30000) return;
  HM.loading = true;
  try { HM.list = await FB.hmApproved(); HM.at = Date.now(); HM.failedAt = 0; HM.err = ""; }
  catch (e) { console.error(e); HM.failedAt = Date.now(); HM.err = e && e.code === "permission-denied" ? "perm" : "load"; if (!HM.list) HM.list = []; }
  HM.loading = false;
  if (HM_VIEWS.includes(current())) render();
}
function hmEnsureThreads(){
  if (!USER || !FB){ return; }
  if (HM.tuid === USER.uid && HM.unsubT) return;
  if (HM.unsubT) HM.unsubT(); HM.tuid = USER.uid; HM.threads = null;
  HM.unsubT = FB.hmWatchThreads(USER.uid, l => { HM.threads = l; hmOnThreads(); }, e => { console.error(e); HM.threads = []; hmOnThreads(); });
}
const hmIsUnread = t => t.lastFrom && t.lastFrom !== USER.uid && tsMs(t.lastAt) > ((t.seen || {})[USER.uid] || 0);
const hmUnread = () => (HM.threads || []).filter(t => !t.marketId && hmIsUnread(t)).length;
function hmOnThreads(){
  const n = hmUnread();
  document.querySelectorAll('a[data-tab="homes"]').forEach(a => a.classList.toggle("hasdot", n > 0));
  const b = $("#hmMsgBadge"); if (b) b.textContent = n || "";
  const v = current();
  if (v === "mylistings" || v === "selling") render();
  const mn = (HM.threads || []).filter(t => t.marketId && hmIsUnread(t)).length; document.querySelectorAll('a[href="#account"].gicon, a[href="/account"].gicon, .acctbtn').forEach(a => a.classList.toggle("hasdot", mn > 0));
  if (v === "hchat"){ const t = (HM.threads || []).find(x => x.id === hchatId); if (t && hmIsUnread(t)) FB.hmSeen(t.id, USER.uid).catch(() => {}); }
}
function hmDefaultFilters(){ HM.f = {deals: [], types: [], min: 0, max: 0, beds: 0, baths: 0, parking: 0, feats: [], cities: [], photos: false, saved: false}; }
const hmFltCount = () => !HM.f ? 0 : HM.f.deals.length + HM.f.types.length + (HM.f.min ? 1 : 0) + (HM.f.max ? 1 : 0) + (HM.f.beds ? 1 : 0) + (HM.f.baths ? 1 : 0) + (HM.f.parking ? 1 : 0) + HM.f.feats.length + HM.f.cities.length + (HM.f.photos ? 1 : 0);
function hmFiltered(skip, noBounds){
  if (!HM.f) hmDefaultFilters();
  const F = HM.f, q = query.trim().toLowerCase(), sv = hmSaved(), B = HM.bounds;
  const l = (HM.list || []).filter(h => (skip === "deals" || !F.deals.length || F.deals.includes(h.deal))
    && (skip === "types" || !F.types.length || F.types.includes(h.type))
    && (!F.min || h.price >= F.min) && (!F.max || h.price <= F.max)
    && (!F.beds || (h.beds || 0) >= F.beds) && (!F.baths || (h.baths || 0) >= F.baths) && (!F.parking || (h.parking || 0) >= F.parking)
    && (skip === "feats" || !F.feats.length || F.feats.every(x => (h.features || []).includes(x)))
    && (skip === "cities" || !F.cities.length || F.cities.includes(dtCity(h.city)))
    && (!F.photos || h.photoCount > 0) && (!F.saved || sv.includes(h.id))
    && (!q || [h.title, h.city, h.showStreet ? h.street : "", h.type, HM_DEALS[h.deal], h.description, (h.features || []).join(" "), h.postal].join(" ").toLowerCase().includes(q))
    && (noBounds || !HM.move || !B || h.lat == null || (h.lat >= B.s && h.lat <= B.n && h.lng >= B.w && h.lng <= B.e)));
  if (HM.sort === "low") l.sort((a, b) => a.price - b.price);
  else if (HM.sort === "high") l.sort((a, b) => b.price - a.price);
  else l.sort((a, b) => tsMs(b.approvedAt || b.createdAt) - tsMs(a.approvedAt || a.createdAt));
  return l;
}

/* map */
let hmLeafletP = null;
function hmLeaflet(){
  if (window.L && L.map) return Promise.resolve(window.L);
  if (hmLeafletP) return hmLeafletP;
  hmLeafletP = new Promise((ok, no) => {
    const css = document.createElement("link"); css.rel = "stylesheet"; css.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"; document.head.appendChild(css);
    const s = document.createElement("script"); s.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"; s.onload = () => ok(window.L); s.onerror = () => { hmLeafletP = null; no(new Error("map")); }; document.head.appendChild(s);
  });
  return hmLeafletP;
}
const HM_TILES = "https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", HM_ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>';
async function hmInitMap(){
  const el = $("#hmMap"); if (!el) return;
  let L; try { L = await hmLeaflet(); } catch (e) { el.innerHTML = `<div class="hmmapfail">The map couldn't load. Check your connection.</div>`; return; }
  if (!document.body.contains(el)) return;
  if (HM.map){ try { HM.map.remove(); } catch (_) {} }
  const map = L.map(el, {zoomControl: true, scrollWheelZoom: true}); HM.map = map;
  L.tileLayer(HM_TILES, {maxZoom: 19, attribution: HM_ATTR}).addTo(map);
  HM.layer = L.layerGroup().addTo(map);
  const pts = hmFiltered(null, true).filter(h => h.lat != null);
  if (HM.view) map.setView(HM.view.c, HM.view.z);
  else if (pts.length) map.fitBounds(L.latLngBounds(pts.map(h => [h.lat, h.lng])).pad(0.2), {maxZoom: 14});
  else map.setView([43.8828, -79.4403], 10);
  map.on("moveend", () => { if (!el.offsetWidth) return; const b = map.getBounds(); HM.bounds = {n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest()}; HM.view = {c: map.getCenter(), z: map.getZoom()}; if (HM.move) hmRefresh(true); });
  if (el.offsetWidth){ const b = map.getBounds(); HM.bounds = {n: b.getNorth(), s: b.getSouth(), e: b.getEast(), w: b.getWest()}; } else if (!HM.mapSeen) HM.bounds = null;
  hmDrawPins(); if (HM.move) hmRefresh(true);
  setTimeout(() => map.invalidateSize(), 50);
}
function hmDrawPins(){
  if (!HM.map || !HM.layer) return;
  HM.layer.clearLayers(); HM.pins = {};
  hmFiltered(null, true).filter(h => h.lat != null).forEach(h => {
    const icon = L.divIcon({className: "hmpin " + h.deal, html: `<span>${esc(hmShort(h))}</span>`, iconSize: null});
    const m = L.marker([h.lat, h.lng], {icon, title: h.title, riseOnHover: true}).addTo(HM.layer);
    m.bindPopup(`<a class="hmpop" href="#listing-${esc(h.id)}">${h.thumb ? `<img src="${esc(h.thumb)}" alt="">` : ""}<b>${esc(hmPriceTxt(h))}</b><span>${esc(h.title)}</span><small>${esc(hmWhere(h))}</small></a>`, {maxWidth: 240});
    m.on("mouseover", () => { const c = document.querySelector(`.hmcard[data-hid="${CSS.escape(h.id)}"]`); if (c) c.classList.add("hot"); });
    m.on("mouseout", () => { const c = document.querySelector(`.hmcard[data-hid="${CSS.escape(h.id)}"]`); if (c) c.classList.remove("hot"); });
    HM.pins[h.id] = m;
  });
}
async function hmMiniMap(id, lat, lng, drag){
  const el = $("#" + id); if (!el) return;
  let L; try { L = await hmLeaflet(); } catch (e) { el.innerHTML = `<div class="hmmapfail">The map couldn't load.</div>`; return; }
  if (!document.body.contains(el)) return;
  if (HM.mini){ try { HM.mini.remove(); } catch (_) {} }
  const has = lat != null, map = L.map(el, {scrollWheelZoom: false}); HM.mini = map;
  L.tileLayer(HM_TILES, {maxZoom: 19, attribution: HM_ATTR}).addTo(map);
  map.setView(has ? [lat, lng] : [43.8828, -79.4403], has ? 15 : 10);
  if (has){
    if (drag){ const m = L.marker([lat, lng], {draggable: true, icon: L.divIcon({className: "hmdrag", html: HM_PIN, iconSize: [36, 36], iconAnchor: [18, 34]})}).addTo(map); m.on("dragend", () => { const p = m.getLatLng(); HM.form.lat = p.lat; HM.form.lng = p.lng; const s = $("#hmPinNote"); if (s) s.textContent = "Pin moved. We'll use this spot."; }); }
    else L.circle([lat, lng], {radius: 120, color: "#2d2d2e", fillColor: "#2d2d2e", fillOpacity: .25, weight: 2}).addTo(map);
  }
  setTimeout(() => map.invalidateSize(), 50);
}
async function hmGeocode(q){
  const r = await fetch("https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=ca&q=" + encodeURIComponent(q), {headers: {"Accept-Language": "en"}});
  const j = await r.json(); return j && j[0] ? {lat: +j[0].lat, lng: +j[0].lon} : null;
}

/* list page */
function hmHero(){
  return `<section class="pagehero lhero homes"><div class="phtext"><h1>Homes</h1><p>Houses, condos, apartments and rooms for sale and for rent, posted by people in your area.</p></div>
    <label class="sortlbl hsort">Sort by
      <select data-hms="sort"><option value="new">Newest</option><option value="low"${HM.sort === "low" ? " selected" : ""}>Price: low to high</option><option value="high"${HM.sort === "high" ? " selected" : ""}>Price: high to low</option></select>
    </label></section>`;
}
function homesView(){
  hmEnsure(); if (USER) hmEnsureThreads();
  if (!HM.f) hmDefaultFilters();
  if (!HM.list) return hmHero() + `<div class="empty">${fbFailed ? "We couldn't connect. Check your connection and refresh the page." : "Loading homes…"}</div>`;
  if (HM.err === "perm") return hmHero() + `<div class="empty">The Homes section isn't switched on yet. Please check back soon.</div>`;
  const n = hmFiltered().length, un = USER ? hmUnread() : 0;
  return hmHero() + `<div class="qbar" id="qbar"><div class="qrow qonly dtbar hmbar">
      <button type="button" class="morefl" id="fltBtn" data-fopen aria-expanded="${fltOpen}" aria-controls="fltPanel"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 6h16M7 12h10M10 18h4"/></svg>More filters <span class="fltbadge" id="fltBadge">${hmFltCount() || ""}</span></button>
      <button type="button" class="morefl hmmaptog" data-hmmaptog aria-pressed="${HM.mapView}">${HM.mapView ? "List" : "Map"}</button>
      <button type="button" class="morefl" data-hmsaved aria-pressed="${HM.f.saved}">${DT_HEART}Saved</button>
      <a class="morefl" href="#my-listings">My listings <span class="fltbadge" id="hmMsgBadge">${un || ""}</span></a>
      <a class="morefl hmpost" href="#list-your-home">+ List your home</a>
    </div></div>
    <div class="fltback" id="fltBack" data-fclose ${fltOpen ? "" : "hidden"}></div>
    <section class="fltpanel" id="fltPanel" role="dialog" aria-label="Filter homes" ${fltOpen ? "" : "hidden"}>
      <div class="flthead"><h2>More filters</h2><button type="button" class="fltx" data-fclose aria-label="Close filters">×</button></div>
      <div class="fltbody" id="hmPanel">${hmPanelHTML()}</div>
      <div class="fltfoot" id="hmFoot">${hmFootHTML(n)}</div>
    </section>
    <div class="hmsplit${HM.mapView ? " showmap" : ""}" id="hmSplit">
      <div class="hmlist" id="hmResults">${hmResultsHTML()}</div>
      <div class="hmmapwrap"><div id="hmMap" class="hmmap"></div>
        <label class="hmmove"><input type="checkbox" data-hmmove${HM.move ? " checked" : ""}> Search as I move the map</label></div>
    </div>`;
}
const hmFootHTML = n => `<button type="button" class="linkbtn" data-hmclear ${hmFltCount() ? "" : "disabled"}>Clear all</button><button type="button" class="btn" data-fclose>Show ${n} home${n === 1 ? "" : "s"}</button>`;
function hmPanelHTML(){
  const F = HM.f;
  const opt = (k, v, label, on, cnt) => `<button type="button" class="fopt${cnt === 0 ? " zero" : ""}" data-hmf="${k}" data-v="${esc(String(v))}" aria-pressed="${on}">${esc(label)}${cnt != null ? ` <i>${cnt}</i>` : ""}</button>`;
  const sec = (title, inner) => inner ? `<div class="fsec"><h3>${title}</h3><div class="fopts" role="group" aria-label="${title}">${inner}</div></div>` : "";
  const cnt = (skip, fn) => { const m = {}; hmFiltered(skip, true).forEach(h => [].concat(fn(h)).forEach(v => { if (v) m[v] = (m[v] || 0) + 1; })); return m; };
  const cD = cnt("deals", h => h.deal), cT = cnt("types", h => h.type), cF = cnt("feats", h => h.features || []), cC = cnt("cities", h => dtCity(h.city));
  const cities = [...new Set([...Object.keys(cC), ...F.cities])].sort();
  const pSel = (k, val) => `<select data-hms="${k}" aria-label="${k === "min" ? "Lowest price" : "Highest price"}"><option value="0">${k === "min" ? "No min" : "No max"}</option>${HM_PRICES.slice(1).map(p => `<option value="${p}"${p === val ? " selected" : ""}>${hmMoney(p)}</option>`).join("")}</select>`;
  const plus = (k, label, max) => { const o = [0]; for (let i = 1; i <= max; i++) o.push(i); return sec(label, o.map(i => opt(k, i, i ? i + "+" : "Any", F[k] === i)).join("")); };
  return sec("Listing type", Object.entries(HM_DEALS).map(([k, l]) => opt("deals", k, l, F.deals.includes(k), cD[k] || 0)).join(""))
    + sec("Home type", HM_TYPES.map(t => opt("types", t, t, F.types.includes(t), cT[t] || 0)).join(""))
    + `<div class="fsec"><h3>Price <small>monthly for rentals</small></h3><div class="dtage hmprice">${pSel("min", F.min)}<span>to</span>${pSel("max", F.max)}</div></div>`
    + plus("beds", "Bedrooms", 5) + plus("baths", "Bathrooms", 4) + plus("parking", "Parking", 3)
    + sec("City", cities.map(c => opt("cities", c, c, F.cities.includes(c), cC[c] || 0)).join(""))
    + sec("Features", HM_FEATS.filter(x => cF[x] || F.feats.includes(x)).map(x => opt("feats", x, x, F.feats.includes(x), cF[x] || 0)).join(""))
    + sec("Photos", opt("photos", "1", "Has photos", F.photos));
}
function hmResultsHTML(){
  const list = hmFiltered(), n = list.length, all = (HM.list || []).length, inMap = HM.move && HM.bounds;
  let html = `<p class="count">${n} home${n === 1 ? "" : "s"}${inMap ? " in this map area" : ""}${query.trim() ? ` matching “${esc(query.trim())}” <button class="linkbtn" data-clear>Clear search</button>` : ""}</p>`;
  if (!n) return html + `<div class="evempty dtempty">${HM_PIN}<b>${all ? "No homes match" : "No homes listed yet"}</b><span>${all ? (inMap ? "Try zooming out or moving the map, or change your filters." : "Try changing your filters.") : "Be the first to list a home, apartment or room."}</span>
    <div style="display:flex;gap:10px;flex-wrap:wrap;justify-content:center">${hmFltCount() ? `<button type="button" class="btn small ghost" data-hmclear>Clear filters</button>` : ""}${HM.f.saved ? `<button type="button" class="btn small ghost" data-hmsaved>Show all homes</button>` : ""}<a class="btn small" href="#list-your-home">List your home</a></div></div>`;
  return html + `<div class="hmgrid">${list.map(hmCard).join("")}</div>`;
}
function hmCard(h){
  const saved = hmSaved().includes(h.id);
  return `<article class="hmcard" data-hid="${esc(h.id)}">
    <a class="hmpic" href="#listing-${esc(h.id)}" aria-label="${esc(h.title)}">${h.thumb ? `<img src="${esc(h.thumb)}" alt="" loading="lazy">` : `<span class="hmnoimg">${HM_PIN}</span>`}<span class="hmdeal ${h.deal}">${HM_DEALS[h.deal]}</span></a>
    <button type="button" class="hmheart" data-hmsave="${esc(h.id)}" aria-pressed="${saved}" aria-label="${saved ? "Remove from saved" : "Save this home"}">${DT_HEART}</button>
    <a class="hmbody" href="#listing-${esc(h.id)}">
      <b class="hmprice">${esc(hmPriceTxt(h))}</b>
      <span class="hmfacts">${h.beds != null ? `<span>${HM_BED}${h.deal === "room" ? "Room" : h.beds + " bd"}</span>` : ""}${h.baths ? `<span>${HM_BATH}${h.baths} ba</span>` : ""}${h.parking ? `<span>${HM_CAR}${h.parking}</span>` : ""}${h.sqft ? `<span>${Number(h.sqft).toLocaleString("en-CA")} sq ft</span>` : ""}</span>
      <span class="hmaddr">${esc(hmWhere(h))}</span>
      <span class="hmtype">${esc(h.type || "")}</span>
    </a></article>`;
}
function hmRefresh(fromMap){
  const r = $("#hmResults"); if (!r){ if (!fromMap) render(); return; }
  r.innerHTML = hmResultsHTML();
  if (!fromMap) hmDrawPins();
  const pnl = $("#hmPanel"), top = pnl ? pnl.scrollTop : 0; if (pnl){ pnl.innerHTML = hmPanelHTML(); pnl.scrollTop = top; }
  const f = $("#hmFoot"); if (f) f.innerHTML = hmFootHTML(hmFiltered().length);
  const bd = $("#fltBadge"); if (bd) bd.textContent = hmFltCount() || "";
}
async function hmToggleSave(id){
  if (!USER){ toast("Sign in to save homes"); afterLogin = "homes"; authMode = "signin"; go("account"); return; }
  const cur = hmSaved(), next = cur.includes(id) ? cur.filter(x => x !== id) : [...cur, id];
  if (PROFILE) PROFILE.savedHomes = next; else PROFILE = {savedHomes: next};
  document.querySelectorAll(`[data-hmsave="${CSS.escape(id)}"]`).forEach(b => { const on = next.includes(id); b.setAttribute("aria-pressed", on); b.setAttribute("aria-label", on ? "Remove from saved" : "Save this home"); const t = b.querySelector(".hmsavetxt"); if (t) t.textContent = on ? "Saved" : "Save"; });
  toast(next.includes(id) ? "Saved. Find it under Saved." : "Removed from saved");
  try { await FB.hmSetSaved(USER.uid, next); } catch (e) { console.error(e); toast("That didn't save. Please try again."); }
  if (HM.f && HM.f.saved && current() === "homes") hmRefresh();
}

/* listing page */
function listingView(){
  const h = (HM.list || []).find(x => x.id === listingId) || HM.extra[listingId] || ((HM.mine || []).find(x => x.id === listingId));
  if (!h){
    if (FB && HM.extra[listingId] === undefined){ HM.extra[listingId] = null; FB.hmGet(listingId).then(x => { HM.extra[listingId] = x || false; if (current() === "listing") render(); }).catch(() => { HM.extra[listingId] = false; if (current() === "listing") render(); }); }
    return HM.extra[listingId] === false ? `<div class="empty">This listing isn't available anymore. <a href="#homes" style="color:var(--link)">See all homes</a></div>` : `<div class="empty">Loading…</div>`;
  }
  hmLoadPhotos(h);
  const own = USER && h.uid === USER.uid, saved = hmSaved().includes(h.id);
  const facts = [["Listing", HM_DEALS[h.deal]], ["Home type", h.type], h.deal !== "room" && h.beds != null && ["Bedrooms", h.beds], h.baths && ["Bathrooms", h.baths], h.parking != null && ["Parking", h.parking || "None"], h.sqft && ["Size", Number(h.sqft).toLocaleString("en-CA") + " sq ft"], h.available && ["Available", new Date(h.available + "T12:00:00").toLocaleDateString("en-CA", {month: "long", day: "numeric", year: "numeric"})], ["Listed", tsMs(h.approvedAt || h.createdAt) ? new Date(tsMs(h.approvedAt || h.createdAt)).toLocaleDateString("en-CA", {month: "short", day: "numeric", year: "numeric"}) : ""]].filter(x => x && x[1] !== "" && x[1] != null);
  const status = own && h.status !== "approved" ? `<div class="dtnote">${h.status === "pending" ? "Waiting for approval. Only you can see this listing for now." : h.status === "rejected" ? "This listing wasn't approved." + (h.adminNote ? " Note: " + esc(h.adminNote) : "") : "This listing is closed."}</div>` : "";
  return `<article class="hmpage">
    ${hmGalleryHTML(h)}
    <div class="hmlayout">
      <div class="hmmain">
        ${status}
        <span class="hmdeal ${h.deal} inline">${HM_DEALS[h.deal]}</span>
        <h1 class="hmbig">${esc(hmPriceTxt(h))}</h1>
        <h2 class="hmtitle">${esc(h.title)}</h2>
        <p class="hmaddr big">${HM_PIN}${esc(hmWhere(h))}${h.showStreet ? "" : " <small>(exact address shared by the lister)</small>"}</p>
        <div class="hmfacts big">${h.beds != null ? `<span>${HM_BED}${h.deal === "room" ? "Room" : h.beds + " bedroom" + (h.beds == 1 ? "" : "s")}</span>` : ""}${h.baths ? `<span>${HM_BATH}${h.baths} bath${h.baths == 1 ? "" : "s"}</span>` : ""}${h.parking ? `<span>${HM_CAR}${h.parking} parking</span>` : ""}</div>
        <div class="hmacts"><button type="button" class="btn ghost" data-hmsave="${esc(h.id)}" aria-pressed="${saved}">${DT_HEART}<span class="hmsavetxt">${saved ? "Saved" : "Save"}</span></button><button type="button" class="btn ghost" data-hmshare>Share</button></div>
        ${h.description ? `<section class="dtsect"><h2>About this home</h2><div class="itemdesc">${descHTML(h.description)}</div></section>` : ""}
        <section class="dtsect"><h2>Details</h2><dl class="dtfacts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(String(v))}</dd></div>`).join("")}</dl></section>
        ${(h.features || []).length ? `<section class="dtsect"><h2>Features</h2><div class="dtchips">${h.features.map(x => `<span>${esc(x)}</span>`).join("")}</div></section>` : ""}
        ${h.lat != null ? `<section class="dtsect"><h2>Location</h2><div id="hmMini" class="hmmini"></div></section>` : ""}
        ${h.deal === "sale" ? hmMortgageHTML(h) : ""}
      </div>
      <aside class="hmside">${hmContactHTML(h)}</aside>
    </div></article>`;
}
function hmGalleryHTML(h){
  const ph = Array.isArray(HM.photos[h.id]) && HM.photos[h.id].length ? HM.photos[h.id] : h.thumb ? [h.thumb] : [];
  const i = Math.min(HM.gi, Math.max(0, ph.length - 1));
  if (!ph.length) return `<div class="hmgal" id="hmGal"><div class="hmgmain hmnoimg">${HM_PIN}</div></div>`;
  return `<div class="hmgal" id="hmGal"><div class="hmgmain"><img src="${esc(ph[i])}" alt="Photo ${i + 1} of ${ph.length}">${ph.length > 1 ? `<button type="button" class="hmgnav prev" data-hmg="${(i - 1 + ph.length) % ph.length}" aria-label="Previous photo">‹</button><button type="button" class="hmgnav next" data-hmg="${(i + 1) % ph.length}" aria-label="Next photo">›</button><span class="hmgcount">${i + 1} / ${ph.length}</span>` : ""}</div>
    ${ph.length > 1 ? `<div class="dtthumbs">${ph.map((u, k) => `<button type="button" data-hmg="${k}" aria-label="Photo ${k + 1}" aria-pressed="${k === i}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}</div>`;
}
async function hmLoadPhotos(h){
  if (!h || HM.photos[h.id] || !h.photoCount || !FB) return;
  HM.photos[h.id] = "loading"; const out = [];
  for (let i = 0; i < Math.min(8, h.photoCount); i++){ try { const d = await FB.hmGetPhoto(h.id, i); if (d) out.push(d); } catch (_) {} }
  HM.photos[h.id] = out;
  if (current() === "listing" && listingId === h.id){ const g = $("#hmGal"); if (g) g.outerHTML = hmGalleryHTML(h); }
  if (current() === "listhome" && HM.form && HM.form.id === h.id && !HM.form.photosLoaded){ HM.form.photos = out.map(data => ({data})); HM.form.photosLoaded = true; const s = $("#hmPhotos"); if (s) s.innerHTML = hmPhotoStrip(); }
}
function hmMortgageHTML(h){
  return `<section class="dtsect hmcalc" id="hmCalc"><h2>Mortgage estimate</h2>
    <div class="hmcalcgrid"><label>Down payment<select data-hmc="down">${[5, 10, 15, 20, 25, 35].map(d => `<option value="${d}"${d === 20 ? " selected" : ""}>${d}%</option>`).join("")}</select></label>
      <label>Interest rate<input data-hmc="rate" type="number" step="0.05" min="0" max="20" value="4.5"></label>
      <label>Amortization<select data-hmc="years">${[15, 20, 25, 30].map(y => `<option${y === 25 ? " selected" : ""}>${y}</option>`).join("")}</select></label></div>
    <p class="hmcalcout" id="hmCalcOut" data-price="${+h.price || 0}">${hmCalc(+h.price || 0, 20, 4.5, 25)}</p>
    <p class="note">A rough estimate only, not including taxes, insurance or fees. Ask a mortgage professional for real numbers.</p></section>`;
}
function hmCalc(price, down, rate, years){
  const P = price * (1 - down / 100), r = Math.pow(1 + rate / 200, 1 / 6) - 1, n = years * 12;   // Canadian: compounded semi-annually
  const m = r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
  return `About <b>${hmMoney(m)}/month</b> on a ${hmMoney(P)} mortgage`;
}
function hmContactHTML(h){
  const own = USER && h.uid === USER.uid;
  if (own) return `<div class="hmcontact"><h2>Your listing</h2><p class="note">People who contact you show up in My listings.</p><a class="btn" href="#list-your-home" data-hmedit="${esc(h.id)}">Edit listing</a><a class="btn ghost" href="#my-listings">My listings</a></div>`;
  return `<div class="hmcontact"><h2>Contact ${esc(h.ownerName || "the lister")}</h2>
    ${!USER ? `<p class="note">Sign in to send a message. Your email and phone stay private.</p>${googleBtn("listing")}<div style="display:grid;gap:8px"><button class="btn" type="button" data-auth="signin" data-next="listing">Sign in with email</button><button class="btn ghost" type="button" data-auth="signup" data-next="listing" style="color:var(--fg)">Create account</button></div>`
      : !USER.emailVerified ? `<p class="note">Confirm your email address first, then you can send a message.</p><button class="btn small" type="button" data-recheck>I've confirmed it</button>`
      : h.status !== "approved" ? `<p class="note">This listing isn't open for messages.</p>`
      : `<form id="hmContact" class="hmcform"><textarea id="hmCText" rows="4" maxlength="2000" required>Hi ${esc(h.ownerName || "")}, is this ${h.deal === "sale" ? "home" : "place"} still available? I'd like to know more.</textarea><button class="btn" type="submit">Send message</button></form><p class="note">Replies show up in My listings → Messages.</p>`}
    <div class="hmsafe"><b>Stay safe:</b> see the place in person before paying anything, and never send a deposit by gift card or wire transfer.</div>
    <button type="button" class="linkbtn" data-hmreport="${esc(h.id)}" style="color:#6e6e73;margin-top:8px">Report this listing</button></div>`;
}

/* post or edit a listing */
function listHomeView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("listhome", "Sign in to list your home", "List a home, apartment or room for sale or for rent. It's free.");
  if (!USER.emailVerified) return `<div class="panel dtgate"><h2>Confirm your email first</h2><p class="note">To keep listings real, only members with a confirmed email can post. We sent a link to ${esc(USER.email || "your email")}.</p><div style="display:flex;gap:14px;flex-wrap:wrap"><button class="btn small" type="button" data-recheck>I've confirmed it</button><button class="linkbtn" type="button" data-resend>Send the link again</button></div></div>`;
  if (!HM.form){ const edit = HM.editId && ((HM.mine || []).find(x => x.id === HM.editId) || (HM.list || []).find(x => x.id === HM.editId)); hmStartForm(edit && edit.uid === USER.uid ? edit : null); }
  const F = HM.form, h = F.data, sel = (a, b) => a === b ? " selected" : "", isNew = !F.id;
  return `<section class="pagehero lhero"><div class="phtext"><h1>${isNew ? "List your home" : "Edit your listing"}</h1><p>${isNew ? "Free to post. We check each listing before it goes live, usually within a day." : "After you save, your listing is checked again before it shows."}</p></div></section>
  <form class="panel dtform hmform" id="hmForm" novalidate>
    <div class="fsec"><h3>Listing type</h3><div class="fopts" role="radiogroup" aria-label="Listing type">${Object.entries(HM_DEALS).map(([k, l]) => `<label class="fopt hmradio"><input type="radio" name="deal" value="${k}"${h.deal === k ? " checked" : ""}> ${l}</label>`).join("")}</div></div>
    <div class="fsec"><h3>Photos <small>up to 8 · the first one is the main photo</small></h3><div class="dtphotos" id="hmPhotos">${hmPhotoStrip()}</div></div>
    <label>Title<input name="title" required maxlength="100" placeholder="e.g. Bright 2-bedroom condo near Yonge and 16th" value="${esc(h.title || "")}"></label>
    <div class="dtgrid2">
      <label>Price <small id="hmPriceHint">${h.deal === "sale" ? "asking price" : "per month"}</small><input name="price" type="number" min="0" step="1" inputmode="numeric" required value="${h.price != null ? h.price : ""}"></label>
      <label>Home type<select name="type" required><option value="">Choose</option>${HM_TYPES.map(t => `<option${sel(t, h.type)}>${t}</option>`).join("")}</select></label>
      <label>Bedrooms<select name="beds">${[0, 1, 2, 3, 4, 5, 6].map(b => `<option value="${b}"${b === (h.beds ?? 1) ? " selected" : ""}>${b === 0 ? "Studio / none" : b === 6 ? "6+" : b}</option>`).join("")}</select></label>
      <label>Bathrooms<select name="baths">${[1, 1.5, 2, 2.5, 3, 3.5, 4, 5].map(b => `<option value="${b}"${b === (h.baths ?? 1) ? " selected" : ""}>${b}</option>`).join("")}</select></label>
      <label>Parking spots<select name="parking">${[0, 1, 2, 3, 4].map(b => `<option value="${b}"${b === (h.parking ?? 0) ? " selected" : ""}>${b === 4 ? "4+" : b}</option>`).join("")}</select></label>
      <label>Size in sq ft <small>(optional)</small><input name="sqft" type="number" min="50" max="20000" inputmode="numeric" value="${h.sqft || ""}"></label>
      <label>Available from <small>(optional)</small><input name="available" type="date" value="${esc(h.available || "")}"></label>
      <label>Your first name <small>shown on the listing</small><input name="ownerName" required maxlength="40" value="${esc(h.ownerName || (PROFILE && PROFILE.name ? PROFILE.name.split(" ")[0] : ""))}"></label>
    </div>
    <div class="fsec"><h3>Address</h3>
      <div class="dtgrid2"><label>Street address<input name="street" maxlength="100" autocomplete="street-address" placeholder="e.g. 123 Main Street, Unit 4" value="${esc(h.street || "")}"></label>
      <label>City<input name="city" required maxlength="40" placeholder="e.g. Richmond Hill" value="${esc(h.city || "")}"></label>
      <label>Postal code<input name="postal" maxlength="7" autocomplete="postal-code" placeholder="L4C 1A1" value="${esc(h.postal || "")}"></label></div>
      <label class="dtcheck"><input type="checkbox" name="showStreet"${h.showStreet ? " checked" : ""}> Show my street address on the listing. If unchecked, people only see the city and an approximate area on the map.</label>
      <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button type="button" class="btn small ghost" data-hmfind>Find on map</button><span class="note" id="hmPinNote">${F.lat != null ? "Drag the pin if it's not quite right." : "We'll find the spot from the address."}</span></div>
      <div id="hmFormMap" class="hmmini"${F.lat != null ? "" : " hidden"}></div>
    </div>
    <label>Description<textarea name="description" rows="6" maxlength="3000" placeholder="What's great about it, what's included, who it suits, and any rules">${esc(h.description || "")}</textarea></label>
    <div class="fsec"><h3>Features</h3><div class="fopts" id="hmFeats">${hmFeatsHTML()}</div></div>
    <label class="dtcheck"><input type="checkbox" name="ok" required${F.id ? " checked" : ""}> This listing is real, I'm allowed to rent or sell this place, and the photos are of this place.</label>
    <p class="formerr" id="hmErr" hidden></p>
    <div class="dtformfoot"><button class="btn" type="submit">${isNew ? "Send for approval" : "Save and send for approval"}</button><a class="linkbtn" href="${isNew ? "#homes" : "#my-listings"}">Cancel</a></div>
  </form>`;
}
function hmStartForm(edit){
  const d = edit ? {...edit} : {deal: "rent", showStreet: false, features: []};
  HM.form = {id: edit ? edit.id : null, data: d, feats: [...(d.features || [])], photos: [], photosLoaded: !edit || !edit.photoCount, lat: edit ? edit.lat : null, lng: edit ? edit.lng : null, changed: false, located: edit ? (edit.street || edit.city || "") : ""};
  if (edit && edit.photoCount){ if (Array.isArray(HM.photos[edit.id])){ HM.form.photos = HM.photos[edit.id].map(data => ({data})); HM.form.photosLoaded = true; } else hmLoadPhotos(edit); }
}
const hmFeatsHTML = () => HM_FEATS.map(x => `<button type="button" class="fopt" data-hmfeat="${esc(x)}" aria-pressed="${HM.form.feats.includes(x)}">${esc(x)}</button>`).join("");
function hmPhotoStrip(){
  const f = HM.form;
  if (!f.photosLoaded) return `<span class="note">Loading photos…</span>`;
  return f.photos.map((ph, i) => `<div class="dtph hmph"><img src="${esc(ph.data)}" alt="Photo ${i + 1}">${i === 0 ? `<span class="dtmainlbl">Main</span>` : `<button type="button" class="dtphmain" data-hmphmain="${i}">Make main</button>`}<button type="button" class="dtphx" data-hmphx="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join("")
    + (f.photos.length < 8 ? `<label class="dtphadd hmph"><input type="file" accept="image/*" multiple id="hmPhIn" hidden><span>+</span><small>Add photos</small></label>` : "");
}
async function hmAddPhotos(files){
  const f = HM.form;
  for (const file of [...files].slice(0, 8 - f.photos.length)){
    if (!/^image\//.test(file.type)) continue;
    try { const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      f.photos.push({data: await dtShrink(raw, 1400, 0.75, 300000)}); f.changed = true; } catch (e) { toast("That photo couldn't be added. Try a JPG or PNG."); }
  }
  const s = $("#hmPhotos"); if (s) s.innerHTML = hmPhotoStrip();
}
function hmAddrQuery(form){ const fd = new FormData(form), g = k => String(fd.get(k) || "").trim(); return [g("street"), g("city"), g("postal"), "Ontario", "Canada"].filter(Boolean).join(", "); }
async function hmFind(form, quiet){
  const q = hmAddrQuery(form), note = $("#hmPinNote");
  if (!String(new FormData(form).get("city") || "").trim()){ if (!quiet && note) note.textContent = "Enter at least the city first."; return false; }
  if (note) note.textContent = "Finding it on the map…";
  try {
    let p = await hmGeocode(q);
    if (!p){ const fd = new FormData(form); p = await hmGeocode([fd.get("postal"), fd.get("city"), "Ontario, Canada"].filter(Boolean).join(", ")); }
    if (!p){ if (note) note.textContent = "We couldn't find that address. Check the spelling, or add the postal code."; return false; }
    HM.form.lat = p.lat; HM.form.lng = p.lng; HM.form.located = q;
    const m = $("#hmFormMap"); if (m){ m.hidden = false; hmMiniMap("hmFormMap", p.lat, p.lng, true); }
    if (note) note.textContent = "Found it. Drag the pin if it's not quite right.";
    return true;
  } catch (e) { if (note) note.textContent = "The map search isn't responding. Try again in a moment."; return false; }
}
async function hmSave(form){
  const fd = new FormData(form), g = k => String(fd.get(k) || "").trim(), err = $("#hmErr");
  const say = t => { if (err){ err.textContent = t; err.hidden = false; err.scrollIntoView({block: "center", behavior: "smooth"}); } };
  const deal = g("deal"), price = Math.round(+g("price"));
  if (!HM_DEALS[deal]) return say("Choose whether it's for sale, for rent, or a room for rent.");
  if (!g("title")) return say("Please add a title.");
  if (!(price > 0)) return say("Please enter the price.");
  if (!g("type")) return say("Please choose the home type.");
  if (!g("city")) return say("Please enter the city.");
  if (!g("ownerName")) return say("Please enter your first name.");
  if (!fd.get("ok")) return say("Please confirm the listing is real and you're allowed to list it.");
  if (!HM.form.photosLoaded) return say("Your photos are still loading. Try again in a moment.");
  if (HM.form.lat == null || HM.form.located !== hmAddrQuery(form)){ const ok = await hmFind(form, true); if (!ok && HM.form.lat == null) return say("We couldn't find that address on the map. Check it, or add the postal code, then try again."); }
  if (HM.busy) return; HM.busy = true;
  const btn = form.querySelector('button[type="submit"]'), label = btn.textContent; btn.disabled = true; btn.textContent = "Saving…";
  try {
    const show = !!fd.get("showStreet"), ph = HM.form.photos, isNew = !HM.form.id, id = HM.form.id || FB.hmNewId();
    const lat = show ? HM.form.lat : Math.round(HM.form.lat * 500) / 500, lng = show ? HM.form.lng : Math.round(HM.form.lng * 500) / 500;
    const thumb = ph.length ? await dtShrink(ph[0].data, 520, 0.7, 60000) : "";
    const data = {uid: USER.uid, status: "pending", deal, type: g("type"), title: g("title").slice(0, 100), price, beds: +g("beds"), baths: +g("baths"), parking: +g("parking"), sqft: +g("sqft") || null,
      available: g("available"), ownerName: g("ownerName").split(" ")[0].slice(0, 40), street: show ? g("street").slice(0, 100) : "", showStreet: show, city: dtCity(g("city")), postal: g("postal").toUpperCase().slice(0, 7),
      lat, lng, description: g("description").slice(0, 3000), features: HM.form.feats.slice(0, 20), thumb, photoCount: ph.length};
    await FB.hmSave(id, data, isNew);
    if (isNew || HM.form.changed){
      for (let i = 0; i < ph.length; i++) await FB.hmSavePhoto(id, i, ph[i].data, USER.uid);
      for (let i = ph.length; i < 8; i++) await FB.hmDelPhoto(id, i).catch(() => {});
      HM.photos[id] = ph.map(p => p.data);
    }
    HM.form = null; HM.editId = null; HM.busy = false; HM.mine = null; HM.list = HM.list ? HM.list.filter(x => x.id !== id) : HM.list;
    toast(isNew ? "Sent for approval. We'll check it soon." : "Saved. It's being checked again."); go("mylistings");
  } catch (e) {
    console.error(e); HM.busy = false; btn.disabled = false; btn.textContent = label;
    say(e && e.code === "permission-denied" ? "The Homes section isn't switched on yet, so your listing couldn't be saved." : "Your listing couldn't be saved. Check your connection and try again.");
  }
}

/* my listings and messages */
function myListingsView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("mylistings", "Your listings and messages", "Sign in to see the homes you've listed and your messages.");
  hmEnsureThreads();
  if (HM.mine === null && FB){ HM.mine = "loading"; FB.hmMine(USER.uid).then(l => { HM.mine = l; if (current() === "mylistings") render(); }).catch(e => { console.error(e); HM.mine = []; if (current() === "mylistings") render(); }); }
  const mine = Array.isArray(HM.mine) ? HM.mine.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt)) : null;
  const st = {pending: ["Waiting for approval", "wait"], approved: ["Live", "live"], rejected: ["Not approved", "no"], closed: ["Closed", "closed"]};
  const row = h => { const [l, c] = st[h.status] || ["", ""];
    return `<div class="hmrow">${h.thumb ? `<img src="${esc(h.thumb)}" alt="">` : `<span class="hmnoimg sm">${HM_PIN}</span>`}
      <div class="hmrowtxt"><a href="#listing-${esc(h.id)}"><b>${esc(h.title)}</b></a><small>${esc(hmPriceTxt(h))} · ${HM_DEALS[h.deal]} · ${esc(h.city || "")}</small><span class="hmst ${c}">${l}</span>${h.status === "rejected" && h.adminNote ? `<small>Note: ${esc(h.adminNote)}</small>` : ""}</div>
      <div class="hmrowacts"><button type="button" class="linkbtn" data-hmedit="${esc(h.id)}">Edit</button>
        ${h.status === "approved" ? `<button type="button" class="linkbtn" data-hmclose="${esc(h.id)}">${HM.arm === "c" + h.id ? "Click again to close" : h.deal === "sale" ? "Mark sold" : "Mark rented"}</button>` : h.status === "closed" ? `<button type="button" class="linkbtn" data-hmreopen="${esc(h.id)}">Relist</button>` : ""}
        <button type="button" class="linkbtn" data-hmdel="${esc(h.id)}" style="color:var(--danger)">${HM.arm === "d" + h.id ? "Click again to delete" : "Delete"}</button></div></div>`; };
  const T = (HM.threads || []).filter(t => !t.marketId).sort((a, b) => tsMs(b.lastAt) - tsMs(a.lastAt));
  const trow = t => { const other = t.users.find(u => u !== USER.uid), un = hmIsUnread(t), mineHome = t.owner === USER.uid;
    return `<a class="dtmrow${un ? " unread" : ""}" href="#hchat-${esc(t.id)}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : `<span class="dtnoimg">${esc(((t.names || {})[other] || "?").charAt(0).toUpperCase())}</span>`}
      <span class="dtmtxt"><b>${esc((t.names || {})[other] || "Someone")} · ${esc(t.homeTitle || "")}</b><small>${mineHome ? "About your listing · " : ""}${t.lastText ? (t.lastFrom === USER.uid ? "You: " : "") + esc(t.lastText) : "No messages yet"}</small></span>
      <span class="dtmwhen">${tsMs(t.lastAt) ? dtWhen(tsMs(t.lastAt)) : ""}${un ? `<i class="dtdot" aria-label="Unread"></i>` : ""}</span></a>`; };
  return `<section class="pagehero lhero"><div class="phtext"><h1>My listings</h1><p>Your homes and your messages with buyers, renters and listers.</p></div><a class="btn" href="#list-your-home">+ List your home</a></section>
    <h2 class="hmh2">Messages</h2>
    ${HM.threads === null ? `<div class="empty">Loading messages…</div>` : T.length ? `<div class="panel dtmlist">${T.map(trow).join("")}</div>` : `<div class="empty">No messages yet.</div>`}
    <h2 class="hmh2">My homes</h2>
    ${!mine ? `<div class="empty">Loading your listings…</div>` : mine.length ? `<div class="panel hmrows">${mine.map(row).join("")}</div>` : `<div class="empty">You haven't listed anything yet. <a href="#list-your-home" style="color:var(--link)">List your home</a></div>`}`;
}
function hchatView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("mylistings", "Sign in to see your messages", "");
  hmEnsureThreads();
  if (HM.threads === null) return `<div class="empty">Loading…</div>`;
  const t = HM.threads.find(x => x.id === hchatId);
  if (!t) return `<div class="empty">This conversation isn't available. <a href="#selling" style="color:var(--link)">Back to Sell on Nojan</a></div>`;
  const other = t.users.find(u => u !== USER.uid), nm = (t.names || {})[other] || "Someone";
  if (HM.chat.id !== t.id){
    if (HM.chat.unsub) HM.chat.unsub();
    HM.chat = {id: t.id, msgs: null, unsub: FB.hmWatchMsgs(t.id, l => { HM.chat.msgs = l; const box = $("#dtMsgs"); if (box && current() === "hchat"){ box.innerHTML = hmMsgsHTML(); box.scrollTop = box.scrollHeight; } }, e => { console.error(e); HM.chat.msgs = []; })};
  }
  if (hmIsUnread(t)) FB.hmSeen(t.id, USER.uid).catch(() => {});
  setTimeout(() => { const box = $("#dtMsgs"); if (box) box.scrollTop = box.scrollHeight; }, 0);
  return `<section class="dtchat panel">
    <header class="dtchead"><a class="dtback" href="${t.marketId ? "#selling" : "#my-listings"}" aria-label="Back">‹</a>
      <a class="dtcwho" href="#${t.marketId ? mkRoute({id: t.marketId, kind: t.mkind}) : "listing-" + esc(t.homeId)}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : `<span class="dtnoimg">${esc(nm.charAt(0).toUpperCase())}</span>`}<span class="hmchwho"><b>${esc(nm)}</b><small>${esc(t.homeTitle || "")}</small></span></a></header>
    <div class="dtmsgs" id="dtMsgs" aria-live="polite">${hmMsgsHTML()}</div>
    <form class="dtsend" id="hmSend"><input id="hmText" maxlength="2000" autocomplete="off" placeholder="Message ${esc(nm)}" aria-label="Message"><button class="btn" type="submit">Send</button></form>
    <p class="dttip">Keep messages on this site. ${t.marketId ? "Meet in a public place and check it before paying" : "See a place in person before paying"}, and never pay by gift card or wire transfer.</p></section>`;
}
function hmMsgsHTML(){
  const l = HM.chat.msgs;
  if (!l) return `<p class="note" style="text-align:center">Loading messages…</p>`;
  if (!l.length) return `<p class="note" style="text-align:center">No messages yet.</p>`;
  let last = "";
  return l.map(x => { const ms = tsMs(x.at) || Date.now(), day = new Date(ms).toDateString(), sep = day !== last ? `<div class="dtday">${new Date(ms).toLocaleDateString("en-CA", {weekday: "long", month: "short", day: "numeric"})}</div>` : ""; last = day;
    return sep + `<div class="dtmsg${x.from === USER.uid ? " mine" : ""}"><span>${esc(x.text).replace(/\n/g, "<br>")}</span><small>${new Date(ms).toLocaleTimeString("en-CA", {hour: "numeric", minute: "2-digit"})}</small></div>`; }).join("");
}

/* admin */
function homesAdminHTML(){
  if (!HM.adm){ HM.adm = "loading"; Promise.all([FB.hmAll(), FB.dtReports().catch(() => [])]).then(([l, r]) => { HM.adm = {list: l, reports: r.filter(x => String(x.about).startsWith("home:"))}; if (current() === "admin") refreshAdmin(); }).catch(e => { console.error(e); HM.adm = {list: [], reports: [], err: true}; if (current() === "admin") refreshAdmin(); }); }
  if (HM.adm === "loading") return `<div class="empty">Loading listings…</div>`;
  const all = HM.adm.list.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt)), pend = all.filter(h => h.status === "pending");
  const R = (h, p) => `<tr><td>${h.thumb ? `<img src="${esc(h.thumb)}" alt="" style="width:56px;height:42px;object-fit:cover;border-radius:8px">` : ""}</td><td><a href="#listing-${esc(h.id)}">${esc(h.title)}</a><br><small>${HM_DEALS[h.deal]} · ${esc(h.type || "")} · ${esc(h.city || "")}</small></td><td>${esc(hmPriceTxt(h))}</td><td>${esc(h.ownerName || "")}</td><td>${tsMs(h.updatedAt) ? new Date(tsMs(h.updatedAt)).toLocaleDateString("en-CA") : ""}</td><td>${esc(h.status)}</td>
    <td style="white-space:nowrap">${p ? `<button class="linkbtn" type="button" data-hmadm="approved" data-id="${esc(h.id)}">Approve</button> <button class="linkbtn" type="button" data-hmadm="rejected" data-id="${esc(h.id)}">Reject</button> ` : h.status === "approved" ? `<button class="linkbtn" type="button" data-hmadm="rejected" data-id="${esc(h.id)}">Take down</button> ` : ""}<button class="linkbtn" type="button" data-hmadmdel="${esc(h.id)}" style="color:var(--danger)">${HM.arm === "a" + h.id ? "Click again" : "Delete"}</button></td></tr>`;
  const T = (rows, p) => `<div class="tablewrap"><table class="ctable"><thead><tr><th></th><th>Listing</th><th>Price</th><th>By</th><th>Updated</th><th>Status</th><th></th></tr></thead><tbody>${rows.map(h => R(h, p)).join("")}</tbody></table></div>`;
  return `${HM.adm.err ? `<p class="formerr">Couldn't load listings. Make sure the new database rules are published.</p>` : ""}
    <div class="admintools"><span class="note">${pend.length} waiting · ${all.filter(h => h.status === "approved").length} live · customers see them at <a href="#homes">Homes</a></span><button class="btn small ghost" type="button" data-hmadmreload>Refresh</button></div>
    ${HM.adm.reports.length ? `<h3 style="margin:18px 0 8px">Reports</h3><div class="tablewrap"><table class="ctable"><thead><tr><th>Date</th><th>Listing</th><th>Reason</th><th></th></tr></thead><tbody>${HM.adm.reports.map(r => `<tr><td>${tsMs(r.at) ? new Date(tsMs(r.at)).toLocaleDateString("en-CA") : ""}</td><td><a href="#listing-${esc(r.about.slice(5))}">${esc((all.find(h => h.id === r.about.slice(5)) || {}).title || "Listing")}</a></td><td>${esc(r.reason || "")}${r.text ? `<br><small>${esc(r.text)}</small>` : ""}</td><td><button class="linkbtn" type="button" data-hmrepdis="${esc(r.id)}">Dismiss</button></td></tr>`).join("")}</tbody></table></div>` : ""}
    <h3 style="margin:18px 0 8px">Waiting for approval</h3>${pend.length ? T(pend, true) : `<p class="note">Nothing waiting.</p>`}
    <h3 style="margin:18px 0 8px">All listings</h3>${all.length ? T(all.filter(h => h.status !== "pending"), false) : `<p class="note">No listings yet.</p>`}`;
}
function hmAfterRender(v){
  if (v === "homes" && $("#hmMap")) hmInitMap();
  else if (v === "listing"){ const h = (HM.list || []).find(x => x.id === listingId) || HM.extra[listingId] || (Array.isArray(HM.mine) && HM.mine.find(x => x.id === listingId)); if (h && h.lat != null && $("#hmMini")) hmMiniMap("hmMini", h.lat, h.lng, false); }
  else if (v === "listhome" && HM.form && HM.form.lat != null && $("#hmFormMap")) hmMiniMap("hmFormMap", HM.form.lat, HM.form.lng, true);
}

/* clicks, inputs and forms for homes */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("button, a[data-hmedit]"); if (!b) return;
  if (b.dataset.hmf){
    const F = HM.f, k = b.dataset.hmf, v = b.dataset.v;
    if (["beds", "baths", "parking"].includes(k)) F[k] = +v;
    else if (k === "photos") F.photos = !F.photos;
    else F[k] = F[k].includes(v) ? F[k].filter(x => x !== v) : [...F[k], v];
    hmRefresh(); return;
  }
  if (b.hasAttribute("data-hmclear")){ const s = HM.f.saved; hmDefaultFilters(); HM.f.saved = s; hmRefresh(); return; }
  if (b.hasAttribute("data-hmsaved")){ if (!USER){ hmToggleSave(""); return; } HM.f.saved = !HM.f.saved; document.querySelectorAll("[data-hmsaved]").forEach(x => x.setAttribute("aria-pressed", HM.f.saved)); hmRefresh(); return; }
  if (b.hasAttribute("data-hmmaptog")){ HM.mapView = !HM.mapView; const s = $("#hmSplit"); if (s) s.classList.toggle("showmap", HM.mapView); b.textContent = HM.mapView ? "List" : "Map"; b.setAttribute("aria-pressed", HM.mapView); if (HM.mapView) HM.mapSeen = true;
    if (HM.map) setTimeout(() => { HM.map.invalidateSize(); if (HM.mapView){ if (!HM.view){ const pts = hmFiltered(null, true).filter(h => h.lat != null); if (pts.length) HM.map.fitBounds(L.latLngBounds(pts.map(h => [h.lat, h.lng])).pad(0.2), {maxZoom: 14}); } const bb = HM.map.getBounds(); HM.bounds = {n: bb.getNorth(), s: bb.getSouth(), e: bb.getEast(), w: bb.getWest()}; hmRefresh(true); } }, 60); return; }
  if (b.dataset.hmsave != null){ ev.preventDefault(); hmToggleSave(b.dataset.hmsave); return; }
  if (b.dataset.hmg != null){ HM.gi = +b.dataset.hmg; const h = (HM.list || []).find(x => x.id === listingId) || HM.extra[listingId] || (Array.isArray(HM.mine) && HM.mine.find(x => x.id === listingId)), g = $("#hmGal"); if (h && g) g.outerHTML = hmGalleryHTML(h); return; }
  if (b.hasAttribute("data-hmshare")){ const url = location.origin + "/#listing-" + listingId; try { if (navigator.share){ await navigator.share({url}); return; } await navigator.clipboard.writeText(url); toast("Link copied"); } catch (_) {} return; }
  if (b.dataset.hmedit){ ev.preventDefault(); HM.editId = b.dataset.hmedit; HM.form = null; go("listhome"); return; }
  if (b.dataset.hmfeat){ const x = b.dataset.hmfeat, L = HM.form.feats; HM.form.feats = L.includes(x) ? L.filter(y => y !== x) : [...L, x]; $("#hmFeats").innerHTML = hmFeatsHTML(); return; }
  if (b.dataset.hmphx != null){ HM.form.photos.splice(+b.dataset.hmphx, 1); HM.form.changed = true; $("#hmPhotos").innerHTML = hmPhotoStrip(); return; }
  if (b.dataset.hmphmain != null){ const [x] = HM.form.photos.splice(+b.dataset.hmphmain, 1); HM.form.photos.unshift(x); HM.form.changed = true; $("#hmPhotos").innerHTML = hmPhotoStrip(); return; }
  if (b.hasAttribute("data-hmfind")){ hmFind($("#hmForm")); return; }
  if (b.dataset.hmclose || b.dataset.hmdel || b.dataset.hmreopen){
    const id = b.dataset.hmclose || b.dataset.hmdel || b.dataset.hmreopen, kind = b.dataset.hmclose ? "c" : b.dataset.hmdel ? "d" : "r";
    if (kind !== "r" && HM.arm !== kind + id){ HM.arm = kind + id; render(); return; }
    HM.arm = "";
    try { if (kind === "d") await FB.hmDelete(id); else await FB.hmSetStatus(id, kind === "c" ? "closed" : "pending"); HM.mine = null; HM.list = HM.list ? HM.list.filter(x => x.id !== id) : HM.list; toast(kind === "d" ? "Listing deleted" : kind === "c" ? "Listing closed" : "Sent for approval again"); render(); }
    catch (e) { console.error(e); toast("That didn't go through. Please try again."); }
    return;
  }
  if (b.dataset.hmreport){ dtReportForm("home:" + b.dataset.hmreport); return; }
  if (b.dataset.hmrepdis){ try { await FB.dtDelReport(b.dataset.hmrepdis); HM.adm.reports = HM.adm.reports.filter(r => r.id !== b.dataset.hmrepdis); refreshAdmin(); } catch (e) { toast("Couldn't dismiss it."); } return; }
  if (b.hasAttribute("data-hmadmreload")){ HM.adm = null; refreshAdmin(); return; }
  if (b.dataset.hmadm){
    const id = b.dataset.id, s = b.dataset.hmadm;
    try { await FB.hmSetStatus(id, s, "", true); const h = HM.adm.list.find(x => x.id === id); if (h) h.status = s; HM.list = null; toast(s === "approved" ? "Approved. It's live now." : "Taken down"); refreshAdmin(); } catch (e) { console.error(e); toast("Couldn't update it. Check the database rules."); }
    return;
  }
  if (b.dataset.hmadmdel){
    const id = b.dataset.hmadmdel; if (HM.arm !== "a" + id){ HM.arm = "a" + id; refreshAdmin(); return; }
    HM.arm = ""; try { await FB.hmDelete(id); HM.adm.list = HM.adm.list.filter(x => x.id !== id); HM.list = null; toast("Listing deleted"); refreshAdmin(); } catch (e) { console.error(e); toast("Couldn't delete it."); }
  }
});
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "hmPhIn"){ hmAddPhotos(t.files); return; }
  if (t.hasAttribute && t.hasAttribute("data-hmmove")){ HM.move = t.checked; hmRefresh(true); return; }
  if (t.name === "deal" && t.closest("#hmForm")){ const hint = $("#hmPriceHint"); if (hint) hint.textContent = t.value === "sale" ? "asking price" : "per month"; return; }
  if (t.dataset && t.dataset.hmc){ const box = $("#hmCalc"); if (!box) return; const v = k => +box.querySelector(`[data-hmc="${k}"]`).value; const out = $("#hmCalcOut"); out.innerHTML = hmCalc(+out.dataset.price, v("down"), v("rate"), v("years")); return; }
  const s = t.closest && t.closest("[data-hms]"); if (!s) return;
  const k = s.dataset.hms;
  if (k === "sort"){ HM.sort = s.value; if ($("#hmResults")) $("#hmResults").innerHTML = hmResultsHTML(); return; }
  HM.f[k] = +s.value; if (HM.f.min && HM.f.max && HM.f.min > HM.f.max){ if (k === "min") HM.f.max = 0; else HM.f.min = 0; } hmRefresh();
});
document.addEventListener("input", e => { if (e.target.dataset && e.target.dataset.hmc === "rate"){ const box = $("#hmCalc"), out = $("#hmCalcOut"); if (!box || !out) return; const v = k => +box.querySelector(`[data-hmc="${k}"]`).value; out.innerHTML = hmCalc(+out.dataset.price, v("down"), v("rate"), v("years")); } });
document.addEventListener("submit", async ev => {
  const f = ev.target;
  if (f.id === "hmForm"){ ev.preventDefault(); hmSave(f); return; }
  if (f.id === "hmContact"){
    ev.preventDefault(); const text = $("#hmCText").value.trim(); if (!text) return;
    const h = (HM.list || []).find(x => x.id === listingId) || HM.extra[listingId]; if (!h) return;
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Sending…";
    try { const myName = (PROFILE && PROFILE.name ? PROFILE.name.split(" ")[0] : "") || (USER.displayName || "").split(" ")[0] || "A member";
      const id = await FB.hmOpenThread(h, USER.uid, myName); await FB.hmSend(id, USER.uid, text); toast("Message sent"); go("hchat", id); }
    catch (e) { console.error(e); btn.disabled = false; btn.textContent = "Send message"; toast("Your message wasn't sent. Please try again."); }
    return;
  }
  if (f.id === "hmSend"){
    ev.preventDefault(); const inp = $("#hmText"), text = inp.value.trim(); if (!text || !HM.chat.id) return;
    inp.value = ""; try { await FB.hmSend(HM.chat.id, USER.uid, text); } catch (e) { console.error(e); inp.value = text; toast("Your message wasn't sent. Please try again."); }
  }
});

/* ---- v77: approved members sell brand new and used items, services and events ---- */
const MK = {list: null, me: "none", meUid: null, mine: null, photos: {}, extra: {}, form: null, busy: false, adm: null, arm: "", gi: 0, newKind: "used", editId: null};
const MK_KINDS = {new: "Brand new item", used: "Used item", service: "Service", event: "Event"};
const MK_VIEWS = ["selling", "sell"];
const CERT_SVG = `<svg viewBox="0 0 24 24" aria-hidden="true"><path class="cb" d="M12 1.8l2.5 1.9 3.1-.3 1 3 2.6 1.8-1.1 2.9 1.1 2.9-2.6 1.8-1 3-3.1-.3L12 22.2l-2.5-1.9-3.1.3-1-3-2.6-1.8 1.1-2.9-1.1-2.9 2.6-1.8 1-3 3.1.3z"/><path class="ck" d="M8.3 12.2l2.5 2.5 4.9-5"/></svg>`;
const certBadge = small => `<span class="cert${small ? " sm" : ""}" title="Checked in person and certified by Nojan">${CERT_SVG}${small ? "Certified" : "Certified by Nojan"}</span>`;
function ageOf(dob){
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(dob || ""); if (!m) return null;
  const n = new Date(), a = n.getFullYear() - m[1] - ((n.getMonth() + 1 < +m[2] || (n.getMonth() + 1 === +m[2] && n.getDate() < +m[3])) ? 1 : 0);
  return a >= 0 && a < 130 ? a : null;
}
const mkRoute = d => (d.kind === "service" ? "service-m-" : d.kind === "event" ? "event-m-" : "item-m-") + d.id;
const mkPrice = d => d.price == null || d.price === "" ? (d.kind === "event" ? "Free" : "Ask for price") : +d.price === 0 ? "Free" : money(+d.price) + (d.kind === "service" && d.priceUnit && d.priceUnit !== "fixed" ? " / " + d.priceUnit : "");
const mkFirst = () => (PROFILE && PROFILE.name ? PROFILE.name.trim().split(/\s+/)[0] : "") || (USER && USER.displayName ? USER.displayName.split(" ")[0] : "") || "A member";

/* live listings from members are mixed into Brand New, Used, Services and Events */
function mkToItem(d){
  return {id: "m-" + d.id, pid: "m-" + d.id, mid: d.id, itemId: normId(d.itemId) || fallbackId(d.id), member: true, uid: d.uid, seller: d.ownerName || "A member", certified: !!d.certified,
    name: d.title || "", desc: d.description || "", brand: d.brand || "", price: d.price == null || d.price === "" ? null : +d.price, condition: d.kind === "used" ? "used" : "new",
    images: d.thumb ? [d.thumb] : [], thumb: d.thumb || "", stock: null, soldOut: false, active: true, added: tsMs(d.createdAt), order: 100000 + (tsMs(d.createdAt) ? -tsMs(d.createdAt) / 1e13 : 0),
    type: fixType((d.type || "").trim(), guessType((d.title || "") + " " + (d.brand || ""))), grade: d.kind === "used" ? (d.grade || "") : "", city: d.city || ""};
}
function mkToService(d){
  return {...fsToService({id: "m-" + d.id, title: d.title, category: d.category || "Other", providerName: d.ownerName || "A member", summary: String(d.description || "").split(/\n/)[0].slice(0, 160), description: d.description || "",
    price: d.price, priceUnit: d.priceUnit || "session", format: d.format || "in-person", location: d.city || "", images: d.thumb ? [d.thumb] : [], thumb: d.thumb || "", order: 100000}), member: true, mid: d.id, uid: d.uid, certified: !!d.certified};
}
function mkToEvent(d){
  return {...fsToEvent({id: "m-" + d.id, title: d.title, category: d.category, startMs: d.startMs, endMs: d.endMs, venue: d.venue || "", address: "", city: d.city || "", format: d.format, onlineInfo: "",
    cover: d.thumb || "", summary: String(d.description || "").split(/\n/)[0].slice(0, 200), description: d.description || "", organizer: d.ownerName || "A member", tickets: [{name: "Entry", price: +d.price || 0}]}), member: true, mid: d.id, uid: d.uid, certified: !!d.certified};
}
function mkMerge(){
  if (typeof PRODUCTS === "undefined") return;
  PRODUCTS = PRODUCTS.filter(p => !p.member); SERVICES = SERVICES.filter(s => !s.member); EVENTS = EVENTS.filter(e => !e.member);
  const L = MK.list || [], now = Date.now();
  L.filter(d => d.kind === "new" || d.kind === "used").forEach(d => PRODUCTS.push(mkToItem(d)));
  L.filter(d => d.kind === "service").forEach(d => SERVICES.push(mkToService(d)));
  if (EVENTS_ON) L.filter(d => d.kind === "event" && (+d.endMs || +d.startMs || 0) >= now).forEach(d => EVENTS.push(mkToEvent(d)));
  EVENTS.sort((a, b) => a.startMs - b.startMs);
}
function mkStartWatch(){
  if (!FB || MK.watching || !SELLING_ON) return; MK.watching = true;   // v92: not while selling is off
  FB.mkWatchLive(l => { MK.list = l; mkMerge(); const v = current(); if (v === "admin") return; if (["home", "new", "used", "services", "events", "item", "service", "event"].includes(v)) render(); },
    e => { console.error(e); MK.list = []; });
}
function mkFind(id){ return (MK.list || []).find(x => x.id === id) || MK.extra[id] || (Array.isArray(MK.mine) && MK.mine.find(x => x.id === id)) || null; }

/* seller status */
function mkEnsureSeller(){
  if (!USER || !FB) return;
  if (MK.meUid === USER.uid) return;
  MK.meUid = USER.uid; MK.me = "loading";
  FB.mkGetSeller(USER.uid).then(s => { MK.me = s || null; if ([...MK_VIEWS, "account"].includes(current())) render(); }).catch(e => { console.error(e); MK.me = null; if ([...MK_VIEWS, "account"].includes(current())) render(); });
}
const mkApproved = () => MK.me && MK.me !== "loading" && MK.me.status === "approved";
function mkEnsureMine(force){
  if (!USER || !FB || (MK.mine && MK.mine !== "loading" && !force) || MK.mine === "loading") return;
  MK.mine = "loading";
  FB.mkMine(USER.uid).then(l => { MK.mine = l; if (MK_VIEWS.includes(current())) render(); }).catch(e => { console.error(e); MK.mine = []; if (MK_VIEWS.includes(current())) render(); });
}
function mkChecks(){
  const pr = PROFILE || {}, age = ageOf(pr.dob);
  return [[!!USER.emailVerified, "Email address confirmed"], [!!(pr.name || "").trim(), "Full name"], [!!(pr.phone || "").trim(), "Phone number"], [!!(pr.address || "").trim(), "Home address"], [age != null && age >= 18, age != null && age < 18 ? "Date of birth (you must be 18 or older to sell)" : "Date of birth (18 or older)"]];
}

/* v89: selling is off — anyone who opens #selling or #sell goes to the home page */
function sellOff(){ setTimeout(() => go("home"), 0); return `<div class="empty">Loading…</div>`; }

/* ---- Sell on Nojan: status, my listings and messages ---- */
function sellingView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("selling", "Sign in to sell on Nojan", "Approved members can sell brand new and used items, offer services and list events.");
  mkEnsureSeller(); hmEnsureThreads();
  const s = MK.me, ok = mkApproved();
  if (ok) mkEnsureMine();
  let status;
  if (s === "loading") status = `<div class="panel"><p class="note">Loading…</p></div>`;
  else if (!s || s.status === "rejected"){
    const C = mkChecks(), all = C.every(c => c[0]);
    status = `<div class="panel mkapply"><h2>${s ? "Apply again" : "Become a seller"}</h2>
      ${s && s.note ? `<p class="dtnote">Your last application wasn't approved. Note from Nojan: ${esc(s.note)}</p>` : s ? `<p class="dtnote">Your last application wasn't approved. You can update your details and apply again.</p>` : ""}
      <p class="note">Once Nojan approves your account, you can list brand new and used items, services and events. Buyers message you here, like Facebook Marketplace.</p>
      <ul class="mkchecks">${C.map(([y, t]) => `<li class="${y ? "y" : "n"}"><span>${y ? "✓" : "•"}</span>${t}</li>`).join("")}</ul>
      ${all ? `<button class="btn" type="button" data-mkapply>Send application</button>` : `<a class="btn" href="#account">Complete your details</a><p class="note">Add the missing details on your account page, then come back here.</p>`}</div>`;
  }
  else if (s.status === "pending") status = `<div class="panel"><h2>Application sent</h2><p class="note">Nojan is reviewing your account. Once you're approved, you can start listing right here.</p></div>`;
  else if (s.status === "suspended") status = `<div class="panel"><h2>Selling is paused</h2><p class="note">Your selling account is paused${s.note ? ": " + esc(s.note) : "."} <a href="#contact-us">Contact us</a> if you have questions.</p></div>`;
  else status = `<div class="panel mkok"><h2><span class="mkokdot">✓</span> You're approved to sell</h2>
      <div class="mknew"><button class="btn" type="button" data-mknew="used">+ Used item</button><button class="btn" type="button" data-mknew="new">+ Brand new item</button><button class="btn ghost" type="button" data-mknew="service" style="color:var(--fg)">+ Service</button>${EVENTS_ON ? `<button class="btn ghost" type="button" data-mknew="event" style="color:var(--fg)">+ Event</button>` : ""}</div>
      <p class="note">Your listings go live right away. Nojan can inspect an item in person and give it the ${certBadge(true)} badge.</p></div>`;
  const st = {live: ["Live", "live"], sold: ["Sold", "closed"], hidden: ["Hidden", "wait"], removed: ["Taken down by Nojan", "no"]};
  const mine = Array.isArray(MK.mine) ? MK.mine.slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt)) : null;
  const row = d => { const [l, c] = st[d.status] || ["", ""];
    return `<div class="hmrow">${d.thumb ? `<img src="${esc(d.thumb)}" alt="">` : `<span class="hmnoimg sm">${svgI("box")}</span>`}
      <div class="hmrowtxt"><a href="#${mkRoute(d)}"><b>${esc(d.title)}</b></a><small>${MK_KINDS[d.kind]}${d.kind === "new" || d.kind === "used" ? ` · <code class="idcode">${esc(normId(d.itemId) || fallbackId(d.id))}</code>` : ""} · ${esc(mkPrice(d))}${d.kind === "event" && d.startMs ? " · " + evDayShort(+d.startMs) : ""}</small><span class="hmst ${c}">${l}</span>${d.certified ? certBadge(true) : ""}</div>
      <div class="hmrowacts">${d.status !== "removed" ? `<button type="button" class="linkbtn" data-mkedit="${esc(d.id)}">Edit</button>` : ""}
        ${d.status === "live" ? `<button type="button" class="linkbtn" data-mkset="sold" data-id="${esc(d.id)}">${d.kind === "event" || d.kind === "service" ? "End it" : "Mark sold"}</button><button type="button" class="linkbtn" data-mkset="hidden" data-id="${esc(d.id)}">Hide</button>` : d.status === "sold" || d.status === "hidden" ? `<button type="button" class="linkbtn" data-mkset="live" data-id="${esc(d.id)}">Make live again</button>` : ""}
        <button type="button" class="linkbtn" data-mkdel="${esc(d.id)}" style="color:var(--danger)">${MK.arm === "d" + d.id ? "Click again to delete" : "Delete"}</button></div></div>`; };
  const T = (HM.threads || []).filter(t => t.marketId).sort((a, b) => tsMs(b.lastAt) - tsMs(a.lastAt));
  const trow = t => { const other = t.users.find(u => u !== USER.uid), un = hmIsUnread(t), mineL = t.owner === USER.uid;
    return `<a class="dtmrow${un ? " unread" : ""}" href="#hchat-${esc(t.id)}">${t.thumb ? `<img src="${esc(t.thumb)}" alt="">` : `<span class="dtnoimg">${esc(((t.names || {})[other] || "?").charAt(0).toUpperCase())}</span>`}
      <span class="dtmtxt"><b>${esc((t.names || {})[other] || "Someone")} · ${esc(t.homeTitle || "")}</b><small>${mineL ? "About your listing · " : ""}${t.lastText ? (t.lastFrom === USER.uid ? "You: " : "") + esc(t.lastText) : "No messages yet"}</small></span>
      <span class="dtmwhen">${tsMs(t.lastAt) ? dtWhen(tsMs(t.lastAt)) : ""}${un ? `<i class="dtdot" aria-label="Unread"></i>` : ""}</span></a>`; };
  return `<section class="pagehero lhero"><div class="phtext"><h1>Sell on Nojan</h1><p>Sell brand new and used items and offer services. Chat with buyers right here.</p></div></section>
    ${status}
    <h2 class="hmh2">Messages</h2>
    ${HM.threads === null ? `<div class="empty">Loading messages…</div>` : T.length ? `<div class="panel dtmlist">${T.map(trow).join("")}</div>` : `<div class="empty">No messages yet. When someone asks about a listing, or you message a seller, it shows up here.</div>`}
    ${ok || (mine && mine.length) ? `<h2 class="hmh2">My listings</h2>${!mine ? `<div class="empty">Loading your listings…</div>` : mine.length ? `<div class="panel hmrows">${mine.map(row).join("")}</div>` : `<div class="empty">You haven't listed anything yet.</div>`}` : ""}`;
}

/* ---- add or edit a listing ---- */
function mkStartForm(edit, kind){
  const d = edit ? {...edit} : {kind: kind || "used", city: (PROFILE && PROFILE.city) || "", format: kind === "service" ? "in-person" : "in-person", priceUnit: "hour", grade: "Good"};
  if (!edit && MK.prefill){ Object.assign(d, MK.prefill); MK.prefill = null; }
  const selfId = edit ? normId(edit.itemId) || fallbackId(edit.id) : "";
  const autoId = edit ? selfId : newItemId();
  if (edit) d.itemId = selfId; else if (!d.itemId) d.itemId = autoId;
  if (!edit && kind === "event"){ const t = new Date(Date.now() + 7 * 864e5); d.date = t.toLocaleDateString("en-CA", {timeZone: TZ}); d.start = "18:00"; d.end = "20:00"; }
  if (edit && edit.kind === "event" && edit.startMs){ const p = ms => new Date(ms).toLocaleString("en-CA", {timeZone: TZ, hour12: false, year: "numeric", month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit"}).replace(",", ""); const [ds, ts] = p(+edit.startMs).split(" "); d.date = ds; d.start = ts.slice(0, 5); d.end = p(+edit.endMs || +edit.startMs + 72e5).split(" ")[1].slice(0, 5); }
  MK.form = {selfId, autoId, id: edit ? edit.id : null, data: d, photos: [], photosLoaded: !edit || !edit.photoCount, changed: false, wasCert: !!(edit && edit.certified)};
  if (edit && edit.photoCount){ if (Array.isArray(MK.photos[edit.id])){ MK.form.photos = MK.photos[edit.id].map(data => ({data})); MK.form.photosLoaded = true; } else mkLoadPhotos(edit); }
}
function mkPhotoStrip(){
  const f = MK.form;
  if (!f.photosLoaded) return `<span class="note">Loading photos…</span>`;
  return f.photos.map((ph, i) => `<div class="dtph hmph"><img src="${esc(ph.data)}" alt="Photo ${i + 1}">${i === 0 ? `<span class="dtmainlbl">Main</span>` : `<button type="button" class="dtphmain" data-mkphmain="${i}">Make main</button>`}<button type="button" class="dtphx" data-mkphx="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`).join("")
    + (f.photos.length < 6 ? `<label class="dtphadd hmph"><input type="file" accept="image/*" multiple id="mkPhIn" hidden><span>+</span><small>Add photos</small></label>` : "");
}
async function mkAddPhotos(files){
  const f = MK.form;
  for (const file of [...files].slice(0, 6 - f.photos.length)){
    if (!/^image\//.test(file.type)) continue;
    try { const raw = await new Promise((ok, no) => { const r = new FileReader(); r.onload = () => ok(r.result); r.onerror = no; r.readAsDataURL(file); });
      f.photos.push({data: await dtShrink(raw, 1400, 0.75, 300000)}); f.changed = true; } catch (e) { toast("That photo couldn't be added. Try a JPG or PNG."); }
  }
  const s = $("#mkPhotos"); if (s) s.innerHTML = mkPhotoStrip();
}
async function mkLoadPhotos(d){
  if (!d || MK.photos[d.id] || !d.photoCount || !FB) return;
  MK.photos[d.id] = "loading"; const out = [];
  for (let i = 0; i < Math.min(6, d.photoCount); i++){ try { const x = await FB.mkGetPhoto(d.id, i); if (x) out.push(x); } catch (_) {} }
  MK.photos[d.id] = out;
  const g = $("#mkGal"); if (g && MK.viewing === d.id) g.outerHTML = mkGalleryHTML(d);
  if (current() === "sell" && MK.form && MK.form.id === d.id && !MK.form.photosLoaded){ MK.form.photos = out.map(data => ({data})); MK.form.photosLoaded = true; const s = $("#mkPhotos"); if (s) s.innerHTML = mkPhotoStrip(); }
}
function sellView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("selling", "Sign in to sell on Nojan", "");
  mkEnsureSeller();
  if (MK.me === "loading") return `<div class="empty">Loading…</div>`;
  if (!mkApproved()) return `<div class="empty">Your account needs to be approved before you can list. <a href="#selling" style="color:var(--link)">Sell on Nojan</a></div>`;
  if (!MK.form){ const e = MK.editId && mkFind(MK.editId); mkStartForm(e && e.uid === USER.uid ? e : null, MK.newKind); }
  const F = MK.form, d = F.data, k = d.kind, sel = (a, b) => a === b ? " selected" : "", isNew = !F.id;
  const word = {new: "item", used: "item", service: "service", event: "event"}[k];
  const cats = k === "event" ? EV_CATS : k === "service" ? [...new Set([...SVC_CATS, ...SERVICES.map(s => s.category)])].filter(Boolean) : TYPE_LIST;
  return `<section class="pagehero lhero"><div class="phtext"><h1>${isNew ? "New listing" : "Edit listing"}</h1><p>${isNew ? "It goes live as soon as you save." : "Changes show right away."}</p></div></section>
  <form class="panel dtform hmform" id="mkForm" novalidate>
    <div class="fsec"><h3>What are you listing?</h3><div class="fopts" role="radiogroup" aria-label="Listing type">${Object.entries(MK_KINDS).filter(([v]) => v !== "event" || EVENTS_ON || v === k).map(([v, l]) => `<label class="fopt hmradio"><input type="radio" name="kind" value="${v}"${k === v ? " checked" : ""}${isNew ? "" : " disabled"}> ${l}</label>`).join("")}</div></div>
    ${F.wasCert ? `<p class="dtnote">This listing is ${certBadge(true)}. If you change it, the badge comes off until Nojan checks it again.</p>` : ""}
    <div class="fsec"><h3>Photos <small>up to 6 · the first one is the main photo</small></h3><div class="dtphotos" id="mkPhotos">${mkPhotoStrip()}</div></div>
    ${k === "new" || k === "used" ? `<div class="idbox"><label>Nojan item ID <small>made for you automatically · items with the same ID show under one ad</small><input name="itemId" maxlength="15" autocomplete="off" spellcheck="false" value="${esc(d.itemId || "")}"></label><div class="idhint" id="mkIdHint">${idHintHTML(d.title, d.itemId, F.selfId)}</div></div>` : ""}
    <label>Title<input name="title" required maxlength="100" placeholder="${k === "event" ? "e.g. Persian music night" : k === "service" ? "e.g. Home cleaning, 3 hours" : "e.g. iPhone 13, 128 GB, blue"}" value="${esc(d.title || "")}"></label>
    <div class="dtgrid2">
      <label>Price in $ <small>${k === "event" ? "per person · 0 if free" : k === "service" ? "" : "leave empty for “Ask for price”"}</small><input name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${d.price != null ? d.price : ""}"></label>
      ${k === "service" ? `<label>Price is<select name="priceUnit">${[["hour", "per hour"], ["session", "per session"], ["day", "per day"], ["fixed", "a fixed price"]].map(([v, l]) => `<option value="${v}"${sel(v, d.priceUnit)}>${l}</option>`).join("")}</select></label>` : ""}
      <label>Category${k === "event" ? `<select name="category">${cats.map(c => `<option${sel(c, d.category)}>${esc(c)}</option>`).join("")}</select>` : `<input name="category" list="mkCats" maxlength="40" value="${esc(k === "service" ? d.category || "" : d.type || "")}" placeholder="Choose or type"><datalist id="mkCats">${cats.map(c => `<option value="${esc(c)}">`).join("")}</datalist>`}</label>
      ${k === "new" || k === "used" ? `<label>Brand <small>(optional)</small><input name="brand" maxlength="40" value="${esc(d.brand || "")}"></label>` : ""}
      ${k === "used" ? `<label>Condition<select name="grade">${GRADES.map(g => `<option${sel(g, d.grade)}>${g}</option>`).join("")}</select></label>` : ""}
      ${k === "service" || k === "event" ? `<label>${k === "event" ? "Where" : "Offered"}<select name="format"><option value="in-person"${sel("in-person", d.format)}>In person</option><option value="online"${sel("online", d.format)}>Online</option>${k === "service" ? `<option value="both"${sel("both", d.format)}>Online or in person</option>` : ""}</select></label>` : ""}
      ${k === "event" ? `<label>Date<input name="date" type="date" required value="${esc(d.date || "")}"></label><label>Starts<input name="start" type="time" required value="${esc(d.start || "")}"></label><label>Ends<input name="end" type="time" value="${esc(d.end || "")}"></label><label>Venue <small>(name or address)</small><input name="venue" maxlength="100" value="${esc(d.venue || "")}"></label>` : ""}
      <label>City<input name="city" required maxlength="40" placeholder="e.g. Richmond Hill" value="${esc(d.city || "")}"></label>
    </div>
    <label>Description<textarea name="description" rows="6" maxlength="3000" placeholder="${k === "event" ? "What happens, who it's for, what to bring" : k === "service" ? "What you offer, your experience, the area you cover" : "Details, size, what's included, any wear or damage"}">${esc(d.description || "")}</textarea></label>
    <label class="dtcheck"><input type="checkbox" name="ok"${F.id ? " checked" : ""}> This ${word} is real, I'm allowed to ${k === "event" ? "host and list it" : k === "service" ? "offer it" : "sell it"}, and the photos are my own.</label>
    <p class="formerr" id="mkErr" hidden></p>
    <div class="dtformfoot"><button class="btn" type="submit">${isNew ? "Publish" : "Save changes"}</button><a class="linkbtn" href="#selling">Cancel</a></div>
  </form>`;
}
function mkKeepForm(){ const f = $("#mkForm"); if (!f || !MK.form) return; const fd = new FormData(f); fd.forEach((v, k) => { if (k !== "ok" && k !== "kind") MK.form.data[k] = v; }); if (MK.form.data.category && MK.form.data.kind !== "service" && MK.form.data.kind !== "event") MK.form.data.type = MK.form.data.category; }
async function mkSave(form){
  const fd = new FormData(form), g = k => String(fd.get(k) || "").trim(), err = $("#mkErr"), F = MK.form, k = F.data.kind;
  const say = t => { if (err){ err.textContent = t; err.hidden = false; err.scrollIntoView({block: "center", behavior: "smooth"}); } };
  if (!g("title")) return say("Please add a title.");
  const pr = g("price") === "" ? null : Math.round(+g("price") * 100) / 100;
  if (pr != null && !(pr >= 0)) return say("Please enter a valid price.");
  if (!g("city")) return say("Please enter the city.");
  let startMs = null, endMs = null;
  if (k === "event"){
    if (!g("date") || !g("start")) return say("Please choose the date and start time.");
    startMs = torontoMs(g("date"), g("start")); endMs = g("end") ? torontoMs(g("date"), g("end")) : startMs + 72e5; if (endMs <= startMs) endMs += 864e5;
    if (endMs < Date.now()) return say("That date has already passed.");
  }
  if ((k === "new" || k === "used") && !F.photos.length) return say("Please add at least one photo of the item.");
  if (!fd.get("ok")) return say("Please confirm the listing is real.");
  if (!F.photosLoaded) return say("Your photos are still loading. Try again in a moment.");
  let itemId = "";
  if (k === "new" || k === "used"){
    itemId = normId(g("itemId")) || F.autoId || newItemId();
    if (!ID_RE.test(itemId)) return say("That item ID doesn't look right. It should look like NJ-7K3QXM.");
    if (itemId !== F.autoId && itemId !== F.selfId && !knownIds().has(itemId)) return say(`No item on Nojan has the ID ${itemId}. Check it, or clear the box to get a new ID.`);
  }
  if (MK.busy) return; MK.busy = true;
  const btn = form.querySelector('button[type="submit"]'), label = btn.textContent; btn.disabled = true; btn.textContent = "Saving…";
  try {
    const isNew = !F.id, id = F.id || FB.mkNewId(), ph = F.photos;
    const thumb = ph.length ? await dtShrink(ph[0].data, 520, 0.7, 60000) : "";
    const cat = g("category").slice(0, 40);
    const data = {uid: USER.uid, ...(itemId ? {itemId} : {}), ownerName: mkFirst().slice(0, 40), kind: k, title: g("title").slice(0, 100), description: g("description").slice(0, 3000), price: pr, city: dtCity(g("city")).slice(0, 40), thumb, photoCount: ph.length,
      brand: k === "new" || k === "used" ? g("brand").slice(0, 40) : "", type: k === "new" || k === "used" ? cat : "", grade: k === "used" ? g("grade") : "",
      category: k === "service" || k === "event" ? cat || "Other" : "", priceUnit: k === "service" ? g("priceUnit") || "hour" : "", format: k === "service" || k === "event" ? g("format") || "in-person" : "",
      startMs, endMs, venue: k === "event" ? g("venue").slice(0, 100) : "", certified: false};
    if (isNew) data.status = "live";
    await FB.mkSave(id, data, isNew);
    if (isNew || F.changed){
      for (let i = 0; i < ph.length; i++) await FB.mkSavePhoto(id, i, ph[i].data, USER.uid);
      for (let i = ph.length; i < 6; i++) await FB.mkDelPhoto(id, i).catch(() => {});
      MK.photos[id] = ph.map(p => p.data);
    }
    MK.form = null; MK.editId = null; MK.busy = false; MK.mine = null;
    toast(isNew ? (itemId ? `Published · item ID ${itemId}` : "Published. It's live now.") : "Saved"); go("selling");
  } catch (e) {
    console.error(e); MK.busy = false; btn.disabled = false; btn.textContent = label;
    say(e && e.code === "permission-denied" ? "Your listing couldn't be saved. Your selling account may not be approved yet." : "Your listing couldn't be saved. Check your connection and try again.");
  }
}

/* ---- the page for one member listing (items, services and events) ---- */
function mkGalleryHTML(d){
  const ph = Array.isArray(MK.photos[d.id]) && MK.photos[d.id].length ? MK.photos[d.id] : d.thumb ? [d.thumb] : [];
  const i = Math.min(MK.gi, Math.max(0, ph.length - 1));
  if (!ph.length) return `<div class="hmgal" id="mkGal"><div class="hmgmain hmnoimg">${d.kind === "event" ? evIcon(d.category) : svgI("box")}</div></div>`;
  return `<div class="hmgal mkgal" id="mkGal"><div class="hmgmain"><img src="${esc(ph[i])}" alt="Photo ${i + 1} of ${ph.length}">${ph.length > 1 ? `<button type="button" class="hmgnav prev" data-mkg="${(i - 1 + ph.length) % ph.length}" aria-label="Previous photo">‹</button><button type="button" class="hmgnav next" data-mkg="${(i + 1) % ph.length}" aria-label="Next photo">›</button><span class="hmgcount">${i + 1} / ${ph.length}</span>` : ""}</div>
    ${ph.length > 1 ? `<div class="dtthumbs">${ph.map((u, k) => `<button type="button" data-mkg="${k}" aria-label="Photo ${k + 1}" aria-pressed="${k === i}"><img src="${esc(u)}" alt=""></button>`).join("")}</div>` : ""}</div>`;
}
function mkDetailView(id){
  const d = mkFind(id);
  if (!d){
    if (FB && MK.extra[id] === undefined){ MK.extra[id] = null; FB.mkGet(id).then(x => { MK.extra[id] = x || false; render(); }).catch(() => { MK.extra[id] = false; render(); }); }
    return MK.extra[id] === false || (!FB && fbFailed) ? `<div class="empty">This listing isn't available anymore. It may have sold. <a href="#home" style="color:var(--link)">Back to the home page</a></div>` : `<div class="empty">Loading…</div>`;
  }
  if (MK.viewing !== d.id){ MK.viewing = d.id; MK.gi = 0; }
  mkLoadPhotos(d);
  const own = USER && d.uid === USER.uid, k = d.kind;
  const listed = tsMs(d.createdAt) ? new Date(tsMs(d.createdAt)).toLocaleDateString("en-CA", {month: "short", day: "numeric", year: "numeric"}) : "";
  const facts = (k === "event" ? [["When", d.startMs ? evDayLong(+d.startMs) + " · " + evTime(+d.startMs) + (d.endMs ? " – " + evTime(+d.endMs) : "") : ""], ["Where", d.format === "online" ? "Online" : [d.venue, d.city].filter(Boolean).join(", ")], ["Category", d.category], ["Price", mkPrice(d)]]
    : k === "service" ? [["Category", d.category], ["Offered", d.format === "both" ? "Online or in person" : d.format === "online" ? "Online" : "In person"], ["Area", d.city], ["Price", mkPrice(d)]]
    : [["Condition", k === "new" ? "Brand new" : "Used" + (d.grade ? " · " + d.grade : "")], ["Brand", d.brand], ["Category", d.type], ["Location", d.city], ["Nojan item ID", idOf(mkToItem(d))]]).concat([["Listed", listed]]).filter(x => x[1]);
  const status = own && d.status !== "live" ? `<div class="dtnote">${d.status === "sold" ? "You marked this as sold, so only you can see it." : d.status === "hidden" ? "This listing is hidden. Only you can see it." : "Nojan took this listing down."}</div>` : !own && d.status !== "live" ? `<div class="dtnote">This listing is no longer available.</div>` : "";
  const back = k === "event" ? "#events" : k === "service" ? "#services" : k === "used" ? "#used-items" : "#new-items";
  return `<article class="hmpage mkpage">
    ${mkGalleryHTML(d)}
    <div class="hmlayout">
      <div class="hmmain">
        ${status}
        <div class="mktags"><span class="hmdeal inline mk${k}">${k === "used" ? "Used" + (d.grade ? " · " + esc(d.grade) : "") : k === "new" ? "Brand new" : MK_KINDS[k]}</span>${d.certified ? certBadge(false) : ""}</div>
        <h1 class="hmtitle mkh1">${esc(d.title)}</h1>
        ${k === "new" || k === "used" ? `<p class="soldby">Sold by <b>${esc(d.ownerName || "a member")}</b> · Nojan member${d.certified ? "" : ` <span class="uncert">Not certified yet</span>`}</p>` : ""}
        <p class="hmbig mkprice">${esc(mkPrice(d))}</p>
        ${k === "new" || k === "used" ? itemIdLine(mkToItem(d)) : ""}
        ${k === "event" && d.startMs ? `<p class="hmaddr big">${svgI("calendar")}${evDayLong(+d.startMs)} · ${evTime(+d.startMs)}</p>` : ""}
        <p class="hmaddr big">${HM_PIN}${esc(k === "event" && d.format === "online" ? "Online" : [k === "event" ? d.venue : "", d.city].filter(Boolean).join(", ") || "Location on request")}</p>
        ${d.certified ? `<div class="certnote">${CERT_SVG}<span><b>Certified by Nojan</b><small>Nojan checked this ${k === "event" ? "event" : k === "service" ? "service" : "item"} in person and confirmed it's as described.</small></span></div>` : ""}
        ${d.description ? `<section class="dtsect"><h2>About this ${k === "event" ? "event" : k === "service" ? "service" : "item"}</h2><div class="itemdesc">${descHTML(d.description)}</div></section>` : ""}
        <section class="dtsect"><h2>Details</h2><dl class="dtfacts">${facts.map(([a, b]) => `<div><dt>${a}</dt><dd>${esc(String(b))}</dd></div>`).join("")}</dl></section>
        ${k === "new" || k === "used" ? offersHTML(mkToItem(d)) : ""}
        <div class="hmacts"><button type="button" class="btn ghost" data-mkshare>Share</button><a class="btn ghost" href="${back}" style="color:var(--fg)">See more</a></div>
      </div>
      <aside class="hmside">${mkContactHTML(d)}</aside>
    </div></article>`;
}
function mkContactHTML(d){
  const own = USER && d.uid === USER.uid, who = d.kind === "event" ? "organizer" : d.kind === "service" ? "provider" : "seller";
  if (own) return `<div class="hmcontact"><h2>Your listing</h2><p class="note">Messages about it show up on Sell on Nojan.</p><button class="btn" type="button" data-mkedit="${esc(d.id)}">Edit listing</button><a class="btn ghost" href="#selling" style="color:var(--fg)">Sell on Nojan</a></div>`;
  return `<div class="hmcontact"><h2>${d.kind === "event" ? "Hosted by" : d.kind === "service" ? "Offered by" : "Sold by"} ${esc(d.ownerName || "a member")}</h2>
    <p class="note mkmember">Nojan member${d.certified ? " · " + certBadge(true) : ""}</p>
    ${!USER ? `<p class="note">Sign in to message the ${who}. Your email and phone stay private.</p>${googleBtn("account")}<div style="display:grid;gap:8px"><button class="btn" type="button" data-auth="signin" data-next="account">Sign in with email</button><button class="btn ghost" type="button" data-auth="signup" data-next="account" style="color:var(--fg)">Create account</button></div>`
      : !USER.emailVerified ? `<p class="note">Confirm your email address first, then you can send a message.</p><button class="btn small" type="button" data-recheck>I've confirmed it</button>`
      : d.status !== "live" ? `<p class="note">This listing isn't open for messages.</p>`
      : `<form id="mkContact" class="hmcform"><textarea id="mkCText" rows="4" maxlength="2000" required>${d.kind === "event" ? `Hi ${esc(d.ownerName || "")}, are there still spots for this event?` : d.kind === "service" ? `Hi ${esc(d.ownerName || "")}, are you available for this? I'd like to know more.` : `Hi ${esc(d.ownerName || "")}, is this still available?`}</textarea><button class="btn" type="submit">Send message</button></form><p class="note">Replies show up on <a href="#selling">Sell on Nojan</a> → Messages.</p>`}
    <div class="hmsafe"><b>Stay safe:</b> meet in a public place, check the ${d.kind === "event" ? "details" : d.kind === "service" ? "work" : "item"} before you pay, and never pay by gift card or wire transfer. Nojan isn't part of the payment for member listings${d.certified ? "" : " and hasn't checked this one"}.</div>
    <button type="button" class="linkbtn" data-mkreport="${esc(d.id)}" style="color:#6e6e73;margin-top:8px">Report this listing</button></div>`;
}

/* ---- admin: seller applications and member listings ---- */
function mkAdmLoad(){   // v81: live lists (same way the Orders tab loads), so they can't hang
  if (MK.admUnsub) MK.admUnsub.forEach(u => { try { u(); } catch (_) {} });
  MK.adm = {sellers: null, list: null, reports: [], err: ""};
  const fail = what => e => { console.error(what, e); MK.adm.err = what + ": " + (e && (e.code || e.message) || "error"); if (MK.adm.sellers === null) MK.adm.sellers = []; if (MK.adm.list === null) MK.adm.list = []; refreshAdmin(true); };
  MK.admUnsub = [
    FB.mkWatchSellers(l => { MK.adm.sellers = l; refreshAdmin(true); }, fail("applications")),
    FB.mkWatchAll(l => { MK.adm.list = l; refreshAdmin(true); }, fail("listings"))
  ];
  FB.dtReports().then(r => { MK.adm.reports = r.filter(x => String(x.about).startsWith("market:")); refreshAdmin(true); }).catch(() => {});
}
function membersAdminHTML(){
  if (!MK.adm) mkAdmLoad();
  const A = MK.adm;
  if (A.sellers === null && A.list === null) return `<div class="empty">Loading sellers…</div>`;
  const S = (A.sellers || []).slice().sort((a, b) => (a.status === "pending" ? 0 : 1) - (b.status === "pending" ? 0 : 1) || tsMs(b.appliedAt) - tsMs(a.appliedAt));
  const srow = s => `<tr><td><b>${esc(s.name || "")}</b><br><small>${esc(s.email || "")}${s.phone ? " · " + esc(s.phone) : ""}</small></td><td>${esc(s.address || "")}</td><td>${ageOf(s.dob) != null ? ageOf(s.dob) : "?"}</td><td>${tsMs(s.appliedAt) ? new Date(tsMs(s.appliedAt)).toLocaleDateString("en-CA") : ""}</td><td><span class="hmst ${s.status === "approved" ? "live" : s.status === "pending" ? "wait" : "no"}">${esc(s.status)}</span></td>
    <td style="white-space:nowrap">${s.status !== "approved" ? `<button class="linkbtn" type="button" data-mkseller="approved" data-id="${esc(s.id)}">Approve</button> ` : ""}${s.status === "pending" ? `<button class="linkbtn" type="button" data-mkseller="rejected" data-id="${esc(s.id)}">Reject</button>` : s.status === "approved" ? `<button class="linkbtn" type="button" data-mkseller="suspended" data-id="${esc(s.id)}">Pause selling</button>` : ""}</td></tr>`;
  const L = (A.list || []).slice().sort((a, b) => tsMs(b.updatedAt) - tsMs(a.updatedAt));
  const lrow = d => `<tr><td>${d.thumb ? `<img src="${esc(d.thumb)}" alt="" style="width:56px;height:42px;object-fit:cover;border-radius:8px">` : ""}</td><td><a href="#${mkRoute(d)}">${esc(d.title)}</a><br><small>${MK_KINDS[d.kind]} · ${esc(d.city || "")}</small></td><td>${esc(mkPrice(d))}</td><td>${esc(d.ownerName || "")}</td><td>${esc(d.status)}</td>
    <td>${d.certified ? certBadge(true) : ""}</td>
    <td style="white-space:nowrap"><button class="linkbtn" type="button" data-mkcert="${d.certified ? "0" : "1"}" data-id="${esc(d.id)}">${d.certified ? "Remove badge" : "Certify ✓"}</button> ${d.status === "removed" ? `<button class="linkbtn" type="button" data-mkadmset="live" data-id="${esc(d.id)}">Put back</button>` : `<button class="linkbtn" type="button" data-mkadmset="removed" data-id="${esc(d.id)}">Take down</button>`} <button class="linkbtn" type="button" data-mkadmdel="${esc(d.id)}" style="color:var(--danger)">${MK.arm === "a" + d.id ? "Click again" : "Delete"}</button></td></tr>`;
  const pend = S.filter(s => s.status === "pending").length;
  return `${A.err ? `<p class="formerr">Couldn't load everything (${esc(A.err)}). Try Refresh. If it keeps happening, sign out and sign in again with the admin account.</p>` : ""}
    <div class="admintools"><span class="note">${pend} application${pend === 1 ? "" : "s"} waiting · ${S.filter(s => s.status === "approved").length} approved sellers · ${L.filter(d => d.status === "live").length} live listings</span><button class="btn small ghost" type="button" data-mkadmreload>Refresh</button></div>
    <h2 class="hmh2">Seller applications</h2>
    ${A.sellers === null ? `<div class="empty">Loading applications…</div>` : S.length ? `<div class="tablewrap"><table class="ctable"><thead><tr><th>Member</th><th>Address</th><th>Age</th><th>Applied</th><th>Status</th><th></th></tr></thead><tbody>${S.map(srow).join("")}</tbody></table></div>` : `<div class="empty">No applications yet.</div>`}
    <h2 class="hmh2">Member listings</h2>
    <p class="note">Click <b>Certify ✓</b> after you've checked an item, service or event in person. The ${certBadge(true)} badge then shows on its card and page. If the member edits it, the badge comes off.</p>
    ${A.list === null ? `<div class="empty">Loading listings…</div>` : L.length ? `<div class="tablewrap"><table class="ctable"><thead><tr><th></th><th>Listing</th><th>Price</th><th>By</th><th>Status</th><th>Badge</th><th></th></tr></thead><tbody>${L.map(lrow).join("")}</tbody></table></div>` : `<div class="empty">No member listings yet.</div>`}
    ${A.reports.length ? `<h2 class="hmh2">Reports</h2><div class="panel">${A.reports.map(r => `<p><a href="#item-m-${esc(String(r.about).slice(7))}">${esc(String(r.about).slice(7))}</a> · ${esc(r.reason || "")} ${r.text ? "· " + esc(r.text) : ""} <button class="linkbtn" type="button" data-mkrepdis="${esc(r.id)}">Dismiss</button></p>`).join("")}</div>` : ""}`;
}

/* ---- address search for "Your details" (OpenStreetMap, free) ---- */
const ADDR = {t: null, list: [], i: -1, seq: 0};
const PROVS = [["AB", "Alberta"], ["BC", "British Columbia"], ["MB", "Manitoba"], ["NB", "New Brunswick"], ["NL", "Newfoundland and Labrador"], ["NS", "Nova Scotia"], ["NT", "Northwest Territories"], ["NU", "Nunavut"], ["ON", "Ontario"], ["PE", "Prince Edward Island"], ["QC", "Quebec"], ["SK", "Saskatchewan"], ["YT", "Yukon"]];
const provCode = n => { n = String(n || "").trim().toLowerCase(); const x = PROVS.find(([c, m]) => c.toLowerCase() === n || m.toLowerCase() === n || (n === "québec" && c === "QC")); return x ? x[0] : ""; };
const fmtPostal = p => { const x = String(p || "").toUpperCase().replace(/\s+/g, ""); return /^[A-Z]\d[A-Z]\d[A-Z]\d$/.test(x) ? x.slice(0, 3) + " " + x.slice(3) : String(p || "").toUpperCase(); };
function addrLabel(p){
  const street = [p.housenumber, p.street].filter(Boolean).join(" ");
  const first = street || p.name || "";
  return [first, p.city || p.town || p.village || p.district || (first !== p.name ? p.name : ""), p.state, p.postcode].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(", ");
}
async function addrSearch(q){
  const seq = ++ADDR.seq, box = $("#addrList"), inp = $("#addrIn"); if (!box || !inp) return;
  if (q.length < 3){ box.hidden = true; inp.setAttribute("aria-expanded", "false"); return; }
  try {
    const r = await fetch("https://photon.komoot.io/api/?limit=8&lang=en&lat=43.88&lon=-79.44&layer=house&layer=street&q=" + encodeURIComponent(q));
    const j = await r.json(); if (seq !== ADDR.seq) return;
    ADDR.list = (j.features || []).filter(f => (f.properties || {}).countrycode === "CA").map(f => { const p = f.properties; return {label: addrLabel(p), street: [p.housenumber, p.street].filter(Boolean).join(" ") || (p.street ? p.street : p.name || ""), city: p.city || p.town || p.village || p.district || "", state: p.state || "", postal: p.postcode || "", lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0]}; }).filter(x => x.label);
    ADDR.i = -1;
    box.innerHTML = ADDR.list.length ? ADDR.list.map((a, i) => `<li role="option" id="addrOpt${i}" data-addr="${i}" aria-selected="false">${HM_PIN}<span>${esc(a.label)}</span></li>`).join("") + `<li class="addrsrc" aria-hidden="true">Search by OpenStreetMap</li>` : `<li class="addrnone">No matches yet. Keep typing, or add the city.</li>`;
    box.hidden = false; inp.setAttribute("aria-expanded", "true");
  } catch (e) { if (seq === ADDR.seq){ box.hidden = true; inp.setAttribute("aria-expanded", "false"); } }
}
function addrPick(i){
  const a = ADDR.list[i], f = $("#profileForm"); if (!a || !f) return;
  f.street.value = a.street || a.label.split(",")[0]; f.lat.value = a.lat; f.lng.value = a.lng;
  f.city.value = a.city || ""; f.postal.value = fmtPostal(a.postal || ""); const pc = provCode(a.state); if (pc) f.province.value = pc;
  [f.city, f.province, f.postal].forEach(x => { x.classList.remove("filled"); void x.offsetWidth; x.classList.add("filled"); });
  if (!a.postal) f.postal.focus(); else f.unit.focus();
  const box = $("#addrList"); box.hidden = true; $("#addrIn").setAttribute("aria-expanded", "false");
}
document.addEventListener("input", e => {
  const t = e.target;
  if (t.id === "addrIn"){ const f = $("#profileForm"); if (f){ f.lat.value = ""; f.lng.value = ""; } clearTimeout(ADDR.t); ADDR.t = setTimeout(() => addrSearch(t.value.trim()), 280); return; }
  if (t.name === "dob" && t.closest("#profileForm")){ const a = ageOf(t.value), o = $("#ageOut"); if (o) o.textContent = a != null ? "Age " + a : ""; }
});
document.addEventListener("keydown", e => {
  if (e.target.id !== "addrIn") return;
  const box = $("#addrList"); if (!box || box.hidden || !ADDR.list.length) return;
  if (e.key === "ArrowDown" || e.key === "ArrowUp"){ e.preventDefault(); ADDR.i = (ADDR.i + (e.key === "ArrowDown" ? 1 : -1) + ADDR.list.length) % ADDR.list.length;
    box.querySelectorAll("[data-addr]").forEach((li, i) => li.setAttribute("aria-selected", i === ADDR.i)); e.target.setAttribute("aria-activedescendant", "addrOpt" + ADDR.i); }
  else if (e.key === "Enter" && ADDR.i >= 0){ e.preventDefault(); addrPick(ADDR.i); }
  else if (e.key === "Escape"){ box.hidden = true; e.target.setAttribute("aria-expanded", "false"); }
});
document.addEventListener("mousedown", e => { const li = e.target.closest("[data-addr]"); if (li){ e.preventDefault(); addrPick(+li.dataset.addr); return; } const box = $("#addrList"); if (box && !box.hidden && !e.target.closest(".addrwrap")) box.hidden = true; });

/* ---- clicks, inputs and forms ---- */
document.addEventListener("click", async ev => {
  const b = ev.target.closest("button"); if (!b) return;
  if (b.hasAttribute("data-mkapply")){
    const pr = PROFILE || {}; b.disabled = true; b.textContent = "Sending…";
    try { const data = {uid: USER.uid, status: "pending", name: pr.name || "", email: USER.email || "", phone: pr.phone || "", address: pr.address || "", city: pr.city || "", dob: pr.dob || "", note: ""};
      await FB.mkApply(USER.uid, data, !MK.me); MK.me = {...data, id: USER.uid}; toast("Application sent"); render(); }
    catch (e) { console.error(e); b.disabled = false; b.textContent = "Send application"; toast(e && e.code === "permission-denied" ? "Selling isn't switched on yet. Please try again later." : "That didn't go through. Please try again."); }
    return;
  }
  if (b.dataset.mknew){ MK.newKind = b.dataset.mknew; MK.editId = null; MK.form = null; go("sell"); return; }
  if (b.dataset.mklike){ const p = PRODUCTS.find(x => x.id === b.dataset.mklike); if (!p) return;
    MK.prefill = {itemId: idOf(p), title: p.name, brand: p.brand || "", type: p.type || "", category: p.type || ""}; MK.newKind = p.condition === "new" ? "new" : "used"; MK.editId = null; MK.form = null; go("sell"); return; }
  if (b.hasAttribute("data-gooffers")){ const o = $("#offers"); if (o) o.scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if (b.dataset.copyid){ try { await navigator.clipboard.writeText(b.dataset.copyid); toast("Item ID copied"); } catch (_) { toast(b.dataset.copyid); } return; }
  if (b.dataset.useid || b.hasAttribute("data-newid")){ const f = b.closest("form"), inp = f && f.querySelector('[name="itemId"]'); if (!inp) return;
    inp.value = b.dataset.useid || (f.id === "mkForm" && MK.form && !MK.form.id ? MK.form.autoId : f.id === "mkForm" ? newItemId() : ""); idHintRefresh(f); return; }
  if (b.dataset.mkedit){ MK.editId = b.dataset.mkedit; MK.form = null; go("sell"); return; }
  if (b.dataset.mkphx != null){ MK.form.photos.splice(+b.dataset.mkphx, 1); MK.form.changed = true; $("#mkPhotos").innerHTML = mkPhotoStrip(); return; }
  if (b.dataset.mkphmain != null){ const [x] = MK.form.photos.splice(+b.dataset.mkphmain, 1); MK.form.photos.unshift(x); MK.form.changed = true; $("#mkPhotos").innerHTML = mkPhotoStrip(); return; }
  if (b.dataset.mkg != null){ MK.gi = +b.dataset.mkg; const d = mkFind(MK.viewing), g = $("#mkGal"); if (d && g) g.outerHTML = mkGalleryHTML(d); return; }
  if (b.hasAttribute("data-mkshare")){ const url = location.href; try { if (navigator.share){ await navigator.share({url}); return; } await navigator.clipboard.writeText(url); toast("Link copied"); } catch (_) {} return; }
  if (b.dataset.mkreport){ dtReportForm("market:" + b.dataset.mkreport); return; }
  if (b.dataset.mkset){
    try { await FB.mkSetStatus(b.dataset.id, b.dataset.mkset); MK.mine = null; toast(b.dataset.mkset === "live" ? "It's live again" : b.dataset.mkset === "sold" ? "Marked as done" : "Hidden"); render(); }
    catch (e) { console.error(e); toast("That didn't go through. Please try again."); } return;
  }
  if (b.dataset.mkdel){
    const id = b.dataset.mkdel; if (MK.arm !== "d" + id){ MK.arm = "d" + id; render(); return; }
    MK.arm = ""; try { await FB.mkDelete(id); MK.mine = null; toast("Listing deleted"); render(); } catch (e) { console.error(e); toast("Couldn't delete it."); } return;
  }
  if (b.hasAttribute("data-mkadmreload")){ MK.adm = null; refreshAdmin(true); return; }
  if (b.dataset.mkseller){
    const id = b.dataset.id, s = b.dataset.mkseller, note = "";
    try { await FB.mkSetSeller(id, s, note); const x = MK.adm.sellers.find(y => y.id === id); if (x) x.status = s; toast(s === "approved" ? "Approved. They can sell now." : s === "rejected" ? "Application rejected" : "Selling paused"); refreshAdmin(); }
    catch (e) { console.error(e); toast("Couldn't update it. Check the database rules."); } return;
  }
  if (b.dataset.mkcert){
    const id = b.dataset.id, on = b.dataset.mkcert === "1";
    try { await FB.mkAdmin(id, {certified: on, certifiedAt: on ? Date.now() : null}); const x = MK.adm.list.find(y => y.id === id); if (x) x.certified = on; toast(on ? "Certified ✓" : "Badge removed"); refreshAdmin(); }
    catch (e) { console.error(e); toast("Couldn't update it."); } return;
  }
  if (b.dataset.mkadmset){
    const id = b.dataset.id, s = b.dataset.mkadmset;
    try { await FB.mkAdmin(id, {status: s}); const x = MK.adm.list.find(y => y.id === id); if (x) x.status = s; toast(s === "removed" ? "Taken down" : "It's live again"); refreshAdmin(); }
    catch (e) { console.error(e); toast("Couldn't update it."); } return;
  }
  if (b.dataset.mkadmdel){
    const id = b.dataset.mkadmdel; if (MK.arm !== "a" + id){ MK.arm = "a" + id; refreshAdmin(); return; }
    MK.arm = ""; try { await FB.mkDelete(id); MK.adm.list = MK.adm.list.filter(x => x.id !== id); toast("Listing deleted"); refreshAdmin(); } catch (e) { console.error(e); toast("Couldn't delete it."); } return;
  }
  if (b.dataset.mkrepdis){ try { await FB.dtDelReport(b.dataset.mkrepdis); MK.adm.reports = MK.adm.reports.filter(r => r.id !== b.dataset.mkrepdis); refreshAdmin(); } catch (e) { toast("Couldn't dismiss it."); } }
});
function idHintRefresh(f){
  const box = f && f.querySelector(".idhint"), inp = f && f.querySelector('[name="itemId"]'); if (!box || !inp) return;
  const self = f.id === "mkForm" ? (MK.form && MK.form.selfId) || "" : (PADM.edit && PADM.edit !== "new" ? (r => r ? normId(r.itemId) || fallbackId(r.id) : "")(rawProduct(PADM.edit)) : "");
  box.innerHTML = idHintHTML((f.querySelector('[name="title"]') || {}).value, inp.value, self);
}
let idHintT = null;
document.addEventListener("input", e => { const t = e.target, f = t.closest && t.closest("#mkForm, #productForm");
  if (f && (t.name === "title" || t.name === "itemId")){ clearTimeout(idHintT); idHintT = setTimeout(() => idHintRefresh(f), 250); } });
document.addEventListener("change", e => {
  const t = e.target;
  if (t.id === "mkPhIn"){ mkAddPhotos(t.files); return; }
  if (t.name === "kind" && t.closest("#mkForm") && MK.form && !MK.form.id){ mkKeepForm(); MK.form.data.kind = t.value; MK.newKind = t.value; render(); }
});
document.addEventListener("submit", async ev => {
  const f = ev.target;
  if (f.id === "mkForm"){ ev.preventDefault(); mkSave(f); return; }
  if (f.id === "mkContact"){
    ev.preventDefault(); const text = $("#mkCText").value.trim(); if (!text) return;
    const d = mkFind(MK.viewing); if (!d) return;
    const btn = f.querySelector("button"); btn.disabled = true; btn.textContent = "Sending…";
    try { const id = await FB.mkOpenThread(d, USER.uid, mkFirst()); await FB.hmSend(id, USER.uid, text); toast("Message sent"); go("hchat", id); }
    catch (e) { console.error(e); btn.disabled = false; btn.textContent = "Send message"; toast("Your message wasn't sent. Please try again."); }
  }
});

/* ---- My orders ---- */
function startMyOrders(){
  if (!FB || !USER || MY.unsub) return;
  MY.unsub = () => {};
  MY.unsub = FB.watchMyOrders(USER.uid, list => { MY.orders = list.sort((a,b)=>tsNum(b.createdAt)-tsNum(a.createdAt)); if (current() === "orders") setTimeout(render); }, err => { console.error(err); MY.orders = MY.orders || []; if (current() === "orders") setTimeout(render); });
}
function orderItemsHTML(o){
  return `<ul class="oitems">${(o.items||[]).map(it=>`<li><span>${it.qty} × ${esc(it.name)} <span class="tag ${it.condition}" style="margin-left:4px">${it.condition==="new"?"New":"Used"}</span></span><span>${itemPrice(it)}</span></li>`).join("")}</ul>
    ${o.tax ? `<div class="sum"><span>HST (estimate)</span><span>${money(o.tax)}</span></div>` : ""}
    <div class="sum total"><span>Total</span><span>${money(o.total||0)}</span></div>`;
}
function myOrdersView(){
  if (!USER) return needSignIn("orders", "Sign in to see your orders and bookings", "Your orders, bookings and their status show here after you sign in.");
  startMyOrders(); startMyBookings();
  return `<div class="sectionhead"><h1>My orders &amp; bookings</h1></div>
    <h2 style="margin:6px 0 12px">Event tickets</h2>${myTicketsHTML()}
    <h2 style="margin:26px 0 12px">Bookings</h2>${myBookingsHTML()}
    <h2 style="margin:26px 0 12px">Orders</h2>${myOrdersList()}`;
}
function myOrdersList(){
  if (!MY.orders) return `<div class="empty">Loading your orders…</div>`;
  if (!MY.orders.length) return `<div class="empty">You haven't placed any orders yet. <a href="#home" style="color:var(--link)">Start shopping</a></div>`;
  return `<div class="ordlist">${MY.orders.map((o,i)=>`
    <details class="ord"${i===0?" open":""}>
      <summary><span class="onum">Order #${o.number}</span><span class="oright">${pill(o.status)}<b>${money(o.total||0)}</b></span><span class="ometa">${fmtDate(o.createdAt)} · ${(o.items||[]).reduce((a,x)=>a+x.qty,0)} item(s)</span></summary>
      <div class="obody">
        <p class="note" style="color:var(--fg)">${esc(STATUS_TEXT[o.status] || "")}</p>
        ${orderItemsHTML(o)}
        ${o.status === "New" ? `<button class="linkbtn" type="button" data-cancel="${o.id}" style="justify-self:start;color:var(--danger)">Cancel this order</button>` : ""}
      </div>
    </details>`).join("")}</div>`;
}

/* ---- Admin ---- */
function startAdmin(){
  if (!FB || !isAdmin() || ADM.unsubO) return;
  ADM.unsubO = ADM.unsubU = () => {};
  ADM.unsubO = FB.watchAllOrders(list => { ADM.orders = list; refreshAdmin(); }, err => { console.error(err); ADM.error = err.code || String(err); refreshAdmin(true); });
  ADM.unsubU = FB.watchUsers(list => { ADM.users = list; refreshAdmin(); }, err => console.error(err));
  ADM.unsubB = FB.watchAllBookings(list => { ADM.bookings = list; refreshAdmin(); autoRemind(); }, err => console.error(err));
}
function refreshAdmin(force){
  if (current() !== "admin") return;
  const a = document.activeElement, box = $("#adminBody");
  if (!force && box && a && box.contains(a) && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName) && a.id !== "admQ"){ ADM.pending = true; const nb = $("#admNew"); if (nb) nb.hidden = false; return; }
  ADM.pending = false;
  if (box) box.innerHTML = adminBody(); else setTimeout(render);
}
function adminView(){
  if (!USER) return needSignIn("admin", "Admin sign-in", "Sign in with the shop's admin account to manage orders.");
  if (!isAdmin()) return `<div class="empty">This page is for the shop's admins only.${USER && !USER.emailVerified ? " If you're an admin, confirm your email address first, then sign in again." : ""}</div>`;
  startAdmin();
  return `<div class="sectionhead"><h1>Admin</h1><p>Orders update live as customers place them.</p></div>
    <div class="admintabs" role="group" aria-label="Admin sections"><button type="button" data-atab="inventory" aria-pressed="${ADM.tab==="inventory"}">Inventory</button><button type="button" data-atab="orders" aria-pressed="${ADM.tab==="orders"}">Orders</button><button type="button" data-atab="bookings" aria-pressed="${ADM.tab==="bookings"}">Bookings${ADM.bookings ? ` (${ADM.bookings.filter(b => b.status === "Requested" && b.kind !== "event").length} new)` : ""}</button><button type="button" data-atab="events" aria-pressed="${ADM.tab==="events"}">Events</button><button type="button" data-atab="dating" aria-pressed="${ADM.tab==="dating"}">Dating</button><button type="button" data-atab="homes" aria-pressed="${ADM.tab==="homes"}">Homes${HM.adm && HM.adm.list ? ` (${HM.adm.list.filter(h => h.status === "pending").length} new)` : ""}</button><button type="button" data-atab="members" aria-pressed="${ADM.tab==="members"}">Sellers${MK.adm && MK.adm.sellers ? ` (${MK.adm.sellers.filter(x => x.status === "pending").length} new)` : ""}</button><button type="button" data-atab="homepage" aria-pressed="${ADM.tab==="homepage"}">Home page</button><button type="button" data-atab="products" aria-pressed="${ADM.tab==="products"}">Products</button><button type="button" data-atab="services" aria-pressed="${ADM.tab==="services"}">Services</button><button type="button" data-atab="providers" aria-pressed="${ADM.tab==="providers"}">Providers</button><button type="button" data-atab="customers" aria-pressed="${ADM.tab==="customers"}">Customers</button></div>
    <div class="newbar" id="admNew" hidden><span>New updates arrived.</span><button type="button" data-admrefresh>Show them</button></div>
    <div id="adminBody">${adminBody()}</div>`;
}
/* v98: inventory (scan in, scan out, labels) loads only for admins, only when opened */
let INV_LOAD = 0;
function invHTML(){
  if (window.NJ_INV) return window.NJ_INV.html();
  if (!INV_LOAD){ INV_LOAD = 1; const s = document.createElement("script"); s.src = "/inv.js?v=98a"; s.onload = () => refreshAdmin(true); s.onerror = () => { INV_LOAD = 2; refreshAdmin(true); }; document.head.appendChild(s); }
  return `<div class="empty">${INV_LOAD === 2 ? "Couldn't load the inventory tool. Check your connection and refresh the page." : "Loading inventory…"}</div>`;
}
function invTab(){
  const bar = document.querySelector(".tabbar"); if (!bar) return;
  const have = bar.querySelector(".invtab"), want = isAdmin();
  if (want && !have){ const a = document.createElement("a"); a.className = "invtab"; a.href = PATH_MODE ? "/admin" : "#admin"; a.dataset.r = "admin"; a.dataset.tab = "admin";
    a.innerHTML = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5a1 1 0 0 1 1-1h3M17 4h3a1 1 0 0 1 1 1v3M21 16v3a1 1 0 0 1-1 1h-3M7 20H4a1 1 0 0 1-1-1v-3M7 9v6M10 9v6M13.5 9v6M17 9v6"/></svg>Scan';
    bar.appendChild(a); bar.classList.add("hasinv"); if (current() === "admin") a.setAttribute("aria-current", "page"); }
  else if (!want && have){ have.remove(); bar.classList.remove("hasinv"); }
}
document.addEventListener("click", e => { if (e.target.closest && e.target.closest('.invtab,[data-atab="inventory"]')){ ADM.tab = "inventory"; if (window.NJ_INV){ window.NJ_INV.view = "list"; window.NJ_INV.form = null; } } }, true);
function adminBody(){
  if (ADM.error) return `<div class="empty">Couldn't load orders (${esc(ADM.error)}). Refresh the page and sign in again.</div>`;
  if (ADM.tab === "inventory") return invHTML();
  if (ADM.tab === "homepage") return homeAdminHTML();
  if (ADM.tab === "products") return productsAdminHTML();
  if (ADM.tab === "services") return servicesAdminHTML();
  if (ADM.tab === "bookings") return adminBookingsHTML();
  if (ADM.tab === "providers") return providersAdminHTML();
  if (ADM.tab === "events") return eventsAdminHTML();
  if (ADM.tab === "dating") return datingAdminHTML();
  if (ADM.tab === "homes") return homesAdminHTML();
  if (ADM.tab === "members") return membersAdminHTML();
  if (!ADM.orders || !ADM.users) return `<div class="empty">Loading…</div>`;
  return ADM.tab === "customers" ? customersHTML() : adminOrdersHTML();
}
function adminOrdersHTML(){
  const all = ADM.orders;
  const counts = {Open: all.filter(o=>!["Completed","Cancelled"].includes(o.status)).length, All: all.length};
  STATUSES.forEach(s => counts[s] = all.filter(o=>o.status===s).length);
  const q = ADM.q.trim().toLowerCase();
  let list = all.filter(o => ADM.status === "All" ? true : ADM.status === "Open" ? !["Completed","Cancelled"].includes(o.status) : o.status === ADM.status);
  if (ADM.uid) list = list.filter(o => o.uid === ADM.uid);
  if (q) list = list.filter(o => [o.number, o.name, o.email, o.phone, ...(o.items||[]).map(i=>i.name)].join(" ").toLowerCase().includes(q));
  const who = ADM.uid ? (ADM.users.find(u=>u.id===ADM.uid) || {}) : null;
  return `<div class="admintools">
      <input id="admQ" type="search" placeholder="Search by order #, name, email, phone or item" value="${esc(ADM.q)}" aria-label="Search orders">
    </div>
    <div class="chips" role="group" aria-label="Filter by status" style="margin-bottom:14px">${["Open","All",...STATUSES].map(s=>`<button type="button" data-afilter="${s}" aria-pressed="${ADM.status===s}">${s} (${counts[s]})</button>`).join("")}</div>
    ${who ? `<p class="note" style="margin-bottom:12px">Showing orders from <b>${esc(who.name || who.email || "this customer")}</b>. <button class="linkbtn" type="button" data-auid="">Show everyone</button></p>` : ""}
    ${list.length ? `<div class="ordlist">${list.map(adminOrderHTML).join("")}</div>` : `<div class="empty">No orders match.</div>`}`;
}
function adminOrderHTML(o){
  const n = ADM.notes[o.id];
  const tel = String(o.phone||"").replace(/[^\d+]/g,"");
  return `<details class="ord" data-oid="${o.id}"${ADM.open.has(o.id) ? " open" : ""}>
    <summary><span class="onum">#${o.number} · ${esc(o.name||"")}</span><span class="oright">${pill(o.status)}<b>${money(o.total||0)}</b></span><span class="ometa">${fmtDate(o.createdAt)} · ${(o.items||[]).reduce((a,x)=>a+x.qty,0)} item(s)${o.stockApplied ? " · taken from stock" : ""}</span></summary>
    <div class="obody">
      <div class="ogrid">
        <div class="obox"><h3>Customer</h3><b>${esc(o.name||"")}</b>
          ${o.phone ? `<a href="tel:${esc(tel)}">${esc(o.phone)}</a>` : ""}
          <a href="mailto:${esc(o.email||"")}?subject=${encodeURIComponent("Your Nojan order #"+o.number)}">${esc(o.email||"")}</a>
          <span class="note">${esc(o.city || "City not given")} · prefers ${esc(o.contactBy || "any")}</span>
          ${o.notes ? `<span class="note" style="color:var(--fg)">“${esc(o.notes)}”</span>` : ""}
        </div>
        <div class="obox"><h3>Items</h3>${orderItemsHTML(o)}</div>
      </div>
      <form class="oactions" data-statusform="${o.id}">
        <label>Status<select name="status">${STATUSES.map(s=>`<option${s===o.status?" selected":""}>${s}</option>`).join("")}</select></label>
        <label style="flex-basis:100%">Message to the customer <small>(optional, added to the email)</small><input name="message" placeholder="e.g. Pickup Saturday after 2 pm works"></label>
        <label class="check"><input type="checkbox" name="email" checked> Email the customer about this change</label>
        <button class="btn small" type="submit">Update status</button>
      </form>
      <div class="obox"><h3>Private notes <small style="text-transform:none;letter-spacing:0">(only admins see these)</small></h3>
        <textarea data-note="${o.id}" placeholder="${n == null ? "Loading…" : "e.g. Paid by e-Transfer, picking up Saturday"}" style="min-height:70px">${esc(n || "")}</textarea>
        <button class="linkbtn" type="button" data-savenote="${o.id}" style="justify-self:start">Save note</button>
      </div>
      <p class="note">${o.stockApplied ? "These items have been taken out of stock. Cancelling the order puts them back." : "Stock comes off when the customer picks up and pays: scan the item out, or set this order to Completed."}</p>
      <div class="obox"><h3>History</h3><ul class="ohist">${(o.history||[]).slice().reverse().map(h=>`<li>${esc(fmtDate(h.at))}: ${esc(h.status)}${h.by ? ` (${esc(h.by)})` : ""}${h.emailed ? " · customer emailed" : ""}</li>`).join("")}</ul></div>
    </div>
  </details>`;
}
function customersHTML(){
  const byUid = {};
  ADM.orders.forEach(o => { const b = byUid[o.uid] = byUid[o.uid] || {n:0, spent:0, last:0}; b.n++; if (o.status !== "Cancelled") b.spent += o.total||0; b.last = Math.max(b.last, tsNum(o.createdAt)); });
  const q = ADM.q.trim().toLowerCase();
  let users = ADM.users.slice().sort((a,b)=>tsNum(b.createdAt)-tsNum(a.createdAt));
  if (q) users = users.filter(u => [u.name,u.email,u.phone,u.city].join(" ").toLowerCase().includes(q));
  return `<div class="admintools"><input id="admQ" type="search" placeholder="Search customers" value="${esc(ADM.q)}" aria-label="Search customers"><span class="note">${ADM.users.length} account${ADM.users.length===1?"":"s"}</span></div>
  <div class="tablewrap"><table class="ctable"><thead><tr><th>Name</th><th>Email</th><th>Phone</th><th>Joined</th><th style="text-align:right">Orders</th><th style="text-align:right">Spent</th></tr></thead><tbody>
  ${users.map(u => { const b = byUid[u.id] || {n:0, spent:0}; return `<tr><td>${esc(u.name||"—")}</td><td><a href="mailto:${esc(u.email||"")}" style="color:var(--link)">${esc(u.email||"")}</a></td><td>${esc(u.phone||"—")}</td><td>${esc(fmtDate(u.createdAt).split(",").slice(0,2).join(","))}</td><td class="num">${b.n ? `<button class="linkbtn" type="button" data-auid="${u.id}">${b.n}</button>` : 0}</td><td class="num">${money(b.spent)}</td></tr>`; }).join("") || `<tr><td colspan="6">No customers yet.</td></tr>`}
  </tbody></table></div>`;
}
async function emailCustomer(o, status, message){
  const fields = {
    Order: "#" + o.number, Status: status, Update: STATUS_TEXT[status] || "",
    ...(message ? {"Message from the shop": message} : {}),
    Items: (o.items||[]).map(it=>`${it.qty} x ${it.name} — ${itemPrice(it)}`).join("\n"),
    "Estimated total": money(o.total||0),
    "Your orders": location.origin + "/#my-orders",
    _cc: o.email, _replyto: CONTACT_EMAIL, _template: "box"
  };
  await sendEmail(`Your Nojan order #${o.number}: ${status}`, fields);
}

/* =========================================================
   SERVICES & BOOKING
   ========================================================= */
const TZ = "America/Toronto";
let SERVICES = [], ALL_SERVICES = [], servicesLoaded = false;
const SVC = {cat:"All", fmt:"All", date:null, slot:null, format:null, step:"pick", slots:{}, unsub:null, sid:null, lastBooking:null};
const SVC_CATS = ["Computer training", "Online courses", "Tutoring", "Tech support & setup", "Business services", "Language lessons"];
const DAYS = ["sun","mon","tue","wed","thu","fri","sat"];
const DAY_NAMES = {mon:"Monday", tue:"Tuesday", wed:"Wednesday", thu:"Thursday", fri:"Friday", sat:"Saturday", sun:"Sunday"};
const BOOK_STATUSES = ["Requested", "Confirmed", "Completed", "Cancelled", "No-show"];
const BOOK_TEXT = {
  "Requested": "We received your booking request and will confirm it soon.",
  "Confirmed": "Your booking is confirmed. See you then!",
  "Completed": "Thanks for joining. We hope it was helpful!",
  "Cancelled": "This booking was cancelled. If this is a mistake, reply to this email.",
  "No-show": "We missed you at this session. Reply to this email to book another time."
};
const SICON = {
  box: '<path d="M3 12V4a1 1 0 0 1 1-1h8l9 9-9 9z"/><circle cx="8" cy="8" r="1.6"/>',
  monitor:'<rect x="3" y="4" width="18" height="12" rx="2"/><path d="M8 20h8M12 16v4"/>',
  video:'<rect x="3" y="6" width="13" height="12" rx="2"/><path d="M16 10l5-3v10l-5-3"/>',
  pin:'<path d="M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z"/><circle cx="12" cy="10" r="2.5"/>',
  clock:'<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  user:'<circle cx="12" cy="8" r="4"/><path d="M4 21c1.5-4 4.5-6 8-6s6.5 2 8 6"/>',
  users:'<circle cx="9" cy="8" r="3.5"/><path d="M2.5 20c1-3.5 3.5-5 6.5-5s5.5 1.5 6.5 5"/><circle cx="17" cy="9" r="2.5"/><path d="M16 14.5c2.5 0 4.5 1.5 5.5 4.5"/>',
  level:'<path d="M5 20v-5M12 20V9M19 20V4"/>',
  calendar:'<rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/>'
};
const svgI = n => `<svg viewBox="0 0 24 24" aria-hidden="true">${SICON[n] || SICON.monitor}</svg>`;
const pad2 = n => String(n).padStart(2, "0");
const initials = n => String(n || "?").split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0].toUpperCase()).join("");
const durTxt = m => m % 60 === 0 ? `${m/60} hr${m > 60 ? "s" : ""}` : m > 60 ? `${Math.floor(m/60)} hr ${m%60} min` : `${m} min`;
const priceTxt = s => s.price == null ? "Price on request" : s.price === 0 ? "Free" : `${money(s.price)} <small>/ ${esc(s.priceUnit)}</small>`;

function fsToService(d){
  const group = d.classType === "group";
  return { id: d.id, title: d.title || "", category: d.category || "Other", providerName: !d.providerName || /online\.?shop/i.test(d.providerName) ? "Nojan" : d.providerName,
    providerType: d.providerType || "Individual", providerBio: d.providerBio || "", providerUid: d.providerUid || "", summary: d.summary || "", description: d.description || "",
    price: d.price == null || d.price === "" ? null : +d.price, priceUnit: d.priceUnit || "session", duration: +d.duration || 60,
    format: d.format || "online", platform: d.platform || "", location: d.location || "", classType: group ? "group" : "1-on-1",
    capacity: group ? Math.max(2, +d.capacity || 6) : 1, level: d.level || "All levels", availability: d.availability || {},
    leadHours: d.leadHours == null || d.leadHours === "" ? 24 : +d.leadHours, horizonDays: +d.horizonDays || 21, blocked: d.blocked || [],
    prep: d.prep || [], repeat: d.repeat !== false, packPct: d.packPct == null ? 10 : +d.packPct || 0,
    images: (d.images || []).slice(0, 5), thumb: d.thumb || "", active: d.active !== false, order: d.order || 0 };
}
function useServices(all){
  useProviders(all.filter(d => d.kind === "provider"));
  useEvents(all.filter(d => d.kind === "event"));
  const st = all.find(d => d.kind === "settings"); SET = st || {}; ALL_SETTINGS = !!st;
  const list = all.filter(d => d.kind !== "provider" && d.kind !== "event" && d.kind !== "settings");
  ALL_SERVICES = list; servicesLoaded = true;
  SERVICES = list.map(fsToService).filter(s => s.active).sort((a,b) => (a.order - b.order) || a.title.localeCompare(b.title));
  mkMerge();
}

/* Times are always shown and stored in Toronto time */
function tzParts(ms){
  const o = {};
  new Intl.DateTimeFormat("en-CA", {timeZone: TZ, year:"numeric", month:"2-digit", day:"2-digit", hour:"2-digit", minute:"2-digit", hourCycle:"h23"})
    .formatToParts(new Date(ms)).forEach(p => o[p.type] = p.value);
  return {y: +o.year, m: +o.month, d: +o.day, H: +o.hour % 24, M: +o.minute};
}
function torontoMs(dateStr, hhmm){
  const [y, m, d] = dateStr.split("-").map(Number), [H, M] = hhmm.split(":").map(Number);
  const guess = Date.UTC(y, m - 1, d, H, M);
  const p = tzParts(guess), off = Date.UTC(p.y, p.m - 1, p.d, p.H, p.M) - guess;
  const p2 = tzParts(guess - off), off2 = Date.UTC(p2.y, p2.m - 1, p2.d, p2.H, p2.M) - (guess - off);
  return guess - off2;
}
const fmtWhen = (ms, opts) => new Intl.DateTimeFormat("en-CA", {timeZone: TZ, ...opts}).format(new Date(ms));
const fmtTime = ms => fmtWhen(ms, {hour:"numeric", minute:"2-digit"});
const fmtLong = ms => fmtWhen(ms, {weekday:"long", month:"long", day:"numeric", year:"numeric"}) + " at " + fmtTime(ms);
function dayList(s){
  const t = tzParts(Date.now()), out = [];
  for (let i = 0; i < s.horizonDays; i++){ const dt = new Date(Date.UTC(t.y, t.m - 1, t.d + i)); out.push({date: dt.toISOString().slice(0, 10), dow: DAYS[dt.getUTCDay()], dt}); }
  return out;
}
function slotsFor(s, date, dow){
  if (s.blocked.includes(date)) return [];
  const r = s.availability[dow]; if (!r || !r.on || !r.start || !r.end) return [];
  const [sh, sm] = r.start.split(":").map(Number), [eh, em] = r.end.split(":").map(Number);
  const out = [], minStart = Date.now() + s.leadHours * 3600000;
  for (let t = sh*60 + sm; t + s.duration <= eh*60 + em; t += s.duration){
    const hhmm = pad2(Math.floor(t/60)) + ":" + pad2(t % 60), ms = torontoMs(date, hhmm), key = `${s.id}_${date}_${hhmm.replace(":", "")}`;
    const used = Math.max(SVC.slots[key] || 0, ALLSLOTS[key] || 0);
    out.push({hhmm, ms, key, taken: used >= s.capacity, past: ms < minStart, left: s.capacity - used});
  }
  return out;
}

/* ---- Customer views ---- */
function fmtChips(s){
  const c = [];
  if (s.format !== "in-person") c.push(`<span class="svcchip online">${svgI("video")}Online</span>`);
  if (s.format !== "online") c.push(`<span class="svcchip inperson">${svgI("pin")}In person</span>`);
  c.push(`<span class="svcchip">${svgI("clock")}${durTxt(s.duration)}</span>`);
  c.push(`<span class="svcchip">${svgI(s.classType === "group" ? "users" : "user")}${s.classType === "group" ? `Group · up to ${s.capacity}` : "1-on-1"}</span>`);
  return `<div class="svcchips">${c.join("")}</div>`;
}
function svcCover(s){ const img = imagesOf(s)[0]; return img ? `<img src="${esc(img)}" data-ref="${esc(refsOf(s)[0])}" alt="" loading="lazy">` : svgI(s.format === "in-person" ? "users" : "monitor"); }
function serviceGrid(list){ return `<div class="svcgrid">${serviceCards(list)}</div>`; }
function serviceCards(list){
  return list.map(s => `
    <article class="svccard" data-svc="${esc(s.id)}">
      <div class="cover">${svcCover(s)}</div>
      <div class="sb">
        <span class="cat">${esc(s.category)}</span>${s.certified ? certBadge(true) : ""}
        <h3><a href="#service-${esc(s.id)}">${esc(s.title)}</a></h3>
        <span class="prov">by ${s.providerUid && PROVIDERS.find(x => x.id === s.providerUid) ? `<a href="#provider-${esc(s.providerUid)}">${esc(s.providerName)}</a>` : esc(s.providerName)}</span>
        ${s.summary ? `<p class="desc">${esc(s.summary)}</p>` : ""}
        ${fmtChips(s)}
        <div class="foot"><span class="svcprice">${priceTxt(s)}</span><a class="btn small" href="#service-${esc(s.id)}">${s.member ? "View" : "Book a time"}</a></div>
      </div>
    </article>`).join("");
}
const ARROW = '<span class="arrow"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg></span>';
/* v74: on phones each home row gets a small "View all" button; it grows into the big View all card when the row reaches the end */
/* v88: the home page. News and fundraiser numbers are edited in Admin → Home page (stored in products/_site). */
const GOFUNDME = "https://gofund.me/dbbc9cd49";
let SITE = {}, HOMETAB = "deals", NEWSED = {}, NEWSDEL = "";
const DEFAULT_NEWS = [
  {id: "n3", date: "2026-11-08", title: "We launched our GoFundMe", text: "Help us grow a business that gives 10% of its profit to the community.", link: GOFUNDME},
  {id: "n2", date: "2026-11-08", title: "Every item now has a Nojan ID", text: "Same item from different sellers? See all the offers on one page.", link: ""},
  {id: "n1", date: "2026-11-07", title: "Find us at nojans.com", text: "Our new home on the web. Same shop, easier to remember.", link: ""}];
const newsList = () => (Array.isArray(SITE.news) ? SITE.news : DEFAULT_NEWS).slice().sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.id).localeCompare(String(a.id)));
const fmtNewsDate = d => { const t = new Date(String(d) + "T12:00:00"); return isNaN(t) ? "" : t.toLocaleDateString("en-US", {month: "short", day: "numeric", year: "numeric"}); };
const newsCard = n => { const ext = /^https?:/i.test(n.link || ""), tag = n.link ? "a" : "div";
  return `<${tag} class="newscard"${n.link ? ` href="${esc(n.link)}"${ext ? ' target="_blank" rel="noopener"' : ""}` : ""}><small>${fmtNewsDate(n.date)}</small><b>${esc(n.title)}</b>${n.text ? `<span>${esc(n.text)}</span>` : ""}</${tag}>`; };
const dollars = n => "$" + Math.round(n).toLocaleString("en-US");
function homeHTML(){
  const soon = (icon, title, text) => `<div class="soon"><span class="soonic">${svgI(icon)}</span><b>${title}</b><span>${text}</span></div>`;
  const f = SITE.fund || {}, raised = +f.raised || 0, goal = +f.goal || 0, donors = +f.donors || 0;
  const pct = goal > 0 ? Math.min(100, Math.max(2, raised / goal * 100)) : 2;
  const fundLine = raised > 0 ? `${dollars(raised)} raised${goal ? " of " + dollars(goal) : ""}${donors ? ` · ${donors} donor${donors === 1 ? "" : "s"}` : ""}` : "Be the first to donate";
  const loading = feedState.new === "loading", live = PRODUCTS.filter(p => !p.soldOut);
  const deals = groupList(live.filter(p => p.was && p.price != null)).sort((a, b) => (b.was - b.price) / b.was - (a.was - a.price) / a.was).slice(0, 4);
  const fresh = groupList(live.slice().sort((a, b) => (b.added || 0) - (a.added || 0) || (b.order - a.order))).slice(0, 4);
  const tabs = [deals.length ? ["deals", "Biggest savings"] : null, ["new", "New arrivals"], ["svc", "Services"]].filter(Boolean);
  if (!tabs.some(t => t[0] === HOMETAB)) HOMETAB = tabs[0][0];
  const rail = HOMETAB === "svc" ? (SERVICES.length ? serviceCards(SERVICES.slice(0, 4)) : soon("monitor", "Services are coming soon", servicesLoaded || fbFailed ? "Classes and expert help, online or in person." : "Loading services…"))
    : loading ? soon("clock", "Loading items…", "") : productCards(HOMETAB === "deals" ? deals : fresh);
  const I = {shop: "M5 8h14l-1 13H6L5 8zM9 8V6a3 3 0 0 1 6 0v2", svc: "M4 6h16v10H4zM8 20h8M12 16v4", ev: "M5 5h14v15H5zM5 10h14M9 3v4M15 3v4", hm: "M4 11l8-7 8 7v9H4zM10 20v-5h4v5",
    dt: "M12 20s-7-4.4-9-8.5A4.8 4.8 0 0 1 12 7a4.8 4.8 0 0 1 9 4.5C19 15.6 12 20 12 20z", cm: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM16 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM3 20c.8-3 2.8-5 5-5s4.2 2 5 5M13 17c.7-1.3 1.8-2 3-2 2.2 0 4.2 2 5 5"};
  const ads = groupList(PRODUCTS).length;
  const cg = new Map(); groupList(live).forEach(p => { const c = typeOf(p) || "Other"; if (!cg.has(c)) cg.set(c, []); cg.get(c).push(p); });
  const cats = [...cg.keys()].sort((a, b) => (a === "Other") - (b === "Other") || cg.get(b).length - cg.get(a).length || a.localeCompare(b)).slice(0, 7);
  const catTile = c => { const p = cg.get(c).find(x => imagesOf(x).length) || cg.get(c)[0], im = p && imagesOf(p)[0], n = cg.get(c).length;
    return `<a class="xtile ctile" href="#shop" data-goshelf="${esc(c)}"><span class="cimg">${im ? `<img src="${esc(im)}" data-ref="${esc(refsOf(p)[0] || "")}" alt="" loading="lazy">` : ""}</span><b>${esc(c)}</b><span class="xn">${n} item${n === 1 ? "" : "s"}</span></a>`; };
  const svcTile = `<a class="xtile ctile" href="#services"><span class="cimg"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="${I.svc}"/></svg></span><b>Services</b><span class="xn">${SERVICES.length ? `${SERVICES.length} service${SERVICES.length === 1 ? "" : "s"} to book` : "Classes and local help"}</span></a>`;
  const giving = `<section class="hsec" aria-label="Support Nojan on GoFundMe"><div class="givecard"><div><span class="fundtag">We're just starting</span><h2>Help us build a business that gives back</h2><p>10% of our profit goes to the community. Give $20 and become one of our founding donors.</p>${raised > 0 ? `<div style="display:grid;gap:6px;max-width:420px"><div class="fundbar"><i style="width:${pct.toFixed(1)}%"></i></div><span class="fundline">${fundLine}</span></div>` : ""}</div><div class="fundbtns"><a href="${GOFUNDME}" target="_blank" rel="noopener">Donate on GoFundMe</a><button type="button" data-fundshare>Share</button></div></div></section>`;
  const areas = [
    {n: "Shop", note: ads ? `${ads} items, new and used` : "New and used items", href: "#shop", on: true, tint: "rgba(43,111,234,.12)", ink: "#2b6fea", i: I.shop},
    {n: "Services", note: SERVICES.length ? `${SERVICES.length} service${SERVICES.length === 1 ? "" : "s"} to book` : "Classes and local help", href: "#services", on: true, tint: "#e7f4ec", ink: "#1a7f45", i: I.svc},
    {n: "Events", note: "Things to do nearby", href: "#events", on: EVENTS_ON, tint: "#fdf1e3", ink: "#b45309", i: I.ev},
    {n: "Homes", note: "Homes to rent or buy", href: "#homes", on: HOMES_ON, tint: "#efeff0", ink: "#575758", i: I.hm},
    {n: "Dating", note: "Meet new people", href: "#dating", on: DATING_ON, tint: "#fdecec", ink: "#c0262d", i: I.dt},
    {n: "Community", note: "", href: "", on: false, tint: "rgba(251,188,5,.16)", ink: "#b07d00", i: I.cm}];
  const ico = a => `<span class="xi" style="background:${a.tint}"><svg viewBox="0 0 24 24" style="stroke:${a.ink}" aria-hidden="true"><path d="${a.i}"/></svg></span>`;
  const tile = a => a.on ? `<a class="xtile" href="${a.href}">${ico(a)}<b>${a.n}</b><span class="xn">${a.note}</span></a>` : `<div class="xtile xsoon">${ico(a)}<b>${a.n}</b><span class="xn">Coming soon</span></div>`;
  const tick = t => `<span><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5 9-10"/></svg>${t}</span>`;
  return `
    <div class="storehead"><a class="storelogo" href="#home" aria-label="Nojan home"><img class="logomark" src="${(document.querySelector("header .logomark") || {}).src || ""}" alt="" width="64" height="64"></a><a class="gicon storeacct" href="#account" aria-label="Your account"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="8" r="4"/><path d="M4 21a8 8 0 0 1 16 0"/></svg></a></div>
    <section class="h5hero" aria-label="Welcome to Nojan">
      <div class="h5l">
        <h1>Brand-name items for less.</h1>
        <p>New and used electronics, kitchen appliances, fragrances and more, below regular prices. Checked by us, picked up in Richmond Hill, and tested by you before you pay.</p>
        <form class="h5search" id="h5search" role="search"><label for="h5q" class="sr">Search Nojan</label><input id="h5q" type="search" placeholder="Search items and services" autocomplete="off"><button type="submit">Search</button></form>
      </div>
      <div class="howcard" aria-label="How buying works">
        <span class="fundtag">How it works</span>
        <ol><li><b>Order online</b><span>Nothing is charged online.</span></li><li><b>We contact you</b><span>Usually within one business day.</span></li><li><b>Test, then pay</b><span>At pickup in Richmond Hill, by e-Transfer or cash.</span></li></ol>
        <a href="#returns">Test before you pay ›</a>
      </div>
    </section>
    <section aria-label="Shop by category"><div class="explore cats">${cats.map(catTile).join("")}${svcTile}</div>
      <div class="trustline">${tick("Used items 40% below market")}${tick(`<a href="#certified">Checked and certified by Nojan</a>`)}${tick("Test before you pay")}${tick("No payment online")}${tick("10% of profit to the community")}</div></section>
    <section class="hsec">
      <div class="h5row"><div class="h5tabs" role="tablist" aria-label="What to show">${tabs.map(([k, l]) => `<button type="button" role="tab" data-htab="${k}" aria-selected="${HOMETAB === k}">${l}</button>`).join("")}</div><a href="${HOMETAB === "svc" ? "#services" : "#shop"}">See all ›</a></div>
      <div class="homegrid">${rail}</div>
    </section>
    <section class="hsec"><div class="h5row"><h2>News</h2><a href="#news">All news ›</a></div><div class="news3">${newsList().slice(0, 3).map(newsCard).join("")}</div></section>
    ${giving}`;
}
function homeAdminHTML(){
  const f = SITE.fund || {}, today = new Date().toLocaleDateString("en-CA", {timeZone: "America/Toronto"}), e = NEWSED;
  return `<div class="panel" style="max-width:760px">
      <h2 style="margin:0">Fundraiser</h2>
      <p class="note">Shown beside the headline on the home page. Update these from your GoFundMe page when donations come in.</p>
      <form id="fundForm" style="display:grid;gap:12px;grid-template-columns:repeat(3,minmax(0,1fr))">
        <label>Raised ($)<input name="raised" type="number" min="0" step="1" value="${+f.raised || 0}"></label>
        <label>Goal ($)<input name="goal" type="number" min="0" step="1" value="${+f.goal || 0}"></label>
        <label>Donors<input name="donors" type="number" min="0" step="1" value="${+f.donors || 0}"></label>
        <div style="grid-column:1/-1;display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">Save fundraiser</button><span id="fundMsg" class="note"></span></div>
      </form>
    </div>
    <div class="panel" style="max-width:760px;margin-top:16px">
      <h2 style="margin:0">News</h2>
      <p class="note">The newest 3 posts show on the home page. All posts show on the News page.</p>
      <form id="newsForm" style="display:grid;gap:12px">
        <label>Title<input name="title" required maxlength="90" value="${esc(e.title || "")}"></label>
        <label>Text<textarea name="text" rows="3" maxlength="400">${esc(e.text || "")}</textarea></label>
        <div style="display:grid;gap:12px;grid-template-columns:minmax(0,1fr) minmax(0,2fr)"><label>Date<input name="date" type="date" value="${esc(e.date || today)}"></label><label>Link (optional)<input name="link" type="text" placeholder="https://… or #shop" value="${esc(e.link || "")}"></label></div>
        <div style="display:flex;gap:12px;align-items:center;flex-wrap:wrap"><button class="btn" type="submit">${e.id ? "Save changes" : "Add news post"}</button>${e.id ? `<button class="linkbtn" type="button" data-newscancel>Cancel</button>` : ""}<span id="newsMsg" class="note"></span></div>
      </form>
      <div style="display:grid;gap:10px">${newsList().map(n => `<div style="display:flex;gap:12px;align-items:center;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px"><div style="min-width:0"><b>${esc(n.title)}</b><div class="note">${fmtNewsDate(n.date)}${n.text ? " · " + esc(n.text.slice(0, 90)) : ""}</div></div><div style="display:flex;gap:14px;flex:none"><button class="linkbtn" type="button" data-newsedit="${esc(n.id)}">Edit</button><button class="linkbtn" type="button" data-newsdel="${esc(n.id)}" style="color:var(--danger)">${NEWSDEL === n.id ? "Tap again to delete" : "Delete"}</button></div></div>`).join("")}</div>
    </div>`;
}
async function saveSite(patch, msgEl, okText){
  if (!FB || !FB.saveSite){ if (msgEl) msgEl.textContent = "Not connected. Refresh the page and try again."; return false; }
  try { await FB.saveSite(patch); SITE = {...SITE, ...patch}; toast(okText); return true; }
  catch (er){ console.error(er); if (msgEl) msgEl.textContent = er && er.code === "permission-denied" ? "Your database doesn't allow saving this yet (permission denied)." : "Couldn't save. Check your connection and try again."; return false; }
}
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "h5search"){ e.preventDefault(); const v = f.querySelector("input").value.trim(); if (!v) return; query = v; const qi = $("#q"); if (qi) qi.value = v; render(); window.scrollTo(0, 0); pageIn(); return; }
  if (f.id === "fundForm"){ e.preventDefault(); if (!isAdmin()) return; const g = n => Math.max(0, Math.round(+f.elements[n].value || 0));
    await saveSite({fund: {raised: g("raised"), goal: g("goal"), donors: g("donors")}}, $("#fundMsg"), "Fundraiser updated"); return; }
  if (f.id === "newsForm"){ e.preventDefault(); if (!isAdmin()) return; const g = n => String(f.elements[n].value || "").trim();
    if (!g("title")) return; const item = {id: NEWSED.id || "n" + Date.now(), title: g("title").slice(0, 90), text: g("text").slice(0, 400), date: g("date") || new Date().toISOString().slice(0, 10), link: g("link").slice(0, 300)};
    const list = newsList().filter(n => n.id !== item.id).concat([item]);
    if (await saveSite({news: list}, $("#newsMsg"), NEWSED.id ? "News post saved" : "News post added")){ NEWSED = {}; refreshAdmin(true); } }
});
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.htab){ HOMETAB = b.dataset.htab; render(); return; }
  if (b.hasAttribute("data-fundshare")){ const data = {title: "Nojan for people", text: "Help Nojan build a business that gives back to the community.", url: GOFUNDME};
    try { if (navigator.share) await navigator.share(data); else { await navigator.clipboard.writeText(GOFUNDME); toast("Link copied"); } } catch (_) {} return; }
  if (b.dataset.newsedit){ NEWSED = {...(newsList().find(n => n.id === b.dataset.newsedit) || {})}; NEWSDEL = ""; refreshAdmin(true); window.scrollTo(0, 0); return; }
  if (b.hasAttribute("data-newscancel")){ NEWSED = {}; refreshAdmin(true); return; }
  if (b.dataset.newsdel){ const id = b.dataset.newsdel; if (NEWSDEL !== id){ NEWSDEL = id; refreshAdmin(true); return; }
    NEWSDEL = ""; if (await saveSite({news: newsList().filter(n => n.id !== id)}, $("#newsMsg"), "News post deleted")) refreshAdmin(true); return; }
});
function homeRowsInit(){
  document.querySelectorAll(".hsec .homegrid").forEach(g => {
    const va = g.querySelector(".viewall"); if (!va || g.parentElement.classList.contains("hgwrap")) return;
    const wrap = document.createElement("div"); wrap.className = "hgwrap"; g.before(wrap); wrap.appendChild(g);
    const pill = document.createElement("a"); pill.className = "vapill " + [...va.classList].filter(c => c !== "viewall").join(" ");
    pill.href = va.getAttribute("href"); pill.setAttribute("aria-label", (va.querySelector("b") || va).textContent.trim());
    pill.innerHTML = `<span>View all</span>${ARROW}`; wrap.appendChild(pill);
    const upd = () => wrap.classList.toggle("atend", g.scrollLeft + g.clientWidth >= g.scrollWidth - va.offsetWidth * 0.6);
    g.addEventListener("scroll", upd, {passive: true}); upd();
  });
}
const viewAll = (cls, href, small, big) => `<a class="viewall ${cls}" href="${href}"><small>${small}</small><b>${big}</b>${ARROW}</a>`;
function servicesView(){
  const F = FLT.services, n = activeFilters("services").length;
  return `<section class="pagehero lhero services">
      <div class="phtext"><h1>Services</h1><p>Classes and expert help, online or in person. Pick a time and pay at your session.</p></div>
      ${SERVICES.length ? `<label class="sortlbl hsort">Sort by
        <select id="sort"><option value="featured"${sortBy==="featured"?" selected":""}>Featured</option><option value="low"${sortBy==="low"?" selected":""}>Price: low to high</option><option value="high"${sortBy==="high"?" selected":""}>Price: high to low</option></select>
      </label>` : ""}
    </section>
    ${svcTabsHTML()}
    ${svcTab() === "people" ? peopleDirHTML() : !SERVICES.length ? `<div class="empty">${servicesLoaded || fbFailed ? `New services are coming soon. <a href="#contact-us" style="color:var(--link)">Tell us what you'd like to learn</a>.` : "Loading services…"}</div>` : `
    ${filterBarHTML("services", "services")}
    <div class="fsec"><h3>Price</h3>
      <div class="pricein">
        <label class="pnum"><span>From $</span><input id="sMinN" type="number" inputmode="decimal" min="0" step="any" value="${F.min ?? ""}" placeholder="0"></label>
        <span class="pto">to</span>
        <label class="pnum"><span>To $</span><input id="sMaxN" type="number" inputmode="decimal" min="0" step="any" value="${F.max ?? ""}" placeholder="Any"></label>
      </div></div>
    ${filterFootHTML("services")}
    <div id="results">${resultsHTML("services")}</div>`}
    <div class="tiles" style="margin-top:28px">
      <div class="tile"><h2>Online classes</h2><p>Join from home on your computer, tablet or phone. Your meeting link comes with your confirmation.</p></div>
      <div class="tile"><h2>In person</h2><p>Meet in Richmond Hill or, for some services, at your home or office. The exact place is confirmed with your booking.</p></div>
      <div class="tile"><h2>Easy to change</h2><p>See all your bookings in one place and cancel from <a href="#my-orders">My bookings</a> if your plans change.</p></div>
    </div>`;
}
function serviceView(){
  if (String(serviceId).startsWith("m-")) return mkDetailView(String(serviceId).slice(2));
  const s = SERVICES.find(x => x.id === serviceId);
  if (!s) return servicesLoaded ? `<div class="empty">This service isn't available anymore. <a href="#services" style="color:var(--link)">See all services</a></div>` : `<div class="empty">Loading…</div>`;
  const how = [
    ["video", "Format", s.format === "both" ? "Online or in person, your choice" : s.format === "online" ? "Online" : "In person"],
    s.format !== "in-person" ? ["monitor", "Online on", s.platform || "Video call, link sent before class"] : null,
    s.format !== "online" ? ["pin", "Location", s.location || "Richmond Hill, Ontario"] : null,
    ["clock", "Session length", durTxt(s.duration)],
    [s.classType === "group" ? "users" : "user", "Class size", s.classType === "group" ? `Small group, up to ${s.capacity}` : "One-on-one"],
    ["level", "Level", s.level]
  ].filter(Boolean);
  return `<article class="svcview">
    <div class="svcmain">
      <div class="cover">${svcCover(s)}</div>
      <div><span class="cat" style="font-size:.78rem;font-weight:700;letter-spacing:.06em;text-transform:uppercase;color:var(--primary-2)">${esc(s.category)}</span>
        <h1 style="margin-top:4px">${esc(s.title)}</h1>
        ${s.summary ? `<p class="note" style="font-size:1.02rem;margin-top:6px">${esc(s.summary)}</p>` : ""}
        <div style="margin-top:10px">${fmtChips(s)}</div>
        <button class="btn mobilebook" type="button" data-tobook>${svgI("calendar").replace("<svg", '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')}See open times &amp; book · ${s.price == null ? "on request" : s.price === 0 ? "Free" : money(s.price)}</button></div>
      ${(() => { const pp = s.providerUid ? PROVIDERS.find(x => x.id === s.providerUid) : null;
        return pp ? `<a class="provider provlink" href="#provider-${esc(pp.id)}">${provAvatar(pp, 52)}<div><b>${esc(pp.name)}</b>${pp.headline ? `<p style="color:var(--fg)">${esc(pp.headline)}</p>` : ""}${pp.location ? `<p>${esc(pp.location)}</p>` : ""}<span class="pgo">View full profile: experience, education &amp; certifications ›</span></div></a>`
          : `<div class="provider"><div class="av">${esc(initials(s.providerName))}</div><div><b>${esc(s.providerName)}</b> <span class="note">· ${esc(s.providerType)}</span>${s.providerBio ? `<p>${esc(s.providerBio)}</p>` : ""}</div></div>`; })()}
      <section><h2 style="margin-bottom:10px">How the classes work</h2>
        <div class="howgrid">${how.map(([i, l, v]) => `<div class="howitem">${svgI(i)}<div><b>${l}</b><span>${esc(v)}</span></div></div>`).join("")}</div></section>
      ${s.description ? `<section class="itemdesc"><h2>About this service</h2>${descHTML(s.description)}</section>` : ""}
      <section class="panel"><h2>Booking &amp; cancellation</h2>
        <ul style="margin:0;padding-left:18px;display:grid;gap:6px">
          <li>Pick an open time. Your spot is held right away, and we confirm by email, usually within a day.</li>
          <li>${s.format !== "in-person" ? "For online sessions, the meeting link comes with your confirmation and also shows in My bookings." : "The exact address is confirmed with your booking."}</li>
          <li>No payment online. Pay the provider by Interac e-Transfer or cash, at or before the session.</li>
          <li>Plans changed? Cancel from My bookings${s.leadHours ? `, ideally at least ${s.leadHours} hours before` : ""}.</li>
        </ul></section>
    </div>
    <aside class="bookpanel" id="bookPanel" aria-label="Book this service">${bookPanelHTML(s)}</aside>
  </article>`;
}
function bookPanelHTML(s){
  if (!SVC.format || (s.format !== "both" && SVC.format !== s.format)) SVC.format = s.format === "in-person" ? "in-person" : "online";
  const days = dayList(s).map(d => { const slots = slotsFor(s, d.date, d.dow).filter(x => !x.past); return {...d, slots, open: slots.filter(x => !x.taken).length}; });
  if (!SVC.date || !days.find(d => d.date === SVC.date && d.open)){ const f = days.find(d => d.open); SVC.date = f ? f.date : null; }
  const day = days.find(d => d.date === SVC.date);
  const slot = SVC.slot && day ? day.slots.find(x => x.key === SVC.slot && !x.taken) : null;
  if (!slot) SVC.slot = null;
  const head = `<div><span class="svcprice">${priceTxt(s)}</span><div class="note">${durTxt(s.duration)} · ${s.classType === "group" ? `group of up to ${s.capacity}` : "one-on-one"}</div></div>`;
  if (SVC.step === "details" && slot) return head + detailsFormHTML(s, slot);
  SVC.step = "pick";
  return `${head}
    ${s.format === "both" ? `<div><div class="note" style="margin-bottom:6px;font-weight:600;color:var(--fg)">How would you like to attend?</div>
      <div class="seg" role="group" aria-label="How to attend">${[["online", "Online"], ["in-person", "In person"]].map(([v, l]) => `<button type="button" data-bkfmt="${v}" aria-pressed="${SVC.format === v}">${l}</button>`).join("")}</div></div>` : ""}
    ${oftenHTML(s)}
    ${days.some(d => d.open) ? `
      <h2>1. Choose a date</h2>
      <div class="daystrip" role="group" aria-label="Dates">${days.map(d => `<button type="button" data-bkday="${d.date}" aria-pressed="${d.date === SVC.date}" ${d.open ? "" : "disabled"} aria-label="${d.dt.toLocaleDateString("en-CA", {weekday:"long", month:"long", day:"numeric", timeZone:"UTC"})}, ${d.open ? d.open + " times open" : "no times open"}"><small>${d.dt.toLocaleDateString("en-CA", {weekday:"short", timeZone:"UTC"})}</small><b>${d.dt.getUTCDate()}</b><small>${d.dt.toLocaleDateString("en-CA", {month:"short", timeZone:"UTC"})}</small>${d.open ? `<em>${d.open} open</em>` : ""}</button>`).join("")}</div>
      <div><h2>2. Choose a time</h2><p class="tzline">All times are Toronto time (ET)</p></div>
      <div class="timegrid" role="group" aria-label="Times">${day.slots.map(x => `<button type="button" data-bkslot="${x.key}" aria-pressed="${!!slot && x.key === slot.key}" ${x.taken ? "disabled" : ""} title="${x.taken ? "Booked" : s.capacity > 1 ? x.left + " spots left" : "Available"}">${fmtTime(x.ms)}</button>`).join("")}</div>
      ${slot ? `<div class="picked"><b>${fmtLong(slot.ms)}</b><br>${durTxt(s.duration)} · ${SVC.format === "online" ? "Online" : "In person"}${s.capacity > 1 ? ` · ${slot.left} spot${slot.left > 1 ? "s" : ""} left` : ""}</div>` : ""}
      ${slot ? seriesHTML(s, {...slot, date: SVC.date}) : ""}
      <button class="btn" type="button" data-bknext ${slot ? "" : "disabled"}>${slot ? "Continue" : "Select a time to continue"}</button>`
    : `<div class="empty" style="padding:18px">No open times in the next ${s.horizonDays} days. <a href="#contact-us" style="color:var(--link)">Ask us about other times</a>.</div>`}
    <p class="note">No payment online. You'll get a confirmation by email.</p>`;
}
function detailsFormHTML(s, slot){
  const pr = PROFILE || {}, ser = seriesOf(s, {...slot, date: SVC.date}).filter(x => x.ok), unit = oftenOf(s) === "pack" ? packPrice(s) : s.price;
  const sum = `<div class="picked"><b>${esc(s.title)}</b><br>${fmtLong(slot.ms)} · ${durTxt(s.duration)}<br>${SVC.format === "online" ? "Online" : "In person"} · ${s.price == null ? "Price on request" : money(s.price) + " / " + esc(s.priceUnit)}${ser.length > 1 ? `<br><b>${ser.length} <span>weekly sessions</span></b> · <span>total</span> ${money(unit * ser.length)}` : ""}<br><button class="linkbtn" type="button" data-bkback>Change time</button></div>`;
  if (!authReady) return sum + `<p class="note">Loading your account…</p>`;
  if (!USER) return sum + `<div class="signinprompt"><h2>3. Sign in to book</h2><p class="note">Sign in or create a free account so you can see and manage your bookings.</p>${googleBtn("service")}
    <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn small" type="button" data-auth="signin" data-next="service">Sign in with email</button><button class="btn small ghost" type="button" data-auth="signup" data-next="service" style="color:var(--fg)">Create account</button></div><div id="authMsg" hidden></div></div>`;
  const needAddr = SVC.format === "in-person" && /your (home|office|place)|customer/i.test(s.location);
  return sum + `<form id="bookForm" novalidate>
    <h2>3. Your details</h2>
    <label>Full name<input name="name" required autocomplete="name" value="${esc(pr.name || USER.displayName || "")}"></label>
    <label>Phone<input name="phone" type="tel" required autocomplete="tel" value="${esc(pr.phone || "")}"></label>
    <label>Email<input name="email" type="email" required autocomplete="email" value="${esc(pr.email || USER.email || "")}"></label>
    ${needAddr ? `<label>Address for the session<input name="address" required autocomplete="street-address"></label>` : ""}
    ${bookExtraHTML(s)}
    <label>What would you like to focus on? <small>(optional)</small><textarea name="notes" style="min-height:80px" placeholder="e.g. I'm new to computers and want to learn email and video calls"></textarea></label>
    ${BOOK_END}
  </form>`;
}
function afterServiceRender(){
  if (!FB || !serviceId || SVC.sid === serviceId) return;
  if (SVC.unsub) SVC.unsub();
  SVC.sid = serviceId; SVC.slots = {};
  SVC.unsub = FB.watchSlots(serviceId, map => { SVC.slots = map; refreshBookPanel(); }, err => console.error(err));
}
function refreshBookPanel(){
  const p = $("#bookPanel"), s = SERVICES.find(x => x.id === serviceId);
  if (!p || !s) return;
  const a = document.activeElement;
  if (p.contains(a) && /^(INPUT|TEXTAREA)$/.test(a.tagName)) return;
  p.innerHTML = bookPanelHTML(s);
}
function resetBooking(){ SVC.date = null; SVC.slot = null; SVC.format = null; SVC.step = "pick"; }
function bookedView(){
  const b = SVC.lastBooking;
  if (!b) return `<div class="empty">See your bookings in <a href="#my-orders" style="color:var(--link)">My orders &amp; bookings</a>.</div>`;
  return `<div class="panel" style="max-width:640px;margin:20px auto;text-align:center;justify-items:center">
    <div class="bkdate" style="width:72px"><small>${fmtWhen(b.startMs, {month:"short"})}</small><b>${fmtWhen(b.startMs, {day:"numeric"})}</b></div>
    <h1>You're booked in! Request #B${b.number}</h1>
    <p style="margin:0"><b>${esc(b.serviceTitle)}</b> with ${esc(b.providerName)}<br>${fmtLong(b.startMs)} (Toronto time) · ${durTxt(b.durationMin)} · ${b.format === "online" ? "Online" : "In person"}</p>
    <p class="note">Your spot is held. We'll email you to confirm${b.format === "online" ? ", with the link to join," : ""} usually within a day. A copy of this request was sent to ${esc(b.email)}.</p>
    <div style="display:flex;gap:10px;justify-content:center;flex-wrap:wrap"><button class="btn" type="button" data-ics="last">${svgI("calendar").replace("<svg", '<svg width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"')}Add to calendar</button><a class="btn ghost" href="#my-orders" style="color:var(--fg)">My bookings</a><a class="linkbtn" href="#services" style="align-self:center">Browse more services</a></div>
  </div>`;
}
function icsFor(b){
  const dt = ms => new Date(ms).toISOString().replace(/[-:]/g, "").replace(/\.\d+/, "");
  const tx = s => String(s || "").replace(/([,;\\])/g, "\\$1").replace(/\n/g, "\\n");
  return ["BEGIN:VCALENDAR", "VERSION:2.0", "PRODID:-//Nojan//Booking//EN", "BEGIN:VEVENT",
    `UID:${b.id || Date.now()}@nojan`, `DTSTAMP:${dt(Date.now())}`, `DTSTART:${dt(b.startMs)}`, `DTEND:${dt(b.startMs + b.durationMin * 60000)}`,
    `SUMMARY:${tx(b.serviceTitle)} (Nojan)`,
    `DESCRIPTION:${tx(`Booking #B${b.number} with ${b.providerName}. ${b.format === "online" ? "Online" : "In person"}.${b.meetingLink ? " Join: " + b.meetingLink : ""}`)}`,
    `LOCATION:${tx(b.format === "online" ? (b.meetingLink || b.platform || "Online") : (b.address || b.location || "Richmond Hill, ON"))}`,
    "END:VEVENT", "END:VCALENDAR"].join("\r\n");
}
function downloadICS(b){
  const url = URL.createObjectURL(new Blob([icsFor(b)], {type: "text/calendar"}));
  const a = document.createElement("a"); a.href = url; a.download = `booking-B${b.number}.ics`; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}
/* My bookings */
MY.bookings = null; MY.unsubB = null;
function startMyBookings(){
  if (!FB || !USER || MY.unsubB) return;
  MY.unsubB = () => {};
  MY.unsubB = FB.watchMyBookings(USER.uid, list => { MY.bookings = list.sort((a,b) => a.startMs - b.startMs); if (["orders", "mybooking"].includes(current())) setTimeout(softRender); }, err => { console.error(err); MY.bookings = MY.bookings || []; });
}
function bookingCardHTML(b, admin){
  return `<div class="bkcard">
    <div class="bkdate"><small>${fmtWhen(b.startMs, {month:"short"})}</small><b>${fmtWhen(b.startMs, {day:"numeric"})}</b><small>${fmtWhen(b.startMs, {weekday:"short"})}</small></div>
    <div style="min-width:0;display:grid;gap:3px">${admin ? `<b>${esc(b.serviceTitle)}</b>` : `<a href="#mybooking-${b.id}" style="font-weight:700;color:inherit">${esc(b.serviceTitle)}</a>`}
      <span class="bkmeta">${fmtTime(b.startMs)} · ${durTxt(b.durationMin)} · ${b.format === "online" ? "Online" : "In person"} · with ${esc(b.providerName)} · #B${b.number}${b.seriesId ? ` · ${b.seriesI}/${b.seriesN}` : ""}${!admin && p2on() && b.msgFrom === "admin" && b.msgSeenC !== b.msgAt ? ` <span class="pill bkflagp">New message</span>` : ""}${!admin && p2on() && b.offer ? ` <span class="pill bkflagp">New time offered</span>` : ""}</span>
      ${!admin && b.status === "Confirmed" && b.meetingLink ? `<a href="${esc(b.meetingLink)}" target="_blank" rel="noopener" style="color:var(--link);font-weight:600">Join the online session</a>` : ""}
      ${!admin && b.status === "Confirmed" && b.format !== "online" && b.locationNote ? `<span class="bkmeta">Where: ${esc(b.locationNote)}</span>` : ""}
      ${!admin ? `<span class="bkmeta" style="color:var(--fg)">${esc(BOOK_TEXT[b.status] || "")}</span>` : ""}
    </div>
    <div style="display:grid;gap:6px;justify-items:end">${pill(b.status)}
      ${!admin ? `<span style="display:flex;gap:12px;flex-wrap:wrap;justify-content:flex-end">${["Requested","Confirmed"].includes(b.status) && b.startMs > Date.now() ? `<button class="linkbtn" type="button" data-ics="${b.id}">Add to calendar</button><button class="linkbtn" type="button" data-bkcancel="${b.id}" style="color:var(--danger)">Cancel</button>` : ""}</span>` : ""}
    </div>
  </div>`;
}
function myBookingsHTML(){
  if (!MY.bookings) return `<div class="empty">Loading your bookings…</div>`;
  const ALLB = MY.bookings; MY.bookings = ALLB.filter(b => b.kind !== "event");
  try { return myBookingsInner(); } finally { MY.bookings = ALLB; }
}
function myBookingsInner(){
  if (!MY.bookings.length) return `<div class="empty">No bookings yet. <a href="#services" style="color:var(--link)">Browse services and classes</a></div>`;
  const now = Date.now(), up = MY.bookings.filter(b => b.startMs + b.durationMin*60000 >= now && !["Cancelled"].includes(b.status)), past = MY.bookings.filter(b => !up.includes(b)).reverse();
  return `${up.length ? `<div class="ordlist">${up.map(b => bookingCardHTML(b)).join("")}</div>` : `<div class="empty">No upcoming bookings. <a href="#services" style="color:var(--link)">Book a service</a></div>`}
    ${past.length ? `<details style="margin-top:12px"><summary class="linkbtn" style="cursor:pointer">Past and cancelled bookings (${past.length})</summary><div class="ordlist" style="margin-top:10px">${past.map(b => bookingCardHTML(b)).join("")}</div></details>` : ""}`;
}

/* ---- Customer events ---- */
document.addEventListener("click", async e => {
  const card = e.target.closest(".svccard");
  if (card && !e.target.closest("a, button")){ go("service", card.dataset.svc); return; }
  const b = e.target.closest("button"); if (!b) return;
  const s = SERVICES.find(x => x.id === serviceId);
  if (b.hasAttribute("data-tobook")){ $("#bookPanel").scrollIntoView({behavior: "smooth", block: "start"}); return; }
  if (b.dataset.svccat){ SVC.cat = b.dataset.svccat; render(); return; }
  if (b.dataset.svcfmt){ SVC.fmt = b.dataset.svcfmt; render(); return; }
  if (b.dataset.bkfmt){ SVC.format = b.dataset.bkfmt; refreshBookPanel(); return; }
  if (b.dataset.bkday){ SVC.date = b.dataset.bkday; SVC.slot = null; refreshBookPanel(); return; }
  if (b.dataset.bkslot){ SVC.slot = b.dataset.bkslot; refreshBookPanel(); return; }
  if (b.hasAttribute("data-bknext")){ if (!SVC.slot) return; SVC.step = "details"; refreshBookPanel(); if (innerWidth < 900) $("#bookPanel").scrollIntoView({behavior:"smooth", block:"start"}); return; }
  if (b.hasAttribute("data-bkback")){ SVC.step = "pick"; refreshBookPanel(); return; }
  if (b.dataset.ics){ const bk = b.dataset.ics === "last" ? SVC.lastBooking : (MY.bookings || []).find(x => x.id === b.dataset.ics); if (bk) downloadICS(bk); return; }
  if (b.dataset.bkcancel){
    const bk = (MY.bookings || []).find(x => x.id === b.dataset.bkcancel); if (!bk) return;
    if (!confirm(`Cancel your booking for ${bk.serviceTitle} on ${fmtLong(bk.startMs)}?`)) return;
    try { await FB.cancelMyBooking(bk.id); toast("Booking cancelled");
      sendEmail(`Booking #B${bk.number} cancelled by the customer`, {Booking:"#B" + bk.number, Service: bk.serviceTitle, When: fmtLong(bk.startMs), Name: bk.name, Email: bk.email, Phone: bk.phone, _replyto: bk.email}).catch(() => {}); }
    catch(er){ console.error(er); toast("Couldn't cancel. Contact us instead."); }
  }
});
document.addEventListener("submit", async e => {
  if (e.target.id !== "bookFormV94") return;   // v95: replaced by the handler in the v95 block below
  e.preventDefault();
  const f = e.target, msg = $("#bookMsg"), err = validate(f);
  if (err) return showMsg(msg, false, err);
  const s = SERVICES.find(x => x.id === serviceId); if (!s || !USER) return;
  const day = dayList(s).find(d => d.date === SVC.date), slot = day && slotsFor(s, day.date, day.dow).find(x => x.key === SVC.slot);
  if (!slot || slot.taken || slot.past){ SVC.step = "pick"; refreshBookPanel(); return toast("That time is no longer available. Please pick another."); }
  const d = Object.fromEntries(new FormData(f));
  const booking = { uid: USER.uid, serviceId: s.id, serviceTitle: s.title, providerName: s.providerName, category: s.category,
    startMs: slot.ms, date: day.date, time: slot.hhmm, durationMin: s.duration, format: SVC.format,
    platform: SVC.format === "online" ? s.platform : "", location: SVC.format === "online" ? "" : s.location,
    price: s.price, priceUnit: s.priceUnit, name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(),
    address: (d.address || "").trim(), notes: (d.notes || "").trim() };
  const btn = $("#bookSubmit"); btn.disabled = true; btn.textContent = "Booking…";
  let res;
  try { res = await FB.bookService(booking, slot.key, s.capacity); }
  catch(er){
    console.error(er); btn.disabled = false; btn.textContent = "Request booking";
    if (er.message === "slot-full"){ SVC.step = "pick"; SVC.slot = null; refreshBookPanel(); return toast("Sorry, that time was just booked. Please pick another time."); }
    return showMsg(msg, false, `We couldn't save your booking. Check your connection and try again, or email us at ${CONTACT_EMAIL}.`);
  }
  FB.saveProfile(USER.uid, {name: booking.name, phone: booking.phone}).catch(() => {});
  PROFILE = {...(PROFILE || {}), name: booking.name, phone: booking.phone};
  sendEmail(`Booking request #B${res.number}: ${s.title}, ${fmtLong(slot.ms)}`, {
    Booking: "#B" + res.number, Service: s.title, Provider: s.providerName, When: fmtLong(slot.ms) + " (Toronto time)", Length: durTxt(s.duration),
    Format: SVC.format === "online" ? `Online${s.platform ? " (" + s.platform + ")" : ""}` : `In person${s.location ? " (" + s.location + ")" : ""}`,
    Price: s.price == null ? "On request" : money(s.price) + " / " + s.priceUnit, Name: booking.name, Phone: booking.phone, Email: booking.email,
    ...(booking.address ? {Address: booking.address} : {}), Notes: booking.notes || "—",
    "What happens next": "Your spot is held. We'll confirm by email, usually within a day.",
    _cc: booking.email, _replyto: booking.email, _template: "box"
  }).catch(() => {});
  SVC.lastBooking = {...booking, id: res.id, number: res.number};
  resetBooking(); go("booked");
});

/* =========================================================
   v95: SERVICES — people directory, profile extras, repeat bookings, booking page
   ========================================================= */
let ALLSLOTS = {}, allSlotsOn = false;
SVC.tab = null; SVC.pf = {fmt: "", lang: "", week: false}; SVC.often = "one"; SVC.weeks = 4; SVC.lastSeries = [];
BOOK_TEXT["Time changed"] = "Your session has a new time. If it doesn't work for you, reply to this email or cancel from My bookings.";
BOOK_TEXT["Reminder"] = "A reminder about your session. See you soon!";
TITLES.mybooking = "Your booking · Nojan";
const CHK = '<svg class="pchk" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" role="img" aria-label="Checked by Nojan"><circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.8 2.8L16 9.5"/></svg>';
function startAllSlots(){
  if (allSlotsOn || !FB || !FB.watchOpenSlots) return; allSlotsOn = true;
  FB.watchOpenSlots(Date.now() - 3600000, m => { ALLSLOTS = m; if (["services", "provider"].includes(current())) setTimeout(render); }, err => console.error(err));
}
function nextFree(s, n){
  const out = [];
  for (const d of dayList(s)) for (const x of slotsFor(s, d.date, d.dow)) if (!x.taken && !x.past){ out.push({...x, date: d.date, sid: s.id}); if (out.length >= (n || 1)) return out; }
  return out;
}
function provInfo(p){
  const sv = servicesOf(p.id), paid = sv.filter(s => s.price > 0).sort((a, b) => a.price - b.price)[0] || null;
  const next = sv.flatMap(s => nextFree(s, 1)).sort((a, b) => a.ms - b.ms)[0] || null;
  const rv = p.reviews || [], avg = rv.length ? rv.reduce((t, r) => t + (+r.stars || 0), 0) / rv.length : 0;
  return {sv, from: paid, free: !paid && sv.some(s => s.price === 0), next, online: sv.some(s => s.format !== "in-person"), inp: sv.some(s => s.format !== "online"), rv, avg};
}
const dayTime = ms => `${fmtWhen(ms, {weekday: "short", month: "short", day: "numeric"})}, ${fmtTime(ms)}`;

/* ---- Services page: People | Services ---- */
const svcTab = () => !PROVIDERS.length ? "services" : (SVC.tab || "people");
function svcTabsHTML(){
  if (!PROVIDERS.length) return "";
  return `<div class="seg svctabs" role="group" aria-label="Show">${[["people", "People"], ["services", "Services"]].map(([v, l]) => `<button type="button" data-svctab="${v}" aria-pressed="${svcTab() === v}">${l}</button>`).join("")}</div>`;
}
function personCardHTML(p, i){
  const where = [i.online ? "Online" : "", i.inp ? "In person" : ""].filter(Boolean);
  return `<article class="pdcard">
    <div class="pdtop">${provAvatar(p, 56)}<div><b class="pdname"><span>${esc(p.name)}</span>${p.checked ? CHK : ""}</b>${p.headline ? `<span class="pdhl">${esc(p.headline)}</span>` : ""}</div></div>
    <div class="pdmeta">${(p.languages || []).length ? `<span>${p.languages.map(esc).join(" · ")}</span>` : ""}${where.map(w => `<span>${w}</span>`).join("")}${p.location ? `<span>${esc(p.location)}</span>` : ""}${i.rv.length ? `<span class="pdrate"><b>${i.avg.toFixed(1)}</b> <span>of 5</span> (${i.rv.length})</span>` : ""}</div>
    <div class="pdfoot"><div>${i.from ? `<b><span>From</span> ${money(i.from.price)} <small>/ ${esc(i.from.priceUnit)}</small></b>` : i.free ? `<b>Free</b>` : i.sv.length ? `<b>Price on request</b>` : `<span class="note">No services yet</span>`}
      ${i.next ? `<span class="pdnext"><span>Next free:</span> ${dayTime(i.next.ms)}</span>` : i.sv.length ? `<span class="note">No open times right now</span>` : ""}</div>
      <a class="btn" href="#provider-${esc(p.id)}">View profile</a></div>
  </article>`;
}
function peopleDirHTML(){
  startAllSlots();
  const f = SVC.pf, q = query.trim().toLowerCase(), wk = Date.now() + 7 * 86400000;
  const langs = [...new Set(PROVIDERS.flatMap(p => p.languages || []))].slice(0, 5);
  const rows = PROVIDERS.map(p => ({p, i: provInfo(p)})).filter(({p, i}) =>
    (!q || [p.name, p.headline, p.about, (p.skills || []).join(" "), i.sv.map(s => s.title + " " + s.category).join(" ")].join(" ").toLowerCase().includes(q)) &&
    (f.fmt !== "online" || i.online) && (f.fmt !== "inp" || i.inp) && (!f.lang || (p.languages || []).includes(f.lang)) && (!f.week || (i.next && i.next.ms < wk)));
  rows.sort((a, b) => (a.i.next ? a.i.next.ms : 9e15) - (b.i.next ? b.i.next.ms : 9e15));
  const chip = (k, v, label, on) => `<button type="button" data-pf="${k}" data-v="${esc(v)}" aria-pressed="${on}">${label}</button>`;
  return `<div class="chips pdirchips" role="group" aria-label="Filter people">
      ${chip("all", "", "All", !f.fmt && !f.lang && !f.week)}${chip("fmt", "online", "Online", f.fmt === "online")}${chip("fmt", "inp", "In person", f.fmt === "inp")}${langs.map(l => chip("lang", l, `<span>Speaks</span> ${esc(l)}`, f.lang === l)).join("")}${chip("week", "1", "Free this week", f.week)}</div>
    ${rows.length ? `<div class="pdir">${rows.map(({p, i}) => personCardHTML(p, i)).join("")}</div>` : `<div class="empty">Nobody matches these filters yet. <button class="linkbtn" type="button" data-pf="all" data-v="">Show everyone</button></div>`}
    <p class="note" style="text-align:center;margin:16px 0 0">Want to offer a service? <a href="#contact-us" style="color:var(--link)">Tell us about yourself</a></p>`;
}

/* ---- Provider profile extras ---- */
function provHeadExtra(p, i){
  const st = [i.rv.length ? [`${i.avg.toFixed(1)} / 5`, i.rv.length === 1 ? "1 review" : `${i.rv.length} reviews`] : null, p.reply ? [esc(p.reply), "usual reply"] : null,
    (p.languages || []).length ? [p.languages.slice(0, 3).map(esc).join(", "), "languages"] : null].filter(Boolean);
  return st.length ? `<div class="pstats">${st.map(([a, b]) => `<div><b>${a}</b><span>${b}</span></div>`).join("")}</div>` : "";
}
function provBookHTML(p, i){
  const intro = i.sv.find(s => s.price === 0 && s.duration <= 20);
  const nx = i.sv.filter(s => s !== intro).flatMap(s => nextFree(s, 3)).sort((a, b) => a.ms - b.ms).slice(0, 3);
  return `${intro ? `<a class="pintro" href="#service-${esc(intro.id)}"><span><b>Not sure yet?</b> <span>Book a free intro call</span></span><span aria-hidden="true">›</span></a>` : ""}
    ${nx.length ? `<section class="pcard"><div class="phd"><h2>Next free times</h2><span class="pmuted">Toronto time</span></div>
      <div class="pnext">${nx.map(x => `<button type="button" data-pslot="${esc(x.sid)}|${x.date}|${esc(x.key)}"><small>${fmtWhen(x.ms, {weekday: "short", month: "short", day: "numeric"})}</small><b>${fmtTime(x.ms)}</b><small>${esc((SERVICES.find(s => s.id === x.sid) || {}).title || "")}</small></button>`).join("")}</div></section>` : ""}`;
}
function provTrustHTML(p, i){
  return `${p.checked || (p.checks || []).length ? `<section class="pcard"><h2>What Nojan checked</h2><ul class="pchecks">${((p.checks || []).length ? p.checks : ["Identity"]).map(c => `<li>${esc(c)}</li>`).join("")}</ul></section>` : ""}
    ${i.rv.length ? `<section class="pcard"><div class="phd"><h2>Reviews</h2><span class="pmuted">Only from people who had a session</span></div>
      <ul class="prevs">${i.rv.map(r => `<li><div class="prevh"><b>${esc(r.name || "Customer")}</b><span class="pmuted">${esc(String(r.stars))} <span>of 5</span>${r.date ? ` · ${esc(r.date)}` : ""}</span></div>${r.text ? `<p>${esc(r.text)}</p>` : ""}</li>`).join("")}</ul></section>` : ""}
    ${i.sv.length ? `<section class="pcard"><h2>Good to know</h2><ul class="pknow"><li>No payment online. You pay at the session.</li><li>Your time is held as soon as you send the request.</li><li>Plans changed? Cancel from My bookings.</li></ul></section>` : ""}`;
}

/* ---- Booking: one time, every week, or a package of 5 ---- */
const oftenOf = s => s.repeat === false || s.price == null ? "one" : (SVC.often || "one");
const packPrice = s => Math.round(s.price * (100 - (s.packPct || 0))) / 100;
function seriesOf(s, slot){
  const o = oftenOf(s), n = o === "pack" ? 5 : o === "weekly" ? (SVC.weeks || 4) : 1, out = [];
  const [y, m, d] = slot.date.split("-").map(Number);
  for (let k = 0; k < n; k++){
    const dt = new Date(Date.UTC(y, m - 1, d + 7 * k)), date = dt.toISOString().slice(0, 10);
    const x = slotsFor(s, date, DAYS[dt.getUTCDay()]).find(z => z.hhmm === slot.hhmm);
    out.push(x ? {...x, date, ok: !x.taken && !x.past} : {date, hhmm: slot.hhmm, ms: torontoMs(date, slot.hhmm), ok: false, off: true});
  }
  return out;
}
function oftenHTML(s){
  if (s.repeat === false || s.price == null) return "";
  const o = oftenOf(s), each = s.price === 0 ? "Free" : money(s.price);
  const opt = (v, t, sub, pr) => `<button type="button" class="often" data-bkoften="${v}" aria-pressed="${o === v}"><span class="oftxt"><b>${t}</b>${sub ? `<small>${sub}</small>` : ""}</span><span class="oftpr">${pr}</span></button>`;
  return `<div><div class="note" style="margin-bottom:6px;font-weight:600;color:var(--fg)">How often?</div>
    <div class="oftens" role="group" aria-label="How often">${opt("one", "One time", "", each)}${opt("weekly", "Every week", "Same day and time", `${each} <small>each</small>`)}${s.price > 0 ? opt("pack", "Package of 5", s.packPct ? `<span>5 weekly sessions, save</span> ${s.packPct}%` : "5 weekly sessions", money(packPrice(s) * 5)) : ""}</div>
    ${o === "weekly" ? `<label class="oftweeks"><span>For how many weeks?</span><select data-bkweeks aria-label="For how many weeks?">${[2, 3, 4, 6, 8].map(n => `<option${(SVC.weeks || 4) === n ? " selected" : ""}>${n}</option>`).join("")}</select></label>` : ""}</div>`;
}
function seriesHTML(s, slot){
  const list = seriesOf(s, slot); if (list.length < 2) return "";
  return `<ul class="serlist">${list.map((x, k) => `<li${x.ok ? "" : ' class="no"'}><span>${k + 1}. ${dayTime(x.ms)}</span><span>${x.ok ? "Free" : x.off ? "Closed that day" : "Already booked"}</span></li>`).join("")}</ul>
    ${list.some(x => !x.ok) ? `<p class="note" style="margin:0">Dates that are not free are left out.</p>` : ""}`;
}
function bookExtraHTML(s){
  const pp = s.providerUid ? PROVIDERS.find(x => x.id === s.providerUid) : null, langs = (pp && pp.languages) || [];
  return `<fieldset class="whofor"><legend>Who is the session for?</legend><div class="whoseg">${["Me", "My child", "Someone else"].map((w, k) => `<label><input type="radio" name="who" value="${w}"${k ? "" : " checked"}><span>${w}</span></label>`).join("")}</div></fieldset>
    <label>Their name <small>(if it is not for you)</small><input name="forName" maxlength="60" autocomplete="off"></label>
    <label>Your level<select name="level"><option>Complete beginner</option><option>I know a little</option><option>Comfortable</option></select></label>
    ${langs.length > 1 ? `<label>Language for the session<select name="lang">${langs.map(l => `<option>${esc(l)}</option>`).join("")}</select></label>` : ""}`;
}
const BOOK_END = `<div class="bknext"><b>What happens next</b><ol><li>We confirm, or offer another time, usually within a day.</li><li>You get the meeting link or the place by email.</li><li>Plans changed? Cancel from My bookings.</li></ol></div>
    <label class="check bkagree"><input type="checkbox" name="agree"> <span>I agree to share my name and answers with the provider.</span></label>
    <div id="bookMsg" hidden></div>
    <button class="btn" type="submit" id="bookSubmit">Send booking request</button>`;

document.addEventListener("click", e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.svctab){ SVC.tab = b.dataset.svctab; render(); return; }
  if (b.dataset.pf){ const f = SVC.pf, k = b.dataset.pf, v = b.dataset.v;
    if (k === "all") SVC.pf = {fmt: "", lang: "", week: false}; else if (k === "week") f.week = !f.week; else f[k] = f[k] === v ? "" : v;
    render(); return; }
  if (b.dataset.bkoften){ SVC.often = b.dataset.bkoften; refreshBookPanel(); return; }
  if (b.dataset.pslot){ const [sid, date, key] = b.dataset.pslot.split("|"); go("service", sid); SVC.date = date; SVC.slot = key; refreshBookPanel(); return; }
});
document.addEventListener("change", e => {
  if (e.target.matches("[data-bkweeks]")){ SVC.weeks = +e.target.value || 4; refreshBookPanel(); return; }
  if (e.target.matches("[data-bkchk]")){ const m = bkChecks(); m[e.target.dataset.bkchk] = e.target.checked; try { localStorage.setItem("nojanChk", JSON.stringify(m)); } catch (_) {} }
});
function bkChecks(){ try { return JSON.parse(localStorage.getItem("nojanChk") || "{}") || {}; } catch (_) { return {}; } }

document.addEventListener("submit", async e => {
  if (e.target.id !== "bookForm") return;
  e.preventDefault();
  const f = e.target, msg = $("#bookMsg"), err = validate(f);
  if (err) return showMsg(msg, false, err);
  if (!f.agree.checked) return showMsg(msg, false, "Please tick the box to agree before you send.");
  const s = SERVICES.find(x => x.id === serviceId); if (!s || !USER) return;
  const day = dayList(s).find(d => d.date === SVC.date), slot = day && slotsFor(s, day.date, day.dow).find(x => x.key === SVC.slot);
  if (!slot || slot.taken || slot.past){ SVC.step = "pick"; refreshBookPanel(); return toast("That time is no longer available. Please pick another."); }
  const o = oftenOf(s), list = seriesOf(s, {...slot, date: day.date}).filter(x => x.ok && x.key);
  const d = Object.fromEntries(new FormData(f)), unit = o === "pack" ? packPrice(s) : s.price;
  const seriesId = list.length > 1 ? "S" + Date.now().toString(36) + Math.random().toString(36).slice(2, 6) : "";
  const base = { uid: USER.uid, serviceId: s.id, serviceTitle: s.title, providerName: s.providerName, providerUid: s.providerUid || "", category: s.category,
    durationMin: s.duration, format: SVC.format, platform: SVC.format === "online" ? s.platform : "", location: SVC.format === "online" ? "" : s.location,
    price: unit, priceUnit: s.priceUnit, name: d.name.trim(), email: d.email.trim(), phone: d.phone.trim(), address: (d.address || "").trim(), notes: (d.notes || "").trim(),
    who: d.who || "Me", forName: (d.forName || "").trim().slice(0, 60), level: d.level || "", lang: d.lang || "",
    ...(seriesId ? {seriesId, seriesKind: o, seriesN: list.length} : {}) };
  const btn = $("#bookSubmit"); btn.disabled = true; btn.textContent = "Sending…";
  const done = [];
  for (let k = 0; k < list.length; k++){
    const x = list[k], bk = {...base, startMs: x.ms, date: x.date, time: x.hhmm, ...(seriesId ? {seriesI: k + 1} : {})};
    try { const r = await FB.bookService(bk, x.key, s.capacity); done.push({...bk, id: r.id, number: r.number, status: "Requested", slotKey: x.key, history: [{status: "Requested", at: new Date().toISOString(), by: "customer"}]}); }
    catch(er){
      console.error(er);
      if (er.message !== "slot-full" && !done.length){ btn.disabled = false; btn.textContent = "Send booking request"; return showMsg(msg, false, `We couldn't save your booking. Check your connection and try again, or email us at ${CONTACT_EMAIL}.`); }
    }
  }
  if (!done.length){ SVC.step = "pick"; SVC.slot = null; refreshBookPanel(); return toast("Sorry, that time was just booked. Please pick another time."); }
  FB.saveProfile(USER.uid, {name: base.name, phone: base.phone}).catch(() => {});
  PROFILE = {...(PROFILE || {}), name: base.name, phone: base.phone};
  sendEmail(`Booking request #B${done[0].number}${done.length > 1 ? ` (+${done.length - 1} more)` : ""}: ${s.title}, ${fmtLong(done[0].startMs)}`, {
    Booking: done.map(x => "#B" + x.number).join(", "), Service: s.title, Provider: s.providerName,
    When: done.map(x => fmtLong(x.startMs)).join(" | ") + " (Toronto time)", Length: durTxt(s.duration),
    ...(done.length > 1 ? {Type: o === "pack" ? `Package of ${done.length}` : `Weekly, ${done.length} sessions`} : {}),
    Format: SVC.format === "online" ? `Online${s.platform ? " (" + s.platform + ")" : ""}` : `In person${s.location ? " (" + s.location + ")" : ""}`,
    Price: unit == null ? "On request" : money(unit) + " / " + s.priceUnit + (done.length > 1 ? `, total ${money(unit * done.length)}` : ""),
    Name: base.name, Phone: base.phone, Email: base.email, ...(base.address ? {Address: base.address} : {}),
    For: base.who + (base.forName ? ` (${base.forName})` : ""), Level: base.level || "—", ...(base.lang ? {Language: base.lang} : {}), Notes: base.notes || "—",
    "What happens next": "Your time is held. We'll confirm by email, usually within a day.",
    _cc: base.email, _replyto: base.email, _template: "box"
  }).catch(() => {});
  SVC.lastBooking = done[0]; SVC.lastSeries = done;
  resetBooking(); SVC.often = "one";
  go("mybooking", done[0].id);
  toast(done.length > 1 ? `${done.length} sessions requested` : "Booking request sent");
});

/* ---- The booking page ---- */
function findBooking(id){
  return (MY.bookings || []).find(b => b.id === id) || (isAdmin() && (ADM.bookings || []).find(b => b.id === id)) || (SVC.lastSeries || []).find(b => b.id === id) || null;
}
function bookingView(){
  if (!authReady) return `<div class="empty">Loading…</div>`;
  if (!USER) return needSignIn("orders", "Sign in to see your booking", "Your bookings and their status show here after you sign in.");
  startMyBookings();
  const b = findBooking(bookingId);
  if (!b) return MY.bookings ? `<div class="empty">We couldn't find this booking. <a href="#my-orders" style="color:var(--link)">See all your bookings</a></div>` : `<div class="empty">Loading your booking…</div>`;
  const s = SERVICES.find(x => x.id === b.serviceId), now = Date.now(), end = b.startMs + b.durationMin * 60000;
  const live = ["Requested", "Confirmed"].includes(b.status), up = live && b.startMs > now, hist = b.history || [];
  const when = st => { const h = hist.find(x => x.status === st); return h ? fmtDate(h.at) : ""; };
  const moved = hist.filter(h => h.status === "Time changed");
  const sib = b.seriesId ? [...new Map([...(SVC.lastSeries || []), ...(MY.bookings || [])].filter(x => x.seriesId === b.seriesId).map(x => [x.id, x])).values()].sort((x, y) => x.startMs - y.startMs) : [];
  const joinOpen = b.status === "Confirmed" && b.format === "online" && b.meetingLink && now > b.startMs - 600000 && now < end;
  const conf = ["Confirmed", "Completed", "No-show"].includes(b.status);
  const step = (state, title, sub) => `<li class="${state}"><span class="tdot" aria-hidden="true"></span><div><b>${title}</b>${sub ? `<span>${sub}</span>` : ""}</div></li>`;
  const steps = b.status === "Cancelled"
    ? [step("done", "Request sent", esc(when("Requested"))), step("stop", "Cancelled", esc(when("Cancelled")))]
    : [step("done", "Request sent", esc(when("Requested"))),
       step(conf ? "done" : "now", conf ? "Confirmed" : "Waiting for confirmation", conf ? esc(when("Confirmed")) : "We usually answer within a day."),
       ...moved.map(h => step("done", "Time changed", esc(fmtDate(h.at)))),
       step(b.reminded ? "done" : "", "Reminder", b.reminded ? "Sent by email" : "By email, the day before"),
       step(b.status === "Completed" ? "done" : b.status === "No-show" ? "stop" : "", b.status === "No-show" ? "Missed session" : "Session", `${esc(dayTime(b.startMs))}${b.price ? ` · <span>pay at the session:</span> ${money(b.price)}` : ""}`),
       step(b.sessionNotes ? "done" : "", "Notes from your session", b.sessionNotes ? "Ready below" : "They show here afterwards")];
  const chk = bkChecks(), box = (key, text) => `<label class="check"><input type="checkbox" data-bkchk="${esc(key)}"${chk[key] ? " checked" : ""}> <span>${esc(text)}</span></label>`;
  const ans = [b.who && b.who !== "Me" ? ["For", b.who + (b.forName ? ` (${b.forName})` : "")] : null, b.level ? ["Level", b.level] : null, b.lang ? ["Language", b.lang] : null, b.notes ? ["Focus", b.notes] : null].filter(Boolean);
  return `<div class="bkpage">
    <section class="panel">
      <div class="bktop">${pill(b.status)}<span class="note">#B${b.number}${b.seriesId ? ` · ${b.seriesKind === "pack" ? "<span>Package</span>" : "<span>Weekly</span>"} ${b.seriesI}/${b.seriesN}` : ""}</span></div>
      <div class="bkhead"><div class="bkdate"><small>${fmtWhen(b.startMs, {month: "short"})}</small><b>${fmtWhen(b.startMs, {day: "numeric"})}</b><small>${fmtWhen(b.startMs, {weekday: "short"})}</small></div>
        <div><h1>${esc(b.serviceTitle)}</h1><p>${fmtTime(b.startMs)} · ${durTxt(b.durationMin)} · <span>Toronto time</span></p>
          <p class="note">${b.format === "online" ? "Online" : "In person"} · <span>with</span> ${esc(b.providerName)}${b.price ? ` · ${money(b.price)}` : ""}</p></div></div>
      ${b.status === "Confirmed" && b.format === "online" ? (joinOpen ? `<a class="btn bkjoin" href="${esc(b.meetingLink)}" target="_blank" rel="noopener">Join the online session</a>` : `<button class="btn bkjoin" type="button" disabled>${b.meetingLink ? "Join opens 10 minutes before" : "The meeting link will show here"}</button>`) : ""}
      ${b.status === "Confirmed" && b.format !== "online" && b.locationNote ? `<p class="picked" style="margin:0"><b>Where:</b> ${esc(b.locationNote)}</p>` : ""}
      <div class="bkacts">${up ? `<button class="btn small ghost" type="button" data-ics="${b.id}">Add to calendar</button>` : ""}${p2on() && up && s && !b.changeReq ? `<button class="btn small ghost" type="button" data-chgopen="${b.id}">Ask for another time</button>` : `<a class="btn small ghost" href="#contact-us">${up && !p2on() ? "Ask for another time" : "Message us"}</a>`}${s ? `<a class="btn small ghost" href="#service-${esc(s.id)}">${up ? "See the service" : "Book again"}</a>` : ""}${up ? `<button class="linkbtn" type="button" data-bkcancel="${b.id}" style="color:var(--danger)">Cancel booking</button>` : ""}</div>
    </section>
    ${bkTopP2(b, s)}
    <section class="panel"><h2>Where things stand</h2><ol class="tline">${steps.join("")}</ol></section>
    ${b.sessionNotes || (b.tasks || []).length ? `<section class="panel"><h2>Notes from your session</h2>${b.sessionNotes ? `<p style="margin:0;white-space:pre-line">${esc(b.sessionNotes)}</p>` : ""}
      ${(b.tasks || []).length ? `<b>To practise before next time</b><div class="bkchecks">${b.tasks.map((t, k) => box(b.id + ":t" + k, t)).join("")}</div>` : ""}</section>` : ""}
    ${up && s && (s.prep || []).length ? `<section class="panel"><h2>Get ready</h2><div class="bkchecks">${s.prep.map((t, k) => box(b.id + ":p" + k, t)).join("")}</div></section>` : ""}
    ${sib.length > 1 ? `<section class="panel"><h2>All sessions in this booking</h2><ul class="serlist">${sib.map(x => `<li><a href="#mybooking-${x.id}"${x.id === b.id ? ' aria-current="true"' : ""}>${esc(dayTime(x.startMs))}</a><span>${esc(x.status)}</span></li>`).join("")}</ul></section>` : ""}
    ${ans.length ? `<section class="panel"><h2>Your answers</h2><dl class="bkans">${ans.map(([k, v]) => `<dt>${k}</dt><dd>${esc(v)}</dd>`).join("")}</dl></section>` : ""}
    ${bkMsgP2(b)}
    <p class="note" style="text-align:center;margin:0"><a href="#my-orders" style="color:var(--link)">All my bookings</a></p>
  </div>`;
}
views.mybooking = bookingView;

/* ---- Admin: move a booking, session notes, reminders ---- */
function toLocalInput(ms){ const p = tzParts(ms); return `${p.y}-${pad2(p.m)}-${pad2(p.d)}T${pad2(p.H)}:${pad2(p.M)}`; }
function adminBookingExtraHTML(b){
  return `${adminP2HTML(b)}<form class="oactions" data-bkmoveform="${b.id}">
        <label>Move to another time <small>(Toronto time)</small><input name="when" type="datetime-local" required value="${toLocalInput(b.startMs)}"></label>
        <label class="check"><input type="checkbox" name="email" checked> Email the customer the new time</label>
        <button class="btn small ghost" type="submit" style="color:var(--fg)">Move booking</button>${p2on() ? `<button class="btn small ghost" type="submit" data-offer="1" style="color:var(--fg)">Offer this time to the customer</button>` : ""}
      </form>
      <form class="oactions" data-bknotesform="${b.id}">
        <label style="flex-basis:100%">Session notes for the customer <small>(they see these on their booking page)</small><textarea name="sessionNotes" style="min-height:70px">${esc(b.sessionNotes || "")}</textarea></label>
        <label style="flex-basis:100%">To practise before next time <small>(one per line)</small><textarea name="tasks" style="min-height:60px">${esc((b.tasks || []).join("\n"))}</textarea></label>
        <button class="btn small ghost" type="submit" style="color:var(--fg)">Save notes</button>
        ${b.status === "Confirmed" && b.startMs > Date.now() && b.email ? `<button class="linkbtn" type="button" data-bkremind="${b.id}">${b.reminded ? "Email another reminder" : "Email a reminder now"}</button>` : ""}
      </form>`;
}
document.addEventListener("submit", async e => {
  const f = e.target, mid = f.dataset && (f.dataset.bkmoveform || f.dataset.bknotesform); if (!mid) return;
  e.preventDefault();
  const b = (ADM.bookings || []).find(x => x.id === mid); if (!b || !isAdmin()) return;
  const btn = f.querySelector("button[type=submit]"), label = btn.textContent; btn.disabled = true;
  try {
    if (f.dataset.bkmoveform){
      const w = f.when.value; if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/.test(w)) return toast("Choose a date and time");
      const date = w.slice(0, 10), hhmm = w.slice(11, 16), ms = torontoMs(date, hhmm);
      if (ms === b.startMs) return toast("That is the time it already has");
      const svc = ALL_SERVICES.find(x => x.id === b.serviceId), cap = svc && svc.classType === "group" ? Math.max(2, +svc.capacity || 6) : 1;
      if (e.submitter && e.submitter.dataset.offer){
        await FB.updateBooking(b.id, {offer: {startMs: ms, date, time: hhmm, slotKey: `${b.serviceId}_${date}_${hhmm.replace(":", "")}`}}, {status: "Time offered", by: USER.email});
        if (b.email) emailBooking(b, "New time offered", `We can offer ${fmtLong(ms)} (Toronto time) instead of ${fmtLong(b.startMs)}.`, {}).catch(er => console.error(er));
        toast("Offer sent to the customer"); return;
      }
      await FB.moveBooking(b.id, {startMs: ms, date, time: hhmm, slotKey: `${b.serviceId}_${date}_${hhmm.replace(":", "")}`}, cap, USER.email);
      if (f.email.checked && b.email) emailBooking({...b, startMs: ms}, "Time changed", `Your session moved from ${fmtLong(b.startMs)} to ${fmtLong(ms)} (Toronto time).`, {}).catch(er => { console.error(er); toast("Moved, but the email didn't send"); });
      toast("Booking moved");
    } else {
      await FB.updateBooking(b.id, {sessionNotes: f.sessionNotes.value.trim().slice(0, 3000), tasks: f.tasks.value.split("\n").map(x => x.trim()).filter(Boolean).slice(0, 12)}, {status: "Notes saved", by: USER.email});
      toast("Notes saved");
    }
  } catch(er){ console.error(er); toast(er.message === "slot-full" ? "That time is already taken" : "Couldn't save. Try again."); }
  finally { btn.disabled = false; btn.textContent = label; }
});
document.addEventListener("click", async e => {
  const r = e.target.closest("[data-bkremind]"); if (!r || !isAdmin()) return;
  const b = (ADM.bookings || []).find(x => x.id === r.dataset.bkremind); if (!b) return;
  r.disabled = true;
  try { await emailBooking(b, "Reminder", "", {}); await FB.updateBooking(b.id, {reminded: true}, {status: "Reminder emailed", by: USER.email}); toast("Reminder emailed"); }
  catch(er){ console.error(er); toast("The reminder didn't send"); r.disabled = false; }
});
/* Reminders go out by email the day before, whenever an admin has the site open */
let remindBusy = false;
async function autoRemind(){
  if (remindBusy || !isAdmin() || !ADM.bookings || !FB || !FB.updateBooking) return; remindBusy = true;
  try {
    const now = Date.now();
    for (const b of ADM.bookings.filter(b => b.kind !== "event" && b.status === "Confirmed" && !b.reminded && b.email && b.startMs > now && b.startMs - now < 24 * 3600000).slice(0, 5)){
      try { await FB.updateBooking(b.id, {reminded: true}, {status: "Reminder emailed", by: "automatic"}); await emailBooking(b, "Reminder", "", {}); } catch(er){ console.error(er); }
    }
  } finally { remindBusy = false; }
}

/* =========================================================
   v96: SERVICES part 2 — messages, time changes, offers, customer reviews
   (customers see these only when the admin switch is on)
   ========================================================= */
let SET = {}, ALL_SETTINGS = false;
const BKP = {msgs: {}, unsub: {}, pick: [], changing: null, day: null, stale: false, seen: {}};
const p2on = () => !!SET.part2;
BOOK_TEXT["New time offered"] = "We can offer you another time. Open your booking to accept it or keep the time you have.";
BOOK_TEXT["Change declined"] = "We couldn't change the time, so your booking stays as it is. Reply to this email if you need help.";
function softRender(){
  const a = document.activeElement, v = $("#view");
  if (current() === "mybooking" && a && v && v.contains(a) && /^(TEXTAREA|INPUT|SELECT)$/.test(a.tagName)){ BKP.stale = true; return; }
  BKP.stale = false; render();
}
document.addEventListener("focusout", () => { if (BKP.stale) setTimeout(() => { if (BKP.stale) softRender(); }, 150); });
const bkAny = id => findBooking(id) || (ADM.bookings || []).find(x => x.id === id) || null;
const bkCap = b => { const svc = ALL_SERVICES.find(x => x.id === b.serviceId); return svc && svc.classType === "group" ? Math.max(2, +svc.capacity || 6) : 1; };
const bkFlags = b => !p2on() ? "" : (b.changeReq ? `<span class="pill bkflagp">Time change</span>` : "") + (b.msgFrom === "customer" && (!b.msgSeenA || b.msgSeenA < b.msgAt) ? `<span class="pill bkflagp">New message</span>` : "") + (b.review && !b.review.published ? `<span class="pill bkflagp">Review</span>` : "");

/* ---- Messages ---- */
function watchMsgs(id){
  if (BKP.unsub[id] || !FB || !FB.watchBookingMsgs) return;
  BKP.unsub[id] = FB.watchBookingMsgs(id, list => { BKP.msgs[id] = list; paintMsgs(id); }, err => { console.error(err); BKP.msgs[id] = BKP.msgs[id] || []; paintMsgs(id); });
}
function msgsHTML(b, admin){
  const list = BKP.msgs[b.id];
  if (!list) return `<p class="note">Loading messages…</p>`;
  if (!list.length) return `<p class="note">${admin ? "No messages yet." : "No messages yet. Ask anything about this booking."}</p>`;
  return list.map(m => { const mine = admin ? m.role === "admin" : m.role !== "admin";
    return `<div class="bmsg${mine ? " me" : ""}"><p>${esc(m.text)}</p><small>${mine ? "" : m.role === "admin" ? "Nojan · " : esc(b.name || "Customer") + " · "}${esc(fmtDate(m.at))}</small></div>`; }).join("");
}
function paintMsgs(id){
  const b = bkAny(id); if (!b) return;
  document.querySelectorAll(`[data-msglog="${id}"]`).forEach(el => { el.innerHTML = msgsHTML(b, el.dataset.admin === "1"); el.scrollTop = el.scrollHeight; });
}
function msgBoxHTML(b, admin){
  watchMsgs(b.id);
  const quick = admin ? [] : ["I'm running late", "I can't find the link", "Can we change the time?"];
  return `<div class="bmsgs" data-msglog="${b.id}" data-admin="${admin ? 1 : 0}" aria-live="polite">${msgsHTML(b, admin)}</div>
    ${quick.length ? `<div class="chips">${quick.map(q => `<button type="button" data-msgquick="${b.id}">${q}</button>`).join("")}</div>` : ""}
    <form class="bmsgform" data-msgform="${b.id}"><input name="text" maxlength="2000" placeholder="Write a message" aria-label="Message" autocomplete="off" required><button class="btn small" type="submit">Send</button></form>`;
}
async function sendBkMsg(id, text, admin){
  const b = admin ? (ADM.bookings || []).find(x => x.id === id) : findBooking(id);
  text = String(text || "").trim().slice(0, 2000); if (!b || !text || !USER) return false;
  const quiet = b.msgFrom === (admin ? "admin" : "customer") && b.msgAt && Date.now() - Date.parse(b.msgAt) < 600000;
  await FB.addBookingMsg(id, {from: USER.uid, role: admin ? "admin" : "customer", text});
  if (!quiet){
    if (admin && b.email) sendEmail(`New message about your booking #B${b.number}`, {Booking: "#B" + b.number, Service: b.serviceTitle, Message: text, "Read and reply": location.origin + "/mybooking-" + b.id, _cc: b.email, _replyto: CONTACT_EMAIL, _template: "box"}).catch(() => {});
    if (!admin) sendEmail(`Message from ${b.name || "a customer"} about booking #B${b.number}`, {Booking: "#B" + b.number, Service: b.serviceTitle, From: b.name || "", Message: text, "Reply in Admin": location.origin + "/admin", _replyto: b.email || CONTACT_EMAIL, _template: "box"}).catch(() => {});
  }
  return true;
}

/* ---- Customer: offer, ask for another time, review ---- */
function offerHTML(b){
  const o = b.offer; if (!o || !["Requested", "Confirmed"].includes(b.status)) return "";
  return `<section class="panel bkoffer"><span class="bklabel">New time offered</span><b class="bkbig">${esc(dayTime(o.startMs))}</b><span class="note"><span>Your time now:</span> ${esc(dayTime(b.startMs))}</span>
    <div class="bkacts"><button class="btn small" type="button" data-offeryes="${b.id}">Accept the new time</button><button class="btn small ghost" type="button" data-offerno="${b.id}">Keep my time</button></div></section>`;
}
function changeHTML(b, s){
  if (b.changeReq && b.changeReq.options) return `<section class="panel"><h2>You asked for another time</h2><ul class="serlist">${b.changeReq.options.map(o => `<li><span>${esc(dayTime(o.startMs))}</span></li>`).join("")}</ul>
    <p class="note" style="margin:0">We'll answer soon. Your booking stays as it is until then.</p><div><button class="linkbtn" type="button" data-chgcancel="${b.id}">Withdraw this request</button></div></section>`;
  if (BKP.changing !== b.id || !s) return "";
  const days = dayList(s).map(d => ({...d, free: slotsFor(s, d.date, d.dow).filter(x => !x.taken && !x.past && x.ms !== b.startMs)})).filter(d => d.free.length);
  const day = days.find(d => d.date === BKP.day) || days[0];
  return `<section class="panel"><h2>Ask for another time</h2><p class="note" style="margin:0">Pick up to 3 times that work for you. We choose one and confirm.</p>
    ${day ? `<label>Day<select data-chgday>${days.map(d => `<option value="${d.date}"${d.date === day.date ? " selected" : ""}>${fmtWhen(d.free[0].ms, {weekday: "short", month: "short", day: "numeric"})}</option>`).join("")}</select></label>
    <div class="timegrid">${day.free.map(x => `<button type="button" data-chgslot="${day.date}|${x.hhmm}|${esc(x.key)}|${x.ms}" aria-pressed="${BKP.pick.some(p => p.slotKey === x.key)}">${fmtTime(x.ms)}</button>`).join("")}</div>` : `<p class="note">There are no other free times right now. Send us a message instead.</p>`}
    ${BKP.pick.length ? `<ul class="serlist">${BKP.pick.map((p, k) => `<li><span>${k + 1}. ${esc(dayTime(p.startMs))}</span><button class="linkbtn" type="button" data-chgdrop="${esc(p.slotKey)}">Remove</button></li>`).join("")}</ul>` : ""}
    <form data-chgform="${b.id}" style="display:grid;gap:10px"><label>Reason <small>(optional)</small><select name="reason"><option>Something came up</option><option>I chose the wrong time</option><option>I'm not feeling well</option><option>Other</option></select></label>
      <label>Note <small>(optional)</small><input name="note" maxlength="300" autocomplete="off"></label>
      <div class="bkacts"><button class="btn small" type="submit"${BKP.pick.length ? "" : " disabled"}>Send request</button><button class="btn small ghost" type="button" data-chgclose>Keep my time</button></div></form></section>`;
}
function reviewHTML(b){
  if (b.review) return `<section class="panel"><h2>Your review</h2><p style="margin:0"><b>${esc(String(b.review.stars))} <span>of 5</span></b>${b.review.text ? ` · ${esc(b.review.text)}` : ""}</p><p class="note" style="margin:0">Thank you. It helps other people choose.</p></section>`;
  return `<section class="panel"><h2>How was your session?</h2><form data-revform="${b.id}" style="display:grid;gap:12px">
    <fieldset class="whofor"><legend>Your rating</legend><div class="whoseg stars">${[1, 2, 3, 4, 5].map(n => `<label><input type="radio" name="stars" value="${n}"${n === 5 ? " checked" : ""}><span>${n}</span></label>`).join("")}</div></fieldset>
    <label>A few words <small>(optional)</small><textarea name="text" maxlength="600" placeholder="What would you tell a friend?"></textarea></label>
    <label class="check"><input type="checkbox" name="showName" checked> <span>Show my first name with the review</span></label>
    <div><button class="btn small" type="submit">Send review</button></div></form></section>`;
}
function bkTopP2(b, s){
  if (!p2on()) return "";
  if (b.msgFrom === "admin" && b.msgAt && b.msgSeenC !== b.msgAt && !BKP.seen[b.id + b.msgAt]){ BKP.seen[b.id + b.msgAt] = 1; FB.updateBooking(b.id, {msgSeenC: b.msgAt}).catch(() => {}); }
  return offerHTML(b) + changeHTML(b, s) + (b.status === "Completed" ? reviewHTML(b) : "");
}
const bkMsgP2 = b => p2on() ? `<section class="panel"><h2>Messages</h2>${msgBoxHTML(b, false)}</section>` : "";

/* ---- Admin ---- */
function adminP2HTML(b){
  if (!p2on()) return "";
  const cr = b.changeReq, rv = b.review, key = "b_" + b.id;
  return `${cr && cr.options ? `<div class="obox bkflag"><h3>Customer asks for another time</h3>${cr.reason || cr.note ? `<span class="note">${esc([cr.reason, cr.note].filter(Boolean).join(" · "))}</span>` : ""}
      <div class="bkacts">${cr.options.map((o, k) => `<button class="btn small" type="button" data-chgpick="${b.id}|${k}">${esc(dayTime(o.startMs))}</button>`).join("")}<button class="btn small ghost" type="button" data-chgkeep="${b.id}" style="color:var(--fg)">Keep current time</button></div></div>` : ""}
      ${b.offer ? `<div class="obox bkflag"><h3>Waiting for the customer</h3><span>You offered ${esc(dayTime(b.offer.startMs))}.</span><div><button class="linkbtn" type="button" data-offerdrop="${b.id}">Withdraw the offer</button></div></div>` : ""}
      ${rv ? `<div class="obox"><h3>Customer review</h3><b>${esc(String(rv.stars))} of 5</b>${rv.text ? `<span>“${esc(rv.text)}”</span>` : ""}${rv.published ? `<span class="note">Shown on the provider's profile</span>` : b.providerUid ? `<div><button class="btn small ghost" type="button" data-revpub="${b.id}" style="color:var(--fg)">Publish on the provider's profile</button></div>` : `<span class="note">This service has no provider profile to show it on.</span>`}</div>` : ""}
      <div class="obox"><h3>Messages</h3><div data-msglazy="${b.id}"${ADM.open.has(key) ? ' data-done="1"' : ""}>${ADM.open.has(key) ? msgBoxHTML(b, true) : ""}</div></div>`;
}
function p2SwitchHTML(){
  return `<div class="obox" style="margin-bottom:14px"><label class="check"><input type="checkbox" data-p2switch${p2on() ? " checked" : ""}> <span><b>Messages, time changes and reviews for customers</b></span></label>
    <span class="note">Turn this on only after the new database rules are published in Firebase. While it is off, customers see the site as before.</span></div>`;
}
document.addEventListener("toggle", e => {
  const d = e.target; if (!d.matches || !d.matches("details.ord[open]")) return;
  const z = d.querySelector("[data-msglazy]"); if (!z || z.dataset.done) return;
  const b = (ADM.bookings || []).find(x => x.id === z.dataset.msglazy); if (!b) return;
  z.dataset.done = "1"; z.innerHTML = msgBoxHTML(b, true);
  if (b.msgFrom === "customer" && b.msgAt && b.msgSeenA !== b.msgAt) FB.updateBooking(b.id, {msgSeenA: b.msgAt}).catch(() => {});
}, true);

document.addEventListener("submit", async e => {
  const f = e.target, ds = f.dataset || {}; if (!ds.msgform && !ds.chgform && !ds.revform) return;
  e.preventDefault();
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
  try {
    if (ds.msgform){ if (await sendBkMsg(ds.msgform, f.text.value, isAdmin() && current() === "admin")) f.text.value = ""; }
    else if (ds.chgform){
      const b = findBooking(ds.chgform); if (!b || !BKP.pick.length) return;
      const req = {options: BKP.pick.slice(0, 3), reason: f.reason.value, note: f.note.value.trim().slice(0, 300), at: new Date().toISOString()};
      await FB.updateBooking(b.id, {changeReq: req}, {status: "Change requested", by: "customer"});
      sendEmail(`${b.name || "A customer"} asks to change booking #B${b.number}`, {Booking: "#B" + b.number, Service: b.serviceTitle, Now: fmtLong(b.startMs), "Asks for": req.options.map(o => fmtLong(o.startMs)).join(" | "), Reason: req.reason, Note: req.note || "—", "Answer in Admin": location.origin + "/admin", _replyto: b.email || CONTACT_EMAIL, _template: "box"}).catch(() => {});
      BKP.pick = []; BKP.changing = null; toast("Request sent"); BKP.stale = false; render();
    } else {
      const b = findBooking(ds.revform); if (!b) return;
      const rv = {stars: Math.min(5, Math.max(1, parseInt(f.stars.value, 10) || 5)), text: f.text.value.trim().slice(0, 600), showName: f.showName.checked, name: String(b.name || "").trim().split(/\s+/)[0] || "", at: new Date().toISOString()};
      await FB.updateBooking(b.id, {review: rv}, {status: "Review sent", by: "customer"});
      sendEmail(`New review for ${b.providerName}: ${rv.stars} of 5`, {Booking: "#B" + b.number, Service: b.serviceTitle, Stars: String(rv.stars), Review: rv.text || "—", "Publish it in Admin": location.origin + "/admin", _template: "box"}).catch(() => {});
      toast("Thank you for your review"); BKP.stale = false; render();
    }
  } catch(er){ console.error(er); toast("Couldn't send. Try again."); }
  finally { btn.disabled = false; }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.matches("[data-chgday]")){ BKP.day = t.value; render(); return; }
  if (t.matches("[data-p2switch]") && isAdmin()){
    try { await FB.saveService("_settings", {kind: "settings", title: "_settings", active: false, part2: t.checked}, !ALL_SETTINGS); SET = {...SET, part2: t.checked}; ALL_SETTINGS = true; toast(t.checked ? "Switched on for customers" : "Switched off"); refreshAdmin(true); }
    catch(er){ console.error(er); t.checked = !t.checked; toast("Couldn't save. Try again."); }
  }
});
document.addEventListener("click", async e => {
  const el = e.target.closest("button"); if (!el) return; const d = el.dataset;
  if (d.msgquick){ const f = document.querySelector(`[data-msgform="${d.msgquick}"]`); if (f){ f.text.value = el.textContent; f.text.focus(); } return; }
  if (d.chgopen){ BKP.changing = d.chgopen; BKP.pick = []; BKP.day = null; render(); return; }
  if ("chgclose" in d){ BKP.changing = null; BKP.pick = []; render(); return; }
  if (d.chgslot){ const [date, time, slotKey, ms] = d.chgslot.split("|"), i = BKP.pick.findIndex(p => p.slotKey === slotKey);
    if (i >= 0) BKP.pick.splice(i, 1); else if (BKP.pick.length >= 3) return toast("You can pick up to 3 times"); else BKP.pick.push({startMs: +ms, date, time, slotKey});
    render(); return; }
  if (d.chgdrop){ BKP.pick = BKP.pick.filter(p => p.slotKey !== d.chgdrop); render(); return; }
  const id = d.chgcancel || d.offeryes || d.offerno || d.chgkeep || d.offerdrop || d.revpub || (d.chgpick || "").split("|")[0]; if (!id) return;
  const b = bkAny(id); if (!b) return;
  el.disabled = true;
  try {
    if (d.chgcancel){ await FB.updateBooking(id, {changeReq: null}, {status: "Change request withdrawn", by: "customer"}); toast("Request withdrawn"); }
    else if (d.offeryes){
      await FB.acceptOffer(id, bkCap(b));
      sendEmail(`${b.name || "A customer"} accepted the new time for #B${b.number}`, {Booking: "#B" + b.number, Service: b.serviceTitle, "New time": fmtLong(b.offer.startMs), _template: "box"}).catch(() => {});
      toast("Your new time is booked");
    }
    else if (d.offerno){ await FB.updateBooking(id, {offer: null}, {status: "Offer declined", by: "customer"}); toast("You kept your time"); }
    else if (!isAdmin()) return;
    else if (d.chgpick){
      const o = b.changeReq.options[+d.chgpick.split("|")[1]];
      await FB.moveBooking(id, {startMs: o.startMs, date: o.date, time: o.time, slotKey: o.slotKey}, bkCap(b), USER.email);
      if (b.email) emailBooking({...b, startMs: o.startMs}, "Time changed", `Your session moved from ${fmtLong(b.startMs)} to ${fmtLong(o.startMs)} (Toronto time), as you asked.`, {}).catch(() => {});
      toast("Booking moved");
    }
    else if (d.chgkeep){ await FB.updateBooking(id, {changeReq: null}, {status: "Change declined", by: USER.email}); if (b.email) emailBooking(b, "Change declined", "", {}).catch(() => {}); toast("Kept the current time"); }
    else if (d.offerdrop){ await FB.updateBooking(id, {offer: null}, {status: "Offer withdrawn", by: USER.email}); toast("Offer withdrawn"); }
    else if (d.revpub){
      const p = PROVIDERS.find(x => x.id === b.providerUid), rv = b.review; if (!p || !rv) return toast("No provider profile for this service");
      const when = new Date(rv.at || Date.now()).toLocaleDateString("en-CA", {month: "short", year: "numeric"});
      await FB.saveService(p.id, {reviews: [{name: rv.showName ? rv.name : "", stars: rv.stars, date: when, text: rv.text || ""}, ...(p.reviews || [])].slice(0, 50)}, false);
      await FB.updateBooking(id, {review: {...rv, published: true}}, {status: "Review published", by: USER.email});
      toast("Review published");
    }
  } catch(er){ console.error(er); toast(er.message === "slot-full" ? "That time was just taken" : "Couldn't save. Try again."); }
  finally { el.disabled = false; }
});

/* ---- Admin: bookings ---- */
const BADM = {filter: "Upcoming", q: ""};
function adminBookingsHTML(){
  if (!ADM.bookings) return `<div class="empty">Loading bookings…</div>`;
  const now = Date.now(), all = ADM.bookings.filter(b => b.kind !== "event");
  const isUp = b => b.startMs + b.durationMin * 60000 >= now && ["Requested", "Confirmed"].includes(b.status);
  const F = {Upcoming: isUp, Requested: b => b.status === "Requested", Confirmed: b => b.status === "Confirmed" && isUp(b), Past: b => !isUp(b) && b.status !== "Cancelled", Cancelled: b => b.status === "Cancelled", All: () => true};
  const q = BADM.q.trim().toLowerCase();
  let list = all.filter(F[BADM.filter]);
  if (q) list = list.filter(b => [b.number, b.name, b.email, b.phone, b.serviceTitle, b.providerName].join(" ").toLowerCase().includes(q));
  list.sort((a, b) => ["Upcoming", "Requested", "Confirmed"].includes(BADM.filter) ? a.startMs - b.startMs : b.startMs - a.startMs);
  return `${p2SwitchHTML()}<div class="admintools"><input id="admBQ" type="search" placeholder="Search by booking #, name, email, phone or service" value="${esc(BADM.q)}" aria-label="Search bookings"></div>
    <div class="chips" role="group" aria-label="Filter bookings" style="margin-bottom:14px">${Object.keys(F).map(k => `<button type="button" data-bfilter="${k}" aria-pressed="${BADM.filter === k}">${k} (${all.filter(F[k]).length})</button>`).join("")}</div>
    ${list.length ? `<div class="ordlist">${list.map(adminBookingHTML).join("")}</div>` : `<div class="empty">No bookings here.</div>`}`;
}
function adminBookingHTML(b){
  const key = "b_" + b.id, n = ADM.notes[key], tel = String(b.phone || "").replace(/[^\d+]/g, "");
  return `<details class="ord" data-oid="${key}"${ADM.open.has(key) ? " open" : ""}>
    <summary><span class="onum">#B${b.number} · ${esc(b.name || "")}</span><span class="oright">${pill(b.status)}${bkFlags(b)}<b>${fmtWhen(b.startMs, {month:"short", day:"numeric"})}, ${fmtTime(b.startMs)}</b></span><span class="ometa">${esc(b.serviceTitle)} · ${b.format === "online" ? "Online" : "In person"} · ${durTxt(b.durationMin)}</span></summary>
    <div class="obody">
      <div class="ogrid">
        <div class="obox"><h3>Customer</h3><b>${esc(b.name || "")}</b>
          ${b.phone ? `<a href="tel:${esc(tel)}">${esc(b.phone)}</a>` : ""}
          <a href="mailto:${esc(b.email || "")}?subject=${encodeURIComponent("Your booking #B" + b.number)}">${esc(b.email || "")}</a>
          ${b.address ? `<span class="note">Address: ${esc(b.address)}</span>` : ""}
          ${b.notes ? `<span class="note" style="color:var(--fg)">“${esc(b.notes)}”</span>` : ""}
          ${[b.who && b.who !== "Me" ? "For: " + b.who + (b.forName ? " (" + b.forName + ")" : "") : "", b.level ? "Level: " + b.level : "", b.lang ? "Language: " + b.lang : "", b.seriesId ? `${b.seriesKind === "pack" ? "Package" : "Weekly"}: session ${b.seriesI} of ${b.seriesN}` : ""].filter(Boolean).map(t => `<span class="note">${esc(t)}</span>`).join("")}</div>
        <div class="obox"><h3>Session</h3><b>${esc(b.serviceTitle)}</b><span class="note">with ${esc(b.providerName)}</span>
          <span>${fmtLong(b.startMs)}</span><span class="note">${durTxt(b.durationMin)} · ${b.format === "online" ? `Online${b.platform ? " · " + esc(b.platform) : ""}` : `In person${b.location ? " · " + esc(b.location) : ""}`}</span>
          <span class="note">${b.price == null ? "Price on request" : money(b.price) + " / " + esc(b.priceUnit)}</span></div>
      </div>
      <form class="oactions" data-bkstatusform="${b.id}">
        <label>Status<select name="status">${BOOK_STATUSES.map(s => `<option${s === b.status ? " selected" : ""}>${s}</option>`).join("")}</select></label>
        ${b.format === "online" ? `<label style="flex-basis:100%">Meeting link <small>(Zoom, Google Meet or Teams; the customer sees it once confirmed)</small><input name="meetingLink" type="url" value="${esc(b.meetingLink || "")}" placeholder="https://"></label>`
          : `<label style="flex-basis:100%">Where to meet <small>(shown to the customer once confirmed)</small><input name="locationNote" value="${esc(b.locationNote || "")}" placeholder="e.g. 123 Main St, Richmond Hill, unit 4"></label>`}
        <label style="flex-basis:100%">Message to the customer <small>(optional, added to the email)</small><input name="message" placeholder="e.g. Please have your laptop charged"></label>
        <label class="check"><input type="checkbox" name="email" checked> Email the customer about this change</label>
        <button class="btn small" type="submit">Update booking</button>
      </form>
      ${adminBookingExtraHTML(b)}
      <div class="obox"><h3>Private notes <small style="text-transform:none;letter-spacing:0">(only admins see these)</small></h3>
        <textarea data-note="${key}" placeholder="${n == null ? "Loading…" : "e.g. Paid $45 cash"}" style="min-height:70px">${esc(n || "")}</textarea>
        <button class="linkbtn" type="button" data-savenote="${key}" style="justify-self:start">Save note</button></div>
      <div class="obox"><h3>History</h3><ul class="ohist">${(b.history || []).slice().reverse().map(h => `<li>${esc(fmtDate(h.at))}: ${esc(h.status)}${h.by ? ` (${esc(h.by)})` : ""}${h.emailed ? " · customer emailed" : ""}</li>`).join("")}</ul></div>
    </div>
  </details>`;
}
async function emailBooking(b, status, message, extra){
  const link = extra.meetingLink ?? b.meetingLink, where = extra.locationNote ?? b.locationNote;
  await sendEmail(`Your booking #B${b.number}: ${status} · ${b.serviceTitle}`, {
    Booking: "#B" + b.number, Status: status, Update: BOOK_TEXT[status] || "", Service: b.serviceTitle, With: b.providerName,
    When: fmtLong(b.startMs) + " (Toronto time)", Length: durTxt(b.durationMin), Format: b.format === "online" ? "Online" : "In person",
    ...(["Confirmed", "Reminder", "Time changed"].includes(status) && b.format === "online" && link ? {"Join link": link} : {}),
    ...(["Confirmed", "Reminder", "Time changed"].includes(status) && b.format !== "online" && where ? {"Where": where} : {}),
    ...(message ? {"Message": message} : {}),
    "Your bookings": location.origin + "/#my-orders",
    _cc: b.email, _replyto: CONTACT_EMAIL, _template: "box"
  });
}

/* ---- Admin: services ---- */
const SADM = {edit: null};
const rawService = id => ALL_SERVICES.find(d => d.id === id);
function servicesAdminHTML(){
  if (SADM.edit) return serviceFormHTML();
  const list = ALL_SERVICES.map(d => ({d, s: fsToService(d)})).sort((a, b) => a.d.id.localeCompare(b.d.id, undefined, {numeric: true}));
  return `<div class="admintools"><p class="note" style="flex:1">Services you add here appear on the Services page with their open times.</p><button class="btn small" type="button" data-snew>+ Add service</button></div>
    ${list.length ? `<div class="plist">${list.map(({d, s}) => { const img = imagesOf(s)[0]; const up = (ADM.bookings || []).filter(b => b.serviceId === d.id && b.startMs > Date.now() && ["Requested", "Confirmed"].includes(b.status)).length;
      return `<div class="prow${s.active ? "" : " hiddenp"}">
        ${img ? `<img src="${esc(img)}" data-ref="${esc(refsOf(s)[0])}" alt="">` : `<span class="noimg" style="display:grid;place-items:center">${svgI("monitor").replace("<svg", '<svg width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.6"')}</span>`}
        <div><div class="pname">${esc(s.title)}</div>
          <div class="pmeta">${esc(d.id)} · ${esc(s.category)} · by ${esc(s.providerName)} · ${s.price == null ? "Price on request" : money(s.price) + " / " + esc(s.priceUnit)} · ${durTxt(s.duration)} · ${s.format === "both" ? "Online & in person" : s.format === "online" ? "Online" : "In person"} · ${s.classType === "group" ? "Group of " + s.capacity : "1-on-1"} · ${up} upcoming booking${up === 1 ? "" : "s"}${s.active ? "" : " · hidden"}</div></div>
        <div class="pctl">
          <label class="check" style="font-size:.88rem"><input type="checkbox" data-sactive="${esc(d.id)}" ${s.active ? "checked" : ""}> Show</label>
          <a class="linkbtn" href="#service-${esc(d.id)}">View</a>
          <button class="btn small ghost" type="button" data-sedit="${esc(d.id)}" style="color:var(--fg)">Edit</button>
        </div></div>`; }).join("")}</div>`
      : `<div class="panel" style="max-width:640px"><h2>Add your first service</h2><p class="note">For example: “Computer basics, one-on-one”, “Microsoft Excel online training” or “Home Wi-Fi and printer setup”. Set the price per session, how classes are held and your weekly open hours. Customers then book open times themselves.</p><button class="btn" type="button" data-snew style="justify-self:start">+ Add service</button></div>`}`;
}
function serviceFormHTML(){
  const isNew = SADM.edit === "new";
  const d = isNew ? {providerName: "Nojan", providerType: "Company", price: "", priceUnit: "session", duration: 60, format: "online", classType: "1-on-1", capacity: 6, level: "All levels", leadHours: 24, horizonDays: 21, active: true,
    availability: {mon: {on: true, start: "10:00", end: "17:00"}, tue: {on: true, start: "10:00", end: "17:00"}, wed: {on: true, start: "10:00", end: "17:00"}, thu: {on: true, start: "10:00", end: "17:00"}, fri: {on: true, start: "10:00", end: "17:00"}, sat: {on: true, start: "10:00", end: "14:00"}, sun: {on: false, start: "10:00", end: "14:00"}}}
    : (rawService(SADM.edit) || {});
  const av = d.availability || {}, opt = (v, cur, l) => `<option value="${v}"${String(cur) === String(v) ? " selected" : ""}>${l || v}</option>`;
  return `<div class="sectionhead"><h2>${isNew ? "Add a service" : "Edit " + esc(d.id)}</h2><button class="linkbtn" type="button" data-scancel>Back to services</button></div>
  <form class="panel" id="serviceForm" novalidate>
    <h3>The service</h3>
    <label>Service name<input name="title" required value="${esc(d.title || "")}" placeholder="e.g. Computer basics for beginners, one-on-one"></label>
    <div class="row">
      <label>Category<input name="category" list="svcCats" value="${esc(d.category || "")}" placeholder="e.g. Computer training"><datalist id="svcCats">${SVC_CATS.map(c => `<option value="${esc(c)}">`).join("")}</datalist></label>
      <label>Level<select name="level">${["All levels", "Beginner", "Intermediate", "Advanced"].map(l => opt(l, d.level || "All levels")).join("")}</select></label>
    </div>
    <label>Short summary <small>(one line shown on the service card)</small><input name="summary" maxlength="160" value="${esc(d.summary || "")}" placeholder="e.g. Learn email, video calls and safe browsing at your own pace."></label>
    <label>Full description <small>(first line is an intro; then one point per line like “• YOU'LL LEARN: …”)</small><textarea name="description" style="min-height:150px">${esc(d.description || "")}</textarea></label>
    <h3>Provider</h3>
    <div class="row">
      <label>Provider name<input name="providerName" required value="${esc(d.providerName || "")}"></label>
      <label>Provider is<select name="providerType">${opt("Individual", d.providerType)}${opt("Company", d.providerType)}</select></label>
    </div>
    <label>Provider profile <small>(links this service to a profile page; add profiles in the Providers tab)</small><select name="providerUid"><option value="">No profile linked</option>${ALL_PROVIDERS.map(p => `<option value="${esc(p.id)}"${d.providerUid === p.id ? " selected" : ""}>${esc(p.name)}${p.headline ? " · " + esc(p.headline.slice(0, 50)) : ""}</option>`).join("")}</select></label>
    <label>About the provider <small>(short note, shown when no profile is linked)</small><textarea name="providerBio" style="min-height:80px">${esc(d.providerBio || "")}</textarea></label>
    <h3>Price and sessions</h3>
    <div class="row">
      <label>Price (CAD) <small>(0 = free, empty = on request)</small><input name="price" type="number" min="0" step="0.01" value="${d.price ?? ""}"></label>
      <label>Price is per<select name="priceUnit">${["session", "hour", "person", "course"].map(u => opt(u, d.priceUnit)).join("")}</select></label>
    </div>
    <div class="row">
      <label>Session length<select name="duration">${[30, 45, 60, 90, 120, 180].map(m => opt(m, d.duration, durTxt(m))).join("")}</select></label>
      <label>Class type<select name="classType">${opt("1-on-1", d.classType, "One-on-one")}${opt("group", d.classType, "Small group")}</select></label>
    </div>
    <label>Group size <small>(max people per session, for group classes)</small><input name="capacity" type="number" min="2" max="50" value="${d.capacity || 6}"></label>
    <h3>How classes are held</h3>
    <label>Format<select name="format">${opt("online", d.format, "Online only")}${opt("in-person", d.format, "In person only")}${opt("both", d.format, "Online or in person (customer chooses)")}</select></label>
    <div class="row">
      <label>Online on <small>(for online classes)</small><input name="platform" list="svcPlat" value="${esc(d.platform || "")}" placeholder="e.g. Zoom"><datalist id="svcPlat"><option value="Zoom"><option value="Google Meet"><option value="Microsoft Teams"><option value="Phone call"></datalist></label>
      <label>In-person location <small>(for in-person classes)</small><input name="location" list="svcLoc" value="${esc(d.location || "")}" placeholder="e.g. Richmond Hill, at our location"><datalist id="svcLoc"><option value="Richmond Hill, at our location"><option value="At your home or office (GTA)"></datalist></label>
    </div>
    <h3>Open hours <small style="font-weight:400;color:var(--muted)">(Toronto time; sessions start every ${durTxt(+d.duration || 60)} within these hours)</small></h3>
    <div class="availgrid">${["mon", "tue", "wed", "thu", "fri", "sat", "sun"].map(k => { const r = av[k] || {}; return `<div class="availrow">
      <label class="check"><input type="checkbox" name="av_${k}_on" ${r.on ? "checked" : ""}> ${DAY_NAMES[k]}</label>
      <input type="time" name="av_${k}_s" value="${esc(r.start || "10:00")}" aria-label="${DAY_NAMES[k]} start">
      <input type="time" name="av_${k}_e" value="${esc(r.end || "17:00")}" aria-label="${DAY_NAMES[k]} end"></div>`; }).join("")}</div>
    <div class="row">
      <label>Minimum notice (hours)<input name="leadHours" type="number" min="0" max="336" value="${d.leadHours ?? 24}"></label>
      <label>Customers can book up to (days ahead)<input name="horizonDays" type="number" min="1" max="90" value="${d.horizonDays || 21}"></label>
    </div>
    <label>Days off <small>(no bookings on these dates; separate with commas, like 2026-12-25, 2026-12-26)</small><input name="blocked" value="${esc((d.blocked || []).join(", "))}"></label>
    <label>Get ready list <small>(the customer sees it on their booking page; one per line)</small><textarea name="prep" placeholder="Charge your laptop">${esc((d.prep || []).join("\n"))}</textarea></label>
    <div class="row"><label class="check"><input type="checkbox" name="repeat"${d.repeat !== false ? " checked" : ""}> Allow weekly bookings and packages of 5</label>
      <label>Package of 5 discount (%)<input name="packPct" type="number" min="0" max="50" value="${d.packPct == null ? 10 : d.packPct}"></label></div>
    <div class="obox"><h3>Photos <small style="text-transform:none;letter-spacing:0">(optional, up to 5; the first is the cover)</small></h3><div class="photogrid" id="photoGrid">${photoGridHTML()}</div></div>
    <label class="check"><input type="checkbox" name="active" ${d.active !== false ? "checked" : ""}> Show on the website</label>
    <div id="serviceMsg" hidden></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${isNew ? "Add service" : "Save changes"}</button>
      <button class="btn ghost" type="button" data-scancel style="color:var(--fg)">Cancel</button>
      ${isNew ? "" : `<button class="linkbtn" type="button" data-sdelete="${esc(d.id)}" style="margin-left:auto;color:var(--danger)">Delete service</button>`}
    </div>
  </form>`;
}
function openServiceForm(id){
  SADM.edit = id; const d = id === "new" ? null : rawService(id);
  PADM.photos = d ? (d.images || []).map(ref => ({ref})) : [];
  refreshAdmin(true); window.scrollTo(0, 0);
}
async function persistPhotos(old){
  const refs = [];
  for (const ph of PADM.photos){
    if (ph.ref){ refs.push(ph.ref); continue; }
    const imgId = await FB.saveImage(ph.full); IMG[imgId] = ph.full; ph.ref = "img:" + imgId; refs.push(ph.ref);
  }
  const first = PADM.photos[0];
  const thumb = !first ? "" : first.thumb ? first.thumb : (old && old.images && old.images[0] === first.ref ? (old.thumb || "") : "");
  if (old) (old.images || []).filter(r => r.startsWith("img:") && !refs.includes(r)).forEach(r => FB.deleteImage(r.slice(4)).catch(() => {}));
  return {refs, thumb};
}
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.bfilter){ BADM.filter = b.dataset.bfilter; refreshAdmin(true); return; }
  if (b.hasAttribute("data-snew")){ openServiceForm("new"); return; }
  if (b.dataset.sedit){ openServiceForm(b.dataset.sedit); return; }
  if (b.hasAttribute("data-scancel")){ SADM.edit = null; PADM.photos = []; refreshAdmin(true); return; }
  if (b.dataset.sdelete){ const d = rawService(b.dataset.sdelete);
    if (!d || !confirm(`Delete “${d.title}”? It disappears from the website. Existing bookings stay in the Bookings tab.`)) return;
    try { await FB.deleteService(d.id, (d.images || []).filter(r => r.startsWith("img:")).map(r => r.slice(4))); SADM.edit = null; toast("Service deleted"); refreshAdmin(true); } catch(er){ console.error(er); toast("Couldn't delete"); } }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.dataset.sactive){ try { await FB.updateService(t.dataset.sactive, {active: t.checked}); toast(t.checked ? "Shown on the website" : "Hidden from the website"); } catch(er){ toast("Couldn't update"); } }
});
document.addEventListener("input", e => { if (e.target.id === "admBQ"){ BADM.q = e.target.value; const pos = e.target.selectionStart; refreshAdmin(true); const q = $("#admBQ"); if (q){ q.focus(); q.setSelectionRange(pos, pos); } } });
document.addEventListener("submit", async e => {
  const f = e.target;
  if (f.id === "serviceForm"){
    e.preventDefault();
    const m = $("#serviceMsg"), d = Object.fromEntries(new FormData(f));
    if (!d.title.trim()) return showMsg(m, false, "Enter a service name.");
    if (!d.providerName.trim()) return showMsg(m, false, "Enter the provider's name.");
    const availability = {};
    for (const k of ["mon", "tue", "wed", "thu", "fri", "sat", "sun"]){
      const on = !!d[`av_${k}_on`], start = d[`av_${k}_s`] || "", end = d[`av_${k}_e`] || "";
      if (on && (!start || !end || end <= start)) return showMsg(m, false, `Check the open hours for ${DAY_NAMES[k]}: the end time must be after the start time.`);
      availability[k] = {on, start, end};
    }
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
    try {
      const isNew = SADM.edit === "new";
      const id = isNew ? "S" + String(Math.max(0, ...ALL_SERVICES.map(x => parseInt(String(x.id).slice(1), 10) || 0)) + 1).padStart(3, "0") : SADM.edit;
      const old = isNew ? null : rawService(id), {refs, thumb} = await persistPhotos(old);
      const group = d.classType === "group";
      const data = {title: d.title.trim(), category: (d.category || "").trim() || "Other", level: d.level, summary: (d.summary || "").trim(), description: (d.description || "").trim(),
        providerName: d.providerName.trim(), providerType: d.providerType, providerBio: (d.providerBio || "").trim(), providerUid: d.providerUid || "",
        price: d.price === "" ? null : +d.price, priceUnit: d.priceUnit, duration: +d.duration, classType: group ? "group" : "1-on-1", capacity: group ? Math.max(2, parseInt(d.capacity, 10) || 6) : 1,
        format: d.format, platform: (d.platform || "").trim(), location: (d.location || "").trim(), availability,
        leadHours: Math.max(0, parseInt(d.leadHours, 10) || 0), horizonDays: Math.min(90, Math.max(1, parseInt(d.horizonDays, 10) || 21)),
        blocked: String(d.blocked || "").match(/\d{4}-\d{2}-\d{2}/g) || [], active: !!d.active,
        prep: String(d.prep || "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 12), repeat: !!d.repeat, packPct: Math.min(50, Math.max(0, parseInt(d.packPct, 10) || 0)), images: refs, thumb};
      if (isNew) data.order = ALL_SERVICES.length;
      await FB.saveService(id, data, isNew);
      toast(isNew ? `Added ${id}` : "Saved"); SADM.edit = null; PADM.photos = []; refreshAdmin(true);
    } catch(er){ console.error(er); btn.disabled = false; btn.textContent = "Save"; showMsg(m, false, "Couldn't save. Check your connection and try again."); }
    return;
  }
  if (f.dataset.bkstatusform){
    e.preventDefault();
    const b = (ADM.bookings || []).find(x => x.id === f.dataset.bkstatusform); if (!b) return;
    const d = Object.fromEntries(new FormData(f)), status = d.status, message = (d.message || "").trim();
    const extra = {}; if ("meetingLink" in d) extra.meetingLink = d.meetingLink.trim(); if ("locationNote" in d) extra.locationNote = d.locationNote.trim();
    const changed = status !== b.status || (extra.meetingLink ?? b.meetingLink ?? "") !== (b.meetingLink || "") || (extra.locationNote ?? b.locationNote ?? "") !== (b.locationNote || "");
    if (!changed && !message) return toast("Nothing changed");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
    let emailed = false;
    if (d.email && b.email){ try { await emailBooking(b, status, message, extra); emailed = true; } catch(er){ console.error(er); toast("Saved, but the email didn't send"); } }
    try {
      await FB.setBookingStatus(b.id, status, {status, by: USER.email, emailed, ...(message ? {message} : {})}, extra);
      toast(emailed ? `Updated to ${status} · customer emailed` : `Updated to ${status}`);
    } catch(er){ console.error(er); btn.disabled = false; btn.textContent = "Update booking"; toast(er.message === "slot-full" ? "That time is now full, so it can't be reopened" : "Couldn't update the booking"); }
  }
});

/* ---- Admin: products ---- */
const PADM = {filter:"All", q:"", edit:null, photos:[], busy:false};
const rawProduct = pid => ALL_PRODUCTS.find(d => d.id === pid);
function productsAdminHTML(){
  if (PADM.edit) return productFormHTML();
  if (!ALL_PRODUCTS.length){
    const n = productSource === "sheet" ? PRODUCTS.length : 0;
    return `<div class="panel" style="max-width:640px">
      <h2>Move your products here</h2>
      <p class="note">Your products are still coming from the Google Sheet. Copy them into the site's database once, then manage everything from this page: prices, stock, photos and new items.</p>
      <p class="note">${n ? `${n} products found in the sheet. Each starts with 1 in stock; set the real quantities after.` : "Loading the sheet…"}</p>
      <div style="display:flex;gap:10px;flex-wrap:wrap"><button class="btn" type="button" data-pimport ${n ? "" : "disabled"}>Copy ${n || ""} products from the sheet</button><button class="btn ghost" type="button" data-pnew style="color:var(--fg)">Start empty and add a product</button></div>
    </div>`;
  }
  const all = ALL_PRODUCTS.map(d => ({d, p: fsToItem(d)}));
  const cnt = {All: all.length, "In stock": all.filter(x=>x.p.active && !x.p.soldOut).length, "Sold out": all.filter(x=>x.p.soldOut).length, Hidden: all.filter(x=>!x.p.active).length};
  const q = PADM.q.trim().toLowerCase();
  let list = all.filter(x => PADM.filter === "All" || (PADM.filter === "In stock" && x.p.active && !x.p.soldOut) || (PADM.filter === "Sold out" && x.p.soldOut) || (PADM.filter === "Hidden" && !x.p.active));
  if (q) list = list.filter(x => [x.d.id, idOf(x.p), x.p.name, x.p.brand, x.p.type].join(" ").toLowerCase().includes(q));
  list.sort((a,b) => a.d.id.localeCompare(b.d.id, undefined, {numeric:true}));
  return `<div class="admintools"><input id="admPQ" type="search" placeholder="Search products by name, brand or ID" value="${esc(PADM.q)}" aria-label="Search products"><button class="btn small" type="button" data-pnew>+ Add product</button></div>
    <div class="chips" role="group" aria-label="Filter products" style="margin-bottom:14px">${Object.keys(cnt).map(k=>`<button type="button" data-pfilter="${k}" aria-pressed="${PADM.filter===k}">${k} (${cnt[k]})</button>`).join("")}</div>
    ${list.length ? `<div class="plist">${list.map(({d,p}) => {
      const img = imagesOf(p)[0];
      return `<div class="prow${p.active ? "" : " hiddenp"}">
        ${img ? `<img src="${esc(img)}" data-ref="${esc(refsOf(p)[0])}" alt="">` : `<span class="noimg"></span>`}
        <div><div class="pname">${esc(p.name)}</div>
          <div class="pmeta"><code class="idcode">${esc(normId(d.itemId) || fallbackId(d.id))}</code> · ${p.condition === "new" ? "Brand new" : "Used"}${p.grade ? ` (${esc(p.grade)})` : ""} · ${esc(p.type)}${p.brand ? ` · ${esc(p.brand)}` : ""} · ${p.price == null ? "No price" : money(p.price)}${p.was ? ` (regular ${money(p.was)})` : ""} · ${stockNote(p).replace(/<[^>]+>/g,"")}${p.active ? "" : " · hidden"}</div></div>
        <div class="pctl">
          <span class="stockctl" aria-label="Quantity available"><button type="button" data-pstep="${esc(d.id)}" data-d="-1" aria-label="One less">−</button><input type="number" min="0" step="1" value="${p.stock}" data-pstock="${esc(d.id)}" aria-label="Quantity available for ${esc(p.name)}"><button type="button" data-pstep="${esc(d.id)}" data-d="1" aria-label="One more">+</button></span>
          <label class="check" style="font-size:.88rem"><input type="checkbox" data-pactive="${esc(d.id)}" ${p.active ? "checked" : ""}> Show</label>
          <button class="btn small ghost" type="button" data-pedit="${esc(d.id)}" style="color:var(--fg)">Edit</button>
        </div></div>`; }).join("")}</div>` : `<div class="empty">No products match.</div>`}`;
}
function productFormHTML(){
  const isNew = PADM.edit === "new", d = isNew ? {condition:"new", stock:1, active:true} : (rawProduct(PADM.edit) || {});
  return `<div class="sectionhead"><h2>${isNew ? "Add a product" : "Edit " + esc(d.id)}</h2><button class="linkbtn" type="button" data-pcancel>Back to products</button></div>
  <form class="panel" id="productForm" novalidate>
    <div class="idbox"><label>Nojan item ID <small>${isNew ? "leave empty for a new ID" : "items with the same ID show under one ad"}</small><input name="itemId" maxlength="15" autocomplete="off" spellcheck="false" placeholder="${isNew ? "Made automatically when you save" : ""}" value="${esc(isNew ? "" : normId(d.itemId) || fallbackId(d.id))}"></label><div class="idhint" id="pIdHint">${idHintHTML(d.title, isNew ? "" : normId(d.itemId) || fallbackId(d.id), isNew ? "" : normId(d.itemId) || fallbackId(d.id))}</div></div>
    <label>Product name<input name="title" required value="${esc(d.title||"")}" placeholder="e.g. Breville the Smart Oven Pro, Brushed Stainless Steel (BOV845BSS)"></label>
    <div class="row">
      <label>Brand<input name="brand" value="${esc(d.brand||"")}"></label>
      <label>Condition<select name="condition"><option value="new"${d.condition!=="used"?" selected":""}>Brand new</option><option value="used"${d.condition==="used"?" selected":""}>Used</option></select></label>
    </div>
    <div class="row">
      <label>Product type <small>(customers filter by this)</small><input name="type" list="typeList" value="${esc(d.type || (d.title ? guessType(d.title) : ""))}" placeholder="e.g. Vacuums">
        <datalist id="typeList">${[...new Set([...TYPE_LIST, ...ALL_PRODUCTS.map(x => x.type).filter(Boolean)])].sort().map(t => `<option value="${esc(t)}">`).join("")}</datalist></label>
      <label>Condition grade <small>(used items only)</small><select name="grade"><option value="">Not set</option>${GRADES.map(g => `<option${d.grade === g ? " selected" : ""}>${g}</option>`).join("")}</select></label>
    </div>
    <div class="row">
      <label>Regular / market price (CAD)<input name="price" type="number" min="0" step="0.01" value="${d.price ?? ""}" placeholder="e.g. 269.99"></label>
      <label>Your price (CAD) <small>(empty = regular price)</small><input name="salePrice" type="number" min="0" step="0.01" value="${d.salePrice ?? ""}"></label>
    </div>
    <button class="linkbtn" type="button" data-p20 style="justify-self:start">Set my price: 20% below for brand new, 40% below for used</button>
    <div class="row">
      <label>Quantity available<input name="stock" type="number" min="0" step="1" required value="${d.stock ?? 1}"></label>
      <label class="check" style="align-self:end;padding-bottom:10px"><input type="checkbox" name="active" ${d.active !== false ? "checked" : ""}> Show on the website</label>
    </div>
    <label>Description <small>(first line is a short intro; then one feature per line like “• LABEL: text”)</small><textarea name="description" style="min-height:180px">${esc(d.description||"")}</textarea></label>
    <div class="obox"><h3>Photos <small style="text-transform:none;letter-spacing:0">(up to 5; the first is the main photo)</small></h3>
      <div class="photogrid" id="photoGrid">${photoGridHTML()}</div>
    </div>
    <div id="productMsg" hidden></div>
    <div style="display:flex;gap:10px;flex-wrap:wrap;align-items:center">
      <button class="btn" type="submit">${isNew ? "Add product" : "Save changes"}</button>
      <button class="btn ghost" type="button" data-pcancel style="color:var(--fg)">Cancel</button>
      ${isNew ? "" : `<button class="linkbtn" type="button" data-pdelete="${esc(d.id)}" style="margin-left:auto;color:var(--danger)">Delete product</button>`}
    </div>
  </form>`;
}
function photoGridHTML(){
  return PADM.photos.map((ph, i) => `<div class="ph"><img src="${esc(ph.src || imgSrc(ph.ref, null, 1))}" data-ref="${esc(ph.ref||"")}" alt="Photo ${i+1}">
      <button type="button" data-prm="${i}" aria-label="Remove photo ${i+1}">×</button>
      ${i ? `<button type="button" class="left" data-pmain="${i}" aria-label="Make photo ${i+1} the main photo">★</button>` : `<span class="main">Main</span>`}</div>`).join("")
    + (PADM.photos.length < 5 ? `<label class="photoadd">+ Add photos<input type="file" accept="image/*" multiple id="photoInput"></label>` : "");
}
function openProductForm(pid){
  PADM.edit = pid;
  const d = pid === "new" ? null : rawProduct(pid);
  PADM.photos = d ? (d.images || []).map(ref => ({ref})) : [];
  refreshAdmin(true); window.scrollTo(0, 0);
}
async function resizeImage(file, max, quality){
  const bmp = await createImageBitmap(file);
  const s = Math.min(1, max / Math.max(bmp.width, bmp.height));
  const c = document.createElement("canvas"); c.width = Math.round(bmp.width * s); c.height = Math.round(bmp.height * s);
  const x = c.getContext("2d"); x.fillStyle = "#fff"; x.fillRect(0, 0, c.width, c.height); x.drawImage(bmp, 0, 0, c.width, c.height);
  let q = quality, url = c.toDataURL("image/jpeg", q);
  while (url.length > 700000 && q > 0.4){ q -= 0.1; url = c.toDataURL("image/jpeg", q); }
  return url;
}
function nextProductId(cond){
  const pre = cond === "used" ? "U" : "N";
  const n = Math.max(0, ...ALL_PRODUCTS.map(d => d.id).filter(id => id.startsWith(pre)).map(id => parseInt(id.slice(1), 10) || 0));
  return pre + String(n + 1).padStart(3, "0");
}
async function productClick(b){
  if (b.dataset.pfilter){ PADM.filter = b.dataset.pfilter; refreshAdmin(true); return true; }
  if (b.hasAttribute("data-pnew")){ openProductForm("new"); return true; }
  if (b.dataset.pedit){ openProductForm(b.dataset.pedit); return true; }
  if (b.hasAttribute("data-pcancel")){ PADM.edit = null; PADM.photos = []; refreshAdmin(true); return true; }
  if (b.dataset.prm != null){ PADM.photos.splice(+b.dataset.prm, 1); $("#photoGrid").innerHTML = photoGridHTML(); return true; }
  if (b.dataset.pmain != null){ const [ph] = PADM.photos.splice(+b.dataset.pmain, 1); PADM.photos.unshift(ph); $("#photoGrid").innerHTML = photoGridHTML(); return true; }
  if (b.hasAttribute("data-p20")){ const f = $("#productForm"), p = parseFloat(f.price.value); if (!(p > 0)) { toast("Enter the regular price first"); return true; } const used = f.condition.value === "used"; f.salePrice.value = (Math.round(p * (used ? 60 : 80)) / 100).toFixed(2); toast(used ? "Set to 40% below (used)" : "Set to 20% below (brand new)"); return true; }
  if (b.dataset.pstep){ const id = b.dataset.pstep, d = rawProduct(id); if (!d) return true;
    const v = Math.max(0, (parseInt(d.stock, 10) || 0) + (+b.dataset.d));
    try { await FB.updateProduct(id, {stock: v}); toast(v === 0 ? "Now sold out" : `${v} available`); } catch(er){ console.error(er); toast("Couldn't update stock"); }
    return true; }
  if (b.dataset.pdelete){ const d = rawProduct(b.dataset.pdelete); if (!d || !confirm(`Delete “${d.title}”? This removes it from the website for good.`)) return true;
    try { await FB.deleteProduct(d.id, (d.images||[]).filter(r => r.startsWith("img:")).map(r => r.slice(4))); PADM.edit = null; toast("Product deleted"); refreshAdmin(true); } catch(er){ console.error(er); toast("Couldn't delete"); }
    return true; }
  if (b.hasAttribute("data-pimport")){
    if (!confirm(`Copy ${PRODUCTS.length} products from the Google Sheet into the site's database?`)) return true;
    b.disabled = true; b.textContent = "Copying…";
    const list = PRODUCTS.map((p, i) => ({id: p.id.replace(/^s-/, ""), title: p.name, description: p.desc || "", brand: p.brand || "", condition: p.condition, type: typeOf(p), grade: "",
      price: p.was ?? p.price, salePrice: p.was != null ? p.price : null, stock: 1, active: true, images: refsOf(p).slice(0, 5), thumb: "", order: i}));
    try { await FB.importProducts(list); toast(`${list.length} products copied`); } catch(er){ console.error(er); toast("Couldn't copy the products"); b.disabled = false; }
    return true;
  }
  return false;
}
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "photoInput"){
    const files = [...t.files].slice(0, 5 - PADM.photos.length);
    for (const f of files){
      try { const full = await resizeImage(f, 1000, 0.82), thumb = await resizeImage(f, 400, 0.72); PADM.photos.push({src: full, full, thumb}); }
      catch(er){ console.error(er); toast("Couldn't read one of the photos"); }
    }
    $("#photoGrid").innerHTML = photoGridHTML();
    return;
  }
  if (t.dataset.pstock){ const v = Math.max(0, parseInt(t.value, 10) || 0); try { await FB.updateProduct(t.dataset.pstock, {stock: v}); toast(v === 0 ? "Now sold out" : `${v} available`); } catch(er){ toast("Couldn't update stock"); } return; }
  if (t.dataset.pactive){ try { await FB.updateProduct(t.dataset.pactive, {active: t.checked}); toast(t.checked ? "Shown on the website" : "Hidden from the website"); } catch(er){ toast("Couldn't update"); } return; }
});
document.addEventListener("input", e => { if (e.target.id === "admPQ"){ PADM.q = e.target.value; const pos = e.target.selectionStart; refreshAdmin(true); const q = $("#admPQ"); if (q){ q.focus(); q.setSelectionRange(pos, pos); } } });
document.addEventListener("submit", async e => {
  if (e.target.id !== "productForm") return;
  e.preventDefault();
  const f = e.target, m = $("#productMsg"), d = Object.fromEntries(new FormData(f));
  if (!d.title.trim()) return showMsg(m, false, "Enter a product name.");
  const price = d.price === "" ? null : +d.price, sale = d.salePrice === "" ? null : +d.salePrice;
  if (price != null && sale != null && sale > price) return showMsg(m, false, "Your price is higher than the regular price. Check the two prices.");
  const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
  try {
    const isNew = PADM.edit === "new", id = isNew ? nextProductId(d.condition) : PADM.edit, old = isNew ? null : rawProduct(id);
    const selfId = old ? normId(old.itemId) || fallbackId(old.id) : "", itemId = normId(d.itemId) || selfId || newItemId();
    if (!ID_RE.test(itemId) || (itemId !== selfId && normId(d.itemId) && !knownIds().has(itemId))){ btn.disabled = false; btn.textContent = "Save"; return showMsg(m, false, `No item on Nojan has the ID ${itemId}. Check it, or clear the box.`); }
    const refs = [];
    for (const ph of PADM.photos){
      if (ph.ref){ refs.push(ph.ref); continue; }
      const imgId = await FB.saveImage(ph.full); IMG[imgId] = ph.full; refs.push("img:" + imgId); ph.ref = "img:" + imgId;
    }
    const first = PADM.photos[0];
    const thumb = !first ? "" : first.thumb ? first.thumb : (old && old.images && old.images[0] === first.ref ? (old.thumb || "") : "");
    const data = {title: d.title.trim(), brand: (d.brand||"").trim(), condition: d.condition, price, salePrice: sale,
      type: (d.type||"").trim() || guessType(d.title), grade: d.condition === "used" ? (d.grade || "") : "",
      stock: Math.max(0, parseInt(d.stock, 10) || 0), active: !!d.active, description: (d.description||"").trim(), images: refs, thumb, itemId};
    if (isNew) data.order = ALL_PRODUCTS.length;
    await FB.saveProduct(id, data, isNew);
    if (old) (old.images||[]).filter(r => r.startsWith("img:") && !refs.includes(r)).forEach(r => FB.deleteImage(r.slice(4)).catch(()=>{}));
    toast(isNew ? `Added · item ID ${itemId}` : "Saved"); PADM.edit = null; PADM.photos = []; refreshAdmin(true);
  } catch(er){ console.error(er); btn.disabled = false; btn.textContent = "Save"; showMsg(m, false, "Couldn't save. Check your connection and try again."); }
});

/* ---- Account, order and admin events ---- */
document.addEventListener("click", async e => {
  const b = e.target.closest("button"); if (!b) return;
  if (b.dataset.mode){ authMode = b.dataset.mode; render(); return; }
  if (b.dataset.auth){ authMode = b.dataset.auth; afterLogin = b.dataset.next || null; go("account"); return; }
  if (b.hasAttribute("data-google") || b.hasAttribute("data-microsoft")){
    if (!FB) return toast("Still connecting, try again in a moment");
    if (b.dataset.next) afterLogin = b.dataset.next; else if (!afterLogin && current() === "account") afterLogin = "account";
    b.disabled = true;
    try { if (b.hasAttribute("data-microsoft")) await FB.microsoft(); else await FB.google(); }
    catch(err){ b.disabled = false; if (err.code !== "auth/popup-closed-by-user" && err.code !== "auth/cancelled-popup-request"){ const m = $("#authMsg"); if (m) showMsg(m,false,authError(err)); else toast(authError(err)); } }
    return;
  }
  if (b.hasAttribute("data-signout")){ await FB.signOut(); toast("You're signed out"); go("home"); return; }
  if (b.hasAttribute("data-recheck")){ try { USER = await FB.refreshUser(); updateAcct(); render(); toast(USER.emailVerified ? "Email confirmed" : "Not confirmed yet. Click the link in the email first."); } catch(err){ toast(authError(err)); } return; }
  if (b.hasAttribute("data-resend")){ try { await FB.resendVerify(); toast("Confirmation email sent"); } catch(err){ toast(authError(err)); } return; }
  if (b.dataset.cancel){
    const o = (MY.orders||[]).find(x=>x.id===b.dataset.cancel); if (!o) return;
    if (!confirm(`Cancel order #${o.number}?`)) return;
    try { await FB.updateOrder(o.id, {status:"Cancelled"}, {status:"Cancelled", by:"customer"}); toast("Order cancelled");
      sendEmail(`Order #${o.number} was cancelled by the customer`, {Order:"#"+o.number, Name:o.name, Email:o.email, Phone:o.phone, _replyto:o.email}).catch(()=>{}); }
    catch(err){ console.error(err); toast("Couldn't cancel. Contact us instead."); }
    return;
  }
  if (b.dataset.atab){ ADM.tab = b.dataset.atab; ADM.q = ""; PED = {id:null, data:null, photo:null}; render(); return; }
  if (b.dataset.afilter){ ADM.status = b.dataset.afilter; refreshAdmin(true); return; }
  if (b.dataset.auid != null){ ADM.uid = b.dataset.auid || null; ADM.tab = "orders"; ADM.status = "All"; ADM.q = ""; render(); return; }
  if (b.hasAttribute("data-admrefresh")){ refreshAdmin(true); $("#admNew").hidden = true; return; }
  if (b.dataset.savenote){
    const id = b.dataset.savenote, ta = document.querySelector(`[data-note="${CSS.escape(id)}"]`);
    try { await FB.saveNote(id, ta.value); ADM.notes[id] = ta.value; toast("Note saved"); if (ADM.pending) refreshAdmin(true); } catch(err){ console.error(err); toast("Couldn't save the note"); }
    return;
  }
  if (await productClick(b)) return;
});
document.addEventListener("toggle", e => {
  const d = e.target; if (!d.matches || !d.matches("details[data-oid]")) return;
  const id = d.dataset.oid;
  if (d.open){ ADM.open.add(id);
    if (ADM.notes[id] == null) FB.getNote(id).then(t => { ADM.notes[id] = t || ""; const ta = document.querySelector(`[data-note="${CSS.escape(id)}"]`); if (ta && !ta.value){ ta.value = t || ""; ta.placeholder = "e.g. Paid by e-Transfer, picking up Saturday"; } }).catch(()=>{ ADM.notes[id] = ""; });
  } else ADM.open.delete(id);
}, true);
document.addEventListener("input", e => { if (e.target.id === "admQ"){ ADM.q = e.target.value; const pos = e.target.selectionStart; refreshAdmin(true); const q = $("#admQ"); if (q){ q.focus(); q.setSelectionRange(pos,pos); } } });
document.addEventListener("submit", async e => {
  const f = e.target, m = $("#authMsg");
  const d = Object.fromEntries(new FormData(f));
  if (f.id === "signinForm" || f.id === "signupForm" || f.id === "resetForm"){
    e.preventDefault();
    const err = validate(f); if (err) return showMsg(m,false,err);
    if (!FB) return showMsg(m,false,"Still connecting. Try again in a moment.");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true;
    try {
      if (f.id === "signinForm") await FB.signIn(d.email.trim(), d.password);
      else if (f.id === "signupForm"){
        if (d.password.length < 6){ btn.disabled = false; return showMsg(m,false,"Use a password with at least 6 characters."); }
        signingUp = true;
        try { await FB.signUp(d.email.trim(), d.password, d.name.trim(), (d.phone||"").trim()); }
        finally { signingUp = false; }
        PROFILE = {name:d.name.trim(), email:d.email.trim(), phone:(d.phone||"").trim(), city:""};
        updateAcct(); if (!afterLogin) render();
        toast("Account created. Check your email to confirm it.");
      } else { await FB.reset(d.email.trim()); btn.disabled = false; showMsg(m,true,"If an account uses that email, a reset link is on its way. Check your inbox and spam folder."); }
    } catch(er){ btn.disabled = false; showMsg(m,false,authError(er)); }
    return;
  }
  if (f.id === "profileForm"){
    e.preventDefault();
    const pm = $("#profileMsg"), err = validate(f); if (err) return showMsg(pm,false,err);
    const dob = (d.dob || "").trim(), age = ageOf(dob);
    if (dob && (age == null || new Date(dob) > new Date())) return showMsg(pm, false, "Please check your date of birth.");
    const street = (d.street || "").trim().slice(0, 100), unit = (d.unit || "").trim().slice(0, 12), city = (d.city || "").trim().slice(0, 40), province = d.province || "", postal = fmtPostal((d.postal || "").trim()).slice(0, 7);
    if (postal && !/^[A-Z]\d[A-Z] \d[A-Z]\d$/.test(postal)) return showMsg(pm, false, "Please check your postal code (like L4C 3B2).");
    if (street && !city) return showMsg(pm, false, "Please add your city.");
    const address = street ? [(unit ? unit + "-" : "") + street, city, province, postal].filter(Boolean).join(", ") : "";
    const data = {name:d.name.trim(), phone:(d.phone||"").trim(), city, street, unit, province, postal, address, dob, lat: d.lat ? +d.lat : null, lng: d.lng ? +d.lng : null};
    try { await FB.saveProfile(USER.uid, data); PROFILE = {...(PROFILE||{}), ...data}; updateAcct(); showMsg(pm,true,"Details saved."); }
    catch(er){ console.error(er); showMsg(pm,false,"Couldn't save. Try again."); }
    return;
  }
  if (f.dataset.statusform){
    e.preventDefault();
    const o = ADM.orders.find(x=>x.id===f.dataset.statusform); if (!o) return;
    const status = d.status, emailIt = !!d.email, message = (d.message||"").trim();
    if (status === o.status && !message) return toast("Choose a different status first");
    const btn = f.querySelector("button[type=submit]"); btn.disabled = true; btn.textContent = "Saving…";
    let emailed = false;
    if (emailIt && o.email){ try { await emailCustomer(o, status, message); emailed = true; } catch(er){ console.error(er); toast("Status saved, but the email didn't send"); } }
    try {
      const r = await FB.setOrderStatus(o.id, status, {status, by: USER.email, emailed, ...(message ? {message} : {})});
      const stockMsg = r.stock === "taken" ? " · stock updated" : r.stock === "returned" ? " · items back in stock" : "";
      toast((emailed ? `Updated to ${status} · customer emailed` : `Updated to ${status}`) + stockMsg);
      if (r.soldOut && r.soldOut.length) setTimeout(() => toast(`Now sold out: ${r.soldOut.join(", ")}`), 2000);
    } catch(er){ console.error(er); toast("Couldn't update the order"); btn.disabled = false; btn.textContent = "Update status"; }
  }
});

/* ---- Firebase connection (loaded by the module script at the end of the page) ---- */
/* v92: visitors read ONE catalog record (products/_catalog) instead of every product and service,
   and keep a copy in the browser for 15 minutes. Admin keeps the live view and rebuilds the catalog when anything changes.
   If the catalog is missing or can't be read, the site falls back to reading products the old way. */
const CAT_KEY = "nojanCatalog", CAT_MAX_AGE = 15 * 60 * 1000;
const CAT = {live: false, applied: 0, lastSig: "", timer: 0, gotP: false, gotS: false, rawServices: []};
const catNorm = v => v && typeof v === "object" ? (v.toMillis ? v.toMillis() : Array.isArray(v) ? v.map(catNorm) : Object.fromEntries(Object.entries(v).map(([k, x]) => [k, catNorm(x)]))) : v;
const catStable = v => Array.isArray(v) ? "[" + v.map(catStable).join(",") + "]" : v && typeof v === "object" ? "{" + Object.keys(v).sort().map(k => JSON.stringify(k) + ":" + catStable(v[k])).join(",") + "}" : JSON.stringify(v === undefined ? null : v);
const catSig = c => catStable([c.products || [], c.services || [], c.site || {}]);
function catApply(c){
  if (!c || !Array.isArray(c.products)) return false;
  SITE = c.site || {};
  if (c.products.length) useProducts(c.products); else { ALL_PRODUCTS = []; loadFromSheet(); }
  useServices(c.services || []);
  CAT.applied = c.at || 1;
  return true;
}
function catLoadLocal(){ try { const c = JSON.parse(localStorage.getItem(CAT_KEY) || "null"); return c && c.data && Array.isArray(c.data.products) ? c : null; } catch (_) { return null; } }
function catSaveLocal(data){ try { localStorage.setItem(CAT_KEY, JSON.stringify({saved: Date.now(), data})); } catch (_) {} }
async function catFetch(){
  const raw = await FB.getCatalog();
  if (!raw || !raw.json) return null;
  const c = JSON.parse(raw.json);
  if (!c || !Array.isArray(c.products)) return null;
  catSaveLocal(c); return c;
}
function catRender(){ if (current() === "admin") refreshAdmin(); else render(); }
async function catStart(){
  const local = catLoadLocal();
  if (local && !CAT.applied && catApply(local.data)) catRender();
  if (local){ CAT.lastSig = catSig(local.data); if (Date.now() - local.saved < CAT_MAX_AGE) return; }
  try {
    const c = await catFetch();
    if (c){ CAT.lastSig = catSig(c); if (c.at !== CAT.applied){ catApply(c); catRender(); } return; }
  } catch (e){ console.error("catalog", e); }
  liveStart();
}
async function catFresh(){   // right before an order: newest prices and stock (1 read)
  if (!FB || CAT.live) return;
  try { const c = await catFetch(); if (c) catApply(c); } catch (_) {}
}
function catSchedule(){
  if (!FB || !FB.saveCatalog || !isAdmin() || !CAT.gotP || !CAT.gotS) return;
  clearTimeout(CAT.timer);
  CAT.timer = setTimeout(async () => {
    const data = {products: catNorm(ALL_PRODUCTS || []), services: catNorm(CAT.rawServices || []), site: catNorm(SITE || {})};
    const sig = catSig(data); if (sig === CAT.lastSig) return;
    data.at = Date.now();
    const json = JSON.stringify(data), big = json.length > 900000;
    try { await FB.saveCatalog(big ? {at: data.at, json: ""} : {at: data.at, json}); CAT.lastSig = sig; if (!big) catSaveLocal(data); }
    catch (e){ console.error("catalog save", e); }
  }, 3000);
}
function liveStart(){
  if (CAT.live || !FB) return; CAT.live = true;
  FB.watchProducts(list => {
    SITE = list.find(d => d.id === "_site") || {}; list = list.filter(d => !String(d.id).startsWith("_"));
    CAT.gotP = true; catSchedule();
    if (!list.length){ ALL_PRODUCTS = []; loadFromSheet(); if (current() === "admin") refreshAdmin(); return; }
    useProducts(list);
    if (current() === "admin") refreshAdmin(); else render();
  }, err => { console.error(err); if (!CAT.applied) loadFromSheet(); });
  FB.watchServices(list => {
    CAT.rawServices = list; CAT.gotS = true; catSchedule();
    useServices(list);
    if (current() === "admin") refreshAdmin(); else if (current() === "service") { const p = $("#bookPanel"); if (p) refreshBookPanel(); else render(); } else render();
  }, err => { console.error(err); servicesLoaded = true; render(); });
}
function onFirebaseReady(api){
  FB = api; fbFailed = false;
  mkStartWatch();
  catStart();
  FB.onAuth(async u => {
    const prevUid = USER && USER.uid;
    USER = u; PROFILE = null;
    if (u && !u.emailVerified){ try { USER = await FB.refreshUser(); } catch(_) {} }
    if (isAdmin()) liveStart();   // v92: admin always sees live data and keeps the catalog up to date
    if (u){
      try { PROFILE = await FB.getProfile(u.uid); } catch(_) {}
      if (!PROFILE && signingUp) PROFILE = {name: "", email: u.email || "", phone: "", city: ""};
      else if (!PROFILE){
        PROFILE = {name: u.displayName || "", email: u.email || "", phone: "", city: ""};
        FB.saveProfile(u.uid, {...PROFILE, provider: (u.providerData[0]||{}).providerId || "password"}, true).catch(err => console.error(err));
      }
    }
    if (!u || u.uid !== prevUid){
      if (MY.unsub){ MY.unsub(); MY.unsub = null; } MY.orders = null;
      if (ADM.unsubO){ ADM.unsubO(); ADM.unsubO = null; } if (ADM.unsubU){ ADM.unsubU(); ADM.unsubU = null; }
      if (ADM.unsubB){ ADM.unsubB(); ADM.unsubB = null; } if (MY.unsubB){ MY.unsubB(); MY.unsubB = null; } MY.bookings = null;
      ADM.orders = ADM.users = ADM.bookings = null; ADM.error = null; ADM.notes = {};
      dtReset(); DT.adm = null;
      if (HM.unsubT) HM.unsubT(); HM.unsubT = null; HM.tuid = null; HM.threads = null; HM.mine = null; HM.adm = null; HM.form = null;
      if (MK.admUnsub) MK.admUnsub.forEach(u => { try { u(); } catch (_) {} }); MK.admUnsub = null;
      MK.meUid = null; MK.me = "none"; MK.mine = null; MK.form = null; MK.adm = null; MK.editId = null;
      PED = {id:null, data:null, photo:null};
    }
    authReady = true; updateAcct();
    if (u && afterLogin){ const v = afterLogin; afterLogin = null; authMode = "signin"; go(v === "account" ? "account" : v); if (v === "account" || v === "checkout") toast("You're signed in"); }
    else render();
  });
}
window.addEventListener("firebase-ready", () => onFirebaseReady(window.SHOP_FB));
window.addEventListener("focus", async () => {   // picks up an email confirmation done in another tab
  if (!FB || !USER || USER.emailVerified) return;
  try { const u = await FB.refreshUser(); if (u && u.emailVerified){ USER = u; updateAcct(); render(); toast("Email confirmed"); } } catch(_) {}
});
if (window.SHOP_FB) setTimeout(() => onFirebaseReady(window.SHOP_FB));
setTimeout(() => { if (!FB){ fbFailed = true; authReady = true; render(); if (!CAT.applied) loadFromSheet(); } }, 12000);
{ const l = catLoadLocal(); if (l && l.data.products.length) catApply(l.data); }   // v92: saved catalog shows instantly

$("#yr").textContent = new Date().getFullYear();
$("#infoEmail").textContent = CONTACT_EMAIL;
updateCount(); render();
let sheetLoading = null;
function loadFromSheet(){   // used only when the product database is empty or can't be reached
  if (sheetLoading) return sheetLoading;
  sheetLoading = loadSheet().then(() => {
    if (productSource === "db") return;
    productSource = "sheet";
    Object.keys(cart).forEach(id => { const p = PRODUCTS.find(x=>x.id===id); if (p) cart[id].snap = p; });
    saveCart(); render();
  });
  return sheetLoading;
}

