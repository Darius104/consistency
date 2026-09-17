import { supabase } from "./lib/supabaseClient";
import {
  bumpPendingOpAttempts,
  deletePendingOp,
  listPendingOps,
  replaceTable,
  type NoteRow,
  type PendingOp,
  type TagRow,
  type TaskRow,
  type TemplateTaskRow,
} from "./db/localCache";

// The network-facing half of the offline cache/outbox layer. queries.ts
// only ever talks to the local cache; this file is the only place that
// still calls Supabase directly.

const TASK_CACHE_COLUMNS = [
  "id",
  "title",
  "notes",
  "time",
  "tag_id",
  "priority",
  "recurrence_type",
  "recurrence_days",
  "start_date",
  "end_date",
  "sort_order",
] as const satisfies (keyof TaskRow)[];
const TASK_COLUMNS = TASK_CACHE_COLUMNS.join(", ");

// A row's onConflict target for an upsert - must match an existing unique
// constraint/PK exactly. Tables not listed here use the "id" PK.
const CONFLICT_TARGET: Record<string, string> = {
  settings: "user_id,key",
  streak_freezes: "user_id,date",
  task_completions: "task_id,date",
};

async function pushDelete(op: PendingOp): Promise<void> {
  if (op.table_name === "task_completions") {
    const [taskId, date] = op.row_id.split(":");
    const { error } = await supabase
      .from("task_completions")
      .delete()
      .eq("task_id", taskId)
      .eq("date", date);
    if (error) throw new Error(error.message);
    return;
  }
  if (op.table_name === "streak_freezes") {
    const { error } = await supabase.from("streak_freezes").delete().eq("date", op.row_id);
    if (error) throw new Error(error.message);
    return;
  }
  if (op.table_name === "template_tasks" && op.row_id.startsWith("template:")) {
    const templateId = op.row_id.slice("template:".length);
    const { error } = await supabase
      .from("template_tasks")
      .delete()
      .eq("template_id", templateId);
    if (error) throw new Error(error.message);
    return;
  }
  const { error } = await supabase.from(op.table_name).delete().eq("id", op.row_id);
  if (error) throw new Error(error.message);
}

async function pushOne(op: PendingOp): Promise<void> {
  if (op.table_name === "rpc:reorder_tasks") {
    const { ids } = JSON.parse(op.payload ?? "{}") as { ids: string[] };
    const { error } = await supabase.rpc("reorder_tasks", { task_ids: ids });
    if (error) throw new Error(error.message);
    return;
  }
  if (op.table_name === "rpc:reorder_tags") {
    const { ids } = JSON.parse(op.payload ?? "{}") as { ids: string[] };
    const { error } = await supabase.rpc("reorder_tags", { tag_ids: ids });
    if (error) throw new Error(error.message);
    return;
  }
  if (op.op === "delete") {
    await pushDelete(op);
    return;
  }
  const payload = JSON.parse(op.payload ?? "{}");
  const onConflict = CONFLICT_TARGET[op.table_name] ?? "id";
  const { error } = await supabase.from(op.table_name).upsert(payload, { onConflict });
  if (error) throw new Error(error.message);
}

let pushing = false;

/** Drains the outbox against Supabase in order, stopping at the first failure. */
export async function pushPendingOps(): Promise<{ pushed: number; failed: boolean }> {
  if (pushing) return { pushed: 0, failed: false };
  pushing = true;
  try {
    let pushed = 0;
    for (const op of await listPendingOps()) {
      try {
        await pushOne(op);
        await deletePendingOp(op.seq);
        pushed++;
      } catch (err) {
        console.error("[sync] push failed for op", op, err);
        await bumpPendingOpAttempts(op.seq);
        return { pushed, failed: true };
      }
    }
    return { pushed, failed: false };
  } finally {
    pushing = false;
  }
}

const PAGE_SIZE = 1000;

async function fetchAllRemote<T>(table: string, columns: string): Promise<T[]> {
  const rows: T[] = [];
  let from = 0;
  for (;;) {
    const { data, error } = await supabase.from(table).select(columns).range(from, from + PAGE_SIZE - 1);
    if (error) throw new Error(error.message);
    const page = (data ?? []) as unknown as T[];
    rows.push(...page);
    if (page.length < PAGE_SIZE) break;
    from += PAGE_SIZE;
  }
  return rows;
}

/** Overwrites the local cache with fresh data from Supabase - last-write-wins. */
export async function pullFromServer(): Promise<void> {
  const [tags, tasks, completions, freezes, templates, templateTasks, notes, settingsRows] =
    await Promise.all([
      fetchAllRemote<TagRow>("tags", "id, name, color, sort_order"),
      fetchAllRemote<TaskRow>("tasks", TASK_COLUMNS),
      fetchAllRemote<{ task_id: string; date: string }>("task_completions", "task_id, date"),
      fetchAllRemote<{ date: string }>("streak_freezes", "date"),
      fetchAllRemote<{ id: string; name: string; tag_id: string | null }>(
        "templates",
        "id, name, tag_id",
      ),
      fetchAllRemote<TemplateTaskRow>(
        "template_tasks",
        "id, template_id, title, notes, time, priority, sort_order",
      ),
      fetchAllRemote<NoteRow>("notes", "id, date, content, sort_order, after_group_key"),
      fetchAllRemote<{ key: string; value: string }>("settings", "key, value"),
    ]);

  await replaceTable("tags", ["id", "name", "color", "sort_order"], tags);
  await replaceTable("tasks", TASK_CACHE_COLUMNS, tasks);
  await replaceTable("task_completions", ["task_id", "date"], completions);
  await replaceTable("streak_freezes", ["date"], freezes);
  await replaceTable("templates", ["id", "name", "tag_id"], templates);
  await replaceTable(
    "template_tasks",
    ["id", "template_id", "title", "notes", "time", "priority", "sort_order"],
    templateTasks,
  );
  await replaceTable("notes", ["id", "date", "content", "sort_order", "after_group_key"], notes);
  await replaceTable("settings", ["key", "value"], settingsRows);
}

type SyncListener = () => void;
const listeners = new Set<SyncListener>();

/** Called after every sync that actually pulled fresh data - lets App.tsx
 *  re-read from the cache into React state without a full app restart. */
export function onSyncComplete(fn: SyncListener): () => void {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** Pushes queued writes, then pulls fresh data, in one shot. Returns whether
 *  it succeeded - a false result means we're still offline (or a real error
 *  occurred), and the outbox/cache are left exactly as they were.
 *
 *  Single-flight: App.tsx and useOnlineStatus can both call this at nearly
 *  the same moment (e.g. the instant a session becomes ready). Without this,
 *  two concurrent pulls each run their own "delete everything, reinsert" pass
 *  on the same cache tables and collide with each other's inserts.
 */
let inFlightSync: Promise<boolean> | null = null;

export async function trySync(): Promise<boolean> {
  if (inFlightSync) return inFlightSync;
  inFlightSync = (async () => {
    try {
      const { failed } = await pushPendingOps();
      if (failed) return false;
      await pullFromServer();
      listeners.forEach((fn) => fn());
      return true;
    } catch (err) {
      console.error("[sync] trySync failed", err);
      return false;
    } finally {
      inFlightSync = null;
    }
  })();
  return inFlightSync;
}
