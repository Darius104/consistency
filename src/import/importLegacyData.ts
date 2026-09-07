import { getDb } from "../db/client";
import { supabase } from "../lib/supabaseClient";

export interface LegacyPeek {
  hasData: boolean;
  counts: { tags: number; tasks: number; completions: number };
}

/** Cheap probe used to decide whether to show the import prompt at all. */
export async function peekLegacyData(): Promise<LegacyPeek> {
  try {
    const db = await getDb();
    const [[tags], [tasks], [completions]] = await Promise.all([
      db.select<{ n: number }[]>("SELECT COUNT(*) as n FROM tags"),
      db.select<{ n: number }[]>("SELECT COUNT(*) as n FROM tasks"),
      db.select<{ n: number }[]>("SELECT COUNT(*) as n FROM task_completions"),
    ]);
    const counts = { tags: tags.n, tasks: tasks.n, completions: completions.n };
    return { hasData: counts.tasks > 0 || counts.tags > 0, counts };
  } catch {
    // No local SQLite file at all (fresh install, or already-migrated machine) - nothing to import.
    return { hasData: false, counts: { tags: 0, tasks: 0, completions: 0 } };
  }
}

async function insertInChunks<T extends object>(
  table: string,
  rows: T[],
  chunkSize = 500,
): Promise<void> {
  for (let i = 0; i < rows.length; i += chunkSize) {
    const chunk = rows.slice(i, i + chunkSize);
    if (!chunk.length) continue;
    const { error } = await supabase.from(table).insert(chunk);
    if (error) throw new Error(`Importing into ${table}: ${error.message}`);
  }
}

export interface ImportResult {
  tags: number;
  tasks: number;
  completions: number;
  freezes: number;
  templates: number;
}

/**
 * One-time migration of the local SQLite file's data into the signed-in
 * Supabase account. Never preserves original SQLite ids - every insert lets
 * Postgres assign a fresh identity value, and an in-memory id map rewrites
 * foreign keys as it goes. This matters the moment there's more than one
 * user: every local SQLite file independently starts counting from id=1,
 * so reusing those ids directly would collide across different accounts'
 * rows sharing the same identity sequence.
 */
export async function importLegacyData(
  onProgress?: (step: string) => void,
): Promise<ImportResult> {
  const db = await getDb();

  onProgress?.("Importing categories…");
  const oldTags = await db.select<{ id: number; name: string; color: string; sort_order: number }[]>(
    "SELECT id, name, color, sort_order FROM tags",
  );
  const tagIdMap = new Map<number, number>();
  for (const t of oldTags) {
    const { data, error } = await supabase
      .from("tags")
      .insert({ name: t.name, color: t.color, sort_order: t.sort_order })
      .select("id")
      .single();
    if (error) throw new Error(`Importing category "${t.name}": ${error.message}`);
    tagIdMap.set(t.id, data.id);
  }

  onProgress?.("Importing tasks…");
  const oldTasks = await db.select<
    {
      id: number;
      title: string;
      notes: string | null;
      time: string | null;
      tag_id: number | null;
      priority: string;
      recurrence_type: string;
      recurrence_days: string | null;
      start_date: string;
      end_date: string | null;
      sort_order: number;
    }[]
  >(
    `SELECT id, title, notes, time, tag_id, priority, recurrence_type, recurrence_days,
            start_date, end_date, sort_order FROM tasks`,
  );
  const taskIdMap = new Map<number, number>();
  for (const t of oldTasks) {
    const { data, error } = await supabase
      .from("tasks")
      .insert({
        title: t.title,
        notes: t.notes,
        time: t.time,
        tag_id: t.tag_id ? tagIdMap.get(t.tag_id) ?? null : null,
        priority: t.priority,
        recurrence_type: t.recurrence_type,
        recurrence_days: t.recurrence_days,
        start_date: t.start_date,
        end_date: t.end_date,
        sort_order: t.sort_order,
      })
      .select("id")
      .single();
    if (error) throw new Error(`Importing task "${t.title}": ${error.message}`);
    taskIdMap.set(t.id, data.id);
  }

  onProgress?.("Importing completion history…");
  const oldCompletions = await db.select<{ task_id: number; date: string }[]>(
    "SELECT task_id, date FROM task_completions",
  );
  const completionRows = oldCompletions
    .map((c) => ({ task_id: taskIdMap.get(c.task_id), date: c.date }))
    .filter((c): c is { task_id: number; date: string } => c.task_id !== undefined);
  await insertInChunks("task_completions", completionRows);

  onProgress?.("Importing streak freezes…");
  const oldFreezes = await db.select<{ date: string }[]>("SELECT date FROM streak_freezes");
  if (oldFreezes.length) {
    const { error } = await supabase.from("streak_freezes").insert(oldFreezes);
    if (error) throw new Error(`Importing streak freezes: ${error.message}`);
  }

  onProgress?.("Importing templates…");
  const oldTemplates = await db.select<{ id: number; name: string; tag_id: number | null }[]>(
    "SELECT id, name, tag_id FROM templates",
  );
  for (const tpl of oldTemplates) {
    const { data, error } = await supabase
      .from("templates")
      .insert({ name: tpl.name, tag_id: tpl.tag_id ? tagIdMap.get(tpl.tag_id) ?? null : null })
      .select("id")
      .single();
    if (error) throw new Error(`Importing template "${tpl.name}": ${error.message}`);

    const blueprints = await db.select<
      { title: string; notes: string | null; time: string | null; priority: string; sort_order: number }[]
    >(
      "SELECT title, notes, time, priority, sort_order FROM template_tasks WHERE template_id = $1 ORDER BY sort_order",
      [tpl.id],
    );
    if (blueprints.length) {
      const { error: taskError } = await supabase
        .from("template_tasks")
        .insert(blueprints.map((b) => ({ ...b, template_id: data.id })));
      if (taskError) throw new Error(`Importing tasks for template "${tpl.name}": ${taskError.message}`);
    }
  }

  onProgress?.("Importing preferences…");
  const oldSettings = await db.select<{ key: string; value: string }[]>(
    "SELECT key, value FROM settings",
  );
  if (oldSettings.length) {
    const { error } = await supabase
      .from("settings")
      .upsert(oldSettings, { onConflict: "user_id,key" });
    if (error) throw new Error(`Importing preferences: ${error.message}`);
  }

  return {
    tags: oldTags.length,
    tasks: oldTasks.length,
    completions: completionRows.length,
    freezes: oldFreezes.length,
    templates: oldTemplates.length,
  };
}
