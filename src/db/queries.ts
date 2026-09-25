import { trySync } from "../sync";
import type {
  DayNote,
  NewTask,
  Priority,
  RecurrenceType,
  Tag,
  Task,
  Template,
  TemplateTaskBlueprint,
} from "../types";
import {
  cacheAddStreakFreeze,
  cacheDeleteNote,
  cacheDeleteTag,
  cacheDeleteTask,
  cacheDeleteTemplate,
  cacheFindTemplateByTagId,
  cacheGetAllSettings,
  cacheGetCompletions,
  cacheGetNotes,
  cacheGetSetting,
  cacheGetStreakFreezes,
  cacheGetTags,
  cacheGetTasks,
  cacheGetTemplateTasks,
  cacheGetTemplates,
  cacheNextNoteSortOrder,
  cacheNextTagSortOrder,
  cacheNextTaskSortOrder,
  cacheRemoveStreakFreeze,
  cacheReplaceTemplateTasks,
  cacheSetCompletion,
  cacheSetSetting,
  cacheUpsertNote,
  cacheUpsertTag,
  cacheUpsertTask,
  cacheUpsertTemplate,
  discardPendingOpsFor,
  enqueueOp,
  type NoteRow,
  type TagRow,
  type TaskRow,
  type TemplateTaskRow,
} from "./localCache";

// Every function here reads from / writes to the local SQLite cache only -
// instant, and identical whether the device is online or offline. Writes
// also enqueue an outbox entry and kick a non-blocking sync attempt; the
// actual Supabase calls live in ../sync.ts, the only place network happens.

function kickSync(): void {
  void trySync();
}

function rowToTask(row: TaskRow): Task {
  return {
    id: row.id,
    title: row.title,
    notes: row.notes,
    time: row.time,
    tagId: row.tag_id,
    priority: row.priority as Priority,
    recurrenceType: row.recurrence_type as RecurrenceType,
    recurrenceDays: row.recurrence_days ? row.recurrence_days.split(",").map(Number) : null,
    startDate: row.start_date,
    endDate: row.end_date,
    sortOrder: row.sort_order,
  };
}

function rowToTag(row: TagRow): Tag {
  return { id: row.id, name: row.name, color: row.color, sortOrder: row.sort_order };
}

// ---------- Tags ----------

export async function getTags(): Promise<Tag[]> {
  const rows = await cacheGetTags();
  return rows.map(rowToTag);
}

export async function createTag(name: string, color: string): Promise<Tag> {
  const row: TagRow = { id: crypto.randomUUID(), name, color, sort_order: await cacheNextTagSortOrder() };
  await cacheUpsertTag(row);
  await enqueueOp({ table: "tags", op: "upsert", rowId: row.id, payload: row });
  kickSync();
  return rowToTag(row);
}

export async function updateTag(id: string, name: string, color: string): Promise<void> {
  const existing = (await cacheGetTags()).find((t) => t.id === id);
  const row: TagRow = { id, name, color, sort_order: existing?.sort_order ?? 0 };
  await cacheUpsertTag(row);
  await enqueueOp({ table: "tags", op: "upsert", rowId: id, payload: row });
  kickSync();
}

/** Persists a manually-dragged tag group order via a single batched RPC call. */
export async function updateTagOrder(tagIds: string[]): Promise<void> {
  const orderMap = new Map(tagIds.map((id, i) => [id, i]));
  for (const t of await cacheGetTags()) {
    if (orderMap.has(t.id)) await cacheUpsertTag({ ...t, sort_order: orderMap.get(t.id)! });
  }
  await enqueueOp({ table: "rpc:reorder_tags", op: "upsert", rowId: "-", payload: { ids: tagIds } });
  kickSync();
}

export async function deleteTag(id: string): Promise<void> {
  await cacheDeleteTag(id);
  // Discard any still-queued writes for this row (no point pushing an edit
  // to something about to be deleted) and always queue the delete itself -
  // deleting a row that never actually reached the server is a harmless
  // no-op there, so this is simpler (and safer) than trying to infer
  // whether the row was ever synced from the outbox's contents alone.
  await discardPendingOpsFor("tags", id);
  await enqueueOp({ table: "tags", op: "delete", rowId: id });
  kickSync();
}

