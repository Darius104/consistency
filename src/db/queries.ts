import { supabase } from "../lib/supabaseClient";
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

const TASK_COLUMNS =
  "id, title, notes, time, tag_id, priority, recurrence_type, recurrence_days, start_date, end_date, sort_order";

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

function checkError(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

// Every table has a `user_id` column defaulting to auth.uid() server-side,
// and RLS scopes every select/insert/update/delete to the signed-in user -
// no function here needs to pass or filter on user_id explicitly.

// ---------- Tags ----------

export async function getTags(): Promise<Tag[]> {
  const { data, error } = await supabase
    .from("tags")
    .select("id, name, color, sortOrder:sort_order")
    .order("sort_order", { ascending: true })
    .order("name", { ascending: true });
  checkError(error);
  return (data ?? []) as unknown as Tag[];
}

export async function createTag(name: string, color: string): Promise<Tag> {
  // sort_order is left for the tags_set_sort_order trigger to assign.
  const { data, error } = await supabase
    .from("tags")
    .insert({ name, color })
    .select("id, name, color, sortOrder:sort_order")
    .single();
  checkError(error);
  return data as unknown as Tag;
}

export async function updateTag(
  id: number,
  name: string,
  color: string,
): Promise<void> {
  const { error } = await supabase.from("tags").update({ name, color }).eq("id", id);
  checkError(error);
}

/** Persists a manually-dragged tag group order via a single batched RPC call. */
export async function updateTagOrder(tagIds: number[]): Promise<void> {
  const { error } = await supabase.rpc("reorder_tags", { tag_ids: tagIds });
  checkError(error);
}

export async function deleteTag(id: number): Promise<void> {
  const { error } = await supabase.from("tags").delete().eq("id", id);
  checkError(error);
}

// ---------- Tasks ----------

export async function getAllTasks(): Promise<Task[]> {
  const rows = await fetchAllRows<TaskRow>("tasks", TASK_COLUMNS);
  return rows.map(rowToTask);
}

export async function createTask(task: NewTask): Promise<Task> {
  const recurrenceDays = task.recurrenceDays?.length
    ? task.recurrenceDays.join(",")
    : null;
  const { data, error } = await supabase
    .from("tasks")
    .insert({
      title: task.title,
      notes: task.notes ?? null,
      time: task.time ?? null,
      tag_id: task.tagId ?? null,
      priority: task.priority,
      recurrence_type: task.recurrenceType,
      recurrence_days: recurrenceDays,
      start_date: task.startDate,
      end_date: task.endDate ?? null,
      // sort_order intentionally omitted - the tasks_set_sort_order trigger assigns it
    })
    .select(TASK_COLUMNS)
    .single();
  checkError(error);
  return rowToTask(data as TaskRow);
}

export async function updateTask(
  id: number,
  task: NewTask,
): Promise<void> {
  const recurrenceDays = task.recurrenceDays?.length
    ? task.recurrenceDays.join(",")
    : null;
  const { error } = await supabase
    .from("tasks")
    .update({
      title: task.title,
      notes: task.notes ?? null,
      time: task.time ?? null,
      tag_id: task.tagId ?? null,
      priority: task.priority,
      recurrence_type: task.recurrenceType,
      recurrence_days: recurrenceDays,
      start_date: task.startDate,
      end_date: task.endDate ?? null,
    })
    .eq("id", id);
  checkError(error);
}

export async function deleteTask(id: number): Promise<void> {
  const { error } = await supabase.from("tasks").delete().eq("id", id);
  checkError(error);
}

/** Persists a manually-dragged order via a single batched RPC call. */
export async function updateTaskOrder(taskIds: number[]): Promise<void> {
  const { error } = await supabase.rpc("reorder_tasks", { task_ids: taskIds });
  checkError(error);
}

// ---------- Completions ----------

// PostgREST caps a single response at 1000 rows by default - a personal
// dataset (~10 tasks/day) crosses that within 3-4 months, so this pages
// through the full table instead of assuming one request is enough.
const PAGE_SIZE = 1000;

async function fetchAllRows<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase
      .from(table)
      .select(columns)
      .range(from, from + PAGE_SIZE - 1);
    checkError(error);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

export async function getAllCompletions(): Promise<Set<string>> {
  const rows = await fetchAllRows<{ task_id: number; date: string }>(
    "task_completions",
    "task_id, date",
  );
  return new Set(rows.map((r) => `${r.task_id}:${r.date}`));
}

export async function setCompletion(
  taskId: number,
  date: string,
  completed: boolean,
): Promise<void> {
  if (completed) {
    const { error } = await supabase
      .from("task_completions")
      .upsert({ task_id: taskId, date }, { onConflict: "task_id,date", ignoreDuplicates: true });
    checkError(error);
  } else {
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("task_id", taskId)
      .eq("date", date);
    checkError(error);
  }
}

// ---------- Settings ----------

export async function getSetting(key: string): Promise<string | null> {
  const { data, error } = await supabase
    .from("settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  checkError(error);
  return data?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const { error } = await supabase
    .from("settings")
    .upsert({ key, value }, { onConflict: "user_id,key" });
  checkError(error);
}

// ---------- Streak freezes ----------

export async function getStreakFreezes(): Promise<Set<string>> {
  const rows = await fetchAllRows<{ date: string }>("streak_freezes", "date");
  return new Set(rows.map((r) => r.date));
}

export async function addStreakFreeze(date: string): Promise<void> {
  const { error } = await supabase
    .from("streak_freezes")
    .upsert({ date }, { onConflict: "user_id,date", ignoreDuplicates: true });
  checkError(error);
}

export async function removeStreakFreeze(date: string): Promise<void> {
  const { error } = await supabase.from("streak_freezes").delete().eq("date", date);
  checkError(error);
}

// ---------- Export (replaces the old SQLite VACUUM INTO backup) ----------

export interface ExportedData {
  exportedAt: string;
  tags: Tag[];
  tasks: Task[];
  completions: { taskId: number; date: string }[];
  streakFreezes: string[];
  templates: (Template & { tasks: TemplateTaskBlueprint[] })[];
  settings: Record<string, string>;
}

/** Pulls every row the signed-in user owns (RLS-scoped) into one JSON-able snapshot. */
export async function exportAllData(): Promise<ExportedData> {
  const [tags, tasks, templates] = await Promise.all([getTags(), getAllTasks(), getTemplates()]);

  const [completionRows, freezeRows, settingRows] = await Promise.all([
    fetchAllRows<{ task_id: number; date: string }>("task_completions", "task_id, date"),
    fetchAllRows<{ date: string }>("streak_freezes", "date"),
    fetchAllRows<{ key: string; value: string }>("settings", "key, value"),
  ]);

  const templatesWithTasks: (Template & { tasks: TemplateTaskBlueprint[] })[] = [];
  for (const t of templates) {
    const { data: blueprints, error } = await supabase
      .from("template_tasks")
      .select("title, notes, time, priority")
      .eq("template_id", t.id)
      .order("sort_order", { ascending: true });
    checkError(error);
    templatesWithTasks.push({ ...t, tasks: (blueprints ?? []) as TemplateTaskBlueprint[] });
  }

  return {
    exportedAt: new Date().toISOString(),
    tags,
    tasks,
    completions: completionRows.map((r) => ({ taskId: r.task_id, date: r.date })),
    streakFreezes: freezeRows.map((r) => r.date),
    templates: templatesWithTasks,
    settings: Object.fromEntries(settingRows.map((r) => [r.key, r.value])),
  };
}

// ---------- Templates ----------

interface TemplateRow {
  id: number;
  name: string;
  tag_id: number | null;
  template_tasks: { count: number }[];
}

export async function getTemplates(): Promise<Template[]> {
  const { data, error } = await supabase
    .from("templates")
    .select("id, name, tag_id, template_tasks(count)")
    .order("name", { ascending: true });
  checkError(error);
  return ((data ?? []) as unknown as TemplateRow[]).map((row) => ({
    id: row.id,
    name: row.name,
    tagId: row.tag_id,
    taskCount: row.template_tasks[0]?.count ?? 0,
  }));
}

/**
 * Captures a category's current tasks as a reusable, named starter pack.
 * A category only ever has one template - re-saving it replaces its
 * blueprint tasks in place instead of piling up duplicates.
 */
export async function createTemplateFromTasks(
  name: string,
  tagId: number | null,
  tasks: TemplateTaskBlueprint[],
): Promise<Template> {
  let templateId: number;

  if (tagId) {
    const { data: existing, error } = await supabase
      .from("templates")
      .select("id")
      .eq("tag_id", tagId)
      .maybeSingle();
    checkError(error);
    if (existing) {
      templateId = existing.id;
      const { error: deleteError } = await supabase
        .from("template_tasks")
        .delete()
        .eq("template_id", templateId);
      checkError(deleteError);
    } else {
      const { data: created, error: insertError } = await supabase
        .from("templates")
        .insert({ name, tag_id: tagId })
        .select("id")
        .single();
      checkError(insertError);
      templateId = created!.id;
    }
  } else {
    const { data: created, error: insertError } = await supabase
      .from("templates")
      .insert({ name, tag_id: null })
      .select("id")
      .single();
    checkError(insertError);
    templateId = created!.id;
  }

  if (tasks.length > 0) {
    const rows = tasks.map((t, i) => ({
      template_id: templateId,
      title: t.title,
      notes: t.notes,
      time: t.time,
      priority: t.priority,
      sort_order: i,
    }));
    const { error: tasksError } = await supabase.from("template_tasks").insert(rows);
    checkError(tasksError);
  }

  const { data: row, error: selectError } = await supabase
    .from("templates")
    .select("id, name, tag_id, template_tasks(count)")
    .eq("id", templateId)
    .single();
  checkError(selectError);
  const typedRow = row as unknown as TemplateRow;
  return {
    id: typedRow.id,
    name: typedRow.name,
    tagId: typedRow.tag_id,
    taskCount: typedRow.template_tasks[0]?.count ?? 0,
  };
}

/** Stamps fresh, independent (non-recurring) copies of a template's tasks onto `date`. */
export async function applyTemplate(templateId: number, date: string): Promise<void> {
  const { data: template, error: templateError } = await supabase
    .from("templates")
    .select("tag_id")
    .eq("id", templateId)
    .maybeSingle();
  checkError(templateError);
  if (!template) return;

  const { data: blueprints, error: blueprintError } = await supabase
    .from("template_tasks")
    .select("title, notes, time, priority")
    .eq("template_id", templateId)
    .order("sort_order", { ascending: true });
  checkError(blueprintError);
  if (!blueprints || blueprints.length === 0) return;

  // One bulk insert instead of N sequential createTask() round trips - the
  // sort_order trigger still fires correctly per row inside a multi-row insert.
  const rows = blueprints.map((bp) => ({
    title: bp.title,
    notes: bp.notes,
    time: bp.time,
    tag_id: template.tag_id,
    priority: bp.priority,
    recurrence_type: "none" as const,
    recurrence_days: null,
    start_date: date,
    end_date: null,
  }));
  const { error: insertError } = await supabase.from("tasks").insert(rows);
  checkError(insertError);
}

export async function deleteTemplate(id: number): Promise<void> {
  const { error } = await supabase.from("templates").delete().eq("id", id);
  checkError(error);
}
