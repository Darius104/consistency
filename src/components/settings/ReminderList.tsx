import type { Task } from "../../types";
import { addDays, parseDateKey, todayKey } from "../../utils/dates";
import { upcomingReminders } from "../../utils/recurrence";
import { BellIcon } from "../ui/icons";
import "./ReminderList.css";

const LOOKAHEAD_DAYS = 14;

interface ReminderListProps {
  tasks: Task[];
  completions: Set<string>;
}

function formatDay(dateKey: string): string {
  const today = todayKey();
  if (dateKey === today) return "Today";
  if (dateKey === addDays(today, 1)) return "Tomorrow";
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

/** Read-only preview of what useTaskReminders.ts has actually scheduled with
 *  the OS - built from the same upcomingReminders() helper, so this list
 *  never drifts out of sync with what's really going to fire. */
export function ReminderList({ tasks, completions }: ReminderListProps) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const entries = upcomingReminders(tasks, completions, todayKey(), LOOKAHEAD_DAYS)
    .map(({ taskId, date }) => {
      const task = tasksById.get(taskId);
      return task ? { taskId, date, title: task.title, time: task.time as string } : null;
    })
    .filter((e): e is { taskId: string; date: string; title: string; time: string } => e !== null)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (entries.length === 0) {
    return <span className="reminder-list__empty">No upcoming reminders.</span>;
  }

  return (
    <div className="reminder-list">
      {entries.map((e) => (
        <div className="reminder-list__row" key={`${e.taskId}:${e.date}`}>
          <span className="reminder-list__day">{formatDay(e.date)}</span>
          <span className="reminder-list__title">{e.title}</span>
          <span className="reminder-list__time">
            <BellIcon size={12} />
            {e.time}
          </span>
        </div>
      ))}
    </div>
  );
}
