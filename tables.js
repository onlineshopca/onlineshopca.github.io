/* Nojan v133: the data layer shaped like the Azure SQL tables.
   One place that says which tables Nojan will have in Azure SQL and how each Firebase record becomes rows.
   Admin → "Download as Azure tables" uses it to turn the backup into an .sql file that SQL Server or Azure SQL can run.
   Loaded only when an admin asks for that file. Nothing here reads or writes the live database by itself. */
(function(){
  "use strict";
  // Column types: s = text (NVARCHAR(400)), t = long text (NVARCHAR(MAX)), i = whole number, m = money (DECIMAL(10,2)), b = yes/no (BIT), d = date and time (DATETIME2)
  const SCHEMA = {
    "acct.Users": {LegacyId: "s", Email: "s", Name: "s", Phone: "s", Street: "s", Unit: "s", City: "s", Postal: "s",
      EmailNews: "b", EmailOffers: "b", CreatedAt: "d", UpdatedAt: "d", DeletedAt: "d"},
    "shop.Products": {LegacyId: "s", ItemCode: "s", Title: "s", Brand: "s", Condition: "s", Grade: "s", ProductType: "s",
      Price: "m", SalePrice: "m", Stock: "i", Active: "b", Description: "t", SortOrder: "i", CreatedAt: "d", UpdatedAt: "d"},
    "shop.ListingImages": {ProductLegacyId: "s", SortOrder: "i", ImageRef: "t"},
    "shop.Orders": {LegacyId: "s", OrderNumber: "i", UserLegacyId: "s", Name: "s", Email: "s", Phone: "s", City: "s", ContactBy: "s",
      Notes: "t", PickupSlot: "s", PromoCode: "s", Discount: "m", Subtotal: "m", Tax: "m", Total: "m", UnpricedItems: "i", Status: "s",
      CreatedAt: "d", UpdatedAt: "d"},
    "shop.OrderItems": {OrderLegacyId: "s", ProductLegacyId: "s", Name: "s", Condition: "s", Qty: "i", Price: "m"},
    "shop.OrderStatusHistory": {OrderLegacyId: "s", Status: "s", ChangedBy: "s", ChangedAt: "d"},
    "svc.Providers": {LegacyId: "s", Name: "s", Headline: "s", ProviderType: "s", Location: "s", About: "t", Website: "s", Active: "b",
      CreatedAt: "d", UpdatedAt: "d"},
    "svc.Services": {LegacyId: "s", Title: "s", Category: "s", Level: "s", Summary: "t", Description: "t", ProviderName: "s", ProviderUid: "s",
      Price: "m", PriceUnit: "s", DurationMin: "i", ClassType: "s", Capacity: "i", Format: "s", Platform: "s", Location: "s",
      LeadHours: "i", HorizonDays: "i", Active: "b", CreatedAt: "d", UpdatedAt: "d"},
    "svc.ServiceAvailability": {ServiceLegacyId: "s", Availability: "t"},
    "svc.ServiceBlockedDates": {ServiceLegacyId: "s", BlockedDate: "s"},
    "svc.Events": {LegacyId: "s", Title: "s", Category: "s", StartsAt: "d", EndsAt: "d", Format: "s", Venue: "s", Address: "s", City: "s",
      Active: "b", CreatedAt: "d", UpdatedAt: "d"},
    "svc.Bookings": {LegacyId: "s", BookingNumber: "i", UserLegacyId: "s", ServiceLegacyId: "s", ServiceTitle: "s", ProviderName: "s",
      StartsAt: "d", DurationMin: "i", Format: "s", Platform: "s", Location: "s", Price: "m", PriceUnit: "s",
      Name: "s", Email: "s", Phone: "s", Address: "s", Notes: "t", Status: "s", CreatedAt: "d", UpdatedAt: "d"},
    "svc.BookingStatusHistory": {BookingLegacyId: "s", Status: "s", ChangedBy: "s", ChangedAt: "d"},
    "svc.BookingMessages": {BookingLegacyId: "s", Role: "s", Body: "t", SentAt: "d"},
    "svc.Reviews": {ServiceLegacyId: "s", Name: "s", Stars: "i", ReviewDate: "s", Body: "t", Verified: "b", BookingLegacyId: "s"},
    "site.Settings": {SettingKey: "s", ValueJson: "t"},
    // Anything not mapped above is kept whole here, so nothing is lost on the way to Azure
    "site.OtherRecords": {Collection: "s", LegacyId: "s", Json: "t"}
  };
  const SQLTYPE = {s: "NVARCHAR(400)", t: "NVARCHAR(MAX)", i: "INT", m: "DECIMAL(10,2)", b: "BIT", d: "DATETIME2"};

  const str = v => v == null ? null : String(v);
  const num = v => v === "" || v == null || isNaN(+v) ? null : +v;
  const yes = v => v == null ? null : !!v;
  const when = v => {                       // ISO text, a number of ms, or a {seconds} object → ISO text
    if (v == null || v === "") return null;
    if (typeof v === "number") return new Date(v).toISOString();
    if (typeof v === "object" && v.seconds != null) return new Date(v.seconds * 1000).toISOString();
    const t = Date.parse(v); return isNaN(t) ? null : new Date(t).toISOString();
  };
  const isSetting = id => String(id || "").startsWith("_");

  /* backup = the object Admin's "Download backup" makes: {collections: {name: [records]}} */
  function fromBackup(backup){
    const c = (backup && backup.collections) || {}, T = {};
    Object.keys(SCHEMA).forEach(k => T[k] = []);
    const add = (t, row) => T[t].push(row), other = (col, r) => add("site.OtherRecords", {Collection: col, LegacyId: str(r.id), Json: JSON.stringify(r)});
    const hist = (t, key, id, list) => (list || []).forEach(h => add(t, {[key]: id, Status: str(h.status), ChangedBy: str(h.by), ChangedAt: when(h.at)}));

    (c.users || []).forEach(u => add("acct.Users", {LegacyId: u.id, Email: str(u.email), Name: str(u.name), Phone: str(u.phone),
      Street: str(u.street || u.address), Unit: str(u.unit), City: str(u.city), Postal: str(u.postal),
      EmailNews: yes(u.emailPrefs && u.emailPrefs.news), EmailOffers: yes(u.emailPrefs && u.emailPrefs.offers),
      CreatedAt: when(u.createdAt), UpdatedAt: when(u.updatedAt), DeletedAt: when(u.deletedAt)}));

    (c.products || []).forEach(p => {
      if (isSetting(p.id)){ add("site.Settings", {SettingKey: "products/" + p.id, ValueJson: JSON.stringify(p)}); return; }
      add("shop.Products", {LegacyId: p.id, ItemCode: str(p.itemId), Title: str(p.title || p.name), Brand: str(p.brand), Condition: str(p.condition),
        Grade: str(p.grade), ProductType: str(p.type), Price: num(p.price), SalePrice: num(p.salePrice), Stock: num(p.stock), Active: yes(p.active),
        Description: str(p.description), SortOrder: num(p.order), CreatedAt: when(p.createdAt), UpdatedAt: when(p.updatedAt)});
      (p.images || []).forEach((ref, i) => add("shop.ListingImages", {ProductLegacyId: p.id, SortOrder: i, ImageRef: str(ref)}));
    });

    (c.orders || []).forEach(o => {
      add("shop.Orders", {LegacyId: o.id, OrderNumber: num(o.number), UserLegacyId: str(o.uid), Name: str(o.name), Email: str(o.email), Phone: str(o.phone),
        City: str(o.city), ContactBy: str(o.contactBy), Notes: str(o.notes), PickupSlot: str(o.pickupSlot), PromoCode: str(o.promo), Discount: num(o.discount),
        Subtotal: num(o.subtotal), Tax: num(o.tax), Total: num(o.total), UnpricedItems: num(o.unpriced), Status: str(o.status),
        CreatedAt: when(o.createdAt), UpdatedAt: when(o.updatedAt)});
      (o.items || []).forEach(it => add("shop.OrderItems", {OrderLegacyId: o.id, ProductLegacyId: str(it.id), Name: str(it.name), Condition: str(it.condition),
        Qty: num(it.qty), Price: num(it.price)}));
      hist("shop.OrderStatusHistory", "OrderLegacyId", o.id, o.history);
    });

    (c.services || []).forEach(s => {
      if (s.kind === "settings" || isSetting(s.id)){ add("site.Settings", {SettingKey: "services/" + s.id, ValueJson: JSON.stringify(s)}); return; }
      if (s.kind === "provider"){
        add("svc.Providers", {LegacyId: s.id, Name: str(s.name), Headline: str(s.headline), ProviderType: str(s.providerType), Location: str(s.location),
          About: str(s.about), Website: str(s.website), Active: yes(s.active), CreatedAt: when(s.createdAt), UpdatedAt: when(s.updatedAt)});
        other("services", s);   // the full profile (experience, education, …) gets its own tables later
        return;
      }
      if (s.kind === "event"){
        add("svc.Events", {LegacyId: s.id, Title: str(s.title), Category: str(s.category), StartsAt: when(s.startMs), EndsAt: when(s.endMs),
          Format: str(s.format), Venue: str(s.venue), Address: str(s.address), City: str(s.city), Active: yes(s.active),
          CreatedAt: when(s.createdAt), UpdatedAt: when(s.updatedAt)});
        other("services", s);   // ticket types and the rest stay whole for now
        return;
      }
      add("svc.Services", {LegacyId: s.id, Title: str(s.title), Category: str(s.category), Level: str(s.level), Summary: str(s.summary),
        Description: str(s.description), ProviderName: str(s.providerName), ProviderUid: str(s.providerUid), Price: num(s.price), PriceUnit: str(s.priceUnit),
        DurationMin: num(s.duration), ClassType: str(s.classType), Capacity: num(s.capacity), Format: str(s.format), Platform: str(s.platform),
        Location: str(s.location), LeadHours: num(s.leadHours), HorizonDays: num(s.horizonDays), Active: yes(s.active),
        CreatedAt: when(s.createdAt), UpdatedAt: when(s.updatedAt)});
      if (s.availability != null) add("svc.ServiceAvailability", {ServiceLegacyId: s.id, Availability: JSON.stringify(s.availability)});
      (s.blocked || []).forEach(day => add("svc.ServiceBlockedDates", {ServiceLegacyId: s.id, BlockedDate: str(day)}));
      (s.reviews || []).forEach(r => add("svc.Reviews", {ServiceLegacyId: s.id, Name: str(r.name), Stars: num(r.stars), ReviewDate: str(r.date),
        Body: str(r.text), Verified: yes(r.verified), BookingLegacyId: str(r.bk)}));
    });

    (c.bookings || []).forEach(b => {
      add("svc.Bookings", {LegacyId: b.id, BookingNumber: num(b.number), UserLegacyId: str(b.uid), ServiceLegacyId: str(b.serviceId),
        ServiceTitle: str(b.serviceTitle), ProviderName: str(b.providerName), StartsAt: when(b.startMs), DurationMin: num(b.durationMin),
        Format: str(b.format), Platform: str(b.platform), Location: str(b.location), Price: num(b.price), PriceUnit: str(b.priceUnit),
        Name: str(b.name), Email: str(b.email), Phone: str(b.phone), Address: str(b.address), Notes: str(b.notes), Status: str(b.status),
        CreatedAt: when(b.createdAt), UpdatedAt: when(b.updatedAt)});
      hist("svc.BookingStatusHistory", "BookingLegacyId", b.id, b.history);
      (b._messages || []).forEach(m => add("svc.BookingMessages", {BookingLegacyId: b.id, Role: str(m.role), Body: str(m.text), SentAt: when(m.at)}));
    });

    // Kept whole: admin notes, counters, time slots, the admin log and the parked parts (homes, market, …). Pictures (productImages) go to Blob Storage later, so they are counted, not copied.
    Object.keys(c).filter(n => !["users", "products", "orders", "services", "bookings", "productImages"].includes(n))
      .forEach(n => (c[n] || []).forEach(r => other(n, r)));
    T._pictures = (c.productImages || []).length;
    return T;
  }

  const q = (v, type) => {
    if (v == null) return "NULL";
    if (type === "b") return v ? "1" : "0";
    if (type === "i" || type === "m") return isFinite(+v) ? String(+v) : "NULL";
    if (type === "d") return "'" + String(v).replace("Z", "").replace(/'/g, "") + "'";
    return "N'" + String(v).replace(/'/g, "''") + "'";
  };

  /* Tables → one script: makes the schemas and tables (only if missing), then fills them */
  function toSQL(T, made){
    const out = ["-- Nojan data as Azure SQL tables", "-- Made " + (made || new Date().toISOString()) + " from Admin → Download as Azure tables", "-- Runs on Azure SQL Database or SQL Server 2019+. Safe to run on an empty practice database.", "SET NOCOUNT ON;", ""];
    ["acct", "shop", "svc", "site"].forEach(s => out.push(`IF SCHEMA_ID('${s}') IS NULL EXEC('CREATE SCHEMA ${s}');`));
    out.push("GO", "");
    Object.keys(SCHEMA).forEach(t => {
      const cols = SCHEMA[t], [sc, nm] = t.split(".");
      out.push(`IF OBJECT_ID('${t}') IS NULL CREATE TABLE ${sc}.[${nm}] (`, "  Id INT IDENTITY(1,1) PRIMARY KEY,",
        Object.keys(cols).map(k => `  [${k}] ${SQLTYPE[cols[k]]} NULL`).join(",\n"), ");");
    });
    out.push("GO", "");
    Object.keys(SCHEMA).forEach(t => {
      const cols = SCHEMA[t], names = Object.keys(cols), rows = T[t] || [];
      out.push(`-- ${t}: ${rows.length} row(s)`);
      for (let i = 0; i < rows.length; i += 500){
        out.push(`INSERT INTO ${t} (${names.map(n => "[" + n + "]").join(", ")}) VALUES`);
        out.push(rows.slice(i, i + 500).map(r => "(" + names.map(n => q(r[n], cols[n])).join(", ") + ")").join(",\n") + ";");
      }
      out.push("");
    });
    out.push("GO");
    return out.join("\n");
  }

  const counts = T => Object.keys(SCHEMA).map(t => [t, (T[t] || []).length]);

  window.NOJAN_TABLES = {SCHEMA, fromBackup, toSQL, counts};
})();
