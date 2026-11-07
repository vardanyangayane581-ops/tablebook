// Ռեստորաններ, մենյու, երեկոյի ճաշացանկեր և ադմին վահանակի API

const path = require("node:path");
const bcrypt = require("bcryptjs");
const { validateReservation, localDate, MESSAGES } = require("./public/validation.js");
const { DEFAULT_SETTINGS } = require("./db/seed.js");

const CATEGORIES = ["starter", "salad", "main", "dessert", "drink"];
const IMAGES = ["cafe-bar.jpg", "cafe-interior.jpg", "cafe-table.jpg", "coffee-friends.jpg"];
const STATUSES = ["pending", "confirmed", "rejected", "cancelled"];

const ADMIN_TEXT = {
  denied: "Էլ. փոստը կամ գաղտնաբառը սխալ է",
  tooMany: "Չափազանց շատ անհաջող փորձեր։ Փորձեք 15 րոպեից։",
  notAdmin: "Ադմին վահանակ մուտք գործելու իրավունք չունեք",
  disabled: "Ադմին վահանակը միացված չէ։ .env ֆայլում նշեք ADMIN_EMAIL և ADMIN_PASSWORD։"
};

function clean(value, max) {
  const text = typeof value === "string" ? value.trim() : "";
  return max ? text.slice(0, max + 1) : text;
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

// ---------- Ստուգումներ ----------

function validateRestaurant(input) {
  const data = {
    name: clean(input.name),
    cuisine: clean(input.cuisine),
    description: clean(input.description),
    address: clean(input.address),
    phone: clean(input.phone),
    hours: clean(input.hours),
    image: clean(input.image),
    rating: Number(input.rating),
    is_active: input.is_active === false || input.is_active === 0 || input.is_active === "0" ? 0 : 1
  };
  const errors = {};
  if (!data.name) errors.name = "Գրեք ռեստորանի անունը";
  else if (data.name.length > 80) errors.name = "Անունը՝ առավելագույնը 80 նիշ";
  if (data.cuisine.length > 60) errors.cuisine = "Խոհանոցը՝ առավելագույնը 60 նիշ";
  if (data.description.length > 400) errors.description = "Նկարագրությունը՝ առավելագույնը 400 նիշ";
  if (data.address.length > 120) errors.address = "Հասցեն՝ առավելագույնը 120 նիշ";
  if (data.phone.length > 30) errors.phone = "Հեռախոսը՝ առավելագույնը 30 նիշ";
  if (data.hours.length > 40) errors.hours = "Աշխատանքային ժամերը՝ առավելագույնը 40 նիշ";
  if (!IMAGES.includes(data.image)) data.image = IMAGES[1];
  if (!Number.isFinite(data.rating) || data.rating < 0 || data.rating > 5) errors.rating = "Վարկանիշը՝ 0-ից 5";
  else data.rating = Math.round(data.rating * 10) / 10;
  return { data, errors };
}

function validateMenuItem(input) {
  const data = {
    category: clean(input.category),
    name: clean(input.name),
    description: clean(input.description),
    price: Number(input.price),
    emoji: clean(input.emoji) || "🍽️",
    is_available: input.is_available === false || input.is_available === 0 || input.is_available === "0" ? 0 : 1
  };
  const errors = {};
  if (!CATEGORIES.includes(data.category)) errors.category = "Ընտրեք բաժինը";
  if (!data.name) errors.name = "Գրեք ուտեստի անունը";
  else if (data.name.length > 80) errors.name = "Անունը՝ առավելագույնը 80 նիշ";
  if (data.description.length > 200) errors.description = "Նկարագրությունը՝ առավելագույնը 200 նիշ";
  if (!Number.isInteger(data.price) || data.price < 0 || data.price > 1000000) errors.price = "Գինը՝ ամբողջ թիվ 0-ից 1 000 000";
  if ([...data.emoji].length > 4) errors.emoji = "Էմոջին՝ առավելագույնը 4 նշան";
  return { data, errors };
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

// ---------- Մոդուլ ----------

module.exports = function setupRestaurants(app, db, { requireUser, startSession }) {
  // ----- Հարցումներ -----
  const q = {
    settings: db.prepare("SELECT key, value FROM site_settings"),
    setSetting: db.prepare(
      "INSERT INTO site_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value"
    ),

    activeRestaurants: db.prepare(`
      SELECT r.*, COUNT(m.id) AS item_count, MIN(m.price) AS min_price
      FROM restaurants r
      LEFT JOIN menu_items m ON m.restaurant_id = r.id AND m.is_available = 1
      WHERE r.is_active = 1
      GROUP BY r.id ORDER BY r.rating DESC, r.name`),
    allRestaurants: db.prepare(`
      SELECT r.*, COUNT(m.id) AS item_count, MIN(m.price) AS min_price
      FROM restaurants r LEFT JOIN menu_items m ON m.restaurant_id = r.id
      GROUP BY r.id ORDER BY r.id DESC`),
    restaurant: db.prepare("SELECT * FROM restaurants WHERE id = ?"),
    insertRestaurant: db.prepare(
      "INSERT INTO restaurants (name, cuisine, description, address, phone, hours, image, rating, is_active) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    ),
    updateRestaurant: db.prepare(
      "UPDATE restaurants SET name = ?, cuisine = ?, description = ?, address = ?, phone = ?, hours = ?, image = ?, rating = ?, is_active = ? WHERE id = ?"
    ),
    deleteRestaurant: db.prepare("DELETE FROM restaurants WHERE id = ?"),

    availableItems: db.prepare(
      "SELECT * FROM menu_items WHERE restaurant_id = ? AND is_available = 1 ORDER BY id"
    ),
    allItems: db.prepare("SELECT * FROM menu_items WHERE restaurant_id = ? ORDER BY id"),
    item: db.prepare("SELECT * FROM menu_items WHERE id = ?"),
    insertItem: db.prepare(
      "INSERT INTO menu_items (restaurant_id, category, name, description, price, emoji, is_available) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ),
    updateItem: db.prepare(
      "UPDATE menu_items SET category = ?, name = ?, description = ?, price = ?, emoji = ?, is_available = ? WHERE id = ?"
    ),
    deleteItem: db.prepare("DELETE FROM menu_items WHERE id = ?"),

    insertMenu: db.prepare(
      "INSERT INTO evening_menus (user_id, restaurant_id, date, time, guests, note, total) VALUES (?, ?, ?, ?, ?, ?, ?)"
    ),
    insertMenuItem: db.prepare(
      "INSERT INTO evening_menu_items (menu_id, item_id, category, name, price, qty) VALUES (?, ?, ?, ?, ?, ?)"
    ),
    menusOfUser: db.prepare(`
      SELECT e.*, r.name AS restaurant_name FROM evening_menus e
      JOIN restaurants r ON r.id = e.restaurant_id
      WHERE e.user_id = ? ORDER BY e.date DESC, e.time DESC`),
    allMenus: db.prepare(`
      SELECT e.*, r.name AS restaurant_name, u.first_name, u.last_name, u.telephone, u.email
      FROM evening_menus e
      JOIN restaurants r ON r.id = e.restaurant_id
      JOIN users u ON u.id = e.user_id
      ORDER BY e.created_at DESC LIMIT 200`),
    menuItems: db.prepare("SELECT * FROM evening_menu_items WHERE menu_id = ? ORDER BY rowid"),
    menu: db.prepare("SELECT * FROM evening_menus WHERE id = ?"),
    setMenuStatus: db.prepare("UPDATE evening_menus SET status = ? WHERE id = ?"),

    admin: db.prepare("SELECT id, name, email, password_hash FROM admins WHERE id = 1"),
    upsertAdmin: db.prepare(`
      INSERT INTO admins (id, name, email, password_hash) VALUES (1, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET name = excluded.name, email = excluded.email, password_hash = excluded.password_hash`),
    counts: db.prepare(`
      SELECT
        (SELECT COUNT(*) FROM restaurants) AS restaurants,
        (SELECT COUNT(*) FROM menu_items) AS items,
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM evening_menus WHERE status = 'pending') +
        (SELECT COUNT(*) FROM reservations WHERE status = 'pending') AS pending`)
  };

  // ----- Միակ աշխատողը՝ .env ֆայլից -----
  // Ադմինը միշտ մեկն է (id = 1)։ Եթե .env-ում տվյալները փոխվեն, բազայում էլ կփոխվեն
  const adminEmail = clean(process.env.ADMIN_EMAIL).toLowerCase();
  const adminPassword = process.env.ADMIN_PASSWORD || "";
  const adminName = clean(process.env.ADMIN_NAME) || "Ադմինիստրատոր";
  if (adminEmail && adminPassword.length >= 8) {
    const current = q.admin.get();
    const same = current && current.email === adminEmail && current.name === adminName &&
      bcrypt.compareSync(adminPassword, current.password_hash);
    if (!same) q.upsertAdmin.run(adminName, adminEmail, bcrypt.hashSync(adminPassword, 12));
  } else {
    console.warn("Ուշադրություն. ADMIN_EMAIL և ADMIN_PASSWORD (8+ նիշ) նշված չեն .env-ում, ադմին վահանակը անջատված է։");
  }
  const adminEnabled = Boolean(q.admin.get());
  const DUMMY_HASH = bcrypt.hashSync("tablebook-admin-dummy", 12);

  // ----- Օգնականներ -----
  function settingsObject() {
    const out = { ...DEFAULT_SETTINGS };
    for (const row of q.settings.all()) out[row.key] = row.value;
    return out;
  }

  function publicRestaurant(r) {
    return {
      id: Number(r.id),
      name: r.name,
      cuisine: r.cuisine,
      description: r.description,
      address: r.address,
      phone: r.phone,
      hours: r.hours,
      image: r.image,
      rating: Number(r.rating),
      is_active: Number(r.is_active) === 1,
      item_count: r.item_count === undefined ? undefined : Number(r.item_count),
      min_price: r.min_price === null || r.min_price === undefined ? null : Number(r.min_price)
    };
  }

  function publicItem(m) {
    return {
      id: Number(m.id),
      restaurant_id: Number(m.restaurant_id),
      category: m.category,
      name: m.name,
      description: m.description,
      price: Number(m.price),
      emoji: m.emoji,
      is_available: Number(m.is_available) === 1
    };
  }

  function publicMenu(e, withCustomer) {
    const out = {
      id: Number(e.id),
      restaurant_id: Number(e.restaurant_id),
      restaurant_name: e.restaurant_name,
      date: e.date,
      time: e.time,
      guests: Number(e.guests),
      note: e.note,
      total: Number(e.total),
      status: e.status,
      created_at: e.created_at,
      items: q.menuItems.all(e.id).map((i) => ({
        item_id: i.item_id === null ? null : Number(i.item_id),
        category: i.category,
        name: i.name,
        price: Number(i.price),
        qty: Number(i.qty)
      }))
    };
    if (withCustomer) {
      out.customer = {
        name: e.first_name + " " + e.last_name,
        telephone: e.telephone,
        email: e.email
      };
    }
    return out;
  }

  // ---------- Հանրային API ----------

  app.get("/api/site", (req, res) => {
    res.json({ settings: settingsObject() });
  });

  app.get("/api/restaurants", (req, res) => {
    res.json({ restaurants: q.activeRestaurants.all().map(publicRestaurant) });
  });

  app.get("/api/restaurants/:id", (req, res) => {
    const id = toId(req.params.id);
    const r = id ? q.restaurant.get(id) : null;
    if (!r || Number(r.is_active) !== 1) {
      return res.status(404).json({ errors: { form: "Ռեստորանը չի գտնվել" } });
    }
    res.json({ restaurant: publicRestaurant(r), items: q.availableItems.all(id).map(publicItem) });
  });

  // Երեկոյի ճաշացանկ՝ զամբյուղից։ Գները և անունները վերցնում ենք բազայից, ոչ թե էջից
  app.post("/api/evening-menus", requireUser, (req, res) => {
    const body = req.body || {};
    const { data, errors } = validateReservation(body, new Date());
    const restaurantId = toId(body.restaurant_id);
    const restaurant = restaurantId ? q.restaurant.get(restaurantId) : null;
    if (!restaurant || Number(restaurant.is_active) !== 1) errors.form = "Ռեստորանը չի գտնվել";

    const lines = [];
    const rawItems = Array.isArray(body.items) ? body.items.slice(0, 60) : [];
    for (const raw of rawItems) {
      const item = toId(raw && raw.id) ? q.item.get(toId(raw.id)) : null;
      const qty = Number(raw && raw.qty);
      if (!item || Number(item.restaurant_id) !== restaurantId || Number(item.is_available) !== 1) {
        errors.form = errors.form || "Զամբյուղի որոշ ուտեստներ այլևս հասանելի չեն։ Թարմացրեք զամբյուղը։";
        continue;
      }
      if (!Number.isInteger(qty) || qty < 1 || qty > 50) {
        errors.form = errors.form || "Ուտեստի քանակը պետք է լինի 1-ից 50";
        continue;
      }
      lines.push({ item, qty });
    }
    if (lines.length === 0 && !errors.form) errors.form = "Զամբյուղը դատարկ է";
    if (hasErrors(errors)) return res.status(400).json({ errors });

    const total = lines.reduce((sum, l) => sum + Number(l.item.price) * l.qty, 0);
    db.exec("BEGIN");
    let menuId;
    try {
      const result = q.insertMenu.run(req.session.userId, restaurantId, data.date, data.time, data.guests, data.note, total);
      menuId = Number(result.lastInsertRowid);
      for (const l of lines) {
        q.insertMenuItem.run(menuId, Number(l.item.id), l.item.category, l.item.name, Number(l.item.price), l.qty);
      }
      db.exec("COMMIT");
    } catch (err) {
      db.exec("ROLLBACK");
      throw err;
    }
    const row = q.menusOfUser.all(req.session.userId).find((m) => Number(m.id) === menuId);
    res.status(201).json({ menu: publicMenu(row) });
  });

  app.get("/api/evening-menus", requireUser, (req, res) => {
    res.json({ menus: q.menusOfUser.all(req.session.userId).map((m) => publicMenu(m)) });
  });

  app.post("/api/evening-menus/:id/cancel", requireUser, (req, res) => {
    const id = toId(req.params.id);
    const row = id ? q.menu.get(id) : null;
    if (!row || Number(row.user_id) !== req.session.userId) {
      return res.status(404).json({ errors: { form: "Ճաշացանկը չի գտնվել" } });
    }
    const active = row.status === "pending" || row.status === "confirmed";
    if (!active || row.date < localDate(new Date())) {
      return res.status(409).json({ errors: { form: MESSAGES.cannotCancel } });
    }
    q.setMenuStatus.run("cancelled", id);
    res.json({ ok: true });
  });

  // ---------- Ադմին՝ մուտք ----------

  // Անհաջող փորձերի սահմանափակում ըստ IP-ի՝ 5 փորձ 15 րոպեում
  const failures = new Map();
  const WINDOW_MS = 15 * 60 * 1000;
  function tooManyFailures(ip) {
    const entry = failures.get(ip);
    if (!entry || Date.now() - entry.first > WINDOW_MS) return false;
    return entry.count >= 5;
  }
  function recordFailure(ip) {
    const entry = failures.get(ip);
    if (!entry || Date.now() - entry.first > WINDOW_MS) failures.set(ip, { first: Date.now(), count: 1 });
    else entry.count++;
  }

  function requireAdmin(req, res, next) {
    if (req.session.adminId === 1 && q.admin.get()) return next();
    res.status(403).json({ errors: { form: ADMIN_TEXT.notAdmin }, denied: true });
  }

  app.post("/api/admin/login", async (req, res, next) => {
    try {
      const ip = req.ip || "unknown";
      if (tooManyFailures(ip)) {
        return res.status(429).json({ errors: { form: ADMIN_TEXT.tooMany }, denied: true });
      }
      if (!adminEnabled) return res.status(503).json({ errors: { form: ADMIN_TEXT.disabled }, denied: true });

      const email = clean((req.body || {}).email).toLowerCase();
      const password = typeof (req.body || {}).password === "string" ? req.body.password : "";
      const admin = q.admin.get();
      const emailOk = admin && admin.email.toLowerCase() === email;
      const passOk = await bcrypt.compare(password.slice(0, 200), emailOk ? admin.password_hash : DUMMY_HASH);

      if (!emailOk || !passOk) {
        recordFailure(ip);
        return res.status(401).json({ errors: { form: ADMIN_TEXT.denied }, denied: true });
      }

      failures.delete(ip);
      // Պահում ենք հաճախորդի մուտքը, եթե կար, և նոր սեսիա ենք բացում
      const userId = req.session.userId;
      await startSession(req, userId);
      req.session.adminId = 1;
      req.session.save((err) => {
        if (err) return next(err);
        res.json({ admin: { name: admin.name, email: admin.email } });
      });
    } catch (err) {
      next(err);
    }
  });

  app.get("/api/admin/me", (req, res) => {
    const admin = req.session.adminId === 1 ? q.admin.get() : null;
    res.json({ admin: admin ? { name: admin.name, email: admin.email } : null });
  });

  app.post("/api/admin/logout", (req, res, next) => {
    delete req.session.adminId;
    req.session.save((err) => (err ? next(err) : res.json({ ok: true })));
  });

  // /admin էջը բացվում է միայն ադմինի համար, մնացածին ուղարկում ենք մուտքի էջ
  function adminPage(req, res) {
    if (req.session.adminId === 1 && q.admin.get()) {
      return res.sendFile(path.join(__dirname, "private", "admin.html"));
    }
    res.redirect("/admin-login");
  }
  app.get("/admin", adminPage);

  // ---------- Ադմին՝ տվյալներ ----------

  app.get("/api/admin/overview", requireAdmin, (req, res) => {
    const c = q.counts.get();
    res.json({
      counts: {
        restaurants: Number(c.restaurants),
        items: Number(c.items),
        users: Number(c.users),
        pending: Number(c.pending)
      }
    });
  });

  app.get("/api/admin/settings", requireAdmin, (req, res) => {
    res.json({ settings: settingsObject() });
  });

  app.put("/api/admin/settings", requireAdmin, (req, res) => {
    const input = req.body || {};
    const errors = {};
    const values = {};
    for (const key of Object.keys(DEFAULT_SETTINGS)) {
      if (!(key in input)) continue;
      const value = clean(input[key]);
      if (value.length > 300) errors[key] = "Առավելագույնը 300 նիշ";
      else if (!value && key !== "announcement") errors[key] = "Դաշտը չի կարող դատարկ լինել";
      else values[key] = value;
    }
    if (hasErrors(errors)) return res.status(400).json({ errors });
    for (const [key, value] of Object.entries(values)) q.setSetting.run(key, value);
    res.json({ settings: settingsObject() });
  });

  app.get("/api/admin/restaurants", requireAdmin, (req, res) => {
    res.json({ restaurants: q.allRestaurants.all().map(publicRestaurant), images: IMAGES });
  });

  app.post("/api/admin/restaurants", requireAdmin, (req, res) => {
    const { data, errors } = validateRestaurant(req.body || {});
    if (hasErrors(errors)) return res.status(400).json({ errors });
    const result = q.insertRestaurant.run(data.name, data.cuisine, data.description, data.address, data.phone, data.hours, data.image, data.rating, data.is_active);
    res.status(201).json({ restaurant: publicRestaurant(q.restaurant.get(Number(result.lastInsertRowid))) });
  });

  app.put("/api/admin/restaurants/:id", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    if (!id || !q.restaurant.get(id)) return res.status(404).json({ errors: { form: "Ռեստորանը չի գտնվել" } });
    const { data, errors } = validateRestaurant(req.body || {});
    if (hasErrors(errors)) return res.status(400).json({ errors });
    q.updateRestaurant.run(data.name, data.cuisine, data.description, data.address, data.phone, data.hours, data.image, data.rating, data.is_active, id);
    res.json({ restaurant: publicRestaurant(q.restaurant.get(id)) });
  });

  app.delete("/api/admin/restaurants/:id", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    if (!id || !q.restaurant.get(id)) return res.status(404).json({ errors: { form: "Ռեստորանը չի գտնվել" } });
    q.deleteRestaurant.run(id);
    res.json({ ok: true });
  });

  app.get("/api/admin/restaurants/:id/items", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    const r = id ? q.restaurant.get(id) : null;
    if (!r) return res.status(404).json({ errors: { form: "Ռեստորանը չի գտնվել" } });
    res.json({ restaurant: publicRestaurant(r), items: q.allItems.all(id).map(publicItem) });
  });

  app.post("/api/admin/restaurants/:id/items", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    if (!id || !q.restaurant.get(id)) return res.status(404).json({ errors: { form: "Ռեստորանը չի գտնվել" } });
    const { data, errors } = validateMenuItem(req.body || {});
    if (hasErrors(errors)) return res.status(400).json({ errors });
    const result = q.insertItem.run(id, data.category, data.name, data.description, data.price, data.emoji, data.is_available);
    res.status(201).json({ item: publicItem(q.item.get(Number(result.lastInsertRowid))) });
  });

  app.put("/api/admin/items/:id", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    if (!id || !q.item.get(id)) return res.status(404).json({ errors: { form: "Ուտեստը չի գտնվել" } });
    const { data, errors } = validateMenuItem(req.body || {});
    if (hasErrors(errors)) return res.status(400).json({ errors });
    q.updateItem.run(data.category, data.name, data.description, data.price, data.emoji, data.is_available, id);
    res.json({ item: publicItem(q.item.get(id)) });
  });

  app.delete("/api/admin/items/:id", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    if (!id || !q.item.get(id)) return res.status(404).json({ errors: { form: "Ուտեստը չի գտնվել" } });
    q.deleteItem.run(id);
    res.json({ ok: true });
  });

  app.get("/api/admin/evening-menus", requireAdmin, (req, res) => {
    res.json({ menus: q.allMenus.all().map((m) => publicMenu(m, true)) });
  });

  app.post("/api/admin/evening-menus/:id/status", requireAdmin, (req, res) => {
    const id = toId(req.params.id);
    const status = clean((req.body || {}).status);
    if (!id || !q.menu.get(id)) return res.status(404).json({ errors: { form: "Պատվերը չի գտնվել" } });
    if (!STATUSES.includes(status)) return res.status(400).json({ errors: { form: "Սխալ կարգավիճակ" } });
    q.setMenuStatus.run(status, id);
    res.json({ ok: true });
  });

  return { requireAdmin };
};
