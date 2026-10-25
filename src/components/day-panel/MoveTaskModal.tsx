import { useState } from "react";
import type { CSSProperties } from "react";
import type { Task } from "../../types";
import {
  WEEKDAY_LABELS,
  addDays,
  buildMonthGrid,
  formatDayName,
  isSameMonth,
  parseDateKey,
  todayKey,
} from "../../utils/dates";
import { isTaskScheduledOn } from "../../utils/recurrence";
import { CalendarMoveIcon, ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { ADD_COLORS } from "./addKinds";
import "./MoveTaskModal.css";

interface MoveTaskModalProps {
  task: Task;
  /** The day it's on now. */
  fromDate: string;
  /** The other tasks still to do in the same template that day - offered
   *  as "move them all" (empty when there are none). */
  groupRest: Task[];
  groupName?: string;
  groupColor?: string;
  /** Every task - a day that already has something on it gets a dot. */
  tasks: Task[];
  onMove: (tasks: Task[], toDate: string) => void;
  onClose: () => void;
}

// The task color (see addKinds.ts) - this moves tasks.
const MOVE_COLOR = ADD_COLORS.task;

function shortDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

function weekdayName(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, { weekday: "long" });
}

/** Pick a day to move an unfinished task to - the next few days as quick
 *  picks, any later day from the small calendar. Today onwards only, and
 *  each day that already has tasks shows a dot, to spot the free ones. */
export function MoveTaskModal({
  task,
  fromDate,
  groupRest,
  groupName,
  groupColor,
  tasks,
  onMove,
  onClose,
}: MoveTaskModalProps) {
  const today = todayKey();
  const [selected, setSelected] = useState(() => addDays(fromDate, 1));
  const [moveAll, setMoveAll] = useState(false);
  const [month, setMonth] = useState(() => {
    const d = parseDateKey(addDays(fromDate, 1));
    return { year: d.getFullYear(), index: d.getMonth() };
  });

  const grid = buildMonthGrid(month.year, month.index);
  // Weeks that are all in the past can't be picked - left out, so this
  // month shows only what's still ahead.
  const days = grid.weeks.filter((week) => week[6] >= today).flat();
  const busy = new Set(days.filter((d) => tasks.some((t) => isTaskScheduledOn(t, d))));
  const todayDate = parseDateKey(today);
  const canGoBack =
    month.year > todayDate.getFullYear() ||
    (month.year === todayDate.getFullYear() && month.index > todayDate.getMonth());

  const next = addDays(fromDate, 1);
  const quick = [
    { date: next, label: next === addDays(today, 1) ? "Tomorrow" : weekdayName(next) },
    { date: addDays(fromDate, 2), label: weekdayName(addDays(fromDate, 2)) },
    { date: addDays(fromDate, 7), label: "Next week" },
  ];

  const moving = moveAll ? [task, ...groupRest] : [task];

  function pick(date: string) {
    setSelected(date);
    const d = parseDateKey(date);
    setMonth({ year: d.getFullYear(), index: d.getMonth() });
  }

  function shiftMonth(delta: number) {
    setMonth(({ year, index }) => {
      const d = new Date(year, index + delta, 1);
      return { year: d.getFullYear(), index: d.getMonth() };
    });
  }

  return (
    <Modal
      title="Move to another day"
      onClose={onClose}
      icon={<CalendarMoveIcon size={15} />}
      accent={MOVE_COLOR}
    >
      <div
        className="move-task"
        style={
          { "--move-color": MOVE_COLOR, "--group-color": groupColor ?? MOVE_COLOR } as CSSProperties
        }
      >
        <div className="move-task__card">
          <span className="move-task__title">{task.title}</span>
          <span className="move-task__sub">
            {groupName ? `${groupName} · ` : ""}
            {formatDayName(fromDate)}
          </span>
        </div>

        {groupRest.length > 0 && (
          <div className="move-task__scope" role="radiogroup" aria-label="What to move">
            <button type="button" role="radio" aria-checked={!moveAll} onClick={() => setMoveAll(false)}>
              Just this task
            </button>
            <button type="button" role="radio" aria-checked={moveAll} onClick={() => setMoveAll(true)}>
              All {groupRest.length + 1} left
            </button>
          </div>
        )}

        <div className="move-task__quick">
          {quick.map((q) => (
            <button
              type="button"
              key={q.date}
              className={`move-task__chip ${selected === q.date ? "move-task__chip--on" : ""}`}
              onClick={() => pick(q.date)}
            >
              <span>{q.label}</span>
              <small>{shortDate(q.date)}</small>
            </button>
          ))}
        </div>

        <div className="move-task__cal">
          <div className="move-task__cal-head">
            <button
              type="button"
              aria-label="Previous month"
              disabled={!canGoBack}
              onClick={() => shiftMonth(-1)}
            >
              <ChevronLeftIcon size={16} />
            </button>
            <span>{grid.monthLabel}</span>
            <button type="button" aria-label="Next month" onClick={() => shiftMonth(1)}>
              <ChevronRightIcon size={16} />
            </button>
          </div>
          <div className="move-task__grid">
            {WEEKDAY_LABELS.map((w, i) => (
              <span className="move-task__wd" key={i}>
                {w.slice(0, 1)}
              </span>
            ))}
            {days.map((d) => (
              <button
                type="button"
                key={d}
                className={[
                  "move-task__day",
                  !isSameMonth(d, month.year, month.index) && "move-task__day--out",
                  d === today && "move-task__day--today",
                  d === fromDate && "move-task__day--from",
                  d === selected && "move-task__day--on",
                ]
                  .filter(Boolean)
                  .join(" ")}
                disabled={d < today || d === fromDate}
                aria-pressed={d === selected}
                aria-label={formatDayName(d)}
                onClick={() => setSelected(d)}
              >
                {parseDateKey(d).getDate()}
                {busy.has(d) && <i aria-hidden="true" />}
              </button>
            ))}
          </div>
        </div>

        <button type="button" className="move-task__go" onClick={() => onMove(moving, selected)}>
          Move {moving.length > 1 ? `${moving.length} tasks ` : ""}to {formatDayName(selected)}
        </button>
      </div>
    </Modal>
  );
}
