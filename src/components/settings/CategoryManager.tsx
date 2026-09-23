import { Fragment, useRef, useState } from "react";
import { getTemplateTasks } from "../../db/queries";
import { useReorderDrag } from "../../hooks/useReorderDrag";
import type { Tag, Template, TemplateTaskBlueprint } from "../../types";
import { PRESET_COLORS } from "../../utils/tagColors";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { EditIcon, TagIcon, TrashIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import "./CategoryManager.css";

interface CategoryManagerProps {
  tags: Tag[];
  templates: Template[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  onUpdateTag: (id: string, name: string, color: string) => void;
  onDeleteTag: (id: string) => void;
  onReorderTags: (tagIds: string[]) => void;
  onSaveTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onDeleteTemplate: (id: string) => void;
}

// Categories and their optional "starter tasks" (what used to be a
// separate, confusingly-named "Templates" section) live in one place now -
// a category only ever has at most one such list under the hood, so this is
// purely a UI reorganization: the same createTag/createTemplateFromTasks/
// deleteTemplate functions everyone's existing data already goes through.
export function CategoryManager({
  tags,
  templates,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onReorderTags,
  onSaveTemplate,
  onDeleteTemplate,
}: CategoryManagerProps) {
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState("");
  const [draftColor, setDraftColor] = useState("");
  // Starter tasks are edited as part of the same session as the name/color
  // - one Cancel discards everything below, one Done saves all of it at
  // once, instead of the tasks list having its own separate save action.
  const [draftTasks, setDraftTasks] = useState<TemplateTaskBlueprint[]>([]);
  const [draftTasksLoading, setDraftTasksLoading] = useState(false);
  const [newTaskTitle, setNewTaskTitle] = useState("");

  const [creating, setCreating] = useState(false);
  const [newName, setNewName] = useState("");
  const [newColor, setNewColor] = useState(PRESET_COLORS[0]);

  const [confirmingDeleteId, setConfirmingDeleteId] = useState<string | null>(null);

  // Guards against startEditing's async getTemplateTasks() call landing
  // after a newer one - switching from editing category A to category B
  // before A's fetch resolves must never let A's stale result overwrite B's
  // draft tasks.
  const editRequestRef = useRef(0);

  // Press-and-hold (touch) / grab-anywhere-with-a-movement-threshold
  // (mouse) reordering - same interaction model now shared with the day
  // view's tag groups and tasks (see useReorderDrag), so nothing about this
  // list needs its own drag handling any more.
  const { draggedId: draggedTagId, dropIndex, registerItemRef, bindPointerDown } = useReorderDrag(
    (nextIds) => onReorderTags(nextIds),
  );

  function startEditing(tag: Tag) {
    setEditingId(tag.id);
    setDraftName(tag.name);
    setDraftColor(tag.color);
    setNewTaskTitle("");
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

  function addDraftTask() {
    const trimmed = newTaskTitle.trim();
    if (!trimmed) return;
    setDraftTasks((prev) => [...prev, { title: trimmed, notes: null, time: null, priority: "medium" }]);
    setNewTaskTitle("");
  }

  function removeDraftTask(index: number) {
    setDraftTasks((prev) => prev.filter((_, i) => i !== index));
  }

  function commitEdit() {
    const trimmed = draftName.trim();
    const tag = tags.find((t) => t.id === editingId);
    if (editingId !== null && trimmed) {
      onUpdateTag(editingId, trimmed, draftColor);
    }
    if (tag) {
      const existing = templates.find((t) => t.tagId === tag.id);
      if (draftTasks.length > 0) {
        onSaveTemplate(tag, draftTasks);
      } else if (existing) {
        onDeleteTemplate(existing.id);
      }
    }
    setEditingId(null);
  }

  async function handleCreate() {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const tag = await onCreateTag(trimmed, newColor);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
    setCreating(false);
    // Jump straight into editing the category you just made - that's also
    // where starter tasks now live, one tap away instead of hunting for it.
    startEditing(tag);
  }

  function cancelCreate() {
    setCreating(false);
    setNewName("");
    setNewColor(PRESET_COLORS[0]);
  }

  return (
    <Card className="category-manager">
      {creating ? (
        <div className="category-manager__row category-manager__row--editing">
          <div className="category-manager__editing-fields">
            <input
              className="category-manager__input category-manager__input--name"
              placeholder="Category name"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleCreate();
                if (e.key === "Escape") cancelCreate();
              }}
              autoFocus
            />
            <div className="category-manager__colors">
              {PRESET_COLORS.map((c) => (
                <button
                  type="button"
                  key={c}
                  className={`category-manager__swatch ${
                    newColor === c ? "category-manager__swatch--active" : ""
                  }`}
                  style={{ background: c }}
                  onClick={() => setNewColor(c)}
                  aria-label={`Choose color ${c}`}
                />
              ))}
            </div>
          </div>
          <div className="category-manager__form-actions">
            <Button onClick={cancelCreate}>Cancel</Button>
            <Button variant="primary" onClick={handleCreate}>
              Create
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={() => setCreating(true)}>+ New category</Button>
      )}

      {tags.length === 0 ? (
        <EmptyState icon={<TagIcon size={16} />}>No categories yet - create one above.</EmptyState>
      ) : (
        <div className="category-manager__list">
          {tags.map((tag, index) => {
            const isEditing = editingId === tag.id;

            if (isEditing) {
              return (
                <div className="category-manager__item category-manager__item--editing" key={tag.id}>
                  <div className="category-manager__row category-manager__row--editing">
                    <div className="category-manager__editing-fields">
                      <input
                        className="category-manager__input category-manager__input--name"
                        value={draftName}
                        onChange={(e) => setDraftName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") commitEdit();
                          if (e.key === "Escape") setEditingId(null);
                        }}
                        autoFocus
                      />
                      <div className="category-manager__colors">
                        {PRESET_COLORS.map((c) => (
                          <button
                            type="button"
                            key={c}
                            className={`category-manager__swatch ${
                              draftColor === c ? "category-manager__swatch--active" : ""
                            }`}
                            style={{ background: c }}
                            onClick={() => setDraftColor(c)}
                            aria-label={`Choose color ${c}`}
                          />
                        ))}
                      </div>
                    </div>
                  </div>

                  <div className="category-manager__starter">
                    <span className="settings__label">Starter tasks</span>
                    <span className="category-manager__hint">
                      Stamp this list onto any day for {tag.name} from the day panel's template
                      picker.
                    </span>
                    {draftTasksLoading ? (
                      <div className="category-manager__starter-list">
                        {[0, 1].map((i) => (
                          <Skeleton key={i} height={28} radius="var(--radius-sm)" />
                        ))}
                      </div>
                    ) : (
                      <>
                        {draftTasks.length === 0 && (
                          <span className="category-manager__hint">No starter tasks yet.</span>
                        )}
                        {draftTasks.length > 0 && (
                          <div className="category-manager__starter-list">
                            {draftTasks.map((t, i) => (
                              <div className="category-manager__starter-row" key={i}>
                                <span className="category-manager__starter-title">{t.title}</span>
                                <button
                                  type="button"
                                  className="category-manager__icon-btn category-manager__icon-btn--danger"
                                  aria-label={`Remove ${t.title}`}
                                  onClick={() => removeDraftTask(i)}
                                >
                                  <TrashIcon size={13} />
                                </button>
                              </div>
                            ))}
                          </div>
                        )}
                        <div className="category-manager__starter-add">
                          <input
                            className="category-manager__input"
                            placeholder="Add a starter task"
                            value={newTaskTitle}
                            onChange={(e) => setNewTaskTitle(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") {
                                e.preventDefault();
                                addDraftTask();
                              }
                            }}
                          />
                          <Button onClick={addDraftTask}>Add</Button>
                        </div>
                      </>
                    )}
                  </div>

                  <div className="category-manager__form-actions">
                    <Button onClick={() => setEditingId(null)}>Cancel</Button>
                    <Button variant="primary" onClick={commitEdit} disabled={draftTasksLoading}>
                      Done
                    </Button>
                  </div>
                </div>
              );
            }

            if (confirmingDeleteId === tag.id) {
              return (
                <div className="category-manager__item" key={tag.id}>
                  <div className="category-manager__row">
                    <span className="category-manager__tag-name">Delete {tag.name}?</span>
                    <div className="category-manager__form-actions">
                      <Button onClick={() => setConfirmingDeleteId(null)}>Cancel</Button>
                      <Button
                        variant="danger"
                        onClick={() => {
                          onDeleteTag(tag.id);
                          setConfirmingDeleteId(null);
                        }}
                      >
                        Delete
                      </Button>
                    </div>
                  </div>
                </div>
              );
            }

            return (
              <Fragment key={tag.id}>
                {draggedTagId !== null && dropIndex === index && (
                  <div className="category-manager__drop-line" />
                )}
                <div
                  className={`category-manager__item ${
                    draggedTagId === tag.id ? "category-manager__item--dragging" : ""
                  }`}
                  ref={registerItemRef(tag.id)}
                >
                  <div
                    className="category-manager__row"
                    onPointerDown={bindPointerDown(tag.id, () => tags.map((t) => t.id))}
                  >
                    <span
                      className="category-manager__dot"
                      style={{ background: tag.color }}
                      aria-hidden="true"
                    />
                    <span className="category-manager__tag-name">{tag.name}</span>
                    <div className="category-manager__actions">
                      <button
                        type="button"
                        className="category-manager__icon-btn category-manager__icon-btn--row"
                        title="Edit category"
                        aria-label={`Edit ${tag.name}`}
                        onClick={() => startEditing(tag)}
                      >
                        <EditIcon size={16} />
                      </button>
                      <button
                        type="button"
                        className="category-manager__icon-btn category-manager__icon-btn--row category-manager__icon-btn--danger"
                        title="Delete category"
                        aria-label={`Delete category ${tag.name}`}
                        onClick={() => setConfirmingDeleteId(tag.id)}
                      >
                        <TrashIcon size={16} />
                      </button>
                    </div>
                  </div>
                </div>
              </Fragment>
            );
          })}
          {draggedTagId !== null && dropIndex === tags.length && (
            <div className="category-manager__drop-line" />
          )}
        </div>
      )}
    </Card>
  );
}