// ---------- Tasks ----------

export async function getAllTasks(): Promise<Task[]> {
  const rows = await cacheGetTasks();
  return rows.map(rowToTask);
}

function taskRowFrom(id: string, task: NewTask, sortOrder: number): TaskRow {
  return {
    id,
    title: task.title,
    notes: task.notes ?? null,
    time: task.time ?? null,
    tag_id: task.tagId ?? null,
    priority: task.priority,
    recurrence_type: task.recurrenceType,
    recurrence_days: task.recurrenceDays?.length ? task.recurrenceDays.join(",") : null,
    start_date: task.startDate,
    end_date: task.endDate ?? null,
    sort_order: sortOrder,
  };
}

export async function createTask(task: NewTask): Promise<Task> {
  const row = taskRowFrom(crypto.randomUUID(), task, await cacheNextTaskSortOrder());
  await cacheUpsertTask(row);
  await enqueueOp({ table: "tasks", op: "upsert", rowId: row.id, payload: row });
  kickSync();
  return rowToTask(row);
}

export async function updateTask(id: string, task: NewTask): Promise<void> {
  const existing = (await cacheGetTasks()).find((t) => t.id === id);
  const row = taskRowFrom(id, task, existing?.sort_order ?? 0);
  await cacheUpsertTask(row);
  await enqueueOp({ table: "tasks", op: "upsert", rowId: id, payload: row });
  kickSync();
}

export async function deleteTask(id: string): Promise<void> {
  await cacheDeleteTask(id);
  await discardPendingOpsFor("tasks", id);
  await enqueueOp({ table: "tasks", op: "delete", rowId: id });
  kickSync();
}

/** Undoes a just-deleted task by re-inserting the exact same row (same id
 *  and sortOrder) - used by the desktop "Undo" toast, not a general
 *  restore feature. Doesn't attempt to bring back that task's completion
 *  history, since deleteTask already discarded it locally and any
 *  server-side row was removed via cascade - acceptable for a few-seconds
 *  "oops" window right after deleting. */
export async function restoreTask(task: Task): Promise<void> {
  const row = taskRowFrom(task.id, task, task.sortOrder);
  await cacheUpsertTask(row);
  await enqueueOp({ table: "tasks", op: "upsert", rowId: task.id, payload: row });
  kickSync();
}

/** Persists a manually-dragged order via a single batched RPC call. */
export async function updateTaskOrder(taskIds: string[]): Promise<void> {
  const orderMap = new Map(taskIds.map((id, i) => [id, i]));
  for (const t of await cacheGetTasks()) {
    if (orderMap.has(t.id)) await cacheUpsertTask({ ...t, sort_order: orderMap.get(t.id)! });
  }
  await enqueueOp({ table: "rpc:reorder_tasks", op: "upsert", rowId: "-", payload: { ids: taskIds } });
  kickSync();
}

// ---------- Completions ----------

export async function getAllCompletions(): Promise<Set<string>> {
  const rows = await cacheGetCompletions();
  return new Set(rows.map((r) => `${r.task_id}:${r.date}`));
}

export async function setCompletion(
  taskId: string,
  date: string,
  completed: boolean,
): Promise<void> {
  await cacheSetCompletion(taskId, date, completed);
  const rowId = `${taskId}:${date}`;
  if (completed) {
    await enqueueOp({ table: "task_completions", op: "upsert", rowId, payload: { task_id: taskId, date } });
  } else {
    await enqueueOp({ table: "task_completions", op: "delete", rowId });
  }
  kickSync();
}

// ---------- Notes ----------

function rowToNote(row: NoteRow): DayNote {
  return {
    id: row.id,
    date: row.date,
    content: row.content,
    sortOrder: row.sort_order,
    afterGroupKey: row.after_group_key,
  };
}

