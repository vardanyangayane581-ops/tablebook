-- Tablebook-ի տվյալների բազայի կառուցվածքը
-- Սերվերը այս ֆայլից ստեղծում է data/tablebook.db-ն առաջին գործարկման ժամանակ

CREATE TABLE IF NOT EXISTS users (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  first_name    TEXT    NOT NULL,
  last_name     TEXT    NOT NULL,
  email         TEXT    NOT NULL UNIQUE COLLATE NOCASE,
  telephone     TEXT    NOT NULL,
  password_hash TEXT    NOT NULL,
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Սեղանների ամրագրումներ
-- date՝ ՏՏՏՏ-ԱԱ-ՕՕ, time՝ ԺԺ:ՐՐ (սրճարանի տեղական ժամով)
CREATE TABLE IF NOT EXISTS reservations (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id    INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  date       TEXT    NOT NULL,
  time       TEXT    NOT NULL,
  guests     INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 12),
  note       TEXT    NOT NULL DEFAULT '',
  status     TEXT    NOT NULL DEFAULT 'pending'
             CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at TEXT    NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS reservations_user_date ON reservations (user_id, date, time);

-- ---------- Ադմին վահանակ ----------

-- Միակ աշխատողը, որը կարող է մուտք գործել ադմին վահանակ։
-- CHECK (id = 1)-ը թույլ չի տալիս ավելացնել երկրորդ աշխատող
CREATE TABLE IF NOT EXISTS admins (
  id            INTEGER PRIMARY KEY CHECK (id = 1),
  name          TEXT    NOT NULL,
  email         TEXT    NOT NULL COLLATE NOCASE,
  password_hash TEXT    NOT NULL
);

-- Կայքի տեքստեր, որոնք ադմինը կարող է փոխել (գլխավոր էջի վերնագիր և այլն)
CREATE TABLE IF NOT EXISTS site_settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);

-- ---------- Ռեստորաններ և մենյու ----------

CREATE TABLE IF NOT EXISTS restaurants (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  name        TEXT    NOT NULL,
  cuisine     TEXT    NOT NULL DEFAULT '',
  description TEXT    NOT NULL DEFAULT '',
  address     TEXT    NOT NULL DEFAULT '',
  phone       TEXT    NOT NULL DEFAULT '',
  hours       TEXT    NOT NULL DEFAULT '',
  image       TEXT    NOT NULL DEFAULT 'cafe-interior.jpg',
  rating      REAL    NOT NULL DEFAULT 4.5 CHECK (rating BETWEEN 0 AND 5),
  is_active   INTEGER NOT NULL DEFAULT 1 CHECK (is_active IN (0, 1)),
  created_at  TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- category՝ starter | salad | main | dessert | drink
CREATE TABLE IF NOT EXISTS menu_items (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  category      TEXT    NOT NULL CHECK (category IN ('starter', 'salad', 'main', 'dessert', 'drink')),
  name          TEXT    NOT NULL,
  description   TEXT    NOT NULL DEFAULT '',
  price         INTEGER NOT NULL CHECK (price BETWEEN 0 AND 1000000),
  emoji         TEXT    NOT NULL DEFAULT '🍽️',
  is_available  INTEGER NOT NULL DEFAULT 1 CHECK (is_available IN (0, 1))
);

CREATE INDEX IF NOT EXISTS menu_items_restaurant ON menu_items (restaurant_id, category);

-- Երեկոյի ճաշացանկ՝ հաճախորդի զամբյուղից կազմված պատվեր
CREATE TABLE IF NOT EXISTS evening_menus (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id       INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  restaurant_id INTEGER NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  date          TEXT    NOT NULL,
  time          TEXT    NOT NULL,
  guests        INTEGER NOT NULL CHECK (guests BETWEEN 1 AND 12),
  note          TEXT    NOT NULL DEFAULT '',
  total         INTEGER NOT NULL,
  status        TEXT    NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'confirmed', 'rejected', 'cancelled')),
  created_at    TEXT    NOT NULL DEFAULT (datetime('now'))
);

-- Ուտեստի անունն ու գինը պահում ենք պատվերի պահին, որ հետագա փոփոխությունները չազդեն
CREATE TABLE IF NOT EXISTS evening_menu_items (
  menu_id  INTEGER NOT NULL REFERENCES evening_menus(id) ON DELETE CASCADE,
  item_id  INTEGER,
  category TEXT    NOT NULL,
  name     TEXT    NOT NULL,
  price    INTEGER NOT NULL,
  qty      INTEGER NOT NULL CHECK (qty BETWEEN 1 AND 50)
);

CREATE INDEX IF NOT EXISTS evening_menus_user ON evening_menus (user_id, date);
