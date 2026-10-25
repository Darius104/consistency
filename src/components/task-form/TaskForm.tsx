import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import type { NewTask, Priority, RecurrenceType, Tag, Task } from "../../types";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { ADD_COLORS } from "../day-panel/addKinds";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { AlarmClockIcon, CheckIcon, ChevronRightIcon, EditIcon, RepeatIcon, TagIcon } from "../ui/icons";
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

type Setting = "time" | "repeat" | "template" | "priority";

const PRIORITIES: Priority[] = ["low", "medium", "high"];
const PRIORITY_LABEL: Record<Priority, string> = { low: "Low", medium: "Medium", high: "High" };
const PRIORITY_COLOR: Record<Priority, string> = {
  low: "var(--priority-low)",
  medium: "var(--priority-medium)",
  high: "var(--priority-high)",
};
const TIME_COLOR = "#f97316";
const REPEAT_COLOR = "#0ea5e9";
const NO_TEMPLATE_COLOR = "#94a3b8";
// Monday first, as everywhere else in the app.
const WEEK_ORDER = [1, 2, 3, 4, 5, 6, 0];
const DAY_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** The repeat setting in a few words, for its row / chip. */
function repeatLabel(type: RecurrenceType, days: number[]): string {
  const list = WEEK_ORDER.filter((d) => days.includes(d)).map((d) => DAY_SHORT[d]).join(", ");
  if (type === "none") return "Doesn't repeat";
  if (type === "daily") {
    if (days.length === 0 || days.length === 7) return "Every day";
    if (days.length === 5 && [1, 2, 3, 4, 5].every((d) => days.includes(d))) return "Weekdays";
    return list;
  }
  return days.length > 0 ? `Weekly · ${list}` : "Weekly";
}

/** The setting's color as a CSS variable (icon square / chip). */
function tint(color: string): CSSProperties {
  return { "--tint": color } as CSSProperties;
}

