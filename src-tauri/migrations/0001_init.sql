CREATE TABLE tags (
  id    INTEGER PRIMARY KEY AUTOINCREMENT,
  name  TEXT NOT NULL UNIQUE,
  color TEXT NOT NULL
);

CREATE TABLE tasks (
  id               INTEGER PRIMARY KEY AUTOINCREMENT,
  title            TEXT NOT NULL,
  notes            TEXT,
  time             TEXT,
  tag_id           INTEGER REFERENCES tags(id) ON DELETE SET NULL,
  priority         TEXT NOT NULL CHECK (priority IN ('low','medium','high')) DEFAULT 'medium',
  recurrence_type  TEXT NOT NULL CHECK (recurrence_type IN ('none','daily','weekly')) DEFAULT 'none',
  recurrence_days  TEXT,
  start_date       TEXT NOT NULL,
  end_date         TEXT,
  created_at       TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE task_completions (
  id           INTEGER PRIMARY KEY AUTOINCREMENT,
  task_id      INTEGER NOT NULL REFERENCES tasks(id) ON DELETE CASCADE,
  date         TEXT NOT NULL,
  completed_at TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE(task_id, date)
);

CREATE INDEX idx_tasks_start_date ON tasks(start_date);
CREATE INDEX idx_completions_date ON task_completions(date);
