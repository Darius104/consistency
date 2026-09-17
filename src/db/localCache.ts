import { getDb } from "./client";

// Thin typed wrapper around the local SQLite cache (schema: see
// src-tauri/migrations/0007_offline_cache.sql). Row shapes mirror Supabase's
// column names (snake_case) so the mapping logic in queries.ts is shared
// between "read from cache" and "row came back from a Supabase pull".

export interface TagRow {
  id: string;
  name: string;
  color: string;
  sort_order: number;
}

export interface TaskRow {
  id: string;
  title: string;
  notes: string | null;
  time: string | null;
  tag_id: string | null;
  priority: string;
  recurrence_type: string;
  recurrence_days: string | null;
  start_date: string;
  end_date: string | null;
  sort_order: number;
}

export interface TemplateRow {
  id: string;
  name: string;
  tag_id: string | null;
}

export interface TemplateTaskRow {
  id: string;
  template_id: string;
  title: string;
  notes: string | null;
  time: string | null;
  priority: string;
  sort_order: number;
}

export interface NoteRow {
  id: string;
  date: string;
  content: string;
  sort_order: number;
  after_group_key: string | null;
}

export type PendingOpKind = "insert" | "update" | "delete" | "upsert";

export interface PendingOp {
  seq: number;
  id: string;
  table_name: string;
  op: PendingOpKind;
  row_id: string;
  payload: string | null;
  attempts: number;
}

/** Bulk-overwrites a whole table's cached contents - used by the "pull" half of sync.ts. */
export async function replaceTable<T extends object>(
  table: string,
  columns: readonly (keyof T & string)[],
  rows: T[],
): Promise<void> {
  const db = await getDb();
  await db.execute(`DELETE FROM ${table}`);
  const placeholders = columns.map((_, i) => `$${i + 1}`).join(",");
  for (const row of rows) {
    await db.execute(
      `INSERT INTO ${table} (${columns.join(",")}) VALUES (${placeholders})`,
      columns.map((c) => row[c] ?? null),
    );
  }
}

// ---------- Tags ----------

export async function cacheGetTags(): Promise<TagRow[]> {
  const db = await getDb();
  return db.select<TagRow[]>(
    "SELECT id, name, color, sort_order FROM tags ORDER BY sort_order, name",
  );
}

export async function cacheUpsertTag(row: TagRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tags (id, name, color, sort_order) VALUES ($1,$2,$3,$4)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, color=excluded.color, sort_order=excluded.sort_order`,
    [row.id, row.name, row.color, row.sort_order],
  );
}

export async function cacheDeleteTag(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tags WHERE id = $1", [id]);
}

// ---------- Tasks ----------

const TASK_COLUMNS =
  "id, title, notes, time, tag_id, priority, recurrence_type, recurrence_days, start_date, end_date, sort_order";

export async function cacheGetTasks(): Promise<TaskRow[]> {
  const db = await getDb();
  return db.select<TaskRow[]>(`SELECT ${TASK_COLUMNS} FROM tasks`);
}

export async function cacheUpsertTask(row: TaskRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO tasks (${TASK_COLUMNS}) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
     ON CONFLICT(id) DO UPDATE SET
       title=excluded.title, notes=excluded.notes, time=excluded.time, tag_id=excluded.tag_id,
       priority=excluded.priority, recurrence_type=excluded.recurrence_type,
       recurrence_days=excluded.recurrence_days, start_date=excluded.start_date,
       end_date=excluded.end_date, sort_order=excluded.sort_order`,
    [
      row.id,
      row.title,
      row.notes,
      row.time,
      row.tag_id,
      row.priority,
      row.recurrence_type,
      row.recurrence_days,
      row.start_date,
      row.end_date,
      row.sort_order,
    ],
  );
}

export async function cacheDeleteTask(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

export async function cacheNextTaskSortOrder(): Promise<number> {
  const db = await getDb();
  // CAST is required: without it, sqlx sometimes can't statically infer this
  // computed expression's type and serializes it as a string like "32.0" -
  // which Postgres then rejects outright once it reaches the integer
  // sort_order column ("invalid input syntax for type integer: \"32.0\"").
  // Number(...) below is a defensive second layer against the same issue.
  const [row] = await db.select<{ next: number }[]>(
    "SELECT CAST(COALESCE(MAX(sort_order), -1) + 1 AS INTEGER) AS next FROM tasks",
  );
  return Number(row.next);
}

export async function cacheNextTagSortOrder(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select<{ next: number }[]>(
    "SELECT CAST(COALESCE(MAX(sort_order), -1) + 1 AS INTEGER) AS next FROM tags",
  );
  return Number(row.next);
}

// ---------- Completions ----------

export async function cacheGetCompletions(): Promise<{ task_id: string; date: string }[]> {
  const db = await getDb();
  return db.select<{ task_id: string; date: string }[]>(
    "SELECT task_id, date FROM task_completions",
  );
}

export async function cacheSetCompletion(
  taskId: string,
  date: string,
  completed: boolean,
): Promise<void> {
  const db = await getDb();
  if (completed) {
    await db.execute(
      "INSERT OR IGNORE INTO task_completions (task_id, date) VALUES ($1,$2)",
      [taskId, date],
    );
  } else {
    await db.execute(
      "DELETE FROM task_completions WHERE task_id = $1 AND date = $2",
      [taskId, date],
    );
  }
}

// ---------- Streak freezes ----------

export async function cacheGetStreakFreezes(): Promise<string[]> {
  const db = await getDb();
  const rows = await db.select<{ date: string }[]>("SELECT date FROM streak_freezes");
  return rows.map((r) => r.date);
}

export async function cacheAddStreakFreeze(date: string): Promise<void> {
  const db = await getDb();
  await db.execute("INSERT OR IGNORE INTO streak_freezes (date) VALUES ($1)", [date]);
}

export async function cacheRemoveStreakFreeze(date: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM streak_freezes WHERE date = $1", [date]);
}

// ---------- Settings ----------

export async function cacheGetSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function cacheSetSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings (key, value) VALUES ($1,$2)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
  );
}

