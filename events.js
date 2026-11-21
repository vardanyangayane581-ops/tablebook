// Երեկոների օրացույց՝ միջոցառումներ (կենդանի երաժշտություն, ջազ, ֆուտբոլ) և դրանց ամրագրումներ

const { localDate, addDays, toMinutes, BOOKING, MESSAGES } = require("./public/validation.js");
const { KINDS } = require("./public/event-kinds.js");

const KIND_IDS = KINDS.map((k) => k.id);
// Միջոցառումը կարելի է ավելացնել առավելագույնը այսքան օր առաջ
const MAX_DAYS_AHEAD = 365;

const TEXT = {
  notFound: "Միջոցառումը չի գտնվել",
  closed: "Այս միջոցառման ամրագրումն արդեն փակ է",
  full: "Ցավոք, տեղեր այլևս չկան",
  fewSeats: (left) => "Մնացել է միայն " + left + " տեղ",
  already: "Դուք արդեն ամրագրել եք այս միջոցառումը։ Կարող եք չեղարկել և նորից ամրագրել այլ քանակով։",
  bookingNotFound: "Ամրագրումը չի գտնվել",
  cannotCancel: "Այս ամրագրումն այլևս հնարավոր չէ չեղարկել"
};

// Օրինակային միջոցառումներ. օրերը հաշվվում են առաջին գործարկման օրվանից
// [ռեստորան, տեսակ, անուն, նկարագրություն, քանի օր հետո, ժամ, գին, տեղեր]
const SAMPLE_EVENTS = [
  ["Ծիրան Տերաս", "live", "Հայկական ժողովրդական երգեր", "Դուդուկ, քանոն և սիրված երգեր բաց տերասում", 2, "20:00", 0, 40],
  ["Կասկադ Լաունջ", "jazz", "Ջազ Կասկադի ստորոտում", "Կենդանի ջազային տրիո և դասական ստանդարտներ", 3, "20:30", 3000, 30],
  ["Թբիլիսյան Բակ", "football", "Չեմպիոնների լիգա մեծ էկրանին", "Խաղը մեծ էկրանով, խորտիկներ և լավ տրամադրություն", 4, "22:00", 0, 50],
  ["Բելլա Նոտտե", "jazz", "Իտալական ջազ և գինի", "Սաքսոֆոն, դաշնամուր և իտալական գինիներ", 6, "20:00", 2500, 24],
  ["Շիրակի Օջախ", "live", "Գյումրվա երգ ու կատակ", "Քաղաքային երգեր և գյումրեցու հումոր", 7, "19:30", 1500, 35],
  ["Կանաչ Այգի", "other", "Ակուստիկ երեկո անտառի եզրին", "Կիթառ, ջութակ և տաք թեյ բուխարու մոտ", 9, "19:00", 0, 20],
  ["Հին Թաղ", "football", "Հայաստանի հավաքականի խաղը", "Միասին երկրպագենք մեր հավաքականին մեծ էկրանով", 11, "21:00", 0, 60],
  ["Լազուր Ձկնատուն", "live", "Մայրամուտը Սևանում", "Կենդանի երաժշտություն լճի ափին", 13, "19:30", 2000, 30]
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

function isRealDate(text) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return false;
  const d = new Date(text + "T00:00");
  return !Number.isNaN(d.getTime()) && localDate(d) === text;
}

// Միջոցառումն արդեն սկսվե՞լ է (կամ անցել)
function hasStarted(event, now) {
  const today = localDate(now);
  if (event.date !== today) return event.date < today;
  return toMinutes(event.time) <= now.getHours() * 60 + now.getMinutes();
}