export async function getAllNotes(): Promise<DayNote[]> {
  const rows = await cacheGetNotes();
  return rows.map(rowToNote);
}

export async function createNote(date: string, content: string): Promise<DayNote> {
  const row: NoteRow = {
    id: crypto.randomUUID(),
    date,
    content,
    sort_order: await cacheNextNoteSortOrder(),
    after_group_key: null,
  };
  await cacheUpsertNote(row);
  await enqueueOp({ table: "notes", op: "upsert", rowId: row.id, payload: row });
  kickSync();
  return rowToNote(row);
}

export async function updateNote(id: string, content: string): Promise<void> {
  const existing = (await cacheGetNotes()).find((n) => n.id === id);
  if (!existing) return;
  const row: NoteRow = { ...existing, content };
  await cacheUpsertNote(row);
  await enqueueOp({ table: "notes", op: "upsert", rowId: id, payload: row });
  kickSync();
}

/** Persists where each note sits relative to that day's tag groups (see
 *  DayNote.afterGroupKey) after a combined drag among notes and groups -
 *  plain per-row upserts, unlike tags/tasks' batched RPC, since each note's
 *  position is independent of every other note's, not one shared order. */
export async function updateNotePositions(
  updates: { id: string; afterGroupKey: string | null; sortOrder: number }[],
): Promise<void> {
  const existingById = new Map((await cacheGetNotes()).map((n) => [n.id, n]));
  for (const u of updates) {
    const existing = existingById.get(u.id);
    if (!existing) continue;
    const row: NoteRow = { ...existing, after_group_key: u.afterGroupKey, sort_order: u.sortOrder };
    await cacheUpsertNote(row);
    await enqueueOp({ table: "notes", op: "upsert", rowId: u.id, payload: row });
  }
  kickSync();
}

export async function deleteNote(id: string): Promise<void> {
  await cacheDeleteNote(id);
  await discardPendingOpsFor("notes", id);
  await enqueueOp({ table: "notes", op: "delete", rowId: id });
  kickSync();
}

// ---------- Settings ----------

export async function getSetting(key: string): Promise<string | null> {
  return cacheGetSetting(key);
}

export async function setSetting(key: string, value: string): Promise<void> {
  await cacheSetSetting(key, value);
  await enqueueOp({ table: "settings", op: "upsert", rowId: key, payload: { key, value } });
  kickSync();
}

// ---------- Streak freezes ----------

export async function getStreakFreezes(): Promise<Set<string>> {
  return new Set(await cacheGetStreakFreezes());
}

export async function addStreakFreeze(date: string): Promise<void> {
  await cacheAddStreakFreeze(date);
  await enqueueOp({ table: "streak_freezes", op: "upsert", rowId: date, payload: { date } });
  kickSync();
}

export async function removeStreakFreeze(date: string): Promise<void> {
  await cacheRemoveStreakFreeze(date);
  await enqueueOp({ table: "streak_freezes", op: "delete", rowId: date });
  kickSync();
}


// ---------- Export (replaces the old SQLite VACUUM INTO backup) ----------

export interface ExportedData {
  exportedAt: string;
  tags: Tag[];
  tasks: Task[];
  completions: { taskId: string; date: string }[];
  streakFreezes: string[];
  templates: (Template & { tasks: TemplateTaskBlueprint[] })[];
  notes: DayNote[];
  settings: Record<string, string>;
}

/** Pulls everything out of the local cache into one JSON-able snapshot - works offline too. */
export async function exportAllData(): Promise<ExportedData> {
  const [tags, tasks, templates, completionRows, freezeRows, notes, settingRows] =
    await Promise.all([
      getTags(),
      getAllTasks(),
      getTemplates(),
      cacheGetCompletions(),
      cacheGetStreakFreezes(),
      getAllNotes(),
      cacheGetAllSettings(),
    ]);

  const templatesWithTasks: (Template & { tasks: TemplateTaskBlueprint[] })[] = [];
  for (const t of templates) {
    const blueprints = await cacheGetTemplateTasks(t.id);
    templatesWithTasks.push({
      ...t,
      tasks: blueprints.map((b) => ({
        title: b.title,
        notes: b.notes,
        time: b.time,
        priority: b.priority as Priority,
      })),
    });
  }

  return {
    exportedAt: new Date().toISOString(),
    tags,
    tasks,
    completions: completionRows.map((r) => ({ taskId: r.task_id, date: r.date })),
    streakFreezes: freezeRows,
    templates: templatesWithTasks,
    notes,
    settings: Object.fromEntries(settingRows.map((r) => [r.key, r.value])),
  };
}

