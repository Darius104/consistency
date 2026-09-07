import { getDb } from "./client";
import type {
  NewTask,
  Priority,
  RecurrenceType,
  Tag,
  Task,
  Template,
  TemplateTaskBlueprint,
} from "../types";

interface TaskRow {
  id: number;
  title: string;
  notes: string | null;
  time: string | null;
  tag_id: number | null;
  priority: Priority;
  recurrence_type: RecurrenceType;
  recurrence_days: string | null;
  start_date: string;
  end_date: string | null;
  sort_order: number;
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    time: row.time,
    tagId: row.tag_id,
    priority: row.priority,
    recurrenceType: row.recurrence_type,
    recurrenceDays: row.recurrence_days
      ? row.recurrence_days.split(",").map(Number)
      : null,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  };
}

// ---------- Tags ----------

export async function getTags(): Promise<Tag[]> {
  const db = await getDb();
  return db.select<Tag[]>(
    "SELECT id, name, color, sort_order AS sortOrder FROM tags ORDER BY sort_order, name",
  );
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const db = await getDb();
  const result = await db.execute(
    `INSERT INTO tags (name, color, sort_order)
     VALUES ($1, $2, (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tags))`,
    [name, color],
  );
  const [row] = await db.select<Tag[]>(
    "SELECT id, name, color, sort_order AS sortOrder FROM tags WHERE id = $1",
    [result.lastInsertId],
  );
  return row;
}

export async function updateTag(
  id: number,
  name: string,
  color: string,
): Promise<void> {
  const db = await getDb();
  await db.execute("UPDATE tags SET name = $1, color = $2 WHERE id = $3", [
    name,
    color,
    id,
  ]);
}

/** Persists a manually-dragged tag group order: sort_order = index in the array. */
export async function updateTagOrder(tagIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < tagIds.length; i++) {
    await db.execute("UPDATE tags SET sort_order = $1 WHERE id = $2", [i, tagIds[i]]);
  }
}

export async function deleteTag(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tags WHERE id = $1", [id]);
}

// ---------- Tasks ----------

export async function getAllTasks(): Promise<Task[]> {
  const db = await getDb();
  const rows = await db.select<TaskRow[]>(
    `SELECT id, title, notes, time, tag_id, priority, recurrence_type,
            recurrence_days, start_date, end_date, sort_order
     FROM tasks`,
  );
  return rows.map(rowToTask);
}

export async function createTask(task: NewTask): Promise<Task> {
  const db = await getDb();
  const recurrenceDays = task.recurrenceDays?.length
    ? task.recurrenceDays.join(",")
    : null;
  const result = await db.execute(
    `INSERT INTO tasks
      (title, notes, time, tag_id, priority, recurrence_type, recurrence_days, start_date, end_date, sort_order)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9,
       (SELECT COALESCE(MAX(sort_order), -1) + 1 FROM tasks))`,
    [
      task.title,
      task.notes ?? null,
      task.time ?? null,
      task.tagId ?? null,
      task.priority,
      task.recurrenceType,
      recurrenceDays,
      task.startDate,
      task.endDate ?? null,
    ],
  );
  const [row] = await db.select<TaskRow[]>(
    `SELECT id, title, notes, time, tag_id, priority, recurrence_type,
            recurrence_days, start_date, end_date, sort_order
     FROM tasks WHERE id = $1`,
    [result.lastInsertId],
  );
  return rowToTask(row);
}

export async function updateTask(
  id: number,
  task: NewTask,
): Promise<void> {
  const db = await getDb();
  const recurrenceDays = task.recurrenceDays?.length
    ? task.recurrenceDays.join(",")
    : null;
  await db.execute(
    `UPDATE tasks SET
       title = $1, notes = $2, time = $3, tag_id = $4, priority = $5,
       recurrence_type = $6, recurrence_days = $7, start_date = $8, end_date = $9
     WHERE id = $10`,
    [
      task.title,
      task.notes ?? null,
      task.time ?? null,
      task.tagId ?? null,
      task.priority,
      task.recurrenceType,
      recurrenceDays,
      task.startDate,
      task.endDate ?? null,
      id,
    ],
  );
}

export async function deleteTask(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM tasks WHERE id = $1", [id]);
}

/** Persists a manually-dragged order: sets sort_order to each id's index in the array. */
export async function updateTaskOrder(taskIds: number[]): Promise<void> {
  const db = await getDb();
  for (let i = 0; i < taskIds.length; i++) {
    await db.execute("UPDATE tasks SET sort_order = $1 WHERE id = $2", [i, taskIds[i]]);
  }
}

// ---------- Completions ----------

// Keys are `${taskId}:${date}`. Personal-scale dataset, so we just load
// everything rather than manage a rolling date window.
export async function getAllCompletions(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ task_id: number; date: string }[]>(
    "SELECT task_id, date FROM task_completions",
  );
  return new Set(rows.map((r) => `${r.task_id}:${r.date}`));
}

