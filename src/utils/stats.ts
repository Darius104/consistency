import type { Task } from "../types";
import { addDays, isBefore } from "./dates";
import { tasksScheduledOn } from "./recurrence";

export type StreakTier = "cold" | "low" | "warm" | "hot" | "blazing";

/** Single shared source of truth for "how hot is this streak" - used by the
 *  flame in StreakCounter and by the avatar badge's glow, so both always
 *  agree on the exact same thresholds. */
export function streakTier(streak: number): StreakTier {
  if (streak === 0) return "cold";
  if (streak < 3) return "low";
  if (streak < 7) return "warm";
  if (streak < 30) return "hot";
  return "blazing";
}

/** Completion rate for one day: null when nothing was scheduled that day. */
export function dayCompletionRate(
  tasks: Task[],
  completions: Set<string>,
  dateKey: string,
): number | null {
  const scheduled = tasksScheduledOn(tasks, dateKey);
  if (scheduled.length === 0) return null;
  const done = scheduled.filter((t) =>
    completions.has(`${t.id}:${dateKey}`),
  ).length;
  return done / scheduled.length;
}

/**
 * Whether a day counts toward the streak: null if nothing was scheduled
 * (doesn't count, doesn't break), true if everything was completed OR the
 * day was protected by a streak freeze, false otherwise. A freeze never
 * changes the real completion rate used elsewhere (weekly %, heatmap) - it
 * only affects the streak.
 */
function isDaySatisfied(
  tasks: Task[],
  completions: Set<string>,
  frozen: Set<string>,
  dateKey: string,
): boolean | null {
  const rate = dayCompletionRate(tasks, completions, dateKey);
  if (rate === null) return null;
  if (frozen.has(dateKey)) return true;
  return rate === 1;
}

/**
 * Consecutive days, walking back from `fromKey`, where every scheduled task
 * was completed (or the day was frozen). Days with nothing scheduled don't
 * break the streak, they're simply skipped. Stops once it reaches a day
 * before any task existed.
 *
 * `fromKey` itself is only counted once it's actually finished (or frozen) -
 * an in-progress today (tasks still open) doesn't erase a real streak that's
 * intact through yesterday, it just isn't added to yet.
 */
