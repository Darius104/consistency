import { useEffect, useRef, useState } from "react";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";
import {
  cancel,
  isPermissionGranted,
  pending,
  requestPermission,
  Schedule,
} from "@tauri-apps/plugin-notification";
import type { Tag, Task } from "../types";
import { addDays, todayKey } from "../utils/dates";
import { occurrenceDateTime, tasksScheduledOn, upcomingReminders } from "../utils/recurrence";
import { computeTodayStatus } from "../utils/stats";

// How far ahead reminders get scheduled with the OS - re-run in full every
// time tasks/completions change, so this only needs to cover a comfortable
// window, not "forever". Exported so ReminderList (Settings) previews
// exactly this same window instead of maintaining its own copy that could
// silently drift out of sync with what's actually scheduled.
export const REMINDER_LOOKAHEAD_DAYS = 14;

// The desktop live-poll fallback (see checkDueRightNow below) used to
// require the task's time to equal the *exact current minute* - if a
// background/unfocused window got its setInterval throttled (WebKit does
// this routinely for non-frontmost windows), or the Mac briefly slept
// through the tick, that exact minute was gone forever and the reminder
// silently never fired, with no way to tell it had been missed. Matching
// against this trailing window instead means a late-arriving tick still
// catches anything that became due within the last few minutes. Only
// relevant now on platforms that fall all the way through to this (see
// isNativeMacOS below) - real macOS installs no longer need it at all.
const LIVE_POLL_GRACE_MS = 5 * 60 * 1000;

// One extra, non-task-specific reminder a day: a nudge that today still has
// unfinished tasks, timed to land while there's still enough evening left to
// act on it. Reusing computeTodayStatus (the same source the streak card
// itself reads) means "nothing scheduled", "already done" and "already
// frozen" all correctly suppress it without duplicating that logic here.
export const END_OF_DAY_REMINDER_TIME = "21:00";

// How many days ahead the evening nudge is armed - so it still arrives on
// a day you never open the app (exactly when it's most useful), and gets
// cancelled as soon as that day is done or frozen.
const END_OF_DAY_LOOKAHEAD_DAYS = 7;

// iOS (and macOS) keep only the soonest 64 pending notifications per app and
// silently drop the rest - so only the soonest this-many are handed over;
// later ones get scheduled as earlier ones pass. A little under 64 for slack.
const MAX_SCHEDULED = 60;

function endOfDayNudgeContent(remaining: number | null): { title: string; body: string } {
  // Today's count is known; a future day's isn't (it can still change by
  // then), so those get a count-free line.
  if (remaining === null) {
    return { title: "Day's almost over", body: "Finish today's tasks to keep your streak alive." };
  }
  const noun = remaining === 1 ? "task" : "tasks";
  return {
    title: "Day's almost over",
    body: `${remaining} ${noun} left today to keep the streak alive.`,
  };
}

/** Deterministic (not random) 31-bit positive id from a task+date pair -
 *  Options.id must be a 32-bit int, too small to hold a task's uuid, so this
 *  is a plain hash rather than trying to encode/decode the uuid itself.
 *  FNV-1a keeps this simple and collision-resistant enough at this app's
 *  scale - nothing needs to invert it back to a task/date since there's no
 *  notification action to resolve any more. Only used by the mobile/
 *  live-poll paths below - the native macOS path (see native_notifications.rs)
 *  uses "<taskId>:<date>" directly, since UNNotificationRequest identifiers
 *  are strings natively and don't need to fit in a 32-bit int. */
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
  /** True when this platform has no real OS-level scheduling at all (not
   *  macOS, and no pending()/cancel() from tauri-plugin-notification either)
   *  and is instead using the live 30s-poll fallback - attemptedCount/
   *  confirmedCount are always 0 here since nothing is ever actually handed
   *  to the OS to confirm, so callers need this to show a
   *  fallback-appropriate message instead of a literal "0 reminders
   *  confirmed" that reads like a failure. */
  usesLiveFallback: boolean;
}

/** One reminder the OS should have pending. `key` is stable per task+day
 *  (or nudge+day) so a pass can tell what's already scheduled. */
interface DesiredReminder {
  key: string;
  date: string;
  time: string;
  title: string;
  body: string;
  /** Fire time, for ordering/capping. */
  at: number;
}

/** Everything that should be scheduled right now: each timed task
 *  occurrence over the lookahead window, plus the evening nudge for every
 *  upcoming day that has tasks and isn't done or frozen - soonest first,
 *  capped at MAX_SCHEDULED. */
