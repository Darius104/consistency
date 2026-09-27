import { useState } from "react";
import type { Priority, TemplateTaskBlueprint } from "../../types";
import { TimePicker } from "../task-form/TimePicker";
import "../task-form/TaskForm.css";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";

interface TemplateTaskModalProps {
  task: TemplateTaskBlueprint;
  onSave: (task: TemplateTaskBlueprint) => void;
  onDelete: () => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high"];

// A starter task blueprint has no tag (it belongs to this template's own
// tag implicitly), no recurrence, and no dates - it's not a real Task yet,
// just what gets stamped onto a day when the template is applied - so this
// reuses TaskForm's field styling but not the form itself, which needs all
// of those to actually create/edit a live task.
export function TemplateTaskModal({ task, onSave, onDelete, onClose }: TemplateTaskModalProps) {
  const [title, setTitle] = useState(task.title);
  const [notes, setNotes] = useState(task.notes ?? "");
  const [time, setTime] = useState(task.time ?? "");
  const [priority, setPriority] = useState<Priority>(task.priority);
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    onSave({ title: trimmed, notes: notes.trim() || null, time: time || null, priority });
  }

  return (
    <Modal title="Edit starter task" onClose={onClose}>
      <div
        className="task-form"
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
          if (e.key === "Escape") onClose();
        }}
      >
        <label className="task-form__field">
          <span className="task-form__label">Title</span>
          <input
            className="task-form__input"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="What do you need to do?"
            autoFocus
          />
        </label>

        <label className="task-form__field">
          <span className="task-form__label">Notes</span>
          <textarea
            className="task-form__input task-form__textarea"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            rows={2}
          />
        </label>

        <div className="task-form__row">
          <div className="task-form__field">
            <span className="task-form__label">Time</span>
            <TimePicker value={time} onChange={setTime} />
          </div>

          <div className="task-form__field">
            <span className="task-form__label">Priority</span>
            <div className="task-form__priority">
              {PRIORITIES.map((p) => (
                <button
                  type="button"
                  key={p}
                  className={`task-form__priority-btn task-form__priority-btn--${p} ${
                    priority === p ? "task-form__priority-btn--active" : ""
                  }`}
                  onClick={() => setPriority(p)}
                >
                  {p[0].toUpperCase() + p.slice(1)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {error && <div className="task-form__error">{error}</div>}

        <div className="task-form__actions">
          <Button variant="danger" onClick={onDelete}>
            Delete
          </Button>
          <div className="task-form__actions-right">
            <Button onClick={onClose}>Cancel</Button>
            <Button variant="primary" onClick={handleSubmit}>
              Save
            </Button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
