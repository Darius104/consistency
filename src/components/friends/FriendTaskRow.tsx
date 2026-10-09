import type { Task } from "../../types";
import "../day-panel/TaskItem.css";
import "../ui/Checkbox.css";
import { AlarmClockIcon } from "../ui/icons";
import { PriorityDot } from "../ui/PriorityDot";

interface FriendTaskRowProps {
  task: Task;
  completed: boolean;
}

// A stripped, non-interactive twin of TaskItem - no click handler, no
// drag-handle, no delete button - since none of those make sense (or are
// safe to leave clickable-but-inert) on a friend's read-only calendar.
export function FriendTaskRow({ task, completed }: FriendTaskRowProps) {
  return (
    <div
      className={`task-item task-item--readonly ${completed ? "task-item--completed" : ""}`}
    >
      <span className={`checkbox ${completed ? "checkbox--checked" : ""}`} aria-hidden="true">
        <span className="checkbox__check">
          <svg viewBox="0 0 16 16" width="10" height="10">
            <path
              d="M2 8.5L6 12.5L14 3.5"
              stroke="currentColor"
              strokeWidth="2"
              fill="none"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      </span>
      <div className="task-item__main">
        {/* Same layout as TaskItem: title + priority, time on the right. */}
        <div className="task-item__line">
          <span className="task-item__title">
            {task.title}
            <span className="task-item__priority">
              <PriorityDot priority={task.priority} />
            </span>
          </span>
          {task.time && (
            <span className="task-item__time">
              <AlarmClockIcon size={12} className="task-item__time-icon" />
              {task.time}
            </span>
          )}
        </div>
        {task.notes && <div className="task-item__notes">{task.notes}</div>}
      </div>
    </div>
  );
}
