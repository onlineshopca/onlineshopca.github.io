// Nojan · v99 · inventory: scan in, scan out, item and unit numbers, labels. Loaded only when an admin opens Inventory.
(function(){
"use strict";
const INV = window.NJ_INV = {view: "list", filter: "All", q: "", res: null, form: null, photos: [], queue: [], start: 1, last: null, busy: false};
try { INV.queue = JSON.parse(localStorage.getItem("nojanLabels") || "[]").filter(x => typeof x === "string"); } catch (_) {}
const saveQ = () => { try { localStorage.setItem("nojanLabels", JSON.stringify(INV.queue)); } catch (_) {} };

/* ---------- numbers ---------- */
const digits = s => String(s == null ? "" : s).replace(/\D/g, "");
const eanCheck = d12 => { let s = 0; for (let i = 0; i < 12; i++) s += (+d12[i]) * (i % 2 ? 3 : 1); return (10 - s % 10) % 10; };
/* every code is kept in its 13-digit form; a 12-digit UPC gets a leading 0 */
function normCode(raw){
  let d = digits(raw);
  if (d.length === 12) d = "0" + d;
  if (d.length === 13) return eanCheck(d.slice(0, 12)) === +d[12] ? d : "";
  return d.length === 8 ? d : "";
}
const isUnit = c => c.length === 13 && c.startsWith("04");
const showCode = c => !c ? "" : c.length === 13 && c[0] === "0" ? `${c[1]} ${c.slice(2, 7)} ${c.slice(7, 12)} ${c[12]}` : c.length === 13 ? `${c[0]} ${c.slice(1, 7)} ${c.slice(7)}` : c;
/* Nojan unit number: 4 (the range kept for a company's own numbers) + year + 8 random digits + check digit */
function newUnit(extra){
  const used = new Set(ALL_PRODUCTS.map(d => d.unit).filter(Boolean)); if (extra) extra.forEach(u => used.add(u));
  const yy = String(new Date().getFullYear()).slice(2), r = new Uint32Array(1); let u;
  do { crypto.getRandomValues(r); const body = "04" + yy + String(r[0] % 100000000).padStart(8, "0"); u = body + eanCheck(body); } while (used.has(u));
  return u;
}
const EL = ["0001101","0011001","0010011","0111101","0100011","0110001","0101111","0111011","0110111","0001011"];
const EG = ["0100111","0110011","0011011","0100001","0011101","0111001","0000101","0010001","0001001","0010111"];
const ER = ["1110010","1100110","1101100","1000010","1011100","1001110","1010000","1000100","1001000","1110100"];
const EP = ["LLLLLL","LLGLGG","LLGGLG","LLGGGL","LGLLGG","LGGLLG","LGGGLL","LGLGLG","LGLGGL","LGGLGL"];
function eanBits(c){
  const p = EP[+c[0]]; let b = "101";
  for (let i = 1; i <= 6; i++) b += (p[i - 1] === "L" ? EL : EG)[+c[i]];
  b += "01010";
  for (let i = 7; i <= 12; i++) b += ER[+c[i]];
  return b + "101";
}
function barcodeSVG(c){
  const bits = eanBits(c); let d = "";
  for (let i = 0; i < bits.length;){ if (bits[i] === "1"){ let j = i; while (bits[j] === "1") j++; d += `M${i} 0h${j - i}v1h-${j - i}z`; i = j; } else i++; }
  return `<svg class="invbc" role="img" aria-label="Barcode ${showCode(c)}" viewBox="0 0 95 1" preserveAspectRatio="none"><path d="${d}"/></svg>`;
}
INV._t = {normCode, eanBits, eanCheck, newUnit, showCode};

/* ---------- small helpers ---------- */
const stockN = d => Math.max(0, parseInt(d.stock, 10) || 0);
const docOf = id => rawProduct(id) || (INV.last && INV.last.id === id ? INV.last : null);
const effId = d => normId(d.itemId) || fallbackId(d.id);
const openOrderOf = d => (ADM.orders || []).find(o => !["Completed", "Cancelled"].includes(o.status) && (o.items || []).some(it => String(it.id).replace(/^s-/, "") === d.id));
const stateOf = d => stockN(d) <= 0 ? "Sold" : d.active === false ? "Hidden" : "In stock";
const condTxt = d => d.condition === "used" ? "Used" + (d.grade ? ", " + d.grade : "") : "Brand new";
const priceTxt = d => { const p = fsToItem(d); return p.price == null ? "No price" : money(p.price); };
const I = {
  scanIn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5a1 1 0 0 1 1-1h3M17 4h3a1 1 0 0 1 1 1v3M21 16v3a1 1 0 0 1-1 1h-3M7 20H4a1 1 0 0 1-1-1v-3M12 8v8M8 12h8"/></svg>',
  scanOut: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3 8V5a1 1 0 0 1 1-1h3M17 4h3a1 1 0 0 1 1 1v3M21 16v3a1 1 0 0 1-1 1h-3M7 20H4a1 1 0 0 1-1-1v-3M8 12.5l3 3 5.5-6.5"/></svg>',
  cam: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 8h3l2-3h6l2 3h3v11H4zM12 10.5a3 3 0 1 0 0 6 3 3 0 0 0 0-6z"/></svg>',
  check: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12.5l4.500 4.500L19 7.500"/></svg>'.replace(/\.500/g, ".5"),
  bag: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 8h12l1 12H5L6 8zM9 8V6a3 3 0 0 1 6 0v2"/></svg>',
  x: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M13 3L5 13h6l-1 8 8-10h-6l1-8z"/></svg>',
  arrow: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>',
  bars: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 6v12M8 6v12M11 6v12M15 6v12M18 6v12M20.5 6v12"/></svg>'
};
function show(view){
  if (view) INV.view = view;
  ADM.tab = "inventory";
  if (current() !== "admin") go("admin"); else refreshAdmin(true);
  window.scrollTo(0, 0);
}
function itemCard(d){
  const p = fsToItem(d), img = imagesOf(p)[0];
  return `<div class="invcard">${img ? `<img src="${esc(img)}" data-ref="${esc(refsOf(p)[0])}" alt="">` : `<span class="noimg"></span>`}
    <div><div class="pname">${esc(d.title || "")}</div><div class="pmeta"><code class="idcode">${esc(effId(d))}</code> · ${esc(condTxt(d))} · ${priceTxt(d)}</div></div></div>`;
}
const head = (title, pill) => `<div class="invhead"><button type="button" class="invback" data-inv="home" aria-label="Back to inventory">${I.arrow}</button><h2>${title}</h2>${pill || ""}</div>`;
const pillHTML = (cls, text) => `<span class="invpill"><i class="invdot ${cls}"></i>${esc(text)}</span>`;

/* ---------- inventory list ---------- */
function listHTML(){
  if (!ALL_PRODUCTS.length) return `<div class="empty">Your products haven't loaded yet. Give it a moment, or open the Products tab.</div>`;
  const all = ALL_PRODUCTS.map(d => ({d, st: stateOf(d), ord: openOrderOf(d)}));
  const cnt = {All: all.length, "In stock": all.filter(x => x.st === "In stock").length, "On order": all.filter(x => x.ord).length, Sold: all.filter(x => x.st === "Sold").length, Hidden: all.filter(x => x.st === "Hidden").length};
  const q = INV.q.trim().toLowerCase(), qd = digits(q);
  let list = all.filter(x => INV.filter === "All" || (INV.filter === "On order" ? !!x.ord : x.st === INV.filter));
  if (q) list = list.filter(x => [x.d.id, effId(x.d), x.d.title, x.d.brand, x.d.type].join(" ").toLowerCase().includes(q) || (qd.length >= 4 && ((x.d.unit || "").includes(qd) || (x.d.gtin || "").includes(qd))));
  list.sort((a, b) => a.d.id.localeCompare(b.d.id, undefined, {numeric: true}));
  const old = ALL_PRODUCTS.filter(d => !d.unit || !normId(d.itemId)).length;
  return `<section class="invhero"><h2>Inventory</h2><p>Add items and mark them sold by scanning.</p>
      <div class="invacts"><button type="button" class="btn invbig" data-inv="scan" data-mode="in">${I.scanIn}Scan in</button><button type="button" class="btn invbig" data-inv="scan" data-mode="out">${I.scanOut}Scan out</button></div></section>
    <div class="admintools"><input id="invQ" type="search" placeholder="Search by name, brand, ID or number" value="${esc(INV.q)}" aria-label="Search inventory"></div>
    <div class="chips invchips" role="group" aria-label="Filter items">${Object.keys(cnt).filter(k => k !== "Hidden" || cnt[k]).map(k => `<button type="button" data-inv="filter" data-v="${k}" aria-pressed="${INV.filter === k}">${k} (${cnt[k]})</button>`).join("")}</div>
    ${(() => { const S = salesSum(); return `<div class="invbar"><span>Sales this month: <b>${money(S.month[1])}</b> · ${S.month[0]} sold</span><button type="button" class="btn small" data-inv="salesview">See sales</button></div>`; })()}
    ${INV.queue.length ? `<div class="invbar"><span><b>${INV.queue.length}</b> label${INV.queue.length === 1 ? "" : "s"} waiting to print</span><button type="button" class="btn small" data-inv="sheet">Open the label sheet</button></div>` : ""}
    ${old ? `<div class="invbar"><span><b>${old}</b> item${old === 1 ? " still has" : "s still have"} an old-style ID or no unit number.</span><button type="button" class="btn small" data-inv="migrate">Give them new numbers</button></div>` : ""}
    ${list.length ? `<div class="plist">${list.map(({d, st, ord}) => {
      const p = fsToItem(d), img = imagesOf(p)[0], n = stockN(d);
      return `<div class="prow invrow${st === "Sold" ? " soldp" : ""}">
        ${img ? `<img src="${esc(img)}" data-ref="${esc(refsOf(p)[0])}" alt="">` : `<span class="noimg"></span>`}
        <div><div class="pname">${esc(d.title || "")}</div>
          <div class="pmeta"><code class="idcode">${esc(effId(d))}</code> · ${esc(condTxt(d))} · ${priceTxt(d)}</div>
          <div class="invst">${ord ? pillHTML("ord", "On order #" + ord.number) : ""}${st === "Sold" ? pillHTML("sold", "Sold · off the website") : st === "Hidden" ? pillHTML("hid", n + " in stock · hidden") : pillHTML("ok", n + " in stock")}${d.unit ? `<span class="invunit">${showCode(d.unit)}</span>` : ""}</div></div>
        <div class="pctl"><button type="button" class="btn small" data-inv="label" data-id="${esc(d.id)}">Label</button><button type="button" class="btn small" data-inv="edit" data-id="${esc(d.id)}">Edit</button></div></div>`; }).join("")}</div>` : `<div class="empty">No items match.</div>`}`;
}

/* ---------- results ---------- */
function stockBox(r, d){
  return `<div class="invbox"><div class="invline"><span>In stock</span><b class="invnum"><i>${r.from}</i>${I.arrow}<span>${r.to}</span></b></div>
    ${r.code ? `<div class="invline"><span>Scanned</span><code class="idcode">${showCode(r.code)}</code></div>` : ""}</div>`;
}
function addedHTML(){
  const r = INV.res, d = docOf(r.id); if (!d) return listHTML();
  const n = stockN(d);
  return `${head("Scan in")}
    <div class="invdone"><span class="invok ok">${I.check}</span><h3>Added 1</h3><p>This barcode is already in your inventory, so the count went up by one. Nothing to type.</p></div>
    ${itemCard(d)}
    <div class="invbox"><div class="invline"><span>In stock</span><b class="invnum"><i>${r.from}</i>${I.arrow}<span>${r.to}</span></b></div>
      <div class="invline"><span>Got more than one? Set how many you have now</span><span class="stockctl" aria-label="Quantity available"><button type="button" data-inv="fix" data-d="-1" aria-label="One less">−</button><input type="number" min="0" step="1" value="${n}" id="invFix" aria-label="Quantity available"><button type="button" data-inv="fix" data-d="1" aria-label="One more">+</button></span></div>
      <p class="invgood">${d.active === false ? "This item is hidden, so customers can't see it yet." : "The website already shows the new count."}</p></div>
    <div class="invbtns"><button type="button" class="btn invmain" data-inv="scan" data-mode="in">Scan the next item</button>
      <button type="button" class="btn" data-inv="undo">Undo</button>
      ${d.condition !== "used" ? `<button type="button" class="btn" data-inv="isused">This one is used, not new</button>` : ""}
      <button type="button" class="btn" data-inv="edit" data-id="${esc(d.id)}">Edit this item</button></div>`;
}
function soldHTML(){
  const r = INV.res, d = docOf(r.id); if (!d) return listHTML();
  const last = r.to <= 0;
  return `${head("Scan out")}
    <div class="invdone"><span class="invok">${I.check}</span><h3>Sold</h3><p>${last ? "That was the last one, so it is off the website now." : `${r.to} left. It stays on the website.`}${r.order ? ` Order #${esc(String(r.order))} is marked Completed.` : ""}</p></div>
    ${itemCard(d)}
    <div class="invbox">${r.code ? `<div class="invline"><span>Scanned</span><code class="idcode">${showCode(r.code)}</code></div>` : ""}
      <div class="invline"><span>In stock</span><b class="invnum"><i>${r.from}</i>${I.arrow}<span>${r.to}</span></b></div>
      <div class="invline"><span>Website</span><b>${last ? "Removed from the shop and search" : "Still listed"}</b></div>
      <div class="invline"><span>Your records</span><b>${last ? "Kept in Inventory under Sold" : "Count updated"}</b></div>
      ${r.saleAt ? `<div class="invline"><span>Sold for</span><span class="invprice">$<input type="number" id="invSalePrice" min="0" step="0.01" inputmode="decimal" value="${(+r.price || 0).toFixed(2)}" aria-label="Price the customer paid"><button type="button" class="btn small" data-inv="saleprice">Save</button></span></div>
      <p class="note">This is the website price. If the customer paid something else, change it and tap Save.</p>` : ""}</div>
    <div class="invbtns"><button type="button" class="btn invmain" data-inv="scan" data-mode="out">Scan the next item</button>
      ${r.order ? "" : `<button type="button" class="btn" data-inv="undo">Undo and put it back</button>`}</div>`;
}
function orderHTML(){
  const r = INV.res, d = docOf(r.id), o = (ADM.orders || []).find(x => x.id === r.oid); if (!d || !o) return listHTML();
  const more = stockN(d) > 0;
  return `${head("Scan out")}
    <div class="invdone"><span class="invok ord">${I.bag}</span><h3>This item is on an order</h3><p>A customer ordered it. Finish the order when they have tested the item and paid.</p></div>
    ${itemCard(d)}
    <div class="invbox"><div class="invline"><b>#${esc(String(o.number))} · ${esc(o.name || "")}</b>${pill(o.status)}</div>
      ${r.code ? `<div class="invline"><span>Scanned</span><code class="idcode">${showCode(r.code)}</code></div>` : ""}
      <div class="invline"><span>To pay at pickup</span><b>${money(o.total || 0)}${typeof HST_RATE !== "undefined" && !HST_RATE ? ", no tax added" : ""}</b></div></div>
    <div class="invbtns"><button type="button" class="btn invmain" data-inv="orderdone">Picked up and paid</button><p class="note">Marks the order Completed and takes the item out of stock.</p>
      <button type="button" class="btn" data-inv="ordercancel">Customer did not take it</button><p class="note">Cancels the order. The item stays on the website.</p>
      ${more ? `<button type="button" class="btn" data-inv="sellother">This sale is for someone else</button>` : ""}
      <button type="button" class="btn" data-inv="home">Not now</button></div>`;
}
function noneHTML(){
  const r = INV.res;
  return `${head(r.mode === "out" ? "Scan out" : "Scan in")}
    <div class="invdone"><span class="invok hid">${I.bars}</span><h3>${r.kind === "already" ? "Already marked sold" : r.kind === "nolabel" ? "This Nojan label isn't in your inventory" : "Not in your inventory"}</h3>
      <p>${r.kind === "already" ? "This item has no stock left, so there is nothing to take out. Scan it in if it came back." : r.kind === "nolabel" ? "The item it belonged to may have been deleted." : "Nothing in your inventory has this barcode. Scan it in first."}</p></div>
    ${r.id && docOf(r.id) ? itemCard(docOf(r.id)) : ""}
    ${r.code ? `<div class="invbox"><div class="invline"><span>Scanned</span><code class="idcode">${showCode(r.code)}</code></div></div>` : ""}
    <div class="invbtns"><button type="button" class="btn invmain" data-inv="scan" data-mode="${r.mode === "out" ? "out" : "in"}">Scan again</button>
      ${r.mode === "out" ? `<button type="button" class="btn" data-inv="scan" data-mode="in">Scan it in instead</button>` : ""}
      <button type="button" class="btn" data-inv="home">Back to inventory</button></div>`;
}
function pickHTML(){
  const r = INV.res;
  return `${head("Scan out")}
    <div class="invdone"><h3>Which one did you sell?</h3><p>More than one item has this barcode.</p></div>
    <div class="plist">${r.ids.map(id => docOf(id)).filter(Boolean).map(d => `<button type="button" class="invpick" data-inv="pickone" data-id="${esc(d.id)}">${itemCard(d)}<span class="invst">${pillHTML("ok", stockN(d) + " in stock")}${d.unit ? `<span class="invunit">${showCode(d.unit)}</span>` : ""}</span></button>`).join("")}</div>
    <div class="invbtns"><button type="button" class="btn" data-inv="home">Cancel</button></div>`;
}

/* ---------- sales record ---------- */
const dayKey = t => { const x = new Date(t); return x.getFullYear() + "-" + (x.getMonth() + 1) + "-" + x.getDate(); };
function salesSum(){
  const all = allSales(), now = new Date(), tk = dayKey(now), mk = now.getFullYear() + "-" + now.getMonth();
  const sum = l => l.reduce((n, x) => n + (+x.price || 0), 0), mon = all.filter(x => { const d = new Date(x.at); return d.getFullYear() + "-" + d.getMonth() === mk; }), tod = all.filter(x => dayKey(x.at) === tk);
  return {all, today: [tod.length, sum(tod)], month: [mon.length, sum(mon)], total: [all.length, sum(all)]};
}
function salesHTML(){
  const S = salesSum(), row = (k, v) => `<div class="invline"><span>${k}</span><b>${money(v[1])} <small>· ${v[0]} sold</small></b></div>`;
  return `${head("Sales")}
    <div class="invbox">${row("Today", S.today)}${row("This month", S.month)}${row("All time", S.total)}
      <p class="note">Sales are recorded when you scan an item out. The price is the website price unless you changed it on the Sold screen.</p></div>
    ${S.all.length ? `<div class="plist">${S.all.slice(0, 200).map(x => `<div class="invqrow"><div><div class="pname">${esc(x.title)}</div><div class="pmeta"><code class="idcode">${esc(x.itemId)}</code> · ${new Date(x.at).toLocaleDateString("en-CA", {month: "short", day: "numeric", year: "numeric"})}${x.order ? " · order #" + esc(String(x.order)) : ""}${x.unit ? ` · <span class="mono">${showCode(x.unit)}</span>` : ""}</div></div><b>${money(+x.price || 0)}</b></div>`).join("")}</div>` : `<div class="empty">No sales recorded yet. They appear here after your first scan-out.</div>`}
    <div class="invbtns"><button type="button" class="btn" data-inv="home">Back to inventory</button></div>`;
}

/* ---------- add an item ---------- */
function openForm(init){
  INV.form = {gtin: "", like: null, title: "", brand: "", type: "", condition: "new", grade: "Good", price: "", salePrice: "", stock: 1, notes: "", imgUrl: "", found: null, ...init};
  const k = INV.form.like;
  if (k){ INV.form.title = k.title || ""; INV.form.brand = k.brand || ""; INV.form.type = k.type || ""; INV.form.price = k.price == null ? "" : String(k.price); INV.form.condition = "used"; if (init && init.grade && k.salePrice != null && k.salePrice !== "") INV.form.salePrice = String(k.salePrice); }
  if (INV.form.price !== "" && INV.form.salePrice === "") INV.form.salePrice = rulePrice(INV.form.price, INV.form.condition);
  INV.photos = []; show("form");
}
const rulePrice = (reg, cond) => { const v = parseFloat(reg); return v > 0 ? (Math.round(v * (cond === "used" ? 60 : 80)) / 100).toFixed(2) : ""; };
function formSync(){
  const f = $("#invForm"); if (!f || !INV.form) return;
  ["title", "brand", "type", "price", "salePrice", "notes"].forEach(k => { if (f[k]) INV.form[k] = f[k].value; });
  if (f.stock) INV.form.stock = Math.max(1, parseInt(f.stock.value, 10) || 1);
}
function photosHTML(){
  const F = INV.form, slots = [];
  INV.photos.forEach((ph, i) => slots.push(`<div class="invph"><img src="${esc(ph.thumb || ph.full)}" alt="Photo ${i + 1}">${i ? "" : `<span class="invmain2">Main</span>`}<button type="button" data-inv="phrm" data-i="${i}" aria-label="Remove photo ${i + 1}">×</button></div>`));
  if (!INV.photos.length && F.imgUrl) slots.push(`<div class="invph"><img src="${esc(F.imgUrl)}" alt="Photo from the product database"><span class="invmain2">Database</span><button type="button" data-inv="dbrm" aria-label="Remove the database photo">×</button></div>`);
  while (slots.length < 5) slots.push(`<span class="invph empty" aria-hidden="true">+</span>`);
  return slots.join("");
}
function formHTML(){
  const F = INV.form; if (!F) return listHTML();
  const used = F.condition === "used", own = INV.photos.length;
  return `${head(used ? "Used item" : "New item", `<span class="invpill">Not on the website yet</span>`)}
  <form class="panel invform" id="invForm" novalidate>
    ${F.like ? `<div class="invsoft"><small>Same product as one you already sell</small><b>${esc(F.like.title || "")}</b><span><code class="idcode">${esc(effId(F.like))}</code></span></div>`
      : F.gtin ? `<div class="invsoft row2">${I.bars}<span><small>Barcode on the box</small><b class="mono">${showCode(F.gtin)}</b></span>${pillHTML(F.found ? "ok" : "hid", F.found ? "Found" : "Not in the database")}</div>
        <p class="note">${F.found ? "The name, brand and photo came from the product database. Check them, set the price, then publish." : "The product database doesn't know this barcode. Type the details once and the next scan will know it."}</p>`
      : `<div class="invsoft"><small>No barcode</small><b>Nojan will make a label for this item.</b></div>`}
    <label>Product name<input name="title" required value="${esc(F.title)}" placeholder="e.g. Breville the Smart Oven Pro, Brushed Stainless Steel"></label>
    <div class="inv2"><label>Brand<input name="brand" value="${esc(F.brand)}"></label>
      <label>Product type<input name="type" list="invTypes" value="${esc(F.type || (F.title ? guessType(F.title) : ""))}" placeholder="e.g. Vacuums"><datalist id="invTypes">${[...new Set([...TYPE_LIST, ...ALL_PRODUCTS.map(x => x.type).filter(Boolean)])].sort().map(t => `<option value="${esc(t)}">`).join("")}</datalist></label></div>
    <div class="invfield"><span id="invCondL">Condition</span><div class="invseg" role="group" aria-labelledby="invCondL"><button type="button" data-inv="cond" data-v="new" aria-pressed="${!used}">${!used ? I.check : ""}Brand new</button><button type="button" data-inv="cond" data-v="used" aria-pressed="${used}">${used ? I.check : ""}Used</button></div></div>
    ${used ? `<div class="invfield"><span id="invGradeL">Grade</span><div class="invseg three" role="group" aria-labelledby="invGradeL">${GRADES.map(g => `<button type="button" data-inv="grade" data-v="${g}" aria-pressed="${F.grade === g}">${F.grade === g ? I.check : ""}${g}</button>`).join("")}</div></div>` : ""}
    <div class="invfield invphotosec"><div class="invline"><span>${used ? "Your photos of this item" : "Photos"}</span><small>${own} of 5</small></div>
      <div class="invphotos" id="invPhotoGrid">${photosHTML()}</div>
      <div class="inv2"><label class="btn invfile">${I.cam}Take a photo<input type="file" accept="image/*" capture="environment" id="invCam"></label><label class="btn invfile">From my photos<input type="file" accept="image/*" multiple id="invLib"></label></div>
      <p class="note">${used ? "Take a photo opens your phone's camera. Show the front, the back, any marks, and everything that comes with it." : "Your own photos are optional for brand new items."}</p></div>
    ${used ? `<label>Notes on its condition<textarea name="notes" placeholder="For example: light scratch on the case, cable included">${esc(F.notes)}</textarea></label>` : ""}
    <div class="inv2"><label>Regular price (CAD)<input name="price" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(F.price)}" placeholder="e.g. 269.99"></label>
      <label>Your price (CAD)<input name="salePrice" class="invstrong" type="number" min="0" step="0.01" inputmode="decimal" value="${esc(F.salePrice)}"></label></div>
    <p class="note">Your price fills in by your rule: 20% below for brand new, 40% below for used. You can change it.</p>
    ${used ? "" : `<div class="invline"><span id="invQtyL">How many</span><span class="stockctl" role="group" aria-labelledby="invQtyL"><button type="button" data-inv="qty" data-d="-1" aria-label="One less">−</button><input type="number" name="stock" min="1" step="1" value="${F.stock}" aria-label="How many"><button type="button" data-inv="qty" data-d="1" aria-label="One more">+</button></span></div>`}
    <div id="invMsg" hidden></div>
    <div class="invbtns"><button class="btn invmain" type="submit" data-pub="1">${used ? "Publish and make the label" : "Publish to the website"}</button>
      ${used ? `<p class="note">A used item needs at least one of your own photos before it goes live.</p>` : ""}
      <button class="btn" type="submit" data-pub="0">Save, but keep it hidden</button></div>
  </form>`;
}
async function saveForm(f, publish, btn){
  formSync();
  const F = INV.form, m = $("#invMsg"), used = F.condition === "used";
  const title = (F.title || "").trim(); if (!title) return showMsg(m, false, "Enter a product name.");
  const price = F.price === "" ? null : +F.price, sale = F.salePrice === "" ? null : +F.salePrice;
  if (price != null && sale != null && sale > price) return showMsg(m, false, "Your price is higher than the regular price. Check the two prices.");
  if (publish && price == null && sale == null) return showMsg(m, false, "Set a price before publishing, or save it hidden.");
  if (publish && used && !INV.photos.length) return showMsg(m, false, "Add at least one of your own photos, or save it hidden.");
  if (INV.busy) return; INV.busy = true;
  const txt = btn.textContent; f.querySelectorAll("button[type=submit]").forEach(b => b.disabled = true); btn.textContent = "Saving…";
  try {
    const id = nextProductId(F.condition), itemId = F.like ? effId(F.like) : newItemId(), refs = [];
    for (const ph of INV.photos){ if (!ph.ref){ const imgId = await FB.saveImage(ph.full); IMG[imgId] = ph.full; ph.ref = "img:" + imgId; } refs.push(ph.ref); }
    if (!refs.length && F.imgUrl) refs.push(F.imgUrl);
    const notes = used ? (F.notes || "").trim() : "", base = F.like ? (F.like.description || "").split(/\n/).filter(l => !/^[•\-*]\s*CONDITION:/i.test(l)).join("\n").trim() : "";
    const data = {title, brand: (F.brand || "").trim(), condition: F.condition, price: price == null ? sale : price, salePrice: price == null ? null : sale,
      type: (F.type || "").trim() || guessType(title), grade: used ? (F.grade || "") : "", stock: used ? 1 : Math.max(1, parseInt(F.stock, 10) || 1), active: !!publish,
      description: [base, notes ? "• CONDITION: " + notes : ""].filter(Boolean).join("\n"), images: refs, thumb: INV.photos[0] ? (INV.photos[0].thumb || "") : "", itemId, unit: newUnit(), order: ALL_PRODUCTS.length};
    if (F.gtin) data.gtin = F.gtin;
    if (notes) data.notes = notes;
    await FB.saveProduct(id, data, true);
    INV.last = {id, ...data}; INV.res = {kind: "saved", id, published: !!publish, fresh: true}; INV.form = null; INV.photos = [];
    INV.busy = false; show("label");
  } catch (er){ console.error(er); INV.busy = false; f.querySelectorAll("button[type=submit]").forEach(b => b.disabled = false); btn.textContent = txt; showMsg(m, false, "Couldn't save. Check your connection and try again."); }
}

/* ---------- labels ---------- */
function labelHTML(d){
  return `<div class="invlabel"><div class="iln">${esc(d.title || "")}</div><div class="ilm"><span>${d.condition === "used" ? "Used" + (d.grade ? " · " + esc(d.grade) : "") : "Brand new"}</span><span class="ilid">${esc(effId(d))}</span></div>${barcodeSVG(d.unit)}<div class="ilc">${showCode(d.unit)}</div></div>`;
}
function labelViewHTML(){
  const r = INV.res, d = docOf(r.id); if (!d || !d.unit) return listHTML();
  const inQ = INV.queue.includes(d.id), live = d.active !== false && stockN(d) > 0;
  return `${head("Nojan label", pillHTML(live ? "ok" : "hid", live ? "On the website" : stockN(d) > 0 ? "Hidden" : "Sold"))}
    <div class="invdone left"><h3>${r.fresh ? "Saved. Now label it." : "Label"}</h3><p>${esc(d.title || "")} · ${esc(condTxt(d))}</p></div>
    <div class="invbox"><div class="invline"><span><b>Item ID</b> the product</span><code class="idcode">${esc(effId(d))}</code></div>
      <div class="invline"><span><b>Unit number</b> this one</span><code class="idcode">${showCode(d.unit)}</code></div>
      ${d.gtin ? `<div class="invline"><span><b>Box barcode</b></span><code class="idcode">${showCode(d.gtin)}</code></div>` : ""}
      <p class="note">Every unit of the same product shares the Item ID. The unit number belongs to this one item only, and its last digit is a check digit.</p></div>
    <div class="invbox"><div class="invline"><b>Label</b><small>Prints at 2⅝ × 1 in</small></div>
      <div class="invprev">${labelHTML(d)}</div>
      <p class="note">${d.gtin && d.condition !== "used" ? "A boxed item already has its own barcode, so this label is optional." : "No price on the label, so it stays right when you change the price."}</p></div>
    <div class="invbtns"><button type="button" class="btn invmain" data-inv="print1" data-id="${esc(d.id)}">Print this label</button>
      <button type="button" class="btn" data-inv="queue" data-id="${esc(d.id)}"${inQ ? " disabled" : ""}>${inQ ? "On the label sheet" : `Add to the label sheet (${INV.queue.length} waiting)`}</button>
      <button type="button" class="btn" data-inv="printroll" data-id="${esc(d.id)}">Print on a label printer</button>
      ${r.fresh && d.condition === "used" ? `<button type="button" class="btn" data-inv="another" data-id="${esc(d.id)}">Add another one like this</button>` : ""}
      <button type="button" class="btn" data-inv="scan" data-mode="in">Scan the next item</button>
      <p class="note">"Print this label" is for sticker sheets. "Print on a label printer" makes one 2¼ × 1¼ in label per page for a roll printer. Prints from your phone to a normal printer on sticker sheets (30 per letter page), or to a label printer.</p></div>`;
}
function sheetHTML(){
  const ds = INV.queue.map(docOf).filter(d => d && d.unit);
  return `${head("Label sheet")}
    <div class="invdone left"><h3>${ds.length} label${ds.length === 1 ? "" : "s"} to print</h3><p>For letter sticker sheets with 30 labels (2⅝ × 1 in, Avery 5160 layout). Print at 100%, not "fit to page".</p></div>
    ${ds.length ? `<div class="invbox"><label class="invline">Start at label number <input type="number" id="invStart" min="1" max="30" step="1" value="${INV.start}" inputmode="numeric" style="width:84px"></label><p class="note">Use this when the top of the sheet is already used. Labels count left to right, row by row.</p></div>
      <div class="plist">${ds.map(d => `<div class="invqrow">${labelHTML(d)}<button type="button" class="btn small" data-inv="unqueue" data-id="${esc(d.id)}">Remove</button></div>`).join("")}</div>` : `<div class="empty">No labels are waiting. Open an item's label and add it to the sheet.</div>`}
    <div class="invbtns">${ds.length ? `<button type="button" class="btn invmain" data-inv="printq">Print ${ds.length} label${ds.length === 1 ? "" : "s"}</button><button type="button" class="btn" data-inv="printqroll">Print on a label printer (one per label)</button><button type="button" class="btn" data-inv="clearq">Clear the list</button>` : ""}
      <button type="button" class="btn" data-inv="home">Back to inventory</button></div>`;
}
function printLabels(ids, start, roll){
  const ds = ids.map(docOf).filter(d => d && d.unit); if (!ds.length) return toast("Nothing to print");
  const cells = [], pages = [];
  if (roll) ds.forEach(d => pages.push(`<div class="invrollpage">${labelHTML(d)}</div>`));
  else {
    for (let i = 1; i < Math.min(30, Math.max(1, start || 1)); i++) cells.push(`<div class="invcell"></div>`);
    ds.forEach(d => cells.push(`<div class="invcell">${labelHTML(d)}</div>`));
    for (let i = 0; i < cells.length; i += 30) pages.push(`<div class="invsheet">${cells.slice(i, i + 30).join("")}</div>`);
  }
  let pg = $("#invPage"); if (pg) pg.remove();
  pg = document.createElement("style"); pg.id = "invPage"; pg.textContent = `@page{size:${roll ? "2.25in 1.25in" : "letter"};margin:0}`; document.head.appendChild(pg);
  let box = $("#invPrint"); if (box) box.remove();
  box = document.createElement("div"); box.id = "invPrint"; box.innerHTML = pages.join(""); document.body.appendChild(box);
  document.body.classList.add("invprinting");
  const done = () => { document.body.classList.remove("invprinting"); const b = $("#invPrint"); if (b) b.remove(); const g = $("#invPage"); if (g) g.remove(); window.removeEventListener("afterprint", done); };
  window.addEventListener("afterprint", done);
  setTimeout(() => { try { window.print(); } catch (e){ console.error(e); toast("Printing isn't available here. Open nojans.com in Safari or Chrome to print."); done(); } }, 60);
}
INV.printLabels = printLabels;

/* ---------- scan logic ---------- */
async function lookup(code){
  try {   // v99: asked through the Nojan mailer script, because the lookup service refuses calls straight from a website
    const c = code.length === 13 && code[0] === "0" ? code.slice(1) : code, ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
    let idToken = ""; try { idToken = await window.SHOP_FB.idToken(); } catch (_) {}
    if (!idToken || typeof MAIL_URL === "undefined") return null;
    const r = await fetch(MAIL_URL, {method: "POST", headers: {"Content-Type": "text/plain;charset=utf-8"}, body: JSON.stringify({action: "lookup", upc: c, idToken}), signal: ctl.signal}); clearTimeout(t);
    const j = await r.json(), it = j && j.ok && j.item; if (!it || !it.title) return null;
    return {title: String(it.title).slice(0, 140), brand: String(it.brand || "").slice(0, 60), imgUrl: /^https:\/\//.test(it.image || "") ? it.image : ""};
  } catch (_) { return null; }
}
INV.lookup = lookup;
const salesOf = d => Array.isArray(d.sales) ? d.sales : [];
const saleLine = (d, code, more) => { const p = fsToItem(d); return {at: Date.now(), price: p.price == null ? 0 : +p.price, unit: d.unit || "", code: code || "", ...(more || {})}; };
const allSales = () => ALL_PRODUCTS.flatMap(d => salesOf(d).map(x => ({...x, id: d.id, title: d.title || "", itemId: effId(d)}))).sort((a, b) => b.at - a.at);
async function setStock(d, to, extra){ await FB.updateProduct(d.id, {stock: to, ...(extra || {})}); }
async function addOne(d, code){
  const from = stockN(d);
  try { await setStock(d, from + 1, d.soldAt ? {soldAt: null} : null); } catch (e){ console.error(e); return toast("Couldn't update stock"); }
  INV.res = {kind: "added", id: d.id, from, to: from + 1, code}; show("added");
}
async function sell(d, code){
  const from = stockN(d), to = Math.max(0, from - 1);
  const sale = saleLine(d, code);
  try { await setStock(d, to, {sales: [...salesOf(d), sale], ...(to === 0 ? {soldAt: sale.at} : {})}); } catch (e){ console.error(e); return toast("Couldn't update stock"); }
  INV.res = {kind: "sold", id: d.id, from, to, code, saleAt: sale.at, price: sale.price}; show("sold");
}
function outOne(d, code){
  const o = openOrderOf(d);
  if (o){ INV.res = {kind: "order", id: d.id, oid: o.id, code}; return show("order"); }
  if (stockN(d) <= 0){ INV.res = {kind: "already", id: d.id, code, mode: "out"}; return show("none"); }
  sell(d, code);
}
async function handle(code, mode){
  const byUnit = ALL_PRODUCTS.filter(d => d.unit === code), byGtin = ALL_PRODUCTS.filter(d => d.gtin === code);
  if (mode === "out"){
    const list = byUnit.length ? byUnit : byGtin;
    if (!list.length){ INV.res = {kind: isUnit(code) ? "nolabel" : "none", code, mode}; return show("none"); }
    const live = list.filter(d => stockN(d) > 0 || openOrderOf(d));
    if (live.length > 1){ INV.res = {kind: "pick", ids: live.map(d => d.id), code}; return show("pick"); }
    return outOne(live[0] || list[0], code);
  }
  if (byUnit.length) return addOne(byUnit[0], code);
  if (byGtin.length){ const nw = byGtin.find(d => d.condition !== "used"); return nw ? addOne(nw, code) : openForm({gtin: code, like: byGtin[0]}); }
  if (isUnit(code)){ INV.res = {kind: "nolabel", code, mode}; return show("none"); }
  INV.res = {kind: "looking", code}; show("looking");
  const info = await lookup(code);
  if (INV.view === "looking" && INV.res && INV.res.code === code) openForm({gtin: code, found: !!info, ...(info || {})});
}
INV.handle = handle;

/* ---------- camera ---------- */
let SC = null, DET = null, AC = null;
function loadScript(src, sri){ return new Promise((ok, no) => { const s = document.createElement("script"); s.src = src; if (sri){ s.integrity = sri; s.crossOrigin = "anonymous"; } s.onload = ok; s.onerror = () => no(new Error("load " + src)); document.head.appendChild(s); }); }
async function detector(){
  if (DET) return DET;
  const want = ["ean_13", "upc_a", "ean_8", "upc_e"];
  if ("BarcodeDetector" in window){
    try { const s = await window.BarcodeDetector.getSupportedFormats(); if (s.includes("ean_13")) return DET = new window.BarcodeDetector({formats: want.filter(f => s.includes(f))}); } catch (_) {}
  }
  /* iPhone and some Android browsers have no built-in barcode reader: load one (fixed version, checked by its fingerprint) */
  if (!window.BarcodeDetectionAPI) await loadScript("https://cdn.jsdelivr.net/npm/barcode-detector@3.2.3/dist/iife/ponyfill.js", "sha384-ZQvvHKgw7Ktqkui5vapXokyfDpQcnXLZhR9hfFMh8rUQztTRNywKQdQ994308nhY");
  return DET = new window.BarcodeDetectionAPI.BarcodeDetector({formats: want});
}
function beep(){ try { if (!AC) return; const o = AC.createOscillator(), g = AC.createGain(); o.frequency.value = 1040; g.gain.value = 0.12; o.connect(g); g.connect(AC.destination); o.start(); o.stop(AC.currentTime + 0.12); } catch (_) {} }
function scanMsg(t){ const m = $("#invScanMsg"); if (m) m.textContent = t; }
function scanClose(){
  if (!SC) return;
  clearTimeout(SC.timer);
  try { if (SC.stream) SC.stream.getTracks().forEach(t => t.stop()); } catch (_) {}
  SC.el.remove(); document.body.classList.remove("invscanning"); SC = null;
}
async function scanOpen(mode){
  scanClose();
  try { if (!AC){ const C = window.AudioContext || window.webkitAudioContext; if (C) AC = new C(); } if (AC && AC.state === "suspended") AC.resume(); } catch (_) {}
  const el = document.createElement("div"); el.id = "invScan"; el.className = "invscan";
  el.innerHTML = `<video playsinline muted autoplay></video>
    <div class="isbar"><button type="button" class="isround" data-inv="scanclose" aria-label="Close the scanner">${I.x}</button>
      <div class="isseg" role="group" aria-label="What this scan does"><button type="button" data-inv="scanmode" data-mode="in" aria-pressed="${mode === "in"}">Scan in</button><button type="button" data-inv="scanmode" data-mode="out" aria-pressed="${mode === "out"}">Scan out</button></div>
      <button type="button" class="isround" data-inv="torch" aria-label="Turn the light on" aria-pressed="false" hidden>${I.bolt}</button></div>
    <div class="ismid"><div class="isframe"><i></i></div><p class="ist">Point at the barcode</p><p class="iss" id="invScanMsg" role="status">It reads the barcode on the box and Nojan labels. A beep tells you when it has it.</p></div>
    <div class="isbot"><form id="invType" class="istype" hidden><input inputmode="numeric" autocomplete="off" placeholder="The number under the barcode" aria-label="Barcode number"><button class="btn" type="submit">Go</button></form>
      <button type="button" class="btn" data-inv="type">Type the number instead</button>
      ${mode === "in" ? `<button type="button" class="btn" data-inv="nobarcode">This item has no barcode</button>` : ""}</div>`;
  document.body.appendChild(el); document.body.classList.add("invscanning");
  const me = SC = {el, mode, stream: null, timer: null, busy: false};
  const alive = () => SC === me;
  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia){ scanMsg("This browser can't open the camera here. Type the number instead."); return; }
  let stream;
  try { stream = await navigator.mediaDevices.getUserMedia({video: {facingMode: {ideal: "environment"}, width: {ideal: 1280}, height: {ideal: 720}}, audio: false}); }
  catch (e){ if (alive()) scanMsg("The camera is blocked. Allow the camera for nojans.com in your browser settings, or type the number instead."); return; }
  if (!alive()){ stream.getTracks().forEach(t => t.stop()); return; }
  me.stream = stream;
  const v = el.querySelector("video"); v.srcObject = stream; try { await v.play(); } catch (_) {}
  try { const tr = stream.getVideoTracks()[0], caps = tr.getCapabilities ? tr.getCapabilities() : {}; if (caps.torch) el.querySelector('[data-inv="torch"]').hidden = false; } catch (_) {}
  let det;
  try { det = await detector(); } catch (e){ console.error(e); if (alive()) scanMsg("The scanner couldn't start. Type the number instead."); return; }
  const tick = async () => {
    if (!alive()) return;
    if (!me.busy && v.readyState >= 2){
      me.busy = true;
      try { const hit = (await det.detect(v)).map(x => normCode(x.rawValue)).find(Boolean); if (hit && alive()){ beep(); const m = me.mode; scanClose(); handle(hit, m); return; } } catch (_) {}
      me.busy = false;
    }
    me.timer = setTimeout(tick, 160);
  };
  tick();
}
INV.scanOpen = scanOpen; INV.scanClose = scanClose;

/* ---------- old items: new-style numbers ---------- */
async function migrate(btn){
  const list = ALL_PRODUCTS.filter(d => !d.unit || !normId(d.itemId));
  if (!list.length || !confirm(`Give ${list.length} item${list.length === 1 ? "" : "s"} a new-style Item ID and a unit number? Page addresses on the website don't change.`)) return;
  btn.disabled = true;
  const map = new Map(), ids = knownIds(), units = new Set(); let n = 0, bad = 0;
  for (const d of list){
    const upd = {};
    if (!normId(d.itemId)){ const old = effId(d); if (!map.has(old)){ let id; do { id = newItemId(); } while (ids.has(id)); ids.add(id); map.set(old, id); } upd.itemId = map.get(old); }
    if (!d.unit){ upd.unit = newUnit(units); units.add(upd.unit); }
    try { await FB.updateProduct(d.id, upd); n++; btn.textContent = `${n} of ${list.length}…`; } catch (e){ console.error(e); bad++; }
  }
  toast(bad ? `${n} updated, ${bad} could not be saved` : `${n} items have new numbers`); refreshAdmin(true);
}

/* ---------- screen ---------- */
INV.html = function(){
  if (INV.view === "form") formSync();   // keep what was typed if the screen redraws
  switch (INV.view){
    case "form": return formHTML();
    case "added": return addedHTML();
    case "sold": return soldHTML();
    case "order": return orderHTML();
    case "none": return noneHTML();
    case "pick": return pickHTML();
    case "label": return labelViewHTML();
    case "sheet": return sheetHTML();
    case "sales": return salesHTML();
    case "looking": return `${head("Scan in")}<div class="invdone"><h3>Looking it up…</h3><p class="mono">${showCode(INV.res.code)}</p></div>`;
    default: return listHTML();
  }
};

/* ---------- events ---------- */
document.addEventListener("click", async e => {
  const b = e.target.closest("[data-inv]"); if (!b) return;
  const a = b.dataset.inv, id = b.dataset.id, d = id ? docOf(id) : null, r = INV.res;
  if (b.tagName === "BUTTON" && b.type === "submit") return;
  e.preventDefault();
  if (a === "home"){ INV.form = null; return show("list"); }
  if (a === "scan") return scanOpen(b.dataset.mode);
  if (a === "scanclose") return scanClose();
  if (a === "scanmode"){ if (SC){ SC.mode = b.dataset.mode; SC.el.querySelectorAll('[data-inv="scanmode"]').forEach(x => x.setAttribute("aria-pressed", String(x === b))); const nb = SC.el.querySelector('[data-inv="nobarcode"]'); if (nb) nb.hidden = SC.mode !== "in"; } return; }
  if (a === "torch"){ if (SC && SC.stream){ const on = b.getAttribute("aria-pressed") !== "true"; try { await SC.stream.getVideoTracks()[0].applyConstraints({advanced: [{torch: on}]}); b.setAttribute("aria-pressed", String(on)); b.setAttribute("aria-label", on ? "Turn the light off" : "Turn the light on"); } catch (_) {} } return; }
  if (a === "type"){ const f = $("#invType"); if (f){ f.hidden = false; b.hidden = true; f.querySelector("input").focus(); } return; }
  if (a === "nobarcode"){ scanClose(); return openForm({condition: "used"}); }
  if (a === "filter"){ INV.filter = b.dataset.v; return refreshAdmin(true); }
  if (a === "edit"){ ADM.tab = "products"; render(); openProductForm(id); return; }
  if (a === "label" && d){
    if (!d.unit){ b.disabled = true; try { await FB.updateProduct(d.id, {unit: newUnit()}); } catch (er){ console.error(er); b.disabled = false; return toast("Couldn't make a label"); } }
    INV.res = {kind: "saved", id: d.id}; let n = 0; const wait = () => { const x = docOf(d.id); if ((x && x.unit) || n++ > 40) show("label"); else setTimeout(wait, 100); }; return wait();
  }
  if (a === "print1" && d) return printLabels([d.id], 1);
  if (a === "queue" && d){ if (!INV.queue.includes(d.id)){ INV.queue.push(d.id); saveQ(); toast("Added to the label sheet"); } return refreshAdmin(true); }
  if (a === "unqueue"){ INV.queue = INV.queue.filter(x => x !== id); saveQ(); return refreshAdmin(true); }
  if (a === "clearq"){ INV.queue = []; saveQ(); return refreshAdmin(true); }
  if (a === "sheet") return show("sheet");
  if (a === "salesview") return show("sales");
  if (a === "another" && d) return openForm({like: d, grade: d.grade || "Good"});
  if (a === "printroll" && d) return printLabels([d.id], 1, true);
  if (a === "printqroll") return printLabels(INV.queue, 1, true);
  if (a === "printq"){ const s = $("#invStart"); INV.start = Math.min(30, Math.max(1, parseInt(s && s.value, 10) || 1)); return printLabels(INV.queue, INV.start); }
  if (a === "migrate") return migrate(b);
  if (a === "cond" || a === "grade"){
    formSync(); const F = INV.form; if (!F) return;
    if (a === "grade") F.grade = b.dataset.v;
    else { F.condition = b.dataset.v; const auto = rulePrice(F.price, F.condition === "used" ? "new" : "used"); if (F.salePrice === "" || F.salePrice === auto) F.salePrice = rulePrice(F.price, F.condition); if (F.condition === "new") F.like = null; }
    const y = window.scrollY; refreshAdmin(true); window.scrollTo(0, y); return;
  }
  if (a === "qty"){ const i = $("#invForm").stock; i.value = Math.max(1, (parseInt(i.value, 10) || 1) + (+b.dataset.d)); return; }
  if (a === "phrm"){ INV.photos.splice(+b.dataset.i, 1); $("#invPhotoGrid").innerHTML = photosHTML(); const c = document.querySelector(".invphotosec small"); if (c) c.textContent = INV.photos.length + " of 5"; return; }
  if (a === "dbrm"){ INV.form.imgUrl = ""; $("#invPhotoGrid").innerHTML = photosHTML(); return; }
  if (a === "pickone" && d) return outOne(d, r && r.code);
  if (!r) return;
  const cur = docOf(r.id);
  if (a === "fix" && cur){ const v = Math.max(0, stockN(cur) + (+b.dataset.d)); try { await setStock(cur, v); const i = $("#invFix"); if (i) i.value = v; r.to = v; toast(v + " in stock"); } catch (er){ toast("Couldn't update stock"); } return; }
  if (a === "undo" && cur){ try { await setStock(cur, r.from, r.kind === "sold" ? {soldAt: null, sales: salesOf(cur).filter(x => x.at !== r.saleAt)} : null); toast("Undone"); show("list"); } catch (er){ toast("Couldn't undo"); } return; }
  if (a === "isused" && cur){ try { await setStock(cur, r.from); } catch (er){ return toast("Couldn't update stock"); } return openForm({gtin: cur.gtin || r.code || "", like: cur}); }
  if (a === "sellother" && cur) return sell(cur, r.code);
  if (a === "saleprice" && cur){ const v = Math.max(0, parseFloat(($("#invSalePrice") || {}).value) || 0); try { await FB.updateProduct(cur.id, {sales: salesOf(cur).map(x => x.at === r.saleAt ? {...x, price: v} : x)}); r.price = v; toast("Saved: sold for " + money(v)); } catch (er){ toast("Couldn't save the price"); } return; }
  if ((a === "orderdone" || a === "ordercancel") && cur){
    const o = (ADM.orders || []).find(x => x.id === r.oid); if (!o) return show("list");
    const status = a === "orderdone" ? "Completed" : "Cancelled", from = stockN(cur);
    b.disabled = true;
    try {
      const res = await FB.setOrderStatus(o.id, status, {status, by: USER.email, emailed: false, via: "scan"});
      if (status === "Cancelled"){ toast(`Order #${o.number} cancelled`); return show("list"); }
      const q = (o.items || []).filter(it => String(it.id).replace(/^s-/, "") === cur.id).reduce((n, it) => n + (it.qty || 0), 0);
      const it = (o.items || []).find(x => String(x.id).replace(/^s-/, "") === cur.id) || {}, sale = saleLine(cur, r.code, {order: o.number, qty: q || 1});
      if (it.price != null && !isNaN(+it.price)) sale.price = +it.price * (q || 1);
      try { await FB.updateProduct(cur.id, {sales: [...salesOf(cur), sale]}); } catch (e2){ console.error(e2); }
      INV.res = {kind: "sold", id: cur.id, from, to: res && res.stock === "taken" ? Math.max(0, from - q) : from, code: r.code, order: o.number, saleAt: sale.at, price: sale.price}; show("sold");
    } catch (er){ console.error(er); b.disabled = false; toast("Couldn't update the order"); }
    return;
  }
});
document.addEventListener("submit", e => {
  const f = e.target;
  if (f.id === "invType"){ e.preventDefault(); const c = normCode(f.querySelector("input").value); if (!c) return scanMsg("That number doesn't look right. Type all the digits under the barcode."); const m = SC ? SC.mode : "in"; scanClose(); handle(c, m); return; }
  if (f.id === "invForm"){ e.preventDefault(); const btn = e.submitter || f.querySelector("button[type=submit]"); saveForm(f, btn.dataset.pub === "1", btn); }
});
document.addEventListener("change", async e => {
  const t = e.target;
  if (t.id === "invCam" || t.id === "invLib"){
    const files = [...t.files].slice(0, 5 - INV.photos.length);
    for (const f of files){ try { const full = await resizeImage(f, 1000, 0.82), thumb = await resizeImage(f, 400, 0.72); INV.photos.push({full, thumb}); } catch (er){ console.error(er); toast("Couldn't read one of the photos"); } }
    t.value = ""; const g = $("#invPhotoGrid"); if (g) g.innerHTML = photosHTML(); const c = document.querySelector(".invphotosec small"); if (c) c.textContent = INV.photos.length + " of 5";
    return;
  }
  if (t.id === "invFix" && INV.res){ const cur = docOf(INV.res.id); if (!cur) return; const v = Math.max(0, parseInt(t.value, 10) || 0); try { await setStock(cur, v); INV.res.to = v; toast(v + " in stock"); } catch (er){ toast("Couldn't update stock"); } return; }
  if (t.name === "price" && t.form && t.form.id === "invForm"){ const s = t.form.salePrice; if (s && (s.value === "" || s.dataset.auto === s.value)){ s.value = rulePrice(t.value, INV.form.condition); s.dataset.auto = s.value; } }
});
document.addEventListener("input", e => { if (e.target.id === "invQ"){ INV.q = e.target.value; const pos = e.target.selectionStart; refreshAdmin(true); const q = $("#invQ"); if (q){ q.focus(); try { q.setSelectionRange(pos, pos); } catch (_) {} } } });
document.addEventListener("keydown", e => { if (e.key === "Escape" && SC) scanClose(); });
window.addEventListener("pagehide", scanClose);
})();
