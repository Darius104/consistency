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
import type { Task } from "../types";
import { todayKey } from "../utils/dates";
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

function endOfDayNudgeContent(remaining: number): { title: string; body: string } {
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

/**
 * Real OS-scheduled reminders - one per upcoming task occurrence with a
 * `time` set, over the next REMINDER_LOOKAHEAD_DAYS days, plus one
 * additional end-of-day nudge for *today only* (see END_OF_DAY_REMINDER_TIME)
 * when today still has incomplete tasks - all cancelled and rescheduled from
 * scratch whenever tasks/completions/freezes/enabled change. The nudge can
 * only ever cover today, not the lookahead window, since whether a future
 * day ends up incomplete isn't knowable ahead of time the way a task's own
 * scheduled occurrences are.
 *
 * Three platform paths, tried in order:
 * 1. macOS: real scheduling via UNUserNotificationCenter, invoked directly
 *    (see native_notifications.rs) - tauri-plugin-notification's own
 *    desktop backend silently ignores any `schedule` passed to it and just
 *    fires immediately, so this bypasses it entirely on this one platform.
 * 2. Mobile (iOS/Android): the plugin's own real scheduling, via
 *    `pending()`/`cancel()` - these only exist on mobile (they route
 *    straight to the native Swift/Kotlin plugin code, bypassing Rust's
 *    command registration entirely).
 * 3. Anything else (Windows/Linux desktop): the live poll this hook used
 *    before real scheduling existed at all - `notify()` only ever fires
 *    immediately there regardless of any `schedule` passed to it, so the
 *    best this can do is check every 30s and fire the moment a task's own
 *    time arrives, only for as long as the app stays open.
 */
export function useTaskReminders(
  tasks: Task[],
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

  // Only used by the live-poll fallback below - kept fresh so the periodic
  // check always sees current data without needing to be in its own effect
  // dependency array (which would mean tearing down/recreating the interval
  // on every single task edit).
  const tasksRef = useRef(tasks);
  // The latest reschedule() from the main effect below - lets the window
  // focus listener be registered once for the hook's whole lifetime instead
  // of being torn down and re-added on every task/completion change.
  const rescheduleRef = useRef<(() => Promise<void>) | null>(null);
  tasksRef.current = tasks;
  const completionsRef = useRef(completions);
  completionsRef.current = completions;
  const freezesRef = useRef(freezes);
  freezesRef.current = freezes;
  const notifiedTodayRef = useRef<Set<string>>(new Set());
  // Only the live-poll fallback needs this - the OS-scheduled paths below
  // naturally stop re-sending once the target time is in the past (see
  // eodEligible's own secondsFromNow > 0 check), but a 30s poll would
  // otherwise fire again on every tick for the rest of the day.
  const eodNotifiedDateRef = useRef<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    let fallbackInterval: number | null = null;

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
            body: task.notes || "It's time for this task.",
            sound: "default",
          });
        } catch {
          // Best-effort on this fallback path - nothing more to do with a
          // failure here than just try again next tick.
        }
      }
    }

    async function checkEndOfDayNudge() {
      const today = todayKey();
      if (eodNotifiedDateRef.current === today) return;
      if (new Date() < occurrenceDateTime(today, END_OF_DAY_REMINDER_TIME)) return;
      const status = computeTodayStatus(
        tasksRef.current,
        completionsRef.current,
        freezesRef.current,
        today,
      );
      if (!status.hasTasks || status.allDone || status.frozen) return;
      eodNotifiedDateRef.current = today;
      try {
        const content = endOfDayNudgeContent(status.remaining);
        await notify({
          id: reminderNotificationId("eod", today),
          title: content.title,
          body: content.body,
          sound: "default",
        });
      } catch {
        // Best-effort, same as checkDueRightNow above.
      }
    }

    // This whole pipeline (permission and scheduling) fails completely
    // silently otherwise - wrapping it is the only way a real failure ever
    // becomes visible (see ReminderStatus/ReminderList in Settings).
    async function reschedule() {
      try {
        const isNativeMacOS = await invoke<boolean>("native_notifications_available").catch(
          () => false,
        );

        // Computed once up front and shared by both OS-scheduled branches
        // below - re-derived from scratch on every pass (same as the
        // per-task entries), so a task getting completed/added/deleted
        // immediately cancels or reschedules this along with everything
        // else, and it naturally stops re-arming for today once the target
        // time itself is already in the past.
        const eodToday = todayKey();
        const eodStatusNow = computeTodayStatus(tasks, completions, freezes, eodToday);
        const eodSecondsFromNow =
          (occurrenceDateTime(eodToday, END_OF_DAY_REMINDER_TIME).getTime() - Date.now()) / 1000;
        const eodEligible =
          eodStatusNow.hasTasks &&
          !eodStatusNow.allDone &&
          !eodStatusNow.frozen &&
          eodSecondsFromNow > 0;
        const eodContent = endOfDayNudgeContent(eodStatusNow.remaining);

        if (!enabled) {
          if (isNativeMacOS) {
            const ids = await invoke<string[]>("native_pending_notification_ids");
            if (ids.length > 0) await invoke("native_cancel_notifications", { ids });
          } else {
            try {
              const owned = await pending();
              if (owned.length > 0) await cancel(owned.map((n) => n.id));
            } catch {
              // Desktop (non-macOS) has no pending()/cancel() - nothing
              // OS-scheduled to clean up there in the first place.
            }
          }
          if (!cancelled) {
            setStatus({
              permission: "disabled",
              lastError: null,
              attemptedCount: 0,
              confirmedCount: 0,
              usesLiveFallback: false,
            });
          }
          return;
        }

        if (isNativeMacOS) {
          const granted = await invoke<boolean>("native_request_permission");
          if (cancelled) return;
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

          // Same "cancel everything ours, then lay down the fresh batch"
          // approach as the mobile path below - all pending native
          // notifications are ours, since this hook is the only thing that
          // ever schedules one.
          const existingIds = await invoke<string[]>("native_pending_notification_ids");
          if (cancelled) return;
          if (existingIds.length > 0) {
            await invoke("native_cancel_notifications", { ids: existingIds });
          }
          if (cancelled) return;

          const today = todayKey();
          const entries = upcomingReminders(tasks, completions, today, REMINDER_LOOKAHEAD_DAYS);
          let attempted = 0;
          let firstError: string | null = null;
          for (const { taskId, date } of entries) {
            const task = tasks.find((t) => t.id === taskId);
            if (!task || !task.time) continue;
            const secondsFromNow = (occurrenceDateTime(date, task.time).getTime() - Date.now()) / 1000;
            if (secondsFromNow <= 0) continue;
            attempted++;
            try {
              await invoke("native_schedule_notification", {
                id: `${taskId}:${date}`,
                title: task.title,
                body: task.notes || "It's time for this task.",
                secondsFromNow,
              });
            } catch (err) {
              firstError ??= err instanceof Error ? err.message : String(err);
            }
          }
          if (eodEligible) {
            attempted++;
            try {
              await invoke("native_schedule_notification", {
                id: `eod:${eodToday}`,
                title: eodContent.title,
                body: eodContent.body,
                secondsFromNow: eodSecondsFromNow,
              });
            } catch (err) {
              firstError ??= err instanceof Error ? err.message : String(err);
            }
          }
          if (cancelled) return;

          // Same reasoning as the mobile path's own post-schedule check
          // below - scheduling is fire-and-forget on the native side too,
          // so this is the only way to confirm it actually registered.
          await new Promise((resolve) => setTimeout(resolve, 500));
          if (cancelled) return;
          const confirmedIds = await invoke<string[]>("native_pending_notification_ids");
          if (!cancelled) {
            setStatus({
              permission: "granted",
              lastError: firstError,
              attemptedCount: attempted,
              confirmedCount: confirmedIds.length,
              usesLiveFallback: false,
            });
          }
          return;
        }

        const granted = await ensurePermission();
        if (cancelled) return;
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
          // This platform can't schedule ahead of time at all - fall back
          // to firing immediately the moment a task's own time arrives,
          // same as this hook's very first (pre-rework) version, and only
          // for as long as the app stays open.
          void checkDueRightNow();
          void checkEndOfDayNudge();
          fallbackInterval = window.setInterval(() => {
            void checkDueRightNow();
            void checkEndOfDayNudge();
          }, 30_000);
          if (!cancelled) {
            setStatus({
              permission: "granted",
              lastError: null,
              attemptedCount: 0,
              confirmedCount: 0,
              usesLiveFallback: true,
            });
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
        if (eodEligible) {
          try {
            await notify({
              id: reminderNotificationId("eod", eodToday),
              title: eodContent.title,
              body: eodContent.body,
              sound: "default",
              schedule: scheduleForOccurrence(eodToday, END_OF_DAY_REMINDER_TIME),
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
            attemptedCount: entries.length + (eodEligible ? 1 : 0),
            confirmedCount: confirmed.length,
            usesLiveFallback: false,
          });
        }
      } catch (err) {
        if (!cancelled) {
          setStatus((s) => ({ ...s, lastError: err instanceof Error ? err.message : String(err) }));
        }
      }
    }

    rescheduleRef.current = reschedule;
    void reschedule();

    return () => {
      cancelled = true;
      if (fallbackInterval !== null) window.clearInterval(fallbackInterval);
    };
  }, [tasks, completions, freezes, enabled]);

  useEffect(() => {
    // Permission can only change from outside the app (System Settings),
    // which this hook has no way to be pushed a notification about - so
    // instead, re-check the moment the user comes back to the app at all,
    // the same "did something external change" signal macOS apps
    // conventionally use. Covers both directions: a denied banner clearing
    // itself once notifications get allowed, and a granted status catching
    // a revoke that happened while the app was in the background.
    const unlistenFocus = getCurrentWindow().onFocusChanged(({ payload: focused }) => {
      if (focused) void rescheduleRef.current?.();
    });

    return () => {
      // Tauri's unlisten can throw ("listeners[eventId].handlerId") if the
      // listener's already gone, e.g. after a webview reload - harmless,
      // but uncaught it surfaced as WriteErrorToast's "didn't save".
      unlistenFocus
        .then((unlisten) => unlisten())
        .catch(() => {});
    };
  }, []);

  return status;
}