export async function cacheGetAllSettings(): Promise<{ key: string; value: string }[]> {
  const db = await getDb();
  return db.select<{ key: string; value: string }[]>("SELECT key, value FROM settings");
}

// ---------- Templates ----------

export async function cacheGetTemplates(): Promise<
  (TemplateRow & { task_count: number })[]
> {
  const db = await getDb();
  return db.select<(TemplateRow & { task_count: number })[]>(
    `SELECT t.id, t.name, t.tag_id, COUNT(tt.id) AS task_count
     FROM templates t LEFT JOIN template_tasks tt ON tt.template_id = t.id
     GROUP BY t.id ORDER BY t.name`,
  );
}

export async function cacheUpsertTemplate(row: TemplateRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO templates (id, name, tag_id) VALUES ($1,$2,$3)
     ON CONFLICT(id) DO UPDATE SET name=excluded.name, tag_id=excluded.tag_id`,
    [row.id, row.name, row.tag_id],
  );
}

export async function cacheDeleteTemplate(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM templates WHERE id = $1", [id]);
}

export async function cacheFindTemplateByTagId(tagId: string): Promise<TemplateRow | null> {
  const db = await getDb();
  const rows = await db.select<TemplateRow[]>(
    "SELECT id, name, tag_id FROM templates WHERE tag_id = $1",
    [tagId],
  );
  return rows[0] ?? null;
}

export async function cacheGetTemplateTasks(templateId: string): Promise<TemplateTaskRow[]> {
  const db = await getDb();
  return db.select<TemplateTaskRow[]>(
    "SELECT id, template_id, title, notes, time, priority, sort_order FROM template_tasks WHERE template_id = $1 ORDER BY sort_order",
    [templateId],
  );
}

export async function cacheReplaceTemplateTasks(
  templateId: string,
  rows: TemplateTaskRow[],
): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM template_tasks WHERE template_id = $1", [templateId]);
  for (const row of rows) {
    await db.execute(
      `INSERT INTO template_tasks (id, template_id, title, notes, time, priority, sort_order)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [row.id, row.template_id, row.title, row.notes, row.time, row.priority, row.sort_order],
    );
  }
}

// ---------- Notes ----------

const NOTE_COLUMNS = "id, date, content, sort_order, after_group_key";

export async function cacheGetNotes(): Promise<NoteRow[]> {
  const db = await getDb();
  return db.select<NoteRow[]>(`SELECT ${NOTE_COLUMNS} FROM notes ORDER BY sort_order, created_at`);
}

export async function cacheUpsertNote(row: NoteRow): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO notes (id, date, content, sort_order, after_group_key) VALUES ($1,$2,$3,$4,$5)
     ON CONFLICT(id) DO UPDATE SET date=excluded.date, content=excluded.content,
       sort_order=excluded.sort_order, after_group_key=excluded.after_group_key`,
    [row.id, row.date, row.content, row.sort_order, row.after_group_key],
  );
}

export async function cacheDeleteNote(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM notes WHERE id = $1", [id]);
}

export async function cacheNextNoteSortOrder(): Promise<number> {
  const db = await getDb();
  const [row] = await db.select<{ next: number }[]>(
    "SELECT CAST(COALESCE(MAX(sort_order), -1) + 1 AS INTEGER) AS next FROM notes",
  );
  return Number(row.next);
}

// ---------- Outbox ----------

export async function enqueueOp(op: {
  table: string;
  op: PendingOpKind;
  rowId: string;
  payload?: unknown;
}): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO pending_ops (id, table_name, op, row_id, payload) VALUES ($1,$2,$3,$4,$5)",
    [crypto.randomUUID(), op.table, op.op, op.rowId, op.payload ? JSON.stringify(op.payload) : null],
  );
}

export async function listPendingOps(): Promise<PendingOp[]> {
  const db = await getDb();
  return db.select<PendingOp[]>("SELECT * FROM pending_ops ORDER BY seq ASC");
}

export async function deletePendingOp(seq: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM pending_ops WHERE seq = $1", [seq]);
}

export async function bumpPendingOpAttempts(seq: number): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE pending_ops SET attempts = attempts + 1 WHERE seq = $1", [seq]);
}

/**
 * Drops every pending op that only ever touched a row which was itself
 * later deleted before syncing - e.g. a task created offline then deleted
 * again before reconnecting never needs to reach the server at all. Returns
 * whether anything was actually pending, so the caller knows whether the
 * row could ever have reached the server (and so needs an explicit delete
 * queued for it) or not.
 */
export async function discardPendingOpsFor(table: string, rowId: string): Promise<boolean> {
  const db = await getDb();
  const result = await db.execute(
    "DELETE FROM pending_ops WHERE table_name = $1 AND row_id = $2",
    [table, rowId],
  );
  return (result?.rowsAffected ?? 0) > 0;
}

/** Wipes every cached row and the outbox - used on sign-out so a different
 *  account signing in on the same device never sees stale cached data. */
export async function clearAllCache(): Promise<void> {
  const db = await getDb();
  for (const table of [
    "template_tasks",
    "templates",
    "task_completions",
    "tasks",
    "tags",
    "notes",
    "settings",
    "streak_freezes",
    "scheduled_reminders",
    "pending_ops",
  ]) {
    await db.execute(`DELETE FROM ${table}`);
  }
}
