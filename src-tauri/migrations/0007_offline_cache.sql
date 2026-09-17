-- Phase 2: repurpose the local SQLite file as an offline-first cache + outbox.
-- These tables previously held the pre-Supabase local data (now already
-- imported into Supabase, twice over - once in Phase 1, once again after
-- the Phase 2 uuid migration) - safe to drop and recreate to mirror
-- Supabase's shape (uuid ids as TEXT) instead of the old integer ids.
DROP TABLE IF EXISTS template_tasks;
DROP TABLE IF EXISTS templates;
DROP TABLE IF EXISTS task_completions;
DROP TABLE IF EXISTS tasks;
DROP TABLE IF EXISTS tags;

CREATE TABLE tags (
  id         TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  color      TEXT NOT NULL,
  sort_order INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE tasks (
  id              TEXT PRIMARY KEY,
  title           TEXT NOT NULL,
  notes           TEXT,
  time            TEXT,
  tag_id          TEXT REFERENCES tags(id) ON DELETE SET NULL,
  priority        TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  recurrence_type TEXT NOT NULL CHECK (recurrence_type IN ('none','daily','weekly')) DEFAULT 'none',
  recurrence_days TEXT,
  start_date      TEXT NOT NULL,
  end_date        TEXT,
  sort_order      INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_tasks_start_date ON tasks(start_date);

CREATE TABLE task_completions (
  task_id TEXT NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date    TEXT NOT NULL,
  PRIMARY KEY (task_id, date)
);

CREATE TABLE templates (
  id     TEXT PRIMARY KEY,
  name   TEXT NOT NULL,
  tag_id TEXT REFERENCES tags(id) ON DELETE SET NULL
);

CREATE TABLE template_tasks (
  id          TEXT PRIMARY KEY,
  template_id TEXT NOT NULL REFERENCES templates(id) ON DELETE CASCADE,
  title       TEXT NOT NULL,
  notes       TEXT,
  time        TEXT,
  priority    TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  sort_order  INTEGER NOT NULL DEFAULT 0
);
CREATE INDEX idx_template_tasks_template_id ON template_tasks(template_id);

-- The outbox: every offline-capable write appends one row here, drained in
-- `seq` order against Supabase so FK-dependent ops (e.g. a tag before a task
-- that references it) always apply in the order they were made.
CREATE TABLE pending_ops (
  seq        INTEGER PRIMARY KEY AUTOINCREMENT,
  id         TEXT NOT NULL UNIQUE,
  table_name TEXT NOT NULL,
  op         TEXT NOT NULL CHECK (op IN ('insert','update','delete','upsert')),
  row_id     TEXT NOT NULL,
  payload    TEXT,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  attempts   INTEGER NOT NULL DEFAULT 0
);
