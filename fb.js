// Nojan · v95 · built 2026-11-10
/* Firebase: sign-in (email or Google) and the order database. These keys are public by design;
   the database's security rules decide who can read or change what. */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, GoogleAuthProvider, OAuthProvider, signInWithPopup, signInWithRedirect, sendPasswordResetEmail, sendEmailVerification, updateProfile, signOut } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore, initializeFirestore, memoryLocalCache, doc, getDoc, setDoc, updateDoc, addDoc, deleteDoc, writeBatch, collection, query, where, orderBy, onSnapshot, getDocs, limit, runTransaction, serverTimestamp, arrayUnion } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const app = initializeApp({
  apiKey: "AIzaSyCjz0UoLyWjWeIhtP8mNJhCGpWmTBw4MLw",
  authDomain: "online-shop-on-ca.firebaseapp.com",
  projectId: "online-shop-on-ca",
  storageBucket: "online-shop-on-ca.firebasestorage.app",
  messagingSenderId: "90169716606",
  appId: "1:90169716606:web:10b740baa4958fd4510d2f"
});
const auth = getAuth(app);
/* v58: keep a copy of the shop data on the phone so it shows instantly, then refreshes */
let db; try { db = initializeFirestore(app, {localCache: memoryLocalCache(), experimentalForceLongPolling: true}); } catch (e) { db = getFirestore(app); }   // v82: memory cache + long polling, so antivirus, VPNs and proxies that hold back streaming connections can't stall reads and saves
const google = new GoogleAuthProvider(); google.setCustomParameters({prompt: "select_account"});
const microsoft = new OAuthProvider("microsoft.com"); microsoft.setCustomParameters({prompt: "select_account"}); microsoft.addScope("email"); microsoft.addScope("profile");
const withId = s => ({id: s.id, ...s.data()});

