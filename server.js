// Tablebook-ի սերվերը՝ Express + SQLite (Node-ի ներկառուցված node:sqlite մոդուլ)

const path = require("node:path");
const fs = require("node:fs");
const express = require("express");
const session = require("express-session");
const bcrypt = require("bcryptjs");
const {
  MESSAGES,
  validateRegistration,
  validateLogin,
  validateReservation,
  localDate
} = require("./public/validation.js");

// ---------- Կարգավորումներ .env ֆայլից ----------

try {
  process.loadEnvFile(path.join(__dirname, ".env"));
} catch (err) {
  if (err.code !== "ENOENT") throw err;
}

if (!process.env.SESSION_SECRET) {
  console.error("Սխալ. SESSION_SECRET-ը նշված չէ։");
  console.error("Պատճենեք .env.example ֆայլը .env անունով և գրեք այնտեղ երկար պատահական բանալի։");
  process.exit(1);
}

let DatabaseSync;
try {
  ({ DatabaseSync } = require("node:sqlite"));
} catch (e) {
  console.error("Սխալ. անհրաժեշտ է Node.js 22.13 կամ ավելի նոր տարբերակ։ Ձեր տարբերակը՝ " + process.version);
  process.exit(1);
}

const PORT = process.env.PORT || 3000;
const DATA_DIR = path.join(__dirname, "data");
const DB_PATH = path.join(DATA_DIR, "tablebook.db");
const SCHEMA_PATH = path.join(__dirname, "db", "schema.sql");
const BCRYPT_ROUNDS = 12;

// ---------- Տվյալների բազա ----------

// Եթե բազան դեռ չկա, ստեղծում ենք այն schema.sql-ից։
// schema.sql-ը կատարում ենք ամեն գործարկման ժամանակ (CREATE ... IF NOT EXISTS),
// որ հին բազայում էլ հայտնվեն նոր աղյուսակները
function openDatabase() {
  const isNew = !fs.existsSync(DB_PATH);
  if (isNew) fs.mkdirSync(DATA_DIR, { recursive: true });

  const db = new DatabaseSync(DB_PATH);
  db.exec("PRAGMA foreign_keys = ON");
  db.exec(fs.readFileSync(SCHEMA_PATH, "utf8"));
  if (isNew) console.log("Ստեղծվեց նոր տվյալների բազա՝ data/tablebook.db");
  return db;
}

const db = openDatabase();

// Բոլոր հարցումները պարամետրացված են (?), արժեքները երբեք չեն միացվում տեքստին
const insertUser = db.prepare(
  "INSERT INTO users (first_name, last_name, email, telephone, password_hash) VALUES (?, ?, ?, ?, ?)"
);
const findUserForLogin = db.prepare("SELECT id, password_hash FROM users WHERE email = ?");
const emailExists = db.prepare("SELECT 1 FROM users WHERE email = ?");
const findUserById = db.prepare(
  "SELECT id, first_name, last_name, email, telephone, created_at FROM users WHERE id = ?"
);

const insertReservation = db.prepare(
  "INSERT INTO reservations (user_id, date, time, guests, note) VALUES (?, ?, ?, ?, ?)"
);
// Նույն օրվա և ժամի համար նույն հյուրի մեկ ակտիվ ամրագրում
const activeReservationAt = db.prepare(
  "SELECT 1 FROM reservations WHERE user_id = ? AND date = ? AND time = ? AND status IN ('pending', 'confirmed')"
);
const reservationsOfUser = db.prepare(
  "SELECT id, date, time, guests, note, status, created_at FROM reservations WHERE user_id = ? ORDER BY date DESC, time DESC"
);
const findReservation = db.prepare(
  "SELECT id, date, time, guests, note, status, created_at FROM reservations WHERE id = ? AND user_id = ?"
);
const cancelReservationById = db.prepare(
  "UPDATE reservations SET status = 'cancelled' WHERE id = ? AND user_id = ?"
);

function publicReservation(row) {
  return {
    id: Number(row.id),
    date: row.date,
    time: row.time,
    guests: Number(row.guests),
    note: row.note,
    status: row.status,
    created_at: row.created_at
  };
}

// Օգտատիրոջ տվյալները պատասխանի համար՝ առանց գաղտնաբառի և հեշի
function publicUser(row) {
  return {
    id: Number(row.id),
    first_name: row.first_name,
    last_name: row.last_name,
    email: row.email,
    telephone: row.telephone,
    created_at: row.created_at
  };
}

// Չգոյություն ունեցող էլ. փոստի դեպքում էլ ենք համեմատում կեղծ հեշի հետ,
// որ պատասխանի արագությամբ հնարավոր չլինի գուշակել՝ էլ. փոստը գրանցված է, թե ոչ
const DUMMY_HASH = bcrypt.hashSync("tablebook-dummy-password", BCRYPT_ROUNDS);

// Մուտքից հետո նոր սեսիա ենք բացում (session fixation-ից պաշտպանություն)
function startSession(req, userId) {
  return new Promise((resolve, reject) => {
    req.session.regenerate((err) => {
      if (err) return reject(err);
      req.session.userId = userId;
      req.session.save((saveErr) => (saveErr ? reject(saveErr) : resolve()));
    });
  });
}

// ---------- Սերվեր ----------

const app = express();