// previous՝ խմբագրվող միջոցառումը. եթե օրը չի փոխվել, անցած օրը սխալ չի համարվում
function validateEvent(input, now, previous) {
  const data = {
    restaurant_id: toId(input.restaurant_id),
    kind: clean(input.kind),
    title: clean(input.title),
    description: clean(input.description),
    date: clean(input.date),
    time: clean(input.time),
    price: Number(input.price === "" || input.price === undefined ? 0 : input.price),
    capacity: Number(input.capacity),
    is_active: input.is_active === false || input.is_active === 0 || input.is_active === "0" ? 0 : 1
  };
  const errors = {};
  if (!data.restaurant_id) errors.restaurant_id = "Ընտրեք ռեստորանը";
  if (!KIND_IDS.includes(data.kind)) errors.kind = "Ընտրեք միջոցառման տեսակը";
  if (!data.title) errors.title = "Գրեք միջոցառման անունը";
  else if (data.title.length > 80) errors.title = "Անունը՝ առավելագույնը 80 նիշ";
  if (data.description.length > 300) errors.description = "Նկարագրությունը՝ առավելագույնը 300 նիշ";

  const sameDate = previous && previous.date === data.date;
  if (!isRealDate(data.date)) errors.date = "Ընտրեք օրը";
  else if (!sameDate && data.date < localDate(now)) errors.date = "Օրը չի կարող լինել անցյալում";
  else if (data.date > localDate(addDays(now, MAX_DAYS_AHEAD))) errors.date = "Առավելագույնը մեկ տարի առաջ";

  if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(data.time)) errors.time = "Գրեք ժամը ԺԺ:ՐՐ ձևով, օր.՝ 20:00";
  if (!Number.isInteger(data.price) || data.price < 0 || data.price > 1000000) {
    errors.price = "Գինը՝ 0-ից 1 000 000 ֏ (0՝ անվճար)";
  }
  if (!Number.isInteger(data.capacity) || data.capacity < 1 || data.capacity > 500) {
    errors.capacity = "Տեղերի քանակը՝ 1-ից 500";
  }
  return { data, errors };
}