function desiredReminders(
  tasks: Task[],
  tags: Tag[],
  completions: Set<string>,
  freezes: Set<string>,
): DesiredReminder[] {
  const today = todayKey();
  const now = Date.now();
  const tagName = new Map(tags.map((t) => [t.id, t.name]));
  const out: DesiredReminder[] = [];

  for (const { taskId, date } of upcomingReminders(tasks, completions, today, REMINDER_LOOKAHEAD_DAYS)) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task?.time) continue;
    const group = task.tagId ? tagName.get(task.tagId) : undefined;
    out.push({
      key: `${taskId}:${date}`,
      date,
      time: task.time,
      // "Morning routine · Drink water" - says which group it belongs to.
      title: group ? `${group} · ${task.title}` : task.title,
      body: task.notes || `Scheduled for ${task.time}`,
      at: occurrenceDateTime(date, task.time).getTime(),
    });
  }

  for (let i = 0; i < END_OF_DAY_LOOKAHEAD_DAYS; i++) {
    const date = addDays(today, i);
    const at = occurrenceDateTime(date, END_OF_DAY_REMINDER_TIME).getTime();
    if (at <= now) continue;
    const status = computeTodayStatus(tasks, completions, freezes, date);
    if (!status.hasTasks || status.allDone || status.frozen) continue;
    const content = endOfDayNudgeContent(i === 0 ? status.remaining : null);
    out.push({ key: `eod:${date}`, date, time: END_OF_DAY_REMINDER_TIME, ...content, at });
  }

  return out
    .filter((r) => r.at > now)
    .sort((a, b) => a.at - b.at)
    .slice(0, MAX_SCHEDULED);
}

/** What a reminder looks like, so an edited title/time/note is re-sent
 *  even though its key didn't change. */
function signature(r: DesiredReminder): string {
  return `${r.date} ${r.time}|${r.title}|${r.body}`;
}

/**
 * Real OS-scheduled reminders - one per upcoming timed task occurrence over
 * the next REMINDER_LOOKAHEAD_DAYS days, plus the evening "day's almost
 * over" nudge (END_OF_DAY_REMINDER_TIME) for each upcoming day that still
 * has something left - recomputed whenever tasks/completions/freezes/enabled
 * change, and whenever the app comes back to the foreground.
 *
 * Each pass compares what should be scheduled with what the OS has pending
 * and only adds/removes the difference. Passes never overlap: a change that
 * arrives mid-pass just queues one more pass with the latest data - two
 * overlapping passes could otherwise finish out of order and put back a
 * reminder for a task that was just ticked off.
 *
 * Three platform paths:
 * 1. macOS: real scheduling via UNUserNotificationCenter, invoked directly
 *    (see native_notifications.rs) - tauri-plugin-notification's own
 *    desktop backend silently ignores any `schedule` and fires immediately.
 *    Uses calendar (wall-clock) triggers, so daylight saving can't shift it.
 * 2. Mobile (iOS/Android): the plugin's own real scheduling, via
 *    `pending()`/`cancel()` - these only exist on mobile.
 * 3. Anything else (Windows/Linux desktop): a live 30s poll that fires the
 *    moment a task's time arrives, only while the app is open.
 */