// ---------- Templates ----------

export async function getTemplates(): Promise<Template[]> {
  const rows = await cacheGetTemplates();
  return rows
    .map((r) => ({ id: r.id, name: r.name, tagId: r.tag_id, taskCount: r.task_count }))
    .sort((a, b) => a.name.localeCompare(b.name));
}

export async function getTemplateTasks(templateId: string): Promise<TemplateTaskBlueprint[]> {
  const rows = await cacheGetTemplateTasks(templateId);
  return rows.map((r) => ({
    title: r.title,
    notes: r.notes,
    time: r.time,
    priority: r.priority as Priority,
  }));
}

/**
 * Captures a tag's current tasks as a reusable, named starter pack.
 * A tag only ever has one template - re-saving it replaces its
 * blueprint tasks in place instead of piling up duplicates. The outbox
 * mirrors that as a "delete all this template's tasks" op followed by one
 * upsert per fresh blueprint task, so a partial sync never leaves stale rows.
 */
export async function createTemplateFromTasks(
  name: string,
  tagId: string | null,
  tasks: TemplateTaskBlueprint[],
): Promise<Template> {
  const existing = tagId ? await cacheFindTemplateByTagId(tagId) : null;
  const templateId = existing?.id ?? crypto.randomUUID();

  await cacheUpsertTemplate({ id: templateId, name, tag_id: tagId });
  await enqueueOp({
    table: "templates",
    op: "upsert",
    rowId: templateId,
    payload: { id: templateId, name, tag_id: tagId },
  });

  const taskRows: TemplateTaskRow[] = tasks.map((t, i) => ({
    id: crypto.randomUUID(),
    template_id: templateId,
    title: t.title,
    notes: t.notes,
    time: t.time,
    priority: t.priority,
    sort_order: i,
  }));
  await cacheReplaceTemplateTasks(templateId, taskRows);
  await enqueueOp({ table: "template_tasks", op: "delete", rowId: `template:${templateId}` });
  for (const row of taskRows) {
    await enqueueOp({ table: "template_tasks", op: "upsert", rowId: row.id, payload: row });
  }
  kickSync();

  return { id: templateId, name, tagId, taskCount: taskRows.length };
}

/** Stamps fresh, independent (non-recurring) copies of a template's tasks onto `date`. */
export async function applyTemplate(templateId: string, date: string): Promise<void> {
  const template = (await cacheGetTemplates()).find((t) => t.id === templateId);
  if (!template) return;
  const blueprints = await cacheGetTemplateTasks(templateId);
  if (blueprints.length === 0) return;

  let sortOrder = await cacheNextTaskSortOrder();
  for (const bp of blueprints) {
    const row: TaskRow = {
      id: crypto.randomUUID(),
      title: bp.title,
      notes: bp.notes,
      time: bp.time,
      tag_id: template.tag_id,
      priority: bp.priority as Priority,
      recurrence_type: "none",
      recurrence_days: null,
      start_date: date,
      end_date: null,
      sort_order: sortOrder++,
    };
    await cacheUpsertTask(row);
    await enqueueOp({ table: "tasks", op: "upsert", rowId: row.id, payload: row });
  }
  kickSync();
}

export async function deleteTemplate(id: string): Promise<void> {
  await cacheDeleteTemplate(id);
  await discardPendingOpsFor("templates", id);
  await enqueueOp({ table: "templates", op: "delete", rowId: id });
  await enqueueOp({ table: "template_tasks", op: "delete", rowId: `template:${id}` });
  kickSync();
}
