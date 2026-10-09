import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getTemplateTasks } from "../../db/queries";
import type { Tag, Template, TemplateTaskBlueprint } from "../../types";
import { PRESET_COLORS } from "../../utils/tagColors";
import { Button } from "../ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, TagIcon, TrashIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { TemplateTaskModal } from "./TemplateTaskModal";
import "./SettingsModal.css";
import "./TemplatesModal.css";

interface TemplatesModalProps {
  tags: Tag[];
  templates: Template[];
  onClose: () => void;
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  onUpdateTag: (id: string, name: string, color: string) => void;
  onDeleteTag: (id: string) => void;
  onSaveTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void | Promise<void>;
  onDeleteTemplate: (id: string) => void;
}

// A full browse-and-edit view of every template, reached straight from the
// calendar header - this is now the only place templates are managed
// (Settings used to have its own flat "Templates" list/editor; that's been
// removed in favor of this one, so there's a single place to do it).
//
// Everything here saves the instant it happens - name on blur, color and
// starter tasks immediately - so there's no Save/Cancel step at all; the
// back arrow (or the modal's own close button) is just "I'm done looking
// at this," never a commit point. `liveTag` is the one piece of state that
// makes this work for a brand-new template: it starts null (nothing's been
// created yet) and becomes real the moment there's something worth saving
// (a name, on blur) - see ensureTag().
export function TemplatesModal({
  tags,
  templates,
  onClose,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onSaveTemplate,
  onDeleteTemplate,
}: TemplatesModalProps) {
  const [editingKey, setEditingKey] = useState<string | null>(null);
  const [liveTag, setLiveTag] = useState<Tag | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState(PRESET_COLORS[0]);
  const [draftTasks, setDraftTasks] = useState<TemplateTaskBlueprint[]>([]);
  const [draftTasksLoading, setDraftTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");
  const [editingTaskIndex, setEditingTaskIndex] = useState<number | null>(null);
  const [justAddedIndex, setJustAddedIndex] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);
  const [colorsOpen, setColorsOpen] = useState(false);

  const editRequestRef = useRef(0);
  // Guards against a double-tap (or a task-add landing before the name's
  // own blur-create resolves) from creating two tags for the same session -
  // every caller awaits this same in-flight promise instead of each firing
  // its own onCreateTag.
  const creatingTagPromiseRef = useRef<Promise<Tag> | null>(null);

  function taskCountFor(tag: Tag): number {
    const template = templates.find((t) => t.tagId === tag.id);
    return template?.taskCount ?? 0;
  }

  function startCreate() {
    setColorsOpen(false);
    setEditingKey("__new__");
    setLiveTag(null);
    setDraftName("");
    setDraftColor(PRESET_COLORS[0]);
    setDraftTasks([]);
    setDraftTasksLoading(false);
    setNewTaskTitle("");
    setEditingTaskIndex(null);
    setError(null);
  }

  function startEdit(tag: Tag) {
    setColorsOpen(false);
    setEditingKey(tag.id);
    setLiveTag(tag);
    setDraftName(tag.name);
    setDraftColor(tag.color);
    setNewTaskTitle("");
    setEditingTaskIndex(null);
    setError(null);
    const requestId = ++editRequestRef.current;
    const template = templates.find((t) => t.tagId === tag.id);
    if (template) {
      setDraftTasksLoading(true);
      setDraftTasks([]);
      getTemplateTasks(template.id).then((result) => {
        if (editRequestRef.current !== requestId) return;
        setDraftTasks(result);
        setDraftTasksLoading(false);
      });
    } else {
      setDraftTasks([]);
      setDraftTasksLoading(false);
    }
  }

  /** The tag this session is for, creating it for real the first time
   *  something actually needs saving (a starter task, or a name blur) -
   *  never called just for picking a color on an as-yet-nameless draft. */
  async function ensureTag(): Promise<Tag | null> {
    if (liveTag) return liveTag;
    const trimmed = draftName.trim();
    if (!trimmed) {
      setError("Give it a name first.");
      return null;
    }
    if (creatingTagPromiseRef.current) return creatingTagPromiseRef.current;
    const promise = onCreateTag(trimmed, draftColor).then((tag) => {
      setLiveTag(tag);
      setEditingKey(tag.id);
      return tag;
    });
    creatingTagPromiseRef.current = promise;
    try {
      return await promise;
    } finally {
      creatingTagPromiseRef.current = null;
    }
  }

  function commitName() {
    const trimmed = draftName.trim();
    if (!trimmed) return;
    if (liveTag) {
      if (liveTag.name !== trimmed) {
        onUpdateTag(liveTag.id, trimmed, liveTag.color);
        setLiveTag({ ...liveTag, name: trimmed });
      }
    } else {
      void ensureTag();
    }
  }

  function selectColor(c: string) {
    setDraftColor(c);
    if (liveTag && liveTag.color !== c) {
      onUpdateTag(liveTag.id, liveTag.name, c);
      setLiveTag({ ...liveTag, color: c });
    }
  }

  async function addTask() {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    const tag = await ensureTag();
    if (!tag) return;
    const next = [...draftTasks, { title: trimmed, notes: null, time: null, priority: "medium" as const }];
    setDraftTasks(next);
    setJustAddedIndex(next.length - 1);
    setNewTaskTitle("");
    window.setTimeout(() => setJustAddedIndex(null), 360);
    await onSaveTemplate(tag, next);
  }

  async function removeTask(index: number) {
    const next = draftTasks.filter((_, i) => i !== index);
    setDraftTasks(next);
    if (editingTaskIndex === index) setEditingTaskIndex(null);
    if (!liveTag) return;
    if (next.length === 0) {
      const existing = templates.find((t) => t.tagId === liveTag.id);
      if (existing) onDeleteTemplate(existing.id);
    } else {
      await onSaveTemplate(liveTag, next);
    }
  }

  async function saveEditedTask(index: number, task: TemplateTaskBlueprint) {
    const next = draftTasks.map((t, i) => (i === index ? task : t));
    setDraftTasks(next);
    setEditingTaskIndex(null);
    if (liveTag) await onSaveTemplate(liveTag, next);
  }

  return (
    <Modal title={editingKey ? (liveTag ? "Edit template" : "New template") : "Templates"} onClose={onClose}>
      {editingKey ? (
        <div className="templates-modal-edit">
          <button type="button" className="templates-modal-edit__back" onClick={() => setEditingKey(null)}>
            <ChevronLeftIcon size={16} />
            Templates
          </button>

          {/* Name and color as plain settings rows - the same grouped look
              as the rest of Settings. Tapping Color opens the color circles
              underneath. */}
          <div className="settings-group-wrap">
            <div className="settings-group">
              <label className="settings-group__row">
                <span className="settings-group__label templates-modal-edit__row-label">Name</span>
                <input
                  className="settings-group__input templates-modal-edit__name-input"
                  placeholder="e.g. Morning routine"
                  aria-label="Template name"
                  value={draftName}
                  onChange={(e) => {
                    setDraftName(e.target.value);
                    setError(null);
                  }}
                  onBlur={commitName}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      commitName();
                      (e.target as HTMLInputElement).blur();
                    }
                  }}
                  autoFocus={!liveTag}
                />
              </label>
              <button
                type="button"
                className="settings-group__row"
                aria-expanded={colorsOpen}
                onClick={() => setColorsOpen((v) => !v)}
              >
                <span className="settings-group__label">Color</span>
                <span
                  className="templates-modal-edit__color-dot"
                  style={{ background: draftColor }}
                  aria-hidden="true"
                />
                <ChevronRightIcon
                  size={15}
                  className={`settings-group__chevron ${colorsOpen ? "settings-group__chevron--open" : ""}`}
                />
              </button>
              {colorsOpen && (
                <div className="settings-group__expand templates-modal-edit__colors" role="radiogroup" aria-label="Color">
                  {PRESET_COLORS.map((c) => (
                    <button
                      type="button"
                      key={c}
                      role="radio"
                      aria-checked={draftColor === c}
                      className={`templates-modal-edit__swatch ${
                        draftColor === c ? "templates-modal-edit__swatch--active" : ""
                      }`}
                      style={{ background: c } as CSSProperties}
                      onClick={() => selectColor(c)}
                      aria-label={`Choose color ${c}`}
                    />
                  ))}
                </div>
              )}
            </div>
            {error ? (
              <span className="settings-footnote settings-footnote--warning">{error}</span>
            ) : (
              <span className="settings-footnote">
                {liveTag ? "Changes save automatically." : "Name it first - it's saved as soon as it has a name."}
              </span>
            )}
          </div>

          <div className="settings-group-wrap">
            <span className="settings-group__title">
              Starter tasks{draftTasks.length > 0 ? ` · ${draftTasks.length}` : ""}
            </span>
            <div className="settings-group">
              {draftTasksLoading
                ? [0, 1].map((i) => (
                    <div className="settings-group__row" key={i}>
                      <Skeleton width="55%" height="0.85em" />
                    </div>
                  ))
                : draftTasks.map((t, i) => (
                    <div
                      className={`settings-group__row settings-group__row--split templates-modal-edit__task-row ${
                        justAddedIndex === i ? "templates-modal-edit__task-row--entering" : ""
                      }`}
                      key={i}
                    >
                      <button
                        type="button"
                        className="settings-group__row-main"
                        onClick={() => setEditingTaskIndex(i)}
                      >
                        <span
                          className="templates-modal-edit__task-dot"
                          style={{ background: draftColor }}
                          aria-hidden="true"
                        />
                        <span className="settings-group__label">{t.title}</span>
                        {t.time && <span className="settings-group__value">{t.time}</span>}
                      </button>
                      <button
                        type="button"
                        className="templates-modal-edit__remove"
                        aria-label={`Remove ${t.title}`}
                        onClick={() => void removeTask(i)}
                      >
                        <TrashIcon size={14} />
                      </button>
                    </div>
                  ))}
              <div className="settings-group__row">
                <span className="templates-modal-edit__add-plus" aria-hidden="true">
                  +
                </span>
                <input
                  className="settings-group__input templates-modal-edit__add-input"
                  placeholder="Add a starter task"
                  aria-label="Starter task title"
                  value={newTaskTitle}
                  onChange={(e) => setNewTaskTitle(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      void addTask();
                    }
                  }}
                />
                <button
                  type="button"
                  className="settings-row-action"
                  onClick={() => void addTask()}
                  disabled={!newTaskTitle.trim()}
                >
                  Add
                </button>
              </div>
            </div>
            <span className="settings-footnote">
              {draftTasks.length === 0
                ? "They're added to any day you use this template on."
                : "Tap a task to change its time, notes or priority."}
            </span>
          </div>

          {liveTag && (
            <div className="settings-group-wrap">
              <div className="settings-group">
                {confirmingDeleteId ? (
                  <div className="settings-group__row">
                    <span className="settings-group__label templates-modal-edit__confirm-text">
                      Delete {liveTag.name} and its starter tasks?
                    </span>
                    <button
                      type="button"
                      className="templates-modal-edit__cancel"
                      onClick={() => setConfirmingDeleteId(null)}
                    >
                      Cancel
                    </button>
                    <button
                      type="button"
                      className="settings-row-action settings-row-action--danger"
                      onClick={() => {
                        onDeleteTag(confirmingDeleteId);
                        setConfirmingDeleteId(null);
                        setEditingKey(null);
                      }}
                    >
                      Delete
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className="settings-group__row settings-group__row--danger"
                    onClick={() => setConfirmingDeleteId(liveTag.id)}
                  >
                    Delete template
                  </button>
                )}
              </div>
            </div>
          )}

          <Button variant="primary" className="settings-primary-action" onClick={() => setEditingKey(null)}>
            Done
          </Button>

          {editingTaskIndex !== null && draftTasks[editingTaskIndex] && (
            <TemplateTaskModal
              task={draftTasks[editingTaskIndex]}
              onSave={(task) => void saveEditedTask(editingTaskIndex, task)}
              onDelete={() => void removeTask(editingTaskIndex)}
              onClose={() => setEditingTaskIndex(null)}
            />
          )}
        </div>
      ) : (
        <div className="settings-pages templates-modal-list">
          <div className="settings-group-wrap">
            <div className="settings-group">
              <button
                type="button"
                className="settings-group__row settings-group__row--accent"
                onClick={startCreate}
              >
                <span className="templates-modal-list__plus" aria-hidden="true">
                  +
                </span>
                <span className="settings-group__label">New template</span>
              </button>
              {tags.map((tag) => {
                const count = taskCountFor(tag);
                return (
                  <button
                    type="button"
                    className="settings-group__row"
                    key={tag.id}
                    onClick={() => startEdit(tag)}
                  >
                    <span
                      className="templates-modal-list__swatch"
                      style={{ "--card-color": tag.color } as CSSProperties}
                      aria-hidden="true"
                    >
                      <TagIcon size={14} />
                    </span>
                    <span className="settings-group__label">{tag.name}</span>
                    <span className="settings-group__value">
                      {count === 0 ? "No tasks" : `${count} ${count === 1 ? "task" : "tasks"}`}
                    </span>
                    <ChevronRightIcon size={15} className="settings-group__chevron" />
                  </button>
                );
              })}
            </div>
            <span className="settings-footnote">
              {tags.length === 0
                ? "A template groups tasks you add together - like a Morning routine."
                : "Use one from + on any day to add its tasks at once."}
            </span>
          </div>
        </div>
      )}
    </Modal>
  );
}