app.use(express.json({ limit: "10kb" }));
app.use(
  session({
    name: "tablebook.sid",
    secret: process.env.SESSION_SECRET,
    resave: false,
    saveUninitialized: false,
    cookie: {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 7 * 24 * 60 * 60 * 1000
    }
  })
);

// extensions-ի շնորհիվ /login և /register հասցեները բացում են login.html-ը և register.html-ը
app.use(express.static(path.join(__dirname, "public"), { extensions: ["html"] }));

// Գրանցում
app.post("/api/register", async (req, res, next) => {
  try {
    const { data, errors } = validateRegistration(req.body || {});
    if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

    if (emailExists.get(data.email)) {
      return res.status(409).json({ errors: { email: MESSAGES.emailTaken } });
    }

    const passwordHash = await bcrypt.hash(data.password, BCRYPT_ROUNDS);
    let result;
    try {
      result = insertUser.run(data.first_name, data.last_name, data.email, data.telephone, passwordHash);
    } catch (err) {
      // Եթե երկու գրանցում միաժամանակ եկան նույն էլ. փոստով
      if (String(err.message).includes("UNIQUE")) {
        return res.status(409).json({ errors: { email: MESSAGES.emailTaken } });
      }
      throw err;
    }

    const userId = Number(result.lastInsertRowid);
    await startSession(req, userId);
    res.status(201).json({ user: publicUser(findUserById.get(userId)) });
  } catch (err) {
    next(err);
  }
});

// Մուտք
app.post("/api/login", async (req, res, next) => {
  try {
    const { data, errors } = validateLogin(req.body || {});
    if (Object.keys(errors).length > 0) {
      return res.status(401).json({ errors: { form: MESSAGES.loginFailed } });
    }

    const row = findUserForLogin.get(data.email);
    const ok = await bcrypt.compare(data.password, row ? row.password_hash : DUMMY_HASH);
    if (!row || !ok) {
      return res.status(401).json({ errors: { form: MESSAGES.loginFailed } });
    }

    const userId = Number(row.id);
    await startSession(req, userId);
    res.json({ user: publicUser(findUserById.get(userId)) });
  } catch (err) {
    next(err);
  }
});

// Ով է մուտք գործել (գլխավոր էջի վերևի մասի համար)
app.get("/api/me", (req, res) => {
  const row = req.session.userId ? findUserById.get(req.session.userId) : null;
  res.json({ user: row ? publicUser(row) : null });
});

// Դուրս գալ՝ ջնջում ենք սեսիան և cookie-ն
app.post("/api/logout", (req, res, next) => {
  req.session.destroy((err) => {
    if (err) return next(err);
    res.clearCookie("tablebook.sid");
    res.json({ ok: true });
  });
});

// ---------- Ամրագրումներ ----------

// Ամրագրումների բոլոր հարցումները միայն մուտք գործած հյուրի համար են
function requireUser(req, res, next) {
  if (req.session.userId && findUserById.get(req.session.userId)) return next();
  res.status(401).json({ errors: { form: MESSAGES.loginNeeded } });
}

// Նոր ամրագրում
app.post("/api/reservations", requireUser, (req, res) => {
  const { data, errors } = validateReservation(req.body || {}, new Date());
  if (Object.keys(errors).length > 0) return res.status(400).json({ errors });

  if (activeReservationAt.get(req.session.userId, data.date, data.time)) {
    return res.status(409).json({ errors: { form: MESSAGES.duplicate } });
  }

  const result = insertReservation.run(req.session.userId, data.date, data.time, data.guests, data.note);
  const row = findReservation.get(Number(result.lastInsertRowid), req.session.userId);
  res.status(201).json({ reservation: publicReservation(row) });
});

// Իմ ամրագրումները
app.get("/api/reservations", requireUser, (req, res) => {
  res.json({ reservations: reservationsOfUser.all(req.session.userId).map(publicReservation) });
});

// Չեղարկում. միայն իր, դեռ չանցած և չմերժված ամրագրումը
app.post("/api/reservations/:id/cancel", requireUser, (req, res) => {
  const id = Number(req.params.id);
  const row = Number.isInteger(id) ? findReservation.get(id, req.session.userId) : null;
  if (!row) return res.status(404).json({ errors: { form: MESSAGES.notFound } });

  const isActive = row.status === "pending" || row.status === "confirmed";
  if (!isActive || row.date < localDate(new Date())) {
    return res.status(409).json({ errors: { form: MESSAGES.cannotCancel } });
  }

  cancelReservationById.run(id, req.session.userId);
  res.json({ reservation: publicReservation(findReservation.get(id, req.session.userId)) });
});

// Չգտնված API երթուղի
app.use("/api", (req, res) => {
  res.status(404).json({ errors: { form: "Այսպիսի հասցե չկա։" } });
});

// Սխալների մշակում. կոնսոլում գրում ենք միայն սխալի նկարագրությունը,
// երբեք՝ հարցման պարունակությունը (այնտեղ կարող է լինել գաղտնաբառ)
app.use((err, req, res, next) => {
  if (err.type === "entity.parse.failed" || err.type === "entity.too.large") {
    return res.status(400).json({ errors: { form: "Սխալ տվյալներ։" } });
  }
  console.error("Սերվերի սխալ " + req.method + " " + req.path + ": " + err.message);
  res.status(500).json({ errors: { form: MESSAGES.serverError } });
});

app.listen(PORT, () => {
  console.log("Tablebook-ը աշխատում է՝ http://localhost:" + PORT);
});