export function computeStreak(
  tasks: Task[],
  completions: Set<string>,
  frozen: Set<string>,
  fromKey: string,
): number {
  if (tasks.length === 0) return 0;

  const earliestStart = tasks.reduce(
    (min, t) => (isBefore(t.startDate, min) ? t.startDate : min),
    tasks[0].startDate,
  );

  const fromSatisfied = isDaySatisfied(tasks, completions, frozen, fromKey);
  let cursor = fromSatisfied === false ? addDays(fromKey, -1) : fromKey;

  let streak = 0;

  while (!isBefore(cursor, earliestStart)) {
    const satisfied = isDaySatisfied(tasks, completions, frozen, cursor);
    if (satisfied === null) {
      // nothing scheduled that day - doesn't count, doesn't break
      cursor = addDays(cursor, -1);
      continue;
    }
    if (!satisfied) break;
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

/** Longest run of fully-completed (or frozen) days anywhere in the task history. */
export function computeLongestStreak(
  tasks: Task[],
  completions: Set<string>,
  frozen: Set<string>,
  uptoKey: string,
): number {
  if (tasks.length === 0) return 0;

  const earliestStart = tasks.reduce(
    (min, t) => (isBefore(t.startDate, min) ? t.startDate : min),
    tasks[0].startDate,
  );

  let longest = 0;
  let current = 0;
  let cursor = earliestStart;

  while (!isBefore(uptoKey, cursor)) {
    const satisfied = isDaySatisfied(tasks, completions, frozen, cursor);
    if (satisfied === null) {
      cursor = addDays(cursor, 1);
      continue;
    }
    if (satisfied) {
      current += 1;
      if (current > longest) longest = current;
    } else {
      current = 0;
    }
    cursor = addDays(cursor, 1);
  }

  return longest;
}

export interface TodayStatus {
  hasTasks: boolean;
  scheduled: number;
  completed: number;
  remaining: number;
  allDone: boolean;
  frozen: boolean;
}

/** What's left today, so the streak can show a concrete call to action. */
export function computeTodayStatus(
  tasks: Task[],
  completions: Set<string>,
  frozen: Set<string>,
  todayKey: string,
): TodayStatus {
  const scheduledTasks = tasksScheduledOn(tasks, todayKey);
  const completed = scheduledTasks.filter((t) =>
    completions.has(`${t.id}:${todayKey}`),
  ).length;
  const scheduled = scheduledTasks.length;

  return {
    hasTasks: scheduled > 0,
    scheduled,
    completed,
    remaining: scheduled - completed,
    allDone: scheduled > 0 && completed === scheduled,
    frozen: frozen.has(todayKey),
  };
}

const MAX_FREEZES_PER_MONTH = 3;

/** How many freezes have been spent in the calendar month `dateKey` falls in. */
export function freezesUsedInMonth(frozen: Set<string>, dateKey: string): number {
  const monthPrefix = dateKey.slice(0, 7); // "YYYY-MM"
  let count = 0;
  for (const d of frozen) {
    if (d.startsWith(monthPrefix)) count += 1;
  }
  return count;
}

export function freezesRemainingInMonth(
  frozen: Set<string>,
  dateKey: string,
): number {
  return Math.max(0, MAX_FREEZES_PER_MONTH - freezesUsedInMonth(frozen, dateKey));
}

export { MAX_FREEZES_PER_MONTH };

export interface FreezeCandidate {
  date: string;
  rate: number;
}

/**
 * Days this calendar month, up to and including `uptoKey`, that had tasks
 * scheduled, weren't fully completed, and aren't already frozen - i.e. the
 * days you could still choose to protect. Most recent first.
 */
export function getFreezeCandidates(
  tasks: Task[],
  completions: Set<string>,
  frozen: Set<string>,
  uptoKey: string,
): FreezeCandidate[] {
  const monthStart = `${uptoKey.slice(0, 7)}-01`;
  const candidates: FreezeCandidate[] = [];

  let cursor = uptoKey;
  while (!isBefore(cursor, monthStart)) {
    if (!frozen.has(cursor)) {
      const rate = dayCompletionRate(tasks, completions, cursor);
      if (rate !== null && rate < 1) {
        candidates.push({ date: cursor, rate });
      }
    }
    cursor = addDays(cursor, -1);
  }

  return candidates;
}

export interface WeeklyCompletion {
  scheduled: number;
  completed: number;
  percent: number; // 0..100, 0 when nothing was scheduled
}

/** `weekStartKey` should be the Monday of the week to summarize. */
export function computeWeeklyCompletion(
  tasks: Task[],
  completions: Set<string>,
  weekStartKey: string,
): WeeklyCompletion {
  let scheduled = 0;
  let completed = 0;

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStartKey, i);
    const dayTasks = tasksScheduledOn(tasks, day);
    scheduled += dayTasks.length;
    completed += dayTasks.filter((t) =>
      completions.has(`${t.id}:${day}`),
    ).length;
  }

  return {
    scheduled,
    completed,
    percent: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
  };
}

export interface CategoryBreakdownItem {
  /** null = tasks with no category assigned. */
  tagId: string | null;
  scheduled: number;
  completed: number;
  percent: number; // 0..100
}

/** Per-category completion for the Mon-Sun week starting `weekStartKey`,
 *  most-scheduled category first - the same week window as
 *  computeWeeklyCompletion, just split out by tag instead of summed. */
export function computeCategoryBreakdown(
  tasks: Task[],
  completions: Set<string>,
  weekStartKey: string,
): CategoryBreakdownItem[] {
  const byTag = new Map<string | null, { scheduled: number; completed: number }>();

  for (let i = 0; i < 7; i++) {
    const day = addDays(weekStartKey, i);
    for (const task of tasksScheduledOn(tasks, day)) {
      const entry = byTag.get(task.tagId) ?? { scheduled: 0, completed: 0 };
      entry.scheduled += 1;
      if (completions.has(`${task.id}:${day}`)) entry.completed += 1;
      byTag.set(task.tagId, entry);
    }
  }

  return Array.from(byTag.entries())
    .map(([tagId, { scheduled, completed }]) => ({
      tagId,
      scheduled,
      completed,
      percent: scheduled === 0 ? 0 : Math.round((completed / scheduled) * 100),
    }))
    .sort((a, b) => b.scheduled - a.scheduled);
}

