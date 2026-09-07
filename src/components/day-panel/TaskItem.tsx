import type { Task } from "../../types";
import { Checkbox } from "../ui/Checkbox";
import { PriorityDot } from "../ui/PriorityDot";
import { GripIcon, XIcon } from "../ui/icons";
import "./TaskItem.css";

interface TaskItemProps {
  task: Task;
  completed: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
  onDragHandleDown: () => void;
  dragging: boolean;
}

export function TaskItem({
  task,
  completed,
  onToggle,
  onView,
  onDelete,
  onDragHandleDown,
  dragging,
}: TaskItemProps) {
  return (
    <div
      className={`task-item ${completed ? "task-item--completed" : ""} ${dragging ? "task-item--dragging" : ""}`}
      onClick={onView}
    >
      <span
        className="task-item__handle"
        aria-hidden="true"
        onMouseDown={(e) => {
          e.stopPropagation();
          onDragHandleDown();
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <GripIcon size={14} />
      </span>
      <Checkbox checked={completed} onChange={onToggle} ariaLabel={`Mark ${task.title} complete`} />
      <div className="task-item__main">
        <span className="task-item__title">{task.title}</span>
        <div className="task-item__meta-row">
          <PriorityDot priority={task.priority} />
          <span className="task-item__time">{task.time || "All day"}</span>
        </div>
        {task.notes && <div className="task-item__notes">{task.notes}</div>}
      </div>
      <button
        className="task-item__delete"
        aria-label="Delete task"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <XIcon size={14} />
      </button>
    </div>
  );
}
