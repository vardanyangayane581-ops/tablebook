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
