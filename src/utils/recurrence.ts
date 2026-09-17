import type { Task } from "../types";
import { addDays, isAfter, isBefore, parseDateKey, weekdayOf } from "./dates";

export function isTaskScheduledOn(task: Task, dateKey: string): boolean {
  if (isBefore(dateKey, task.startDate)) return false;
  if (task.endDate && isAfter(dateKey, task.endDate)) return false;

  switch (task.recurrenceType) {
    case "none":
      return dateKey === task.startDate;
    case "daily": {
      // recurrenceDays on a daily task is an optional weekday allow-list -
      // absent/empty means every day; e.g. [1,2,3,4,5] means weekdays only.
      const days = task.recurrenceDays;
      if (!days || days.length === 0) return true;
      return days.includes(weekdayOf(dateKey));
    }
    case "weekly":
      return (task.recurrenceDays ?? []).includes(weekdayOf(dateKey));
  }
}

export function tasksScheduledOn(tasks: Task[], dateKey: string): Task[] {
  return tasks.filter((t) => isTaskScheduledOn(t, dateKey));
}

/** Every date (as "YYYY-MM-DD" keys) this task occurs on over the next
 *  `days` days starting at `fromDate` (inclusive) - used both to schedule
 *  reminders ahead of time and to list upcoming ones in Settings. */
export function nextOccurrences(task: Task, fromDate: string, days: number): string[] {
  const dates: string[] = [];
  let cursor = fromDate;
  for (let i = 0; i < days; i++) {
    if (isTaskScheduledOn(task, cursor)) dates.push(cursor);
    cursor = addDays(cursor, 1);
  }
  return dates;
}

/** The exact moment a task's reminder for one occurrence is due. */
export function occurrenceDateTime(dateKey: string, time: string): Date {
  const [hours, minutes] = time.split(":").map(Number);
  const date = parseDateKey(dateKey);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export interface ReminderEntry {
  taskId: string;
  date: string;
}

/** Every (task, date) pair that still has a pending reminder - a task with
 *  a `time` set, occurring within `days` of `fromDate`, not already
 *  completed, and (for `fromDate` itself) not already past its time. Shared
 *  by both the actual OS-scheduling pass (useTaskReminders) and the in-app
 *  upcoming-reminders list (ReminderList) so what's shown always matches
 *  what's actually scheduled. */
export function upcomingReminders(
  tasks: Task[],
  completions: Set<string>,
  fromDate: string,
  days: number,
  now: Date = new Date(),
): ReminderEntry[] {
  const entries: ReminderEntry[] = [];
  for (const task of tasks) {
    if (!task.time) continue;
    for (const date of nextOccurrences(task, fromDate, days)) {
      if (completions.has(`${task.id}:${date}`)) continue;
      if (date === fromDate && occurrenceDateTime(date, task.time) <= now) continue;
      entries.push({ taskId: task.id, date });
    }
  }
  return entries;
}

// Display order Mon..Sun, independent of recurrenceDays' own 0=Sun..6=Sat
// storage order (see weekdayOf).
const WEEKDAY_DISPLAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const WEEKDAY_SHORT_LABEL: Record<number, string> = {
  0: "Sun",
  1: "Mon",
  2: "Tue",
  3: "Wed",
  4: "Thu",
  5: "Fri",
  6: "Sat",
};
const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

function labelDays(days: number[]): string {
  return WEEKDAY_DISPLAY_ORDER.filter((d) => days.includes(d))
    .map((d) => WEEKDAY_SHORT_LABEL[d])
    .join(", ");
}

/** Plain-language summary of a task's recurrence, for read-only display. */
export function describeRecurrence(task: Task): string {
  if (task.recurrenceType === "none") return "Doesn't repeat";

  if (task.recurrenceType === "daily") {
    const days = task.recurrenceDays;
    if (!days || days.length === 0) return "Repeats daily";
    if (days.length === 5 && WEEKDAYS_ONLY.every((d) => days.includes(d))) {
      return "Repeats daily on weekdays";
    }
    return `Repeats daily on ${labelDays(days)}`;
  }

  const days = task.recurrenceDays ?? [];
  return days.length > 0 ? `Repeats weekly on ${labelDays(days)}` : "Repeats weekly";
}
