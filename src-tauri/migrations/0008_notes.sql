-- Quick free-text notes attached to a specific day - purely informational,
-- never a task: no checkbox, no priority/time, never counted toward streak
-- or weekly completion (those only ever read from the tasks table).
CREATE TABLE notes (
  id         TEXT PRIMARY KEY,
  date       TEXT NOT NULL,
  content    TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX idx_notes_date ON notes(date);
