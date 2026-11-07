// Սրճարանի սեղաններ, զբաղվածություն, ժամի փոփոխություն և ամրագրումների կառավարում ադմին վահանակից

const { validateReservation, localDate, toMinutes, MESSAGES, BOOKING } = require("./public/validation.js");

const STATUSES = ["pending", "confirmed", "rejected", "cancelled"];
const ACTIVE = ["pending", "confirmed"];

const DEFAULT_TABLES = [
  ["Սեղան 1 · պատուհանի մոտ", 2],
  ["Սեղան 2 · պատուհանի մոտ", 2],
  ["Սեղան 3", 4],
  ["Սեղան 4", 4],
  ["Սեղան 5 · բազմոց", 6],
  ["Սեղան 6 · մեծ", 8]
];

function clean(value) {
  return typeof value === "string" ? value.trim() : "";
}

function toId(value) {
  const n = Number(value);
  return Number.isInteger(n) && n > 0 ? n : null;
}

function hasErrors(errors) {
  return Object.keys(errors).length > 0;
}

function validateTable(input) {
  const data = {
    name: clean(input.name),
    seats: Number(input.seats),
    is_active: input.is_active === false || input.is_active === 0 || input.is_active === "0" ? 0 : 1
  };
  const errors = {};
  if (!data.name) errors.name = "Գրեք սեղանի անունը";
  else if (data.name.length > 60) errors.name = "Անունը՝ առավելագույնը 60 նիշ";
  if (!Number.isInteger(data.seats) || data.seats < 1 || data.seats > BOOKING.maxGuests) {
    errors.seats = "Տեղերի քանակը՝ 1-ից " + BOOKING.maxGuests;
  }
  return { data, errors };
}

