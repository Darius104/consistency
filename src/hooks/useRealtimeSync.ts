import { useEffect } from "react";
import { supabase } from "../lib/supabaseClient";
import { trySync } from "../sync";

// Every table sync.ts's pullFromServer() reads - see supabase/realtime_setup.sql,
// which is what actually turns broadcasts on for these on the server side.
const SYNCED_TABLES = [
  "tasks",
  "tags",
  "task_completions",
  "streak_freezes",
  "templates",
  "template_tasks",
  "notes",
  "settings",
] as const;

// A burst of related writes (e.g. applying a template stamps several tasks
// at once, or a drag-reorder touches every row in a list) fires one
// postgres_changes event per row - debounced so a single user action on
// another device triggers one full re-sync here, not one per row.
const DEBOUNCE_MS = 400;

/**
 * Subscribes to Supabase Realtime (Postgres Changes) for every table this
 * app syncs, so a change made on ANY other signed-in device triggers this
 * one to pull fresh data almost immediately - on top of (not instead of)
 * the existing on-edit/on-launch/on-reconnect sync in sync.ts, which still
 * covers the same device making its own change and the offline case this
 * socket can't (no network to open it with).
 *
 * No new merge logic - an event just re-runs the same trySync() every
 * local write already kicks off, so this device converges the exact same
 * way it always has, just triggered by someone else's edit instead of its
 * own. RLS (not a client-side filter, since not every synced table is
 * confirmed to carry its own user_id column - see friends_schema.sql's
 * notes on task_completions) is what keeps this to only your own data.
 */
export function useRealtimeSync(userId: string | null): void {
  useEffect(() => {
    if (!userId) return;

    let debounceTimer: number | null = null;
    function scheduleSync() {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      debounceTimer = window.setTimeout(() => {
        debounceTimer = null;
        void trySync();
      }, DEBOUNCE_MS);
    }

    const channel = supabase.channel(`sync:${userId}`);
    for (const table of SYNCED_TABLES) {
      channel.on(
        "postgres_changes",
        { event: "*", schema: "public", table },
        scheduleSync,
      );
    }
    channel.subscribe();

    return () => {
      if (debounceTimer !== null) window.clearTimeout(debounceTimer);
      void supabase.removeChannel(channel);
    };
  }, [userId]);
}