export async function setCompletion(
  taskId: number,
  date: string,
  completed: boolean,
): Promise<void> {
  const db = await getDb();
  if (completed) {
    await db.execute(
      "INSERT OR IGNORE INTO task_completions (task_id, date) VALUES ($1, $2)",
      [taskId, date],
    );
  } else {
    await db.execute(
      "DELETE FROM task_completions WHERE task_id = $1 AND date = $2",
      [taskId, date],
    );
  }
}

// ---------- Settings ----------

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key = $1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT INTO settings (key, value) VALUES ($1, $2) ON CONFLICT(key) DO UPDATE SET value = $2",
    [key, value],
  );
}

// ---------- Streak freezes ----------

export async function getStreakFreezes(): Promise<Set<string>> {
  const db = await getDb();
  const rows = await db.select<{ date: string }[]>(
    "SELECT date FROM streak_freezes",
  );
  return new Set(rows.map((r) => r.date));
}

export async function addStreakFreeze(date: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    "INSERT OR IGNORE INTO streak_freezes (date) VALUES ($1)",
    [date],
  );
}

export async function removeStreakFreeze(date: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM streak_freezes WHERE date = $1", [date]);
}

// ---------- Backup ----------

/**
 * Writes a complete, consistent snapshot of the database to `destinationPath`.
 * Uses SQLite's own VACUUM INTO rather than copying the file on disk - the
 * database runs in WAL mode, so a raw file copy could miss recent writes
 * still sitting in the -wal file. VACUUM INTO handles that safely and also
 * refuses to overwrite an existing file, which is what we want here.
 */
export async function backupDatabase(destinationPath: string): Promise<void> {
  const db = await getDb();
  await db.execute("VACUUM INTO $1", [destinationPath]);
}

// ---------- Templates ----------

export async function getTemplates(): Promise<Template[]> {
  const db = await getDb();
  return db.select<Template[]>(
    `SELECT t.id, t.name, t.tag_id AS tagId, COUNT(tt.id) AS taskCount
     FROM templates t
     LEFT JOIN template_tasks tt ON tt.template_id = t.id
     GROUP BY t.id
     ORDER BY t.name`,
  );
}

/**
 * Captures a category's current tasks as a reusable, named starter pack.
 * A category only ever has one template - re-saving it (e.g. after tweaking
 * that category's tasks) replaces its blueprint tasks in place instead of
 * piling up duplicate "Trading", "Trading", "Trading" templates.
 */
export async function createTemplateFromTasks(
  name: string,
  tagId: number | null,
  tasks: TemplateTaskBlueprint[],
): Promise<Template> {
  const db = await getDb();

  let templateId: number;
  const [existing] = tagId
    ? await db.select<{ id: number }[]>("SELECT id FROM templates WHERE tag_id = $1", [tagId])
    : [];

  if (existing) {
    templateId = existing.id;
    await db.execute("DELETE FROM template_tasks WHERE template_id = $1", [templateId]);
  } else {
    const result = await db.execute(
      "INSERT INTO templates (name, tag_id) VALUES ($1, $2)",
      [name, tagId],
    );
    templateId = result.lastInsertId as number;
  }

  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    await db.execute(
      `INSERT INTO template_tasks (template_id, title, notes, time, priority, sort_order)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [templateId, t.title, t.notes, t.time, t.priority, i],
    );
  }

  const [row] = await db.select<Template[]>(
    `SELECT t.id, t.name, t.tag_id AS tagId, COUNT(tt.id) AS taskCount
     FROM templates t
     LEFT JOIN template_tasks tt ON tt.template_id = t.id
     WHERE t.id = $1
     GROUP BY t.id`,
    [templateId],
  );
  return row;
}

/** Stamps fresh, independent (non-recurring) copies of a template's tasks onto `date`. */
export async function applyTemplate(templateId: number, date: string): Promise<void> {
  const db = await getDb();
  const [template] = await db.select<{ tag_id: number | null }[]>(
    "SELECT tag_id FROM templates WHERE id = $1",
    [templateId],
  );
  if (!template) return;

  const blueprints = await db.select<
    { title: string; notes: string | null; time: string | null; priority: Priority }[]
  >(
    "SELECT title, notes, time, priority FROM template_tasks WHERE template_id = $1 ORDER BY sort_order",
    [templateId],
  );

  for (const bp of blueprints) {
    await createTask({
      title: bp.title,
      notes: bp.notes,
      time: bp.time,
      tagId: template.tag_id,
      priority: bp.priority,
      recurrenceType: "none",
      recurrenceDays: null,
      startDate: date,
      endDate: null,
    });
  }
}

export async function deleteTemplate(id: number): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM templates WHERE id = $1", [id]);
}
