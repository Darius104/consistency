import { useState } from "react";
import type { NewTask, Priority, RecurrenceType, Tag, Task } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { RecurrenceControls } from "./RecurrenceControls";
import { TagPicker } from "./TagPicker";
import { TimePicker } from "./TimePicker";
import "./TaskForm.css";

interface TaskFormProps {
  task?: Task;
  defaultDate: string;
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  onSave: (data: NewTask) => void;
  onDelete?: () => void;
  onClose: () => void;
}

const PRIORITIES: Priority[] = ["low", "medium", "high"];

export function TaskForm({
  task,
  defaultDate,
  tags,
  onCreateTag,
  onSave,
  onDelete,
  onClose,
}: TaskFormProps) {
  const [title, setTitle] = useState(task?.title ?? "");
  const [notes, setNotes] = useState(task?.notes ?? "");
  const [time, setTime] = useState(task?.time ?? "");
  const [tagId, setTagId] = useState<string | null>(task?.tagId ?? null);
  const [priority, setPriority] = useState<Priority>(task?.priority ?? "medium");
  const [recurrenceType, setRecurrenceType] = useState<RecurrenceType>(
    task?.recurrenceType ?? "none",
  );
  const [recurrenceDays, setRecurrenceDays] = useState<number[]>(
    task?.recurrenceDays ?? [],
  );
  const [error, setError] = useState<string | null>(null);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Title is required.");
      return;
    }
    if (recurrenceType === "weekly" && recurrenceDays.length === 0) {
      setError("Pick at least one weekday for a weekly task.");
      return;
    }

    onSave({
      title: trimmed,
      notes: notes.trim() || null,
      time: time || null,
      tagId,
      priority,
      recurrenceType,
      recurrenceDays:
        recurrenceType === "none"
          ? null
          : recurrenceDays.length > 0
            ? recurrenceDays
            : null,
      startDate: task?.startDate ?? defaultDate,
      endDate: task?.endDate ?? null,
    });
  }

  return (
    <Modal title={task ? "Edit task" : "New task"} onClose={onClose}>
      <div
        className="task-form"
        onKeyDown={(e) => {
          // Matches NoteForm's own shortcuts - bound on the outer form
          // (not one specific field) since this form has several, and a
          // synthetic keydown from any focused descendant still bubbles up
          // to here. Cmd/Ctrl+Enter only (not plain Enter) so it never
          // hijacks a newline in the notes textarea.
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

        <div className="task-form__field">
          <span className="task-form__label">Template</span>
          <TagPicker
            tags={tags}
            selectedTagId={tagId}
            onChange={setTagId}
            onCreateTag={onCreateTag}
          />
        </div>

        <div className="task-form__field">
          <span className="task-form__label">Repeat</span>
          <RecurrenceControls
            type={recurrenceType}
            days={recurrenceDays}
            onChange={(t, d) => {
              setRecurrenceType(t);
              setRecurrenceDays(d);
            }}
          />
        </div>

        {error && <div className="task-form__error">{error}</div>}

        <div className="task-form__actions">
          {task && onDelete && (
            <Button variant="danger" onClick={onDelete}>
              Delete
            </Button>
          )}
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
