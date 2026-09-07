CREATE TABLE templates (
  id         INTEGER PRIMARY KEY AUTOINCREMENT,
  name       TEXT NOT NULL,
  tag_id     INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE template_tasks (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  template_id INTEGER NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  notes       TEXT,
  time        TEXT,
  priority    TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