window.SHOP_FB = {
  onAuth: cb => onAuthStateChanged(auth, cb),
  signIn: (email, pw) => signInWithEmailAndPassword(auth, email, pw),
  async signUp(email, pw, name, phone){
    const cred = await createUserWithEmailAndPassword(auth, email, pw);
    await updateProfile(cred.user, {displayName: name});
    await setDoc(doc(db, "users", cred.user.uid), {name, email, phone: phone || "", city: "", provider: "password", createdAt: serverTimestamp()}, {merge: true});
    sendEmailVerification(cred.user).catch(() => {});
    return cred.user;
  },
  async google(){
    try { return await signInWithPopup(auth, google); }
    catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, google); throw e; }
  },
  async microsoft(){
    try { const cred = await signInWithPopup(auth, microsoft); if (cred.user.email && !cred.user.emailVerified && !(await getDoc(doc(db, "users", cred.user.uid))).exists()) sendEmailVerification(cred.user).catch(() => {}); return cred; }
    catch (e) { if (e.code === "auth/popup-blocked" || e.code === "auth/operation-not-supported-in-this-environment") return signInWithRedirect(auth, microsoft); throw e; }
  },
  reset: email => sendPasswordResetEmail(auth, email),
  resendVerify: () => sendEmailVerification(auth.currentUser),
  signOut: () => signOut(auth),
  idToken: () => auth.currentUser.getIdToken(),
  async refreshUser(){ await auth.currentUser.reload(); await auth.currentUser.getIdToken(true); return auth.currentUser; },
  async getProfile(uid){ const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; },
  saveProfile: (uid, data, isNew) => setDoc(doc(db, "users", uid), {...data, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: true}),
  async placeOrder(o){
    const counter = doc(db, "counters", "orders"), ref = doc(collection(db, "orders"));
    const number = await runTransaction(db, async tx => {
      const c = await tx.get(counter);
      const n = c.exists() ? c.data().n + 1 : 1001;
      tx.set(counter, {n});
      tx.set(ref, {...o, number: n, status: "New", sold: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        history: [{status: "New", at: new Date().toISOString(), by: "customer"}]});
      return n;
    });
    return {id: ref.id, number};
  },
  watchMyOrders: (uid, cb, err) => onSnapshot(query(collection(db, "orders"), where("uid", "==", uid)), s => cb(s.docs.map(withId)), err),
  watchAllOrders: (cb, err) => onSnapshot(query(collection(db, "orders"), orderBy("createdAt", "desc")), s => cb(s.docs.map(withId)), err),
  watchUsers: (cb, err) => onSnapshot(collection(db, "users"), s => cb(s.docs.map(withId)), err),
  updateOrder: (id, data, hist) => updateDoc(doc(db, "orders", id), {...data, updatedAt: serverTimestamp(), ...(hist ? {history: arrayUnion({...hist, at: new Date().toISOString()})} : {})}),
  async getNote(id){ const s = await getDoc(doc(db, "adminNotes", id)); return s.exists() ? s.data().text : ""; },
  /* Products and stock */
  watchProducts: (cb, err) => onSnapshot(collection(db, "products"), s => cb(s.docs.map(withId)), err),
  async getImage(id){ const s = await getDoc(doc(db, "productImages", id)); return s.exists() ? s.data().data : null; },
  async saveImage(data){ const r = await addDoc(collection(db, "productImages"), {data, createdAt: serverTimestamp()}); return r.id; },
  deleteImage: id => deleteDoc(doc(db, "productImages", id)),
  updateProduct: (id, data) => updateDoc(doc(db, "products", id), {...data, updatedAt: serverTimestamp()}),
  saveProduct: (id, data, isNew) => setDoc(doc(db, "products", id), {...data, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: !isNew}),
  async deleteProduct(id, imageIds){ await deleteDoc(doc(db, "products", id)); await Promise.all(imageIds.map(i => deleteDoc(doc(db, "productImages", i)).catch(() => {}))); },
  async importProducts(list){ const b = writeBatch(db); list.forEach(({id, ...d}) => b.set(doc(db, "products", id), {...d, createdAt: serverTimestamp(), updatedAt: serverTimestamp()})); await b.commit(); },
  /* Services and bookings */
  watchServices: (cb, err) => onSnapshot(collection(db, "services"), s => cb(s.docs.map(withId)), err),
  saveService: (id, data, isNew) => setDoc(doc(db, "services", id), {...data, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: !isNew}),
  updateService: (id, data) => updateDoc(doc(db, "services", id), {...data, updatedAt: serverTimestamp()}),
  async deleteService(id, imageIds){ await deleteDoc(doc(db, "services", id)); await Promise.all(imageIds.map(i => deleteDoc(doc(db, "productImages", i)).catch(() => {}))); },
  watchSlots: (serviceId, cb, err) => onSnapshot(query(collection(db, "slots"), where("serviceId", "==", serviceId)), s => { const m = {}; s.docs.forEach(d => m[d.id] = d.data().count || 0); cb(m); }, err),
  /* v95: taken times for every service from now on (no personal details), for "next free time" */
  watchOpenSlots: (fromMs, cb, err) => onSnapshot(query(collection(db, "slots"), where("startMs", ">=", fromMs)), s => { const m = {}; s.docs.forEach(d => m[d.id] = d.data().count || 0); cb(m); }, err),
  updateBooking: (id, data, hist) => updateDoc(doc(db, "bookings", id), {...data, updatedAt: serverTimestamp(), ...(hist ? {history: arrayUnion({...hist, at: new Date().toISOString()})} : {})}),
  /* v95: an admin moves a booking: the old time is freed and the new one is taken, if there is room */
  async moveBooking(id, to, capacity, by){
    return runTransaction(db, async tx => {
      const bref = doc(db, "bookings", id), b = (await tx.get(bref)).data();
      const counted = b.status !== "Cancelled", oref = counted && b.slotKey ? doc(db, "slots", b.slotKey) : null, nref = doc(db, "slots", to.slotKey);
      const os = oref ? await tx.get(oref) : null, ns = await tx.get(nref), used = ns.exists() ? (ns.data().count || 0) : 0;
      if (counted){
        if (used >= capacity) throw new Error("slot-full");
        if (os && os.exists() && (os.data().count || 0) > 0) tx.update(oref, {count: os.data().count - 1});
        if (ns.exists()) tx.update(nref, {count: used + 1}); else tx.set(nref, {serviceId: b.serviceId, startMs: to.startMs, count: 1});
      }
      tx.update(bref, {startMs: to.startMs, date: to.date, time: to.time, slotKey: to.slotKey, reminded: false, updatedAt: serverTimestamp(),
        history: arrayUnion({status: "Time changed", by, from: b.startMs, to: to.startMs, at: new Date().toISOString()})});
    });
  },
  async bookService(b, slotKey, capacity){
    const counter = doc(db, "counters", "bookings"), slotRef = doc(db, "slots", slotKey), ref = doc(collection(db, "bookings"));
    const number = await runTransaction(db, async tx => {
      const c = await tx.get(counter), sl = await tx.get(slotRef);
      const used = sl.exists() ? (sl.data().count || 0) : 0;
      if (used >= capacity) throw new Error("slot-full");
      const n = c.exists() ? c.data().n + 1 : 1001;
      tx.set(counter, {n});
      if (sl.exists()) tx.update(slotRef, {count: used + 1}); else tx.set(slotRef, {serviceId: b.serviceId, startMs: b.startMs, count: 1});
      tx.set(ref, {...b, slotKey, number: n, status: "Requested", createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        history: [{status: "Requested", at: new Date().toISOString(), by: "customer"}]});
      return n;
    });
    return {id: ref.id, number};
  },
  watchMyBookings: (uid, cb, err) => onSnapshot(query(collection(db, "bookings"), where("uid", "==", uid)), s => cb(s.docs.map(withId)), err),
  watchAllBookings: (cb, err) => onSnapshot(query(collection(db, "bookings"), orderBy("createdAt", "desc")), s => cb(s.docs.map(withId)), err),
  /* Cancelled frees the time slot; moving back from Cancelled takes it again if there's still room */
  async setBookingStatus(id, status, hist, extra){
    return runTransaction(db, async tx => {
      const bref = doc(db, "bookings", id), b = (await tx.get(bref)).data();
      const was = b.status !== "Cancelled", now = status !== "Cancelled";
      if (was !== now && b.slotKey){
        const sref = doc(db, "slots", b.slotKey), sl = await tx.get(sref), used = sl.exists() ? (sl.data().count || 0) : 0;
        if (now){
          const svc = await tx.get(doc(db, "services", b.serviceId)), cap = svc.exists() ? (svc.data().classType === "group" ? Math.max(2, +svc.data().capacity || 6) : 1) : 1;
          if (used >= cap) throw new Error("slot-full");
          if (sl.exists()) tx.update(sref, {count: used + 1}); else tx.set(sref, {serviceId: b.serviceId, startMs: b.startMs, count: 1});
        } else if (sl.exists() && used > 0) tx.update(sref, {count: used - 1});
      }
      tx.update(bref, {...extra, status, updatedAt: serverTimestamp(), history: arrayUnion({...hist, at: new Date().toISOString()})});
    });
  },
  async cancelMyBooking(id){
    return runTransaction(db, async tx => {
      const bref = doc(db, "bookings", id), b = (await tx.get(bref)).data();
      if (!["Requested", "Confirmed"].includes(b.status)) throw new Error("not-cancellable");
      const sref = b.slotKey ? doc(db, "slots", b.slotKey) : null, sl = sref ? await tx.get(sref) : null;
      if (sl && sl.exists() && (sl.data().count || 0) > 0) tx.update(sref, {count: sl.data().count - 1});
      tx.update(bref, {status: "Cancelled", updatedAt: serverTimestamp(), history: arrayUnion({status: "Cancelled", by: "customer", at: new Date().toISOString()})});
    });
  },
  /* v71 homes */
  hmApproved: async () => (await getDocs(query(collection(db, "homes"), where("status", "==", "approved"), limit(500)))).docs.map(withId),
  hmMine: async uid => (await getDocs(query(collection(db, "homes"), where("uid", "==", uid)))).docs.map(withId),
  hmAll: async () => (await getDocs(collection(db, "homes"))).docs.map(withId),
  async hmGet(id){ const s = await getDoc(doc(db, "homes", id)); return s.exists() ? withId(s) : null; },
  hmNewId: () => doc(collection(db, "homes")).id,
  hmSave: (id, data, isNew) => setDoc(doc(db, "homes", id), {...data, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: true}),
  hmSetStatus: (id, status, note, adm) => updateDoc(doc(db, "homes", id), {status, ...(adm ? {adminNote: note || "", ...(status === "approved" ? {approvedAt: serverTimestamp()} : {})} : {}), updatedAt: serverTimestamp()}),
  hmSavePhoto: (id, i, data, uid) => setDoc(doc(db, "homePhotos", id + "_" + i), {homeId: id, uid, i, data}),
  hmDelPhoto: (id, i) => deleteDoc(doc(db, "homePhotos", id + "_" + i)),
  async hmGetPhoto(id, i){ const s = await getDoc(doc(db, "homePhotos", id + "_" + i)); return s.exists() ? s.data().data : null; },
  async hmDelete(id){ for (let i = 0; i < 8; i++){ try { await deleteDoc(doc(db, "homePhotos", id + "_" + i)); } catch (_) {} } await deleteDoc(doc(db, "homes", id)); },
  hmSetSaved: (uid, ids) => setDoc(doc(db, "users", uid), {savedHomes: ids}, {merge: true}),
  async hmOpenThread(h, me, myName){
    const id = h.id + "_" + me, ref = doc(db, "threads", id), s = await getDoc(ref);
    if (!s.exists()) await setDoc(ref, {homeId: h.id, owner: h.uid, users: [me, h.uid], names: {[me]: myName, [h.uid]: h.ownerName || "Lister"}, homeTitle: h.title || "", thumb: h.thumb || "", status: "open", createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastText: "", lastFrom: "", seen: {}});
    return id;
  },
  hmWatchThreads: (uid, cb, err) => onSnapshot(query(collection(db, "threads"), where("users", "array-contains", uid)), s => cb(s.docs.map(withId)), err),
  hmWatchMsgs: (id, cb, err) => onSnapshot(query(collection(db, "threads", id, "messages"), orderBy("at", "asc"), limit(300)), s => cb(s.docs.map(d => ({id: d.id, ...d.data({serverTimestamps: "estimate"})}))), err),
  async hmSend(id, me, text){
    await addDoc(collection(db, "threads", id, "messages"), {from: me, text, at: serverTimestamp()});
    await updateDoc(doc(db, "threads", id), {lastText: text.slice(0, 120), lastFrom: me, lastAt: serverTimestamp(), ["seen." + me]: Date.now() + 5000});
  },
  hmSeen: (id, me) => updateDoc(doc(db, "threads", id), {["seen." + me]: Date.now() + 5000}),
  /* v77 member selling */
  mkWatchLive: (cb, err) => onSnapshot(query(collection(db, "market"), where("status", "==", "live"), limit(1000)), s => cb(s.docs.map(withId)), err),
  async mkGet(id){ const s = await getDoc(doc(db, "market", id)); return s.exists() ? withId(s) : null; },
  mkMine: async uid => (await getDocs(query(collection(db, "market"), where("uid", "==", uid)))).docs.map(withId),
  mkAll: async () => (await getDocs(collection(db, "market"))).docs.map(withId),
  mkNewId: () => doc(collection(db, "market")).id,
  mkSave: (id, data, isNew) => setDoc(doc(db, "market", id), {...data, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: true}),
  mkSetStatus: (id, status) => updateDoc(doc(db, "market", id), {status, updatedAt: serverTimestamp()}),
  mkAdmin: (id, data) => updateDoc(doc(db, "market", id), {...data, updatedAt: serverTimestamp()}),
  mkSavePhoto: (id, i, data, uid) => setDoc(doc(db, "marketPhotos", id + "_" + i), {mid: id, uid, i, data}),
  mkDelPhoto: (id, i) => deleteDoc(doc(db, "marketPhotos", id + "_" + i)),
  async mkGetPhoto(id, i){ const s = await getDoc(doc(db, "marketPhotos", id + "_" + i)); return s.exists() ? s.data().data : null; },
  async mkDelete(id){ for (let i = 0; i < 6; i++){ try { await deleteDoc(doc(db, "marketPhotos", id + "_" + i)); } catch (_) {} } await deleteDoc(doc(db, "market", id)); },
  async mkGetSeller(uid){ const s = await getDoc(doc(db, "sellers", uid)); return s.exists() ? withId(s) : null; },
  mkApply: (uid, data, isNew) => setDoc(doc(db, "sellers", uid), {...data, appliedAt: serverTimestamp()}, {merge: !isNew}),
  mkWatchSellers: (cb, err) => onSnapshot(collection(db, "sellers"), s => cb(s.docs.map(withId)), err),
  mkWatchAll: (cb, err) => onSnapshot(collection(db, "market"), s => cb(s.docs.map(withId)), err),
  mkSellers: async () => (await getDocs(collection(db, "sellers"))).docs.map(withId),
  mkSetSeller: (uid, status, note) => updateDoc(doc(db, "sellers", uid), {status, note: note || "", decidedAt: serverTimestamp()}),
  async mkOpenThread(d, me, myName){
    const id = "m" + d.id + "_" + me, ref = doc(db, "threads", id), s = await getDoc(ref);
    if (!s.exists()) await setDoc(ref, {marketId: d.id, mkind: d.kind, owner: d.uid, users: [me, d.uid], names: {[me]: myName, [d.uid]: d.ownerName || "Seller"}, homeTitle: d.title || "", thumb: d.thumb || "", status: "open", createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastText: "", lastFrom: "", seen: {}});
    return id;
  },
  /* v70 dating */
  async dtGetMe(uid){ const s = await getDoc(doc(db, "dating", uid)); return s.exists() ? withId(s) : null; },
  dtSaveMe: (uid, data, isNew) => setDoc(doc(db, "dating", uid), {...data, uid, ...(isNew ? {createdAt: serverTimestamp()} : {}), updatedAt: serverTimestamp()}, {merge: true}),
  dtSavePhoto: (uid, i, data) => setDoc(doc(db, "datingPhotos", uid + "_" + i), {uid, i, data}),
  dtDelPhoto: (uid, i) => deleteDoc(doc(db, "datingPhotos", uid + "_" + i)),
  async dtGetPhoto(uid, i){ const s = await getDoc(doc(db, "datingPhotos", uid + "_" + i)); return s.exists() ? s.data().data : null; },
  dtPeople: async () => (await getDocs(query(collection(db, "dating"), where("active", "==", true), limit(500)))).docs.map(withId),
  dtAllProfiles: async () => (await getDocs(collection(db, "dating"))).docs.map(withId),
  dtMyActs: async uid => (await getDocs(query(collection(db, "likes"), where("from", "==", uid)))).docs.map(withId),
  dtBlockedMe: async uid => (await getDocs(query(collection(db, "likes"), where("to", "==", uid), where("kind", "==", "block")))).docs.map(withId),
  async dtAct(me, other, kind){
    await setDoc(doc(db, "likes", me + "_" + other), {from: me, to: other, kind, at: serverTimestamp()});
    if (kind !== "like") return null;
    const back = await getDoc(doc(db, "likes", other + "_" + me));
    if (!back.exists() || back.data().kind !== "like") return null;
    const users = [me, other].sort(), id = users.join("_"), ref = doc(db, "matches", id);
    const m = await getDoc(ref);
    if (m.exists()){ if (m.data().status === "closed") return null; return id; }
    try { await setDoc(ref, {users, status: "open", createdAt: serverTimestamp(), lastAt: serverTimestamp(), lastText: "", lastFrom: "", seen: {}}); } catch (e) { if (!(await getDoc(ref)).exists()) throw e; }
    return id;
  },
  dtUndoPass: (me, other) => deleteDoc(doc(db, "likes", me + "_" + other)),
  dtWatchMatches: (uid, cb, err) => onSnapshot(query(collection(db, "matches"), where("users", "array-contains", uid)), s => cb(s.docs.map(withId)), err),
  dtWatchMsgs: (id, cb, err) => onSnapshot(query(collection(db, "matches", id, "messages"), orderBy("at", "asc"), limit(300)), s => cb(s.docs.map(d => ({id: d.id, ...d.data({serverTimestamps: "estimate"})}))), err),
  async dtSend(id, me, text){
    await addDoc(collection(db, "matches", id, "messages"), {from: me, text, at: serverTimestamp()});
    await updateDoc(doc(db, "matches", id), {lastText: text.slice(0, 120), lastFrom: me, lastAt: serverTimestamp(), ["seen." + me]: Date.now() + 5000});
  },
  dtSeen: (id, me) => updateDoc(doc(db, "matches", id), {["seen." + me]: Date.now() + 5000}),
  dtClose: (id, me) => updateDoc(doc(db, "matches", id), {status: "closed", closedBy: me}),
  dtReport: r => addDoc(collection(db, "reports"), {...r, at: serverTimestamp()}),
  dtReports: async () => (await getDocs(query(collection(db, "reports"), orderBy("at", "desc")))).docs.map(withId),
  dtDelReport: id => deleteDoc(doc(db, "reports", id)),
  async dtDeleteProfile(uid){ for (let i = 0; i < 4; i++){ try { await deleteDoc(doc(db, "datingPhotos", uid + "_" + i)); } catch (_) {} } await deleteDoc(doc(db, "dating", uid)); },
  /* v65 events: each ticket takes one place in the event's counter (the database rules allow +1 at a time, never past the event's capacity) */
  watchSlotsIn: (ids, cb, err) => onSnapshot(query(collection(db, "slots"), where("serviceId", "in", ids)), s => { const m = {}; s.docs.forEach(d => m[d.id] = d.data().count || 0); cb(m); }, err),
  async reserveTickets(b, qty, capacity){
    const slotRef = doc(db, "slots", b.slotKey); let taken = 0;
    const step = d => runTransaction(db, async tx => { const sl = await tx.get(slotRef), used = sl.exists() ? (sl.data().count || 0) : 0;
      if (d > 0){ if (used >= capacity) throw new Error("sold-out"); if (sl.exists()) tx.update(slotRef, {count: used + 1}); else tx.set(slotRef, {serviceId: b.eventId, startMs: b.startMs, count: 1}); }
      else if (sl.exists() && used > 0) tx.update(slotRef, {count: used - 1}); });
    try {
      for (let i = 0; i < qty; i++){ await step(1); taken++; }
      const counter = doc(db, "counters", "tickets"), ref = doc(collection(db, "bookings"));
      const number = await runTransaction(db, async tx => { const c = await tx.get(counter), n = c.exists() ? c.data().n + 1 : 1001; tx.set(counter, {n});
        tx.set(ref, {...b, number: n, status: "Requested", createdAt: serverTimestamp(), updatedAt: serverTimestamp(), history: [{status: "Requested", at: new Date().toISOString(), by: "customer"}]}); return n; });
      return {id: ref.id, number};
    } catch (e) { for (let i = 0; i < taken; i++){ try { await step(-1); } catch(_) {} } throw e; }
  },
  async cancelMyTicket(id){
    const bref = doc(db, "bookings", id), b = (await getDoc(bref)).data();
    if (!["Requested", "Confirmed"].includes(b.status)) throw new Error("not-cancellable");
    await updateDoc(bref, {status: "Cancelled", updatedAt: serverTimestamp(), history: arrayUnion({status: "Cancelled", by: "customer", at: new Date().toISOString()})});
    const sref = doc(db, "slots", b.slotKey);
    for (let i = 0; i < (b.qty || 1); i++){ try { await runTransaction(db, async tx => { const sl = await tx.get(sref); if (sl.exists() && (sl.data().count || 0) > 0) tx.update(sref, {count: sl.data().count - 1}); }); } catch(_) {} }
  },
  async setTicketStatus(id, status){
    return runTransaction(db, async tx => {
      const bref = doc(db, "bookings", id), b = (await tx.get(bref)).data(), q = b.qty || 1;
      const was = b.status !== "Cancelled", now = status !== "Cancelled";
      const sref = doc(db, "slots", b.slotKey), sl = was !== now ? await tx.get(sref) : null, ev = was !== now && now ? await tx.get(doc(db, "services", b.eventId)) : null;
      if (was !== now){
        const used = sl.exists() ? (sl.data().count || 0) : 0;
        if (now){ const cap = ev.exists() ? (+ev.data().capacity || 0) : 0; if (used + q > cap) throw new Error("sold-out");
          if (sl.exists()) tx.update(sref, {count: used + q}); else tx.set(sref, {serviceId: b.eventId, startMs: b.startMs, count: q}); }
        else if (sl.exists()) tx.update(sref, {count: Math.max(0, used - q)});
      }
      tx.update(bref, {status, updatedAt: serverTimestamp(), history: arrayUnion({status, by: "admin", at: new Date().toISOString()})});
    });
  },
  /* Change an order's status; items come out of stock at "Ready for pickup" (or "Completed") and go back if it moves away from those */
  async setOrderStatus(id, status, hist){
    return runTransaction(db, async tx => {
      const oref = doc(db, "orders", id), o = (await tx.get(oref)).data();
      const want = ["Ready for pickup", "Completed"].includes(status), had = !!o.stockApplied;
      const qty = {}; (o.items || []).forEach(it => { const pid = String(it.id).replace(/^s-/, ""); qty[pid] = (qty[pid] || 0) + (it.qty || 0); });
      const snaps = want === had ? [] : await Promise.all(Object.keys(qty).map(async pid => [pid, await tx.get(doc(db, "products", pid))]));
      const soldOut = [];
      for (const [pid, s] of snaps){
        if (!s.exists()) continue;
        const cur = parseInt(s.data().stock, 10) || 0, next = Math.max(0, cur + (want ? -qty[pid] : qty[pid]));
        if (want && next === 0 && cur > 0) soldOut.push(s.data().title || pid);
        tx.update(s.ref, {stock: next, updatedAt: serverTimestamp()});
      }
      tx.update(oref, {status, stockApplied: want, updatedAt: serverTimestamp(), history: arrayUnion({...hist, at: new Date().toISOString()})});
      return {stock: want === had ? null : want ? "taken" : "returned", soldOut};
    });
  },
  saveSite: data => setDoc(doc(db, "products", "_site"), {...data, updatedAt: serverTimestamp()}, {merge: true}),
  async getCatalog(){ const s = await getDoc(doc(db, "products", "_catalog")); return s.exists() ? s.data() : null; },   // v92
  saveCatalog: data => setDoc(doc(db, "products", "_catalog"), data),
  saveNote: (id, text) => setDoc(doc(db, "adminNotes", id), {text, updatedAt: serverTimestamp()})
};
window.dispatchEvent(new Event("firebase-ready"));

