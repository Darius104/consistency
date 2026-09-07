CREATE TABLE streak_freezes (
  date       TEXT PRIMARY KEY,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
