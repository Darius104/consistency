import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import {
  cancel,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
} from "@tauri-apps/plugin-notification";
import type { Task } from "../types";
import { todayKey } from "../utils/dates";
import { tasksScheduledOn, upcomingReminders } from "../utils/recurrence";

// How far ahead reminders get scheduled with the OS - re-run in full every
// time tasks/completions change, so this only needs to cover a comfortable
// window, not "forever".
const REMINDER_LOOKAHEAD_DAYS = 14;

/** Deterministic (not random) 31-bit positive id from a task+date pair -
 *  Options.id must be a 32-bit int, too small to hold a task's uuid, so this
 *  is a plain hash rather than trying to encode/decode the uuid itself.
 *  FNV-1a keeps this simple and collision-resistant enough at this app's
 *  scale - nothing needs to invert it back to a task/date since there's no
 *  notification action to resolve any more. */
function reminderNotificationId(taskId: string, date: string): number {
  const str = `${taskId}:${date}`;
  let hash = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    hash ^= str.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash & 0x7fffffff;
}

// Schedule.at() sends its Date as an ISO-8601 string that the Rust side
// re-serializes (a custom formatter, not the exact string we sent) before
// handing it to iOS's Swift plugin code, which parses it back with a
// strict, hardcoded DateFormatter pattern - the two don't actually agree on
// format, so the parse fails there and the whole request is silently
// dropped (a real upstream bug: the failure never reaches JS at all, since
// the Swift throw happens after the plugin has already told JS "ok",
// racing its own completion handler). Schedule.interval() sidesteps the
// entire string round-trip: the Swift side builds the trigger directly from
// plain numeric date components, so there's no date string to parse or
// mis-format.
function scheduleForOccurrence(dateKey: string, time: string): Schedule {
  // No `year` here - the plugin's Rust struct types it as a u8 (max 255),
  // so an absolute calendar year like 2026 fails to deserialize at all
  // ("invalid value: integer `2026`, expected u8"). Not needed anyway:
  // reminders only ever look 14 days ahead, and month/day/hour/minute
  // alone already pin down one specific moment within that window.
  const [, month, day] = dateKey.split("-").map(Number);
  const [hour, minute] = time.split(":").map(Number);
  return Schedule.interval({ month, day, hour, minute }, false);
}

interface NotifyOptions {
  id: number;
  title: string;
  body?: string;
  sound?: string;
  schedule?: Schedule;
}

// The plugin's own public sendNotification() is a dead end for error
// visibility: it's a synchronous fire-and-forget wrapper (`void
// sendNotification(...)` inside the injected window.Notification shim)
// that discards whatever the real invoke() call resolves or rejects with -
// which is exactly why every scheduling failure so far was completely
// invisible. Calling the plugin's own command directly instead gives us
// the real, awaitable, catchable result.
async function notify(options: NotifyOptions): Promise<void> {
  await invoke("plugin:notification|notify", { options });
}

async function ensurePermission(): Promise<boolean> {
  let granted = await isPermissionGranted();
  if (!granted) {
    const result = await requestPermission();
    granted = result === "granted";
  }
  return granted;
}

export interface ReminderStatus {
  /** "unknown" until the first scheduling pass finishes; then reflects
   *  what actually happened, since this whole pipeline (permission check,
   *  scheduling, the native Notification shim underneath sendNotification)
   *  fails completely silently otherwise - there's nothing else that would
   *  tell you a reminder never got scheduled. */
  permission: "unknown" | "disabled" | "denied" | "granted";
  lastError: string | null;
  /** How many upcoming reminders this pass tried to schedule. */
  attemptedCount: number;
  /** How many the OS actually confirms are pending right after - re-checked
   *  with a short delay (see reschedule() below), since sendNotification()
   *  itself is synchronous/fire-and-forget and the native side registers
   *  the request asynchronously underneath it. A gap between the two counts
   *  means scheduling itself is silently failing at the plugin/native layer
   *  - not just "scheduled but not firing at the right time". */
  confirmedCount: number;
}

/**
 * Real OS-scheduled reminders (replacing what used to be a 30s poll that
 * only ever fired while the app happened to be open) - one per upcoming
 * task occurrence with a `time` set, over the next REMINDER_LOOKAHEAD_DAYS
 * days, cancelled and rescheduled from scratch whenever tasks/completions/
 * enabled change.
 *
 * `pending()`/`cancel()` only exist on mobile (they route straight to the
 * native Swift/Kotlin plugin code, bypassing Rust's command registration
 * entirely - desktop's Rust plugin only ever registers `notify`,
 * `requestPermission`, and `isPermissionGranted`). That's used here as the
 * capability probe: where `pending()` isn't available, this falls back to
 * a live poll - the same "check every 30s, fire if it's this task's moment
 * right now" approach this hook used before today's rework - since
 * desktop's `notify()` only ever fires immediately regardless of any
 * `schedule` passed to it, rather than actually scheduling ahead.
 */