export function useTaskReminders(
  tasks: Task[],
  tags: Tag[],
  completions: Set<string>,
  freezes: Set<string>,
  enabled: boolean,
): ReminderStatus {
  const [status, setStatus] = useState<ReminderStatus>({
    permission: "unknown",
    lastError: null,
    attemptedCount: 0,
    confirmedCount: 0,
    usesLiveFallback: false,
  });

  // Latest inputs, read by each pass when it starts (passes are queued, so
  // they must always work from current data, not what was current when
  // they were requested).
  const tasksRef = useRef(tasks);
  tasksRef.current = tasks;
  const tagsRef = useRef(tags);
  tagsRef.current = tags;
  const completionsRef = useRef(completions);
  completionsRef.current = completions;
  const freezesRef = useRef(freezes);
  freezesRef.current = freezes;
  const enabledRef = useRef(enabled);
  enabledRef.current = enabled;

  // What this app session last handed to the OS, per key - lets a pass skip
  // reminders that are already pending unchanged. Empty at launch, so the
  // first pass replaces whatever an older version left behind.
  const scheduledRef = useRef<Map<string, string>>(new Map());
  const runningRef = useRef(false);
  const rerunRef = useRef(false);
  const unmountedRef = useRef(false);
  const fallbackIntervalRef = useRef<number | null>(null);
  const notifiedTodayRef = useRef<Set<string>>(new Set());
  const eodNotifiedDateRef = useRef<string | null>(null);

  const passRef = useRef<() => Promise<void>>(async () => {});

  passRef.current = async function pass() {
    const tasks = tasksRef.current;
    const tags = tagsRef.current;
    const completions = completionsRef.current;
    const freezes = freezesRef.current;
    const enabled = enabledRef.current;

    async function checkDueRightNow() {
      const today = todayKey();
      const now = new Date();
      const due = tasksScheduledOn(tasksRef.current, today).filter((t) => {
        if (!t.time) return false;
        const [hour, minute] = t.time.split(":").map(Number);
        const dueAt = new Date(now);
        dueAt.setHours(hour, minute, 0, 0);
        const msSinceDue = now.getTime() - dueAt.getTime();
        return msSinceDue >= 0 && msSinceDue <= LIVE_POLL_GRACE_MS;
      });
      for (const task of due) {
        const key = `${task.id}:${today}`;
        if (notifiedTodayRef.current.has(key)) continue;
        if (completionsRef.current.has(key)) continue;
        notifiedTodayRef.current.add(key);
        try {
          await notify({
            id: reminderNotificationId(task.id, today),
            title: task.title,
            body: task.notes || `Scheduled for ${task.time}`,
            sound: "default",
          });
        } catch {
          // Best-effort on this fallback path - try again next tick.
        }
      }
    }

    async function checkEndOfDayNudge() {
      const today = todayKey();
      if (eodNotifiedDateRef.current === today) return;
      if (new Date() < occurrenceDateTime(today, END_OF_DAY_REMINDER_TIME)) return;
      const st = computeTodayStatus(tasksRef.current, completionsRef.current, freezesRef.current, today);
      if (!st.hasTasks || st.allDone || st.frozen) return;
      eodNotifiedDateRef.current = today;
      try {
        const content = endOfDayNudgeContent(st.remaining);
        await notify({ id: reminderNotificationId("eod", today), ...content, sound: "default" });
      } catch {
        // Best-effort, same as checkDueRightNow above.
      }
    }

    const isNativeMacOS = await invoke<boolean>("native_notifications_available").catch(() => false);

    if (!enabled) {
      if (fallbackIntervalRef.current !== null) {
        window.clearInterval(fallbackIntervalRef.current);
        fallbackIntervalRef.current = null;
      }
      if (isNativeMacOS) {
        const ids = await invoke<string[]>("native_pending_notification_ids");
        if (ids.length > 0) await invoke("native_cancel_notifications", { ids });
      } else {
        try {
          const owned = await pending();
          if (owned.length > 0) await cancel(owned.map((n) => n.id));
        } catch {
          // Desktop (non-macOS) has nothing OS-scheduled to clean up.
        }
      }
      scheduledRef.current.clear();
      setStatus({
        permission: "disabled",
        lastError: null,
        attemptedCount: 0,
        confirmedCount: 0,
        usesLiveFallback: false,
      });
      return;
    }

    const desired = desiredReminders(tasks, tags, completions, freezes);
    const desiredByKey = new Map(desired.map((r) => [r.key, r]));
    let firstError: string | null = null;
    const noteError = (err: unknown) => {
      firstError ??= err instanceof Error ? err.message : String(err);
    };

    if (isNativeMacOS) {
      const granted = await invoke<boolean>("native_request_permission");
      if (!granted) {
        setStatus({
          permission: "denied",
          lastError: null,
          attemptedCount: 0,
          confirmedCount: 0,
          usesLiveFallback: false,
        });
        return;
      }

      // Remove what's pending but no longer wanted (done, deleted, moved,
      // or changed - a changed one is re-added below).
      const pendingIds = await invoke<string[]>("native_pending_notification_ids");
      const stale = pendingIds.filter((id) => {
        const want = desiredByKey.get(id);
        return !want || scheduledRef.current.get(id) !== signature(want);
      });
      if (stale.length > 0) await invoke("native_cancel_notifications", { ids: stale });
      for (const id of stale) scheduledRef.current.delete(id);
      const stillPending = new Set(pendingIds.filter((id) => !stale.includes(id)));

      for (const r of desired) {
        if (stillPending.has(r.key)) continue;
        const [year, month, day] = r.date.split("-").map(Number);
        const [hour, minute] = r.time.split(":").map(Number);
        try {
          await invoke("native_schedule_notification_at", {
            id: r.key,
            title: r.title,
            body: r.body,
            year,
            month,
            day,
            hour,
            minute,
          });
          scheduledRef.current.set(r.key, signature(r));
        } catch (err) {
          noteError(err);
        }
      }

      // Scheduling is fire-and-forget natively - ask the OS what it really
      // has, to tell "dropped" apart from "scheduled, not fired yet".
      await new Promise((resolve) => setTimeout(resolve, 500));
      const confirmedIds = await invoke<string[]>("native_pending_notification_ids");
      setStatus({
        permission: "granted",
        lastError: firstError,
        attemptedCount: desired.length,
        confirmedCount: confirmedIds.length,
        usesLiveFallback: false,
      });
      return;
    }

    const granted = await ensurePermission();
    if (!granted) {
      setStatus({
        permission: "denied",
        lastError: null,
        attemptedCount: 0,
        confirmedCount: 0,
        usesLiveFallback: false,
      });
      return;
    }

    let owned: { id: number }[];
    try {
      owned = await pending();
    } catch {
      // This platform can't schedule ahead at all - fire live instead, only
      // while the app is open.
      void checkDueRightNow();
      void checkEndOfDayNudge();
      if (fallbackIntervalRef.current === null) {
        fallbackIntervalRef.current = window.setInterval(() => {
          void checkDueRightNow();
          void checkEndOfDayNudge();
        }, 30_000);
      }
      setStatus({
        permission: "granted",
        lastError: null,
        attemptedCount: 0,
        confirmedCount: 0,
        usesLiveFallback: true,
      });
      return;
    }

    // Mobile ids are numbers (hashed from the key) - same diff as macOS.
    const idFor = (key: string) => {
      const [first, ...rest] = key.split(":");
      return reminderNotificationId(first, rest.join(":"));
    };
    const desiredById = new Map(desired.map((r) => [idFor(r.key), r]));
    const staleIds = owned
      .map((n) => n.id)
      .filter((id) => {
        const want = desiredById.get(id);
        return !want || scheduledRef.current.get(want.key) !== signature(want);
      });
    if (staleIds.length > 0) await cancel(staleIds);
    const stillPending = new Set(owned.map((n) => n.id).filter((id) => !staleIds.includes(id)));

    for (const r of desired) {
      const id = idFor(r.key);
      if (stillPending.has(id)) continue;
      try {
        await notify({
          id,
          title: r.title,
          body: r.body,
          sound: "default",
          schedule: scheduleForOccurrence(r.date, r.time),
        });
        scheduledRef.current.set(r.key, signature(r));
      } catch (err) {
        noteError(err);
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 500));
    const confirmed = await pending();
    setStatus({
      permission: "granted",
      lastError: firstError,
      attemptedCount: desired.length,
      confirmedCount: confirmed.length,
      usesLiveFallback: false,
    });
  };

  // One pass at a time; anything requested meanwhile collapses into a single
  // follow-up pass with the latest data.
  const runPass = useRef(async () => {
    if (runningRef.current) {
      rerunRef.current = true;
      return;
    }
    runningRef.current = true;
    try {
      do {
        rerunRef.current = false;
        try {
          await passRef.current();
        } catch (err) {
          if (!unmountedRef.current) {
            setStatus((st) => ({ ...st, lastError: err instanceof Error ? err.message : String(err) }));
          }
        }
      } while (rerunRef.current && !unmountedRef.current);
    } finally {
      runningRef.current = false;
    }
  }).current;

  useEffect(() => {
    void runPass();
  }, [tasks, tags, completions, freezes, enabled, runPass]);

  useEffect(() => {
    // Things only noticed when the app comes back: a new day (tomorrow's
    // reminders and nudge need arming), or notification permission changed
    // in System Settings. Window focus covers the Mac; the page becoming
    // visible again covers the iPhone, where window focus doesn't fire.
    unmountedRef.current = false;
    const unlistenFocus = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void runPass();
    });
    const onVisible = () => {
      if (document.visibilityState === "visible") void runPass();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      unmountedRef.current = true;
      document.removeEventListener("visibilitychange", onVisible);
      if (fallbackIntervalRef.current !== null) window.clearInterval(fallbackIntervalRef.current);
      // Tauri's unlisten can throw ("listeners[eventId].handlerId") if the
      // listener's already gone, e.g. after a webview reload - harmless,
      // but uncaught it surfaced as WriteErrorToast's "didn't save".
      unlistenFocus.then((unlisten) => unlisten()).catch(() => {});
    };
  }, [runPass]);

  return status;
}
