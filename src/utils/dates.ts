// All dates in this app are plain "YYYY-MM-DD" strings in local time.
// We deliberately avoid toISOString() (which is UTC) to prevent off-by-one
// day bugs for users west of UTC.

export function toDateKey(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function todayKey(): string {
  return toDateKey(new Date());
}

export function parseDateKey(key: string): Date {
  const [y, m, d] = key.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(key: string, delta: number): string {
  const date = parseDateKey(key);
  date.setDate(date.getDate() + delta);
  return toDateKey(date);
}

export function weekdayOf(key: string): number {
  return parseDateKey(key).getDay(); // 0=Sun..6=Sat
}

export function isBefore(a: string, b: string): boolean {
  return a < b;
}

export function isAfter(a: string, b: string): boolean {
  return a > b;
}

// Monday-start week key for a given date (the date of that week's Monday).
export function startOfWeek(key: string): string {
  const dow = weekdayOf(key); // 0=Sun..6=Sat
  const mondayOffset = dow === 0 ? -6 : 1 - dow;
  return addDays(key, mondayOffset);
}

export interface MonthGrid {
  /** 6 rows x 7 cols of date keys, Monday-first, including leading/trailing days from adjacent months. */
  weeks: string[][];
  monthLabel: string;
}

export function buildMonthGrid(year: number, monthIndex: number): MonthGrid {
  const firstOfMonth = new Date(year, monthIndex, 1);
  const firstKey = toDateKey(firstOfMonth);
  const gridStart = startOfWeek(firstKey);

  const weeks: string[][] = [];
  let cursor = gridStart;
  for (let w = 0; w < 6; w++) {
    const week: string[] = [];
    for (let d = 0; d < 7; d++) {
      week.push(cursor);
      cursor = addDays(cursor, 1);
    }
    weeks.push(week);
  }

  const monthLabel = firstOfMonth.toLocaleDateString(undefined, {
    month: "long",
    year: "numeric",
  });

  return { weeks, monthLabel };
}

export function isSameMonth(key: string, year: number, monthIndex: number): boolean {
  const d = parseDateKey(key);
  return d.getFullYear() === year && d.getMonth() === monthIndex;
}

export const WEEKDAY_LABELS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

/** "2h 14m" / "9m" - rounds up to the next minute rather than
 *  down, so this never reads "0m" while time still remains. */
export function formatCountdown(ms: number): string {
  const totalMinutes = Math.max(0, Math.ceil(ms / 60_000));
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
}

/** "Today" / "Tomorrow" / "Yesterday", otherwise a short date like
 *  "Thu, Oct 9" - for naming which day something applies to. */
export function formatDayName(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return "Today";
  if (dateKey === addDays(today, 1)) return "Tomorrow";
  if (dateKey === addDays(today, -1)) return "Yesterday";
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}