export function useTaskReminders(
  tasks: Task[],
  completions: Set<string>,
  enabled: boolean,
): ReminderStatus {
  const [status, setStatus] = useState<ReminderStatus>({
    permission: "unknown",
    lastError: null,
    attemptedCount: 0,
    confirmedCount: 0,
  });

  // Only used by the desktop fallback below - kept fresh so the periodic
  // check always sees current data without needing to be in its own effect
  // dependency array (which would mean tearing down/recreating the interval
  // on every single task edit).
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const completionsRef = useRef(completions);
  completionsRef.current = completions;
  const notifiedTodayRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    let fallbackInterval: number | null = null;

    async function checkDueRightNow() {
      const today = todayKey();
      const now = new Date();
      const nowHHMM = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;
      const due = tasksScheduledOn(tasksRef.current, today).filter((t) => t.time === nowHHMM);
      for (const task of due) {
        const key = `${task.id}:${today}`;
        if (notifiedTodayRef.current.has(key)) continue;
        if (completionsRef.current.has(key)) continue;
        notifiedTodayRef.current.add(key);
        try {
          await notify({
            id: reminderNotificationId(task.id, today),
            title: task.title,
            body: task.notes || "It's time for this task.",
            sound: "default",
          });
        } catch {
          // Best-effort on this fallback path - nothing more to do with a
          // failure here than just try again next tick.
        }
      }
    }

    // This whole pipeline (permission and scheduling) fails completely
    // silently otherwise - wrapping it is the only way a real failure ever
    // becomes visible (see ReminderStatus/ReminderList in Settings).
    async function reschedule() {
      try {
        if (!enabled) {
          try {
            const owned = await pending();
            if (owned.length > 0) await cancel(owned.map((n) => n.id));
          } catch {
            // Desktop has no pending()/cancel() - nothing OS-scheduled to
            // clean up there in the first place.
          }
          if (!cancelled) {
            setStatus({ permission: "disabled", lastError: null, attemptedCount: 0, confirmedCount: 0 });
          }
          return;
        }

        const granted = await ensurePermission();
        if (cancelled) return;
        if (!granted) {
          setStatus({ permission: "denied", lastError: null, attemptedCount: 0, confirmedCount: 0 });
          return;
        }

        let owned: { id: number }[];
        try {
          owned = await pending();
        } catch {
          // This platform can't schedule ahead of time at all - fall back
          // to firing immediately the moment a task's own time arrives,
          // same as this hook's very first (pre-rework) version, and only
          // for as long as the app stays open.
          void checkDueRightNow();
          fallbackInterval = window.setInterval(checkDueRightNow, 30_000);
          if (!cancelled) {
            setStatus({ permission: "granted", lastError: null, attemptedCount: 0, confirmedCount: 0 });
          }
          return;
        }
        if (cancelled) return;

        const today = todayKey();
        const entries = upcomingReminders(tasks, completions, today, REMINDER_LOOKAHEAD_DAYS).map(
          ({ taskId, date }) => ({ notificationId: reminderNotificationId(taskId, date), taskId, date }),
        );

        if (cancelled) return;

        // Cancel everything currently scheduled (all of it is ours - this
        // hook is the only thing that ever schedules a notification) before
        // laying down the fresh batch, so an edited/deleted/completed
        // task's stale reminder never lingers.
        if (owned.length > 0) await cancel(owned.map((n) => n.id));
        if (cancelled) return;

        let firstNotifyError: string | null = null;
        for (const { notificationId, taskId, date } of entries) {
          const task = tasks.find((t) => t.id === taskId);
          if (!task) continue;
          try {
            await notify({
              id: notificationId,
              title: task.title,
              body: task.notes || "It's time for this task.",
              sound: "default",
              schedule: scheduleForOccurrence(date, task.time as string),
            });
          } catch (err) {
            firstNotifyError ??= err instanceof Error ? err.message : String(err);
          }
        }

        // Give the native side a moment to actually register each request
        // (sendNotification returns before that's necessarily done), then
        // ask the OS itself what it really has pending - this is the only
        // way to tell "scheduled but the OS silently dropped it" apart from
        // "scheduled fine, just hasn't fired yet".
        await new Promise((resolve) => setTimeout(resolve, 500));
        if (cancelled) return;
        const confirmed = await pending();
        if (!cancelled) {
          setStatus({
            permission: "granted",
            lastError: firstNotifyError,
            attemptedCount: entries.length,
            confirmedCount: confirmed.length,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setStatus((s) => ({ ...s, lastError: err instanceof Error ? err.message : String(err) }));
        }
      }
    }

    void reschedule();
    return () => {
      cancelled = true;
      if (fallbackInterval !== null) window.clearInterval(fallbackInterval);
    };
  }, [tasks, completions, enabled]);

  return status;
}
