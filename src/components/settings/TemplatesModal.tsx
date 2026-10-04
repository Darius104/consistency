import { useRef, useState } from "react";
import type { CSSProperties } from "react";
import { getTemplateTasks } from "../../db/queries";
import type { Tag, Template, TemplateTaskBlueprint } from "../../types";
import { PRESET_COLORS } from "../../utils/tagColors";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { ChevronLeftIcon, EditIcon, TagIcon, TrashIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import { TemplateTaskModal } from "./TemplateTaskModal";
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
            <ChevronLeftIcon size={14} />
            All templates
          </button>

          <div
            className="templates-modal-edit__hero"
            style={{ "--hero-color": draftColor } as CSSProperties}
          >
            <input
              className="templates-modal-edit__hero-name"
              placeholder="Template name"
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
              autoFocus
            />
            <div className="templates-modal-edit__colors">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`templates-modal-edit__swatch ${
                    draftColor === c ? "templates-modal-edit__swatch--active" : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => selectColor(c)}
                  aria-label={`Choose color ${c}`}
                />
              ))}
            </div>
          </div>

          {error && <div className="templates-modal-edit__error">{error}</div>}

          <div className="templates-modal-edit__tasks">
            <span className="templates-modal-edit__section-label">
              Starter tasks{draftTasks.length > 0 ? ` (${draftTasks.length})` : ""}
            </span>
            {draftTasksLoading ? (
              <div className="templates-modal-edit__task-list">
                {[0, 1].map((i) => (
                  <Skeleton key={i} height={28} radius="var(--radius-sm)" />
                ))}
              </div>
            ) : (
              <>
                {draftTasks.length === 0 ? (
                  <div className="templates-modal-edit__empty">
                    Add a few tasks below - they'll stamp onto any day this template is used.
                  </div>
                ) : (
                  <div className="templates-modal-edit__task-list">
                    {draftTasks.map((t, i) => (
                      <div
                        className={`templates-modal-edit__task-row ${
                          justAddedIndex === i ? "templates-modal-edit__task-row--entering" : ""
                        }`}
                        key={i}
                      >
                        <span
                          className="templates-modal-edit__task-dot"
                          style={{ background: draftColor }}
                          aria-hidden="true"
                        />
                        <button
                          type="button"
                          className="templates-modal-edit__task-title"
                          onClick={() => setEditingTaskIndex(i)}
                        >
                          {t.title}
                        </button>
                        <button
                          type="button"
                          className="templates-modal-edit__icon-btn"
                          aria-label={`Edit ${t.title}`}
                          onClick={() => setEditingTaskIndex(i)}
                        >
                          <EditIcon size={13} />
                        </button>
                        <button
                          type="button"
                          className="templates-modal-edit__icon-btn templates-modal-edit__icon-btn--danger"
                          aria-label={`Remove ${t.title}`}
                          onClick={() => void removeTask(i)}
                        >
                          <TrashIcon size={13} />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
                <div className="templates-modal-edit__task-add">
                  <input
                    className="templates-modal-edit__task-add-input"
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
                  <Button onClick={() => void addTask()}>Add</Button>
                </div>
              </>
            )}
          </div>

          <div className="templates-modal-edit__actions">
            {liveTag && (
              <button
                type="button"
                className="templates-modal-edit__delete-link"
                onClick={() => setConfirmingDeleteId(liveTag.id)}
              >
                <TrashIcon size={13} />
                Delete template
              </button>
            )}
            <div className="templates-modal-edit__actions-right">
              <Button variant="primary" onClick={() => setEditingKey(null)}>
                Done
              </Button>
            </div>
          </div>

          {confirmingDeleteId && (
            <div className="templates-modal-edit__confirm">
              <span>Delete {liveTag?.name}? This removes its starter tasks too.</span>
              <div className="templates-modal-edit__confirm-actions">
                <Button onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
                <Button
                  variant="danger"
                  onClick={() => {
                    onDeleteTag(confirmingDeleteId);
                    setConfirmingDeleteId(null);
                    setEditingKey(null);
                  }}
                >
                  Delete
                </Button>
              </div>
            </div>
          )}

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
        <div className="templates-modal-grid">
          <button type="button" className="templates-modal-card templates-modal-card--new" onClick={startCreate}>
            <span className="templates-modal-card--new__plus">+</span>
            New template
          </button>
          {tags.map((tag) => {
            const count = taskCountFor(tag);
            return (
              <button
                type="button"
                className="templates-modal-card"
                key={tag.id}
                style={{ "--card-color": tag.color } as CSSProperties}
                onClick={() => startEdit(tag)}
              >
                <span className="templates-modal-card__name">{tag.name}</span>
                <span className="templates-modal-card__count">
                  {count === 0 ? "No starter tasks" : `${count} starter ${count === 1 ? "task" : "tasks"}`}
                </span>
              </button>
            );
          })}
          {tags.length === 0 && (
            <div className="templates-modal-grid__empty-wrap">
              <EmptyState icon={<TagIcon size={16} />}>
                No templates yet - create your first one above.
              </EmptyState>
            </div>
          )}
        </div>
      )}
    </Modal>
  );
}
