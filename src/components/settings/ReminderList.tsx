import { REMINDER_LOOKAHEAD_DAYS } from "../../hooks/useTaskReminders";
import type { Task } from "../../types";
import { addDays, parseDateKey, todayKey } from "../../utils/dates";
import { upcomingReminders } from "../../utils/recurrence";
import { EmptyState } from "../ui/EmptyState";
import { BellIcon } from "../ui/icons";
import "./ReminderList.css";

interface ReminderListProps {
  tasks: Task[];
  completions: Set<string>;
  onSelectReminder: (taskId: string, date: string) => void;
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
export function ReminderList({ tasks, completions, onSelectReminder }: ReminderListProps) {
  const tasksById = new Map(tasks.map((t) => [t.id, t]));
  const entries = upcomingReminders(tasks, completions, todayKey(), REMINDER_LOOKAHEAD_DAYS)
    .map(({ taskId, date }) => {
      const task = tasksById.get(taskId);
      return task ? { taskId, date, title: task.title, time: task.time as string } : null;
    })
    .filter((e): e is { taskId: string; date: string; title: string; time: string } => e !== null)
    .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time));

  if (entries.length === 0) {
    return <EmptyState icon={<BellIcon size={16} />}>No upcoming reminders.</EmptyState>;
  }

  // Grouped by day (entries are already date-sorted) instead of repeating
  // the day on every single row - a long date like "Wed, Sep 30" doesn't
  // fit a per-row column without wrapping mid-string, and a flat list of
  // 20+ rows all saying "Today"/"Tomorrow" reads as noise rather than an
  // agenda.
  const groups: { day: string; items: typeof entries }[] = [];
  for (const entry of entries) {
    const currentGroup = groups[groups.length - 1];
    if (currentGroup && currentGroup.day === entry.date) {
      currentGroup.items.push(entry);
    } else {
      groups.push({ day: entry.date, items: [entry] });
    }
  }

  return (
    <div className="reminder-list">
      {groups.map((group) => (
        <div className="reminder-list__group" key={group.day}>
          <span className="reminder-list__group-heading">{formatDay(group.day)}</span>
          {group.items.map((e) => (
            <button
              type="button"
              className="reminder-list__row"
              key={`${e.taskId}:${e.date}`}
              onClick={() => onSelectReminder(e.taskId, e.date)}
            >
              <span className="reminder-list__title">{e.title}</span>
              <span className="reminder-list__time">
                <BellIcon size={12} />
                {e.time}
              </span>
            </button>
          ))}
        </div>
      ))}
    </div>
  );
}
