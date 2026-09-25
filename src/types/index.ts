export type Priority = "low" | "medium" | "high";

export type ThemeId =
  | "midnight"
  | "steel"
  | "ocean"
  | "forest"
  | "blossom"
  | "lavender"
  | "crimson"
  | "amber"
  | "random";

export type RecurrenceType = "none" | "daily" | "weekly";

export interface Tag {
  id: string;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Task {
  id: string;
  title: string;
  notes: string | null;
  time: string | null; // "HH:MM"
  tagId: string | null;
  priority: Priority;
  recurrenceType: RecurrenceType;
  recurrenceDays: number[] | null; // 0=Sun..6=Sat, only for "weekly"
  startDate: string; // "YYYY-MM-DD"
  endDate: string | null;
  sortOrder: number;
}

export interface NewTask {
  title: string;
  notes?: string | null;
  time?: string | null;
  tagId?: string | null;
  priority: Priority;
  recurrenceType: RecurrenceType;
  recurrenceDays?: number[] | null;
  startDate: string;
  endDate?: string | null;
}

// A concrete calendar occurrence of a task on a specific date,
// with completion resolved for that date.
export interface TaskOccurrence {
  task: Task;
  date: string; // "YYYY-MM-DD"
  completed: boolean;
}

// A reusable "starter pack": a tag plus a canned list of tasks that can
// be stamped onto any day on demand, instead of retyping them each time.
export interface Template {
  id: string;
  name: string;
  tagId: string | null;
  taskCount: number;
}

export interface TemplateTaskBlueprint {
  title: string;
  notes: string | null;
  time: string | null;
  priority: Priority;
}

// A quick free-text note attached to one specific day - not a task: no
// checkbox, no time/priority, never counted toward the streak or weekly %.
export interface DayNote {
  id: string;
  date: string; // "YYYY-MM-DD"
  content: string;
  sortOrder: number;
  // Which tag-group (by tag id, or the literal "none" for the untagged
  // group) this note is anchored after in the day's list - null means
  // "before all groups" (the default for a freshly created note).
  afterGroupKey: string | null;
}