module.exports = function setupTables(db) {
  // Հին բազայում reservations-ը դեռ չունի table_id սյունակ
  const columns = db.prepare("PRAGMA table_info(reservations)").all().map((c) => c.name);
  if (!columns.includes("table_id")) {
    db.exec("ALTER TABLE reservations ADD COLUMN table_id INTEGER REFERENCES cafe_tables(id) ON DELETE SET NULL");
  }
  db.exec("CREATE INDEX IF NOT EXISTS reservations_table_date ON reservations (table_id, date)");

  if (Number(db.prepare("SELECT COUNT(*) AS n FROM cafe_tables").get().n) === 0) {
    const insert = db.prepare("INSERT INTO cafe_tables (name, seats) VALUES (?, ?)");
    for (const [name, seats] of DEFAULT_TABLES) insert.run(name, seats);
    console.log("Ավելացվեցին օրինակային սեղաններ");
  }

  const q = {
    activeTables: db.prepare("SELECT * FROM cafe_tables WHERE is_active = 1 ORDER BY id"),
    allTables: db.prepare("SELECT * FROM cafe_tables ORDER BY id"),
    table: db.prepare("SELECT * FROM cafe_tables WHERE id = ?"),
    insertTable: db.prepare("INSERT INTO cafe_tables (name, seats, is_active) VALUES (?, ?, ?)"),
    updateTable: db.prepare("UPDATE cafe_tables SET name = ?, seats = ?, is_active = ? WHERE id = ?"),
    deleteTable: db.prepare("DELETE FROM cafe_tables WHERE id = ?"),
    futureOfTable: db.prepare(
      "SELECT COUNT(*) AS n FROM reservations WHERE table_id = ? AND date >= ? AND status IN ('pending', 'confirmed')"
    ),

    // Ակտիվ ամրագրումները տվյալ օրը՝ բացի exclude-ից (երբ ամրագրումը փոխում է իր իսկ ժամը)
    busyOnDate: db.prepare(
      "SELECT table_id, time FROM reservations WHERE date = ? AND id != ? AND table_id IS NOT NULL AND status IN ('pending', 'confirmed')"
    ),

    reservation: db.prepare("SELECT * FROM reservations WHERE id = ?"),
    setReservationStatus: db.prepare("UPDATE reservations SET status = ? WHERE id = ?"),
    moveReservation: db.prepare("UPDATE reservations SET date = ?, time = ?, table_id = ?, status = ? WHERE id = ?"),
    allReservations: db.prepare(`
      SELECT r.*, t.name AS table_name, u.first_name, u.last_name, u.telephone, u.email
      FROM reservations r
      JOIN users u ON u.id = r.user_id
      LEFT JOIN cafe_tables t ON t.id = r.table_id
      ORDER BY r.created_at DESC LIMIT 200`),

    menu: db.prepare("SELECT * FROM evening_menus WHERE id = ?"),
    moveMenu: db.prepare("UPDATE evening_menus SET date = ?, time = ? WHERE id = ?")
  };

  function publicTable(t) {
    return { id: Number(t.id), name: t.name, seats: Number(t.seats), is_active: Number(t.is_active) === 1 };
  }

  // { [tableId]: ["10:00", "12:30", ...] }
  function busyMap(date, excludeId) {
    const out = {};
    for (const row of q.busyOnDate.all(date, excludeId || 0)) {
      const key = String(row.table_id);
      (out[key] = out[key] || []).push(row.time);
    }
    return out;
  }

  // Նույն սեղանի ամրագրումները պետք է լինեն առնվազն 1 ժամ իրարից հեռու
  function isBusy(tableId, date, time, excludeId) {
    const taken = busyMap(date, excludeId)[String(tableId)] || [];
    return taken.some((t) => Math.abs(toMinutes(t) - toMinutes(time)) < BOOKING.tableGapMinutes);
  }

  // Ստուգում է սեղանը նոր ամրագրման կամ ժամի փոփոխության համար։ Վերադարձնում է սխալը կամ null
  function tableError(tableId, guests, date, time, excludeId) {
    const table = tableId ? q.table.get(tableId) : null;
    if (!table || Number(table.is_active) !== 1) return MESSAGES.tableEmpty;
    if (guests > Number(table.seats)) return MESSAGES.tableSeats;
    if (isBusy(tableId, date, time, excludeId)) return MESSAGES.tableBusy;
    return null;
  }

  // Նոր օրն ու ժամը ստուգում ենք նույն կանոններով, ինչ նոր ամրագրման դեպքում
  function validateMove(row, body) {
    return validateReservation(
      { date: body.date, time: body.time, guests: row.guests, note: row.note },
      new Date()
    );
  }

  function adminReservation(r) {
    return {
      id: Number(r.id),
      kind: "table",
      date: r.date,
      time: r.time,
      guests: Number(r.guests),
      note: r.note,
      status: r.status,
      created_at: r.created_at,
      table_id: r.table_id === null ? null : Number(r.table_id),
      table_name: r.table_name || null,
      customer: { name: r.first_name + " " + r.last_name, telephone: r.telephone, email: r.email }
    };
  }

  function routes(app, { requireUser, requireAdmin }) {
    // ---------- Հանրային՝ սեղաններ և զբաղված ժամեր ----------

    app.get("/api/availability", (req, res) => {
      const date = clean(req.query.date);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ errors: { date: MESSAGES.dateEmpty } });
      res.json({
        tables: q.activeTables.all().map(publicTable),
        busy: busyMap(date, toId(req.query.exclude)),
        gap: BOOKING.tableGapMinutes
      });
    });

    // ---------- Հաճախորդ՝ իր ամրագրման ժամի փոփոխություն ----------

    app.post("/api/reservations/:id/move", requireUser, (req, res) => {
      const id = toId(req.params.id);
      const row = id ? q.reservation.get(id) : null;
      if (!row || Number(row.user_id) !== req.session.userId) {
        return res.status(404).json({ errors: { form: MESSAGES.notFound } });
      }
      if (!ACTIVE.includes(row.status) || row.date < localDate(new Date())) {
        return res.status(409).json({ errors: { form: MESSAGES.cannotReschedule } });
      }
      const body = req.body || {};
      const { data, errors } = validateMove(row, body);
      const tableId = toId(body.table_id);
      if (!errors.date && !errors.time) {
        const err = tableError(tableId, Number(row.guests), data.date, data.time, id);
        if (err) errors.table_id = err;
      }
      if (hasErrors(errors)) return res.status(400).json({ errors });
      // Հաճախորդի փոփոխությունից հետո ամրագրումը նորից սպասում է ադմինի հաստատմանը
      q.moveReservation.run(data.date, data.time, tableId, "pending", id);
      res.json({ ok: true });
    });

    // ---------- Ադմին՝ սեղաններ ----------

    app.get("/api/admin/tables", requireAdmin, (req, res) => {
      res.json({ tables: q.allTables.all().map(publicTable) });
    });

    app.post("/api/admin/tables", requireAdmin, (req, res) => {
      const { data, errors } = validateTable(req.body || {});
      if (hasErrors(errors)) return res.status(400).json({ errors });
      const result = q.insertTable.run(data.name, data.seats, data.is_active);
      res.status(201).json({ table: publicTable(q.table.get(Number(result.lastInsertRowid))) });
    });

    app.put("/api/admin/tables/:id", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      if (!id || !q.table.get(id)) return res.status(404).json({ errors: { form: "Սեղանը չի գտնվել" } });
      const { data, errors } = validateTable(req.body || {});
      if (hasErrors(errors)) return res.status(400).json({ errors });
      q.updateTable.run(data.name, data.seats, data.is_active, id);
      res.json({ table: publicTable(q.table.get(id)) });
    });

    app.delete("/api/admin/tables/:id", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      if (!id || !q.table.get(id)) return res.status(404).json({ errors: { form: "Սեղանը չի գտնվել" } });
      if (Number(q.futureOfTable.get(id, localDate(new Date())).n) > 0) {
        return res.status(409).json({
          errors: { form: "Այս սեղանն ունի առաջիկա ամրագրումներ։ Նախ փոխեք կամ չեղարկեք դրանք, կամ պարզապես թաքցրեք սեղանը։" }
        });
      }
      q.deleteTable.run(id);
      res.json({ ok: true });
    });

    // ---------- Ադմին՝ սեղանի ամրագրումներ (առանց մենյուի) ----------

    app.get("/api/admin/reservations", requireAdmin, (req, res) => {
      res.json({ reservations: q.allReservations.all().map(adminReservation) });
    });

    app.post("/api/admin/reservations/:id/status", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      const status = clean((req.body || {}).status);
      if (!id || !q.reservation.get(id)) return res.status(404).json({ errors: { form: MESSAGES.notFound } });
      if (!STATUSES.includes(status)) return res.status(400).json({ errors: { form: "Սխալ կարգավիճակ" } });
      q.setReservationStatus.run(status, id);
      res.json({ ok: true });
    });

    // Ադմինը կարող է փոխել օրը, ժամը և սեղանը. կարգավիճակը մնում է նույնը
    app.post("/api/admin/reservations/:id/move", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      const row = id ? q.reservation.get(id) : null;
      if (!row) return res.status(404).json({ errors: { form: MESSAGES.notFound } });
      const body = req.body || {};
      const { data, errors } = validateMove(row, body);
      const tableId = toId(body.table_id);
      if (!errors.date && !errors.time) {
        const err = tableError(tableId, Number(row.guests), data.date, data.time, id);
        if (err) errors.table_id = err;
      }
      if (hasErrors(errors)) return res.status(400).json({ errors });
      q.moveReservation.run(data.date, data.time, tableId, row.status, id);
      res.json({ ok: true });
    });

    // Մենյուով պատվերի օրն ու ժամը (սեղան չունի)
    app.post("/api/admin/evening-menus/:id/move", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      const row = id ? q.menu.get(id) : null;
      if (!row) return res.status(404).json({ errors: { form: "Պատվերը չի գտնվել" } });
      const { data, errors } = validateMove(row, req.body || {});
      if (hasErrors(errors)) return res.status(400).json({ errors });
      q.moveMenu.run(data.date, data.time, id);
      res.json({ ok: true });
    });
  }

  return { tableError, routes };
};
