-- Local-only reverse lookup from a scheduled OS notification's id back to
-- which task/date it's for - never synced, rebuilt from scratch every time
-- reminders are (re)scheduled. This is what lets a "Mark complete" tap on
-- the notification resolve to a task even if the app was fully killed (JS
-- memory gone) when it was tapped.
CREATE TABLE scheduled_reminders (
  notification_id INTEGER PRIMARY KEY,
  task_id TEXT NOT NULL,
  date TEXT NOT NULL
);
