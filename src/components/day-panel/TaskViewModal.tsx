import type { Tag, Task } from "../../types";
import { describeRecurrence } from "../../utils/recurrence";
import { Button } from "../ui/Button";
import { ClockIcon, EditIcon, RepeatIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { PriorityDot } from "../ui/PriorityDot";
import "./TaskViewModal.css";

interface TaskViewModalProps {
  task: Task;
  tag?: Tag;
  onEdit: () => void;
  onClose: () => void;
}

function capitalize(s: string): string {
  return s[0].toUpperCase() + s.slice(1);
}

export function TaskViewModal({ task, tag, onEdit, onClose }: TaskViewModalProps) {
  return (
    <Modal title="Task" onClose={onClose}>
      <div className="task-view">
        <div className="task-view__badges">
          <span className="task-view__priority">
            <PriorityDot priority={task.priority} />
            {capitalize(task.priority)} priority
          </span>
          {tag && (
            <span className="task-view__tag">
              <span className="task-view__tag-dot" style={{ background: tag.color }} />
              {tag.name}
            </span>
          )}
        </div>

        <h3 className="task-view__title">{task.title}</h3>

        <div className="task-view__info-rows">
          <div className="task-view__info-row">
            <ClockIcon size={14} className="task-view__info-icon" />
            {task.time || "All day"}
          </div>
          {task.recurrenceType !== "none" && (
            <div className="task-view__info-row">
              <RepeatIcon size={14} className="task-view__info-icon" />
              {describeRecurrence(task)}
            </div>
          )}
        </div>

        {task.notes && <p className="task-view__notes">{task.notes}</p>}

        <div className="task-view__actions">
          <Button variant="primary" onClick={onEdit}>
            <EditIcon size={14} />
            Edit
          </Button>
        </div>
      </div>
    </Modal>
  );
}
