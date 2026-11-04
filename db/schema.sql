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
