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

// Past this many failed attempts, an op is treated as permanently stuck
// (a schema mismatch, a payload that will never validate, ...) rather than
// a transient network blip.
const MAX_PUSH_ATTEMPTS = 5;

/** Drains the outbox against Supabase in order, stopping at the first
 *  failure - *unless* that op has already failed MAX_PUSH_ATTEMPTS times
 *  and no other queued op touches the same row, in which case it's skipped
 *  instead of blocking everything queued after it. Without the skip, one
 *  permanently-unpushable op (nothing about retrying it can ever succeed)
 *  would silently stall every future sync forever, hiding every other
 *  pending change from ever reaching the server. It stays in the outbox
 *  either way - a stuck op is never just discarded, only skipped once it's
 *  proven itself not worth blocking on. The same-row check keeps strict
 *  ordering wherever skipping ahead could actually desync a later op (e.g.
 *  an update trying to reach the server before that row's own insert). */
export async function pushPendingOps(): Promise<{ pushed: number; failed: boolean }> {
  if (pushing) return { pushed: 0, failed: false };
  pushing = true;
  try {
    const ops = await listPendingOps();
    let pushed = 0;
    for (const op of ops) {
      try {
        await pushOne(op);
        await deletePendingOp(op.seq);
        pushed++;
      } catch (err) {
        console.error("[sync] push failed for op", op, err);
        await bumpPendingOpAttempts(op.seq);
        const attemptsNow = op.attempts + 1;
        const sameRowElsewhere = ops.some(
          (other) =>
            other.seq !== op.seq && other.table_name === op.table_name && other.row_id === op.row_id,
        );
        if (attemptsNow >= MAX_PUSH_ATTEMPTS && !sameRowElsewhere) {
          console.error(
            `[sync] giving up on op ${op.seq} (${op.table_name}/${op.op} on ${op.row_id}) after ${attemptsNow} attempts - skipping it so the rest of the outbox isn't stuck behind it`,
          );
          continue;
        }
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

  // Each table is upserted-then-pruned (see replaceTable's own comment for
  // why this isn't wrapped in a transaction) - a failure partway through
  // any one of these leaves that table's already-processed rows correct,
  // never missing.
  await replaceTable("tags", ["id", "name", "color", "sort_order"], tags, ["id"]);
  await replaceTable("tasks", TASK_CACHE_COLUMNS, tasks, ["id"]);
  await replaceTable("task_completions", ["task_id", "date"], completions, ["task_id", "date"]);
  await replaceTable("streak_freezes", ["date"], freezes, ["date"]);
  await replaceTable("templates", ["id", "name", "tag_id"], templates, ["id"]);
  await replaceTable(
    "template_tasks",
    ["id", "template_id", "title", "notes", "time", "priority", "sort_order"],
    templateTasks,
    ["id"],
  );
  await replaceTable(
    "notes",
    ["id", "date", "content", "sort_order", "after_group_key"],
    notes,
    ["id"],
  );
  await replaceTable("settings", ["key", "value"], settingsRows, ["key"]);
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
