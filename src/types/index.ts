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
  id: number;
  name: string;
  color: string;
  sortOrder: number;
}

export interface Task {
  id: number;
  title: string;
  notes: string | null;
  time: string | null; // "HH:MM"
  tagId: number | null;
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
  tagId?: number | null;
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

// A reusable "starter pack": a category plus a canned list of tasks that can
// be stamped onto any day on demand, instead of retyping them each time.
export interface Template {
  id: number;
  name: string;
  tagId: number | null;
  taskCount: number;
}

export interface TemplateTaskBlueprint {
  title: string;
  notes: string | null;
  time: string | null;
  priority: Priority;
}
