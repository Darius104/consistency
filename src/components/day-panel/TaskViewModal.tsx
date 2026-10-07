import type { CSSProperties } from "react";
import type { Tag, Task } from "../../types";
import { addDays, parseDateKey, todayKey } from "../../utils/dates";
import { describeRecurrence, isTaskScheduledOn } from "../../utils/recurrence";
import { Button } from "../ui/Button";
import { CheckIcon, EditIcon, TrashIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { PriorityDot } from "../ui/PriorityDot";
import "./TaskViewModal.css";

interface TaskViewModalProps {
  task: Task;
  tag?: Tag;
  /** The day this task was opened from - what "Mark complete" applies to. */
  dateKey: string;
  completed: boolean;
  completions: Set<string>;
  freezes: Set<string>;
  /** Past day - completions and deletes are locked in (see App.tsx). */
  locked: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onClose: () => void;
}

type HistoryStatus = "done" | "missed" | "frozen" | "pending";

interface HistoryEntry {
  date: string;
  status: HistoryStatus;
}

const HISTORY_SIZE = 7;
// How far back to look for the last 7 occurrences - a once-a-week task
// needs 7 weeks; a year covers anything sparser without scanning forever.
const HISTORY_LOOKBACK_DAYS = 366;

/** The task's last 7 occurrences up to the opened day (never the future),
 *  oldest first. Today, if not done yet, is "pending" rather than missed -
 *  there's still time. */
function recentHistory(
  task: Task,
  upTo: string,
  completions: Set<string>,
  freezes: Set<string>,
): HistoryEntry[] {
  const today = todayKey();
  const end = upTo < today ? upTo : today;
  const entries: HistoryEntry[] = [];
  for (let i = 0; i < HISTORY_LOOKBACK_DAYS && entries.length < HISTORY_SIZE; i++) {
    const date = addDays(end, -i);
    if (date < task.startDate) break;
    if (!isTaskScheduledOn(task, date)) continue;
    let status: HistoryStatus;
    if (completions.has(`${task.id}:${date}`)) status = "done";
    else if (date === today) status = "pending";
    else if (freezes.has(date)) status = "frozen";
    else status = "missed";
    entries.push({ date, status });
  }
  return entries.reverse();
}

/** Consecutive completions counting back from the newest occurrence. A
 *  still-pending today doesn't break it, and a frozen day carries it over
 *  without adding to it - the same rules as the main streak. */
function inARow(history: HistoryEntry[]): number {
  let count = 0;
  for (let i = history.length - 1; i >= 0; i--) {
    const { status } = history[i];
    if (status === "done") count++;
    else if (status === "missed") break;
  }
  return count;
}

export function TaskViewModal({
  task,
  tag,
  dateKey,
  completed,
  completions,
  freezes,
  locked,
  onToggle,
  onEdit,
  onDelete,
  onClose,
}: TaskViewModalProps) {
  const recurring = task.recurrenceType !== "none";
  const history = recurring ? recentHistory(task, dateKey, completions, freezes) : [];
  const doneCount = history.filter((h) => h.status === "done").length;
  // Today still in progress isn't a miss yet, so it isn't counted against you.
  const judged = history.filter((h) => h.status !== "pending").length;
  const streak = inARow(history);

  return (
    <Modal title="Task" onClose={onClose}>
      <div
        className="task-view"
        style={{ "--tpl": tag?.color ?? "var(--accent)" } as CSSProperties}
      >
        <div className="task-view__head">
          <span className="task-view__accent" aria-hidden="true" />
          <h3 className={`task-view__title ${completed ? "task-view__title--done" : ""}`}>
            {task.title}
          </h3>
        </div>

        <dl className="task-view__list">
          <div className="task-view__row">
            <dt>Time</dt>
            <dd>{task.time || "All day"}</dd>
          </div>
          {recurring && (
            <div className="task-view__row">
              <dt>Repeats</dt>
              <dd>{describeRecurrence(task)}</dd>
            </div>
          )}
          {tag && (
            <div className="task-view__row">
              <dt>Template</dt>
              <dd>
                <span className="task-view__tag-dot" />
                {tag.name}
              </dd>
            </div>
          )}
          {/* Only High is worth a line - the same rule as the task rows. */}
          {task.priority === "high" && (
            <div className="task-view__row">
              <dt>Priority</dt>
              <dd>
                <PriorityDot priority="high" />
                High
              </dd>
            </div>
          )}
        </dl>

        {task.notes && <p className="task-view__notes">{task.notes}</p>}

        {history.length >= 2 && (
          <section className="task-view__history">
            <div className="task-view__history-head">
              <span className="task-view__history-label">Last {history.length} times</span>
              <span className="task-view__history-summary">
                {doneCount} of {judged}
                {streak >= 2 && <> · {streak} in a row</>}
              </span>
            </div>
            <ol className="task-view__history-dots">
              {history.map((h) => (
                <li
                  key={h.date}
                  className={`task-view__history-day task-view__history-day--${h.status}`}
                  title={`${h.date}: ${h.status}`}
                >
                  <span className="task-view__history-dot">
                    {h.status === "done" && <CheckIcon size={11} />}
                  </span>
                  <span className="task-view__history-date">{parseDateKey(h.date).getDate()}</span>
                </li>
              ))}
            </ol>
          </section>
        )}

        <div className="task-view__actions">
          <Button variant="ghost" className="task-view__edit" onClick={onEdit}>
            <EditIcon size={14} />
            Edit
          </Button>
          <button
            type="button"
            className={`task-view__complete ${completed ? "task-view__complete--done" : ""}`}
            onClick={onToggle}
            disabled={locked}
            aria-pressed={completed}
          >
            <CheckIcon size={15} />
            {completed ? "Completed" : "Mark complete"}
          </button>
        </div>

        {!locked && (
          <button type="button" className="task-view__delete" onClick={onDelete}>
            <TrashIcon size={13} />
            Delete task
          </button>
        )}
      </div>
    </Modal>
  );
}
