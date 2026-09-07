import type { Task } from "../types";
import { isAfter, isBefore, weekdayOf } from "./dates";

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