module.exports = function setupEvents(db) {
  const q = {
    restaurant: db.prepare("SELECT id, is_active FROM restaurants WHERE id = ?"),
    restaurantByName: db.prepare("SELECT id FROM restaurants WHERE name = ? AND is_active = 1"),
    anyRestaurant: db.prepare("SELECT id FROM restaurants WHERE is_active = 1 ORDER BY id LIMIT 1"),
    seeded: db.prepare("SELECT value FROM site_settings WHERE key = 'events_seeded'"),
    markSeeded: db.prepare("INSERT OR REPLACE INTO site_settings (key, value) VALUES ('events_seeded', '1')"),

    // Միջոցառումը ռեստորանի տվյալներով և արդեն ամրագրված տեղերով
    upcoming: db.prepare(`
      SELECT e.*, r.name AS restaurant_name, r.city AS restaurant_city, r.region AS restaurant_region,
             r.image AS restaurant_image,
             COALESCE((SELECT SUM(b.guests) FROM event_bookings b WHERE b.event_id = e.id AND b.status = 'confirmed'), 0) AS booked
      FROM events e JOIN restaurants r ON r.id = e.restaurant_id
      WHERE e.is_active = 1 AND r.is_active = 1 AND e.date >= ? AND e.date <= ?
      ORDER BY e.date, e.time, e.id`),
    allEvents: db.prepare(`
      SELECT e.*, r.name AS restaurant_name, r.city AS restaurant_city,
             COALESCE((SELECT SUM(b.guests) FROM event_bookings b WHERE b.event_id = e.id AND b.status = 'confirmed'), 0) AS booked,
             (SELECT COUNT(*) FROM event_bookings b WHERE b.event_id = e.id AND b.status = 'confirmed') AS bookings
      FROM events e JOIN restaurants r ON r.id = e.restaurant_id
      ORDER BY (e.date < ?) ASC, CASE WHEN e.date < ? THEN NULL ELSE e.date END ASC, e.date DESC, e.time`),
    event: db.prepare(`
      SELECT e.*, r.is_active AS restaurant_active,
             COALESCE((SELECT SUM(b.guests) FROM event_bookings b WHERE b.event_id = e.id AND b.status = 'confirmed'), 0) AS booked
      FROM events e JOIN restaurants r ON r.id = e.restaurant_id WHERE e.id = ?`),
    insertEvent: db.prepare(`
      INSERT INTO events (restaurant_id, kind, title, description, date, time, price, capacity, is_active)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`),
    updateEvent: db.prepare(`
      UPDATE events SET restaurant_id = ?, kind = ?, title = ?, description = ?, date = ?, time = ?,
                        price = ?, capacity = ?, is_active = ? WHERE id = ?`),
    deleteEvent: db.prepare("DELETE FROM events WHERE id = ?"),

    insertBooking: db.prepare("INSERT INTO event_bookings (event_id, user_id, guests, note) VALUES (?, ?, ?, ?)"),
    activeBookingOf: db.prepare(
      "SELECT id FROM event_bookings WHERE event_id = ? AND user_id = ? AND status = 'confirmed'"
    ),
    booking: db.prepare("SELECT * FROM event_bookings WHERE id = ? AND user_id = ?"),
    cancelBooking: db.prepare("UPDATE event_bookings SET status = 'cancelled' WHERE id = ? AND user_id = ?"),
    bookingsOfUser: db.prepare(`
      SELECT b.*, e.title, e.kind, e.date, e.time, e.price, e.is_active AS event_active,
             r.name AS restaurant_name, r.city AS restaurant_city
      FROM event_bookings b JOIN events e ON e.id = b.event_id JOIN restaurants r ON r.id = e.restaurant_id
      WHERE b.user_id = ? ORDER BY e.date DESC, e.time DESC`),
    bookingsOfEvent: db.prepare(`
      SELECT b.id, b.guests, b.note, b.status, b.created_at, u.first_name, u.last_name, u.telephone, u.email
      FROM event_bookings b JOIN users u ON u.id = b.user_id
      WHERE b.event_id = ? ORDER BY b.status, b.created_at`)
  };

  // Առաջին գործարկման ժամանակ ավելացնում ենք օրինակային միջոցառումներ (միայն մեկ անգամ,
  // որ ադմինի ջնջածները չվերադառնան)
  if (!q.seeded.get()) {
    const fallback = q.anyRestaurant.get();
    if (fallback) {
      const today = new Date();
      db.exec("BEGIN");
      try {
        for (const [name, kind, title, description, days, time, price, capacity] of SAMPLE_EVENTS) {
          const r = q.restaurantByName.get(name) || fallback;
          q.insertEvent.run(Number(r.id), kind, title, description, localDate(addDays(today, days)), time, price, capacity, 1);
        }
        q.markSeeded.run();
        db.exec("COMMIT");
      } catch (err) {
        db.exec("ROLLBACK");
        throw err;
      }
      console.log("Ավելացվեցին օրինակային միջոցառումներ");
    }
  }

  function publicEvent(e, now) {
    const capacity = Number(e.capacity);
    const booked = Number(e.booked || 0);
    return {
      id: Number(e.id),
      restaurant_id: Number(e.restaurant_id),
      restaurant_name: e.restaurant_name,
      restaurant_city: e.restaurant_city,
      restaurant_region: e.restaurant_region,
      restaurant_image: e.restaurant_image,
      kind: e.kind,
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time,
      price: Number(e.price),
      capacity: capacity,
      seats_left: Math.max(0, capacity - booked),
      is_open: !hasStarted(e, now) && booked < capacity
    };
  }

  function adminEvent(e) {
    return {
      id: Number(e.id),
      restaurant_id: Number(e.restaurant_id),
      restaurant_name: e.restaurant_name,
      restaurant_city: e.restaurant_city,
      kind: e.kind,
      title: e.title,
      description: e.description,
      date: e.date,
      time: e.time,
      price: Number(e.price),
      capacity: Number(e.capacity),
      booked: Number(e.booked || 0),
      bookings: Number(e.bookings || 0),
      is_active: Number(e.is_active) === 1
    };
  }

  function myBooking(b, now) {
    return {
      id: Number(b.id),
      event_id: Number(b.event_id),
      title: b.title,
      kind: b.kind,
      date: b.date,
      time: b.time,
      price: Number(b.price),
      guests: Number(b.guests),
      note: b.note,
      status: Number(b.event_active) === 1 ? b.status : "event_cancelled",
      restaurant_name: b.restaurant_name,
      restaurant_city: b.restaurant_city,
      can_cancel: b.status === "confirmed" && Number(b.event_active) === 1 && !hasStarted(b, now)
    };
  }

  function routes(app, { requireUser, requireAdmin }) {
    // ---------- Հանրային՝ առաջիկա միջոցառումներ ----------

    app.get("/api/events", (req, res) => {
      const now = new Date();
      const rows = q.upcoming.all(localDate(now), localDate(addDays(now, BOOKING.maxDaysAhead)));
      res.json({ events: rows.map((e) => publicEvent(e, now)), kinds: KINDS });
    });

    // ---------- Հյուր՝ ամրագրում և չեղարկում ----------

    app.post("/api/events/:id/book", requireUser, (req, res) => {
      const now = new Date();
      const id = toId(req.params.id);
      const event = id ? q.event.get(id) : null;
      if (!event || Number(event.is_active) !== 1 || Number(event.restaurant_active) !== 1) {
        return res.status(404).json({ errors: { form: TEXT.notFound } });
      }
      if (hasStarted(event, now)) return res.status(409).json({ errors: { form: TEXT.closed } });

      const body = req.body || {};
      const guests = Number(body.guests);
      const note = clean(body.note);
      const errors = {};
      if (!Number.isInteger(guests) || guests < 1 || guests > BOOKING.maxGuests) errors.guests = MESSAGES.guests;
      if (note.length > BOOKING.maxNoteLength) errors.note = MESSAGES.noteLong || "Նշումը չափազանց երկար է";
      if (hasErrors(errors)) return res.status(400).json({ errors });

      if (q.activeBookingOf.get(id, req.session.userId)) {
        return res.status(409).json({ errors: { form: TEXT.already } });
      }
      const left = Number(event.capacity) - Number(event.booked);
      if (left <= 0) return res.status(409).json({ errors: { form: TEXT.full } });
      if (guests > left) return res.status(409).json({ errors: { guests: TEXT.fewSeats(left) } });

      const result = q.insertBooking.run(id, req.session.userId, guests, note);
      res.status(201).json({ booking: { id: Number(result.lastInsertRowid), event_id: id, guests: guests } });
    });

    app.get("/api/event-bookings", requireUser, (req, res) => {
      const now = new Date();
      res.json({ bookings: q.bookingsOfUser.all(req.session.userId).map((b) => myBooking(b, now)) });
    });

    app.post("/api/event-bookings/:id/cancel", requireUser, (req, res) => {
      const id = toId(req.params.id);
      const booking = id ? q.booking.get(id, req.session.userId) : null;
      if (!booking) return res.status(404).json({ errors: { form: TEXT.bookingNotFound } });
      const event = q.event.get(booking.event_id);
      if (booking.status !== "confirmed" || !event || hasStarted(event, new Date())) {
        return res.status(409).json({ errors: { form: TEXT.cannotCancel } });
      }
      q.cancelBooking.run(id, req.session.userId);
      res.json({ ok: true });
    });

    // ---------- Ադմին՝ միջոցառումներ ----------

    app.get("/api/admin/events", requireAdmin, (req, res) => {
      const today = localDate(new Date());
      res.json({ events: q.allEvents.all(today, today).map(adminEvent), kinds: KINDS });
    });

    app.post("/api/admin/events", requireAdmin, (req, res) => {
      const { data, errors } = validateEvent(req.body || {}, new Date(), null);
      if (data.restaurant_id && !q.restaurant.get(data.restaurant_id)) errors.restaurant_id = "Ռեստորանը չի գտնվել";
      if (hasErrors(errors)) return res.status(400).json({ errors });
      const result = q.insertEvent.run(
        data.restaurant_id, data.kind, data.title, data.description, data.date, data.time,
        data.price, data.capacity, data.is_active
      );
      res.status(201).json({ id: Number(result.lastInsertRowid) });
    });

    app.put("/api/admin/events/:id", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      const previous = id ? q.event.get(id) : null;
      if (!previous) return res.status(404).json({ errors: { form: TEXT.notFound } });
      const { data, errors } = validateEvent(req.body || {}, new Date(), previous);
      if (data.restaurant_id && !q.restaurant.get(data.restaurant_id)) errors.restaurant_id = "Ռեստորանը չի գտնվել";
      // Չենք թողնում տեղերը դարձնել ավելի քիչ, քան արդեն ամրագրված է
      if (!errors.capacity && data.capacity < Number(previous.booked)) {
        errors.capacity = "Արդեն ամրագրված է " + previous.booked + " տեղ, ավելի քիչ չի կարելի";
      }
      if (hasErrors(errors)) return res.status(400).json({ errors });
      q.updateEvent.run(
        data.restaurant_id, data.kind, data.title, data.description, data.date, data.time,
        data.price, data.capacity, data.is_active, id
      );
      res.json({ ok: true });
    });

    app.delete("/api/admin/events/:id", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      const event = id ? q.event.get(id) : null;
      if (!event) return res.status(404).json({ errors: { form: TEXT.notFound } });
      if (Number(event.booked) > 0 && !hasStarted(event, new Date())) {
        return res.status(409).json({
          errors: { form: "Այս միջոցառումն ունի ամրագրումներ։ Ջնջելու փոխարեն թաքցրեք այն, և հյուրերը կտեսնեն, որ այն չեղարկված է։" }
        });
      }
      q.deleteEvent.run(id);
      res.json({ ok: true });
    });

    // Ով է ամրագրել
    app.get("/api/admin/events/:id/bookings", requireAdmin, (req, res) => {
      const id = toId(req.params.id);
      if (!id || !q.event.get(id)) return res.status(404).json({ errors: { form: TEXT.notFound } });
      res.json({
        bookings: q.bookingsOfEvent.all(id).map((b) => ({
          id: Number(b.id),
          guests: Number(b.guests),
          note: b.note,
          status: b.status,
          created_at: b.created_at,
          customer: { name: b.first_name + " " + b.last_name, telephone: b.telephone, email: b.email }
        }))
      });
    });
  }

  return { routes };
};