// Title first, then each setting with its own color - on the phone as rows
// that open in place, on desktop as a line of chips whose options open in a
// panel right under them (inside the window, so nothing gets cut off at
// its edge). The pickers inside (time, repeat, template) are the same ones as
// before; only how they're reached changed.
export function TaskForm({
  task,
  defaultDate,
  tags,
  onCreateTag,
  onSave,
  onDelete,
  onClose,
}: TaskFormProps) {
  const isPhone = useMediaQuery("(max-width: 700px)");
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
  const [openSetting, setOpenSetting] = useState<Setting | null>(null);

  function handleSubmit() {
    const trimmed = title.trim();
    if (!trimmed) {
      setError("Give the task a title.");
      return;
    }
    if (recurrenceType === "weekly" && recurrenceDays.length === 0) {
      setError("Pick at least one weekday for a weekly task.");
      setOpenSetting("repeat");
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

  const tag = tags.find((t) => t.id === tagId);

  function toggle(setting: Setting) {
    // Opening Time with none set starts it at 09:00, ready to adjust.
    if (setting === "time" && openSetting !== "time" && !time) setTime("09:00");
    setOpenSetting((open) => (open === setting ? null : setting));
  }

  const prioritySegment = (
    <div className="task-form__seg" role="radiogroup" aria-label="Priority">
      {PRIORITIES.map((p) => (
        <button
          type="button"
          key={p}
          role="radio"
          aria-checked={priority === p}
          className={`task-form__seg-btn ${priority === p ? "task-form__seg-btn--on" : ""}`}
          style={tint(PRIORITY_COLOR[p])}
          onClick={() => setPriority(p)}
        >
          {PRIORITY_LABEL[p]}
        </button>
      ))}
    </div>
  );

  const settings: {
    id: Setting;
    label: string;
    color: string;
    icon: ReactNode;
    /** Shown on the row / chip - null when nothing's set. */
    value: string | null;
    /** Desktop chip text when nothing's set. */
    unset: string;
    editor: ReactNode;
  }[] = [
    {
      id: "time",
      label: "Time",
      color: TIME_COLOR,
      icon: <AlarmClockIcon size={15} />,
      value: time || null,
      unset: "Time",
      editor: <TimePicker value={time} onChange={setTime} />,
    },
    {
      id: "repeat",
      label: "Repeat",
      color: REPEAT_COLOR,
      icon: <RepeatIcon size={15} />,
      value: recurrenceType === "none" ? null : repeatLabel(recurrenceType, recurrenceDays),
      unset: "Repeat",
      editor: (
        <RecurrenceControls
          type={recurrenceType}
          days={recurrenceDays}
          onChange={(t, d) => {
            setRecurrenceType(t);
            setRecurrenceDays(d);
          }}
        />
      ),
    },
    {
      id: "template",
      label: "Template",
      color: tag?.color ?? NO_TEMPLATE_COLOR,
      icon: <TagIcon size={15} />,
      value: tag ? tag.name : null,
      unset: "Template",
      editor: (
        <TagPicker
          tags={tags}
          selectedTagId={tagId}
          onChange={setTagId}
          onCreateTag={onCreateTag}
        />
      ),
    },
    {
      id: "priority",
      label: "Priority",
      color: PRIORITY_COLOR[priority],
      icon: <span className="task-form__flag">!</span>,
      value: PRIORITY_LABEL[priority],
      unset: "Priority",
      editor: prioritySegment,
    },
  ];

  const titleField = (
    <input
      className="task-form__title"
      value={title}
      onChange={(e) => setTitle(e.target.value)}
      onKeyDown={(e) => {
        // Return in the title adds it - the quickest way to jot one down.
        if (e.key === "Enter" && !e.nativeEvent.isComposing) {
          e.preventDefault();
          handleSubmit();
        }
      }}
      placeholder="What do you need to do?"
      aria-label="Title"
      autoFocus
    />
  );

  const notesField = (
    <textarea
      className="task-form__notes"
      value={notes}
      onChange={(e) => setNotes(e.target.value)}
      placeholder="Add notes"
      aria-label="Notes"
      rows={notes.includes("\n") || notes.length > 40 ? 3 : 1}
    />
  );

  const saveLabel = task ? "Save" : "Add task";
  const open = settings.find((s) => s.id === openSetting);

  return (
    <Modal
      title={task ? "Edit task" : "New task"}
      icon={task ? <EditIcon size={14} /> : <CheckIcon size={14} />}
      accent={ADD_COLORS.task}
      onClose={onClose}
    >
      <div
        className={`task-form task-form--new ${isPhone ? "task-form--phone" : "task-form--desk"}`}
        style={tint(ADD_COLORS.task)}
        onKeyDown={(e) => {
          // Cmd/Ctrl+Enter saves from anywhere in the form (plain Enter
          // still makes a new line in the notes).
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
            e.preventDefault();
            handleSubmit();
          }
        }}
      >
        {isPhone ? (
          <>
            <div className="task-form__card">
              {titleField}
              {notesField}
            </div>

            <div className="task-form__group">
              {settings.map((s) =>
                s.id === "priority" ? (
                  <div key={s.id} className="task-form__setting">
                    <span className="task-form__setting-icon" style={tint(s.color)}>
                      {s.icon}
                    </span>
                    <span className="task-form__setting-label">{s.label}</span>
                    {prioritySegment}
                  </div>
                ) : (
                  <div key={s.id} className="task-form__setting-wrap">
                    <button
                      type="button"
                      className={`task-form__setting ${openSetting === s.id ? "task-form__setting--open" : ""}`}
                      onClick={() => toggle(s.id)}
                      aria-expanded={openSetting === s.id}
                    >
                      <span className="task-form__setting-icon" style={tint(s.color)}>
                        {s.icon}
                      </span>
                      <span className="task-form__setting-label">{s.label}</span>
                      <span
                        className={`task-form__setting-value ${s.value ? "task-form__setting-value--set" : ""}`}
                      >
                        {s.id === "template" && tag && (
                          <span className="task-form__dot" style={{ background: tag.color }} />
                        )}
                        <span className="task-form__setting-text">{s.value ?? "None"}</span>
                      </span>
                      <ChevronRightIcon size={14} className="task-form__chevron" />
                    </button>
                    {openSetting === s.id && <div className="task-form__editor">{s.editor}</div>}
                  </div>
                ),
              )}
            </div>

            {error && <div className="task-form__error">{error}</div>}

            <button type="button" className="task-form__cta" onClick={handleSubmit}>
              {saveLabel}
            </button>
            {task && onDelete && (
              <button type="button" className="task-form__delete-link" onClick={onDelete}>
                Delete task
              </button>
            )}
          </>
        ) : (
          <>
            {titleField}
            {notesField}

            <div className="task-form__chips">
              {settings.map((s) => (
                <button
                  key={s.id}
                  type="button"
                  className={`task-form__chip ${s.value ? "" : "task-form__chip--unset"} ${openSetting === s.id ? "task-form__chip--open" : ""}`}
                  style={tint(s.color)}
                  onClick={() => toggle(s.id)}
                  aria-expanded={openSetting === s.id}
                  title={s.value ?? undefined}
                >
                  {s.id === "template" && tag ? (
                    <span className="task-form__dot" style={{ background: tag.color }} />
                  ) : (
                    s.icon
                  )}
                  <span className="task-form__chip-text">{s.value ?? s.unset}</span>
                </button>
              ))}
            </div>
            {open && (
              <div className="task-form__panel" key={open.id} style={tint(open.color)}>
                <span className="task-form__panel-title">{open.label}</span>
                {open.editor}
              </div>
            )}

            {error && <div className="task-form__error">{error}</div>}

            <div className="task-form__footer">
              {task && onDelete ? (
                <Button variant="danger" onClick={onDelete}>
                  Delete
                </Button>
              ) : (
                <span className="task-form__hint">⏎ to add</span>
              )}
              <div className="task-form__footer-right">
                <Button onClick={onClose}>Cancel</Button>
                <button type="button" className="task-form__save" onClick={handleSubmit}>
                  {saveLabel}
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
