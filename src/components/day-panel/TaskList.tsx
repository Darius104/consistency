import { Fragment, useEffect, useRef, useState } from "react";
import { useReorderDrag } from "../../hooks/useReorderDrag";
import type { DayNote, Tag, Task, Template, TemplateTaskBlueprint } from "../../types";
import { EmptyState } from "../ui/EmptyState";
import { CheckIcon } from "../ui/icons";
import { NoteRow } from "./NoteRow";
import { TaskGroup } from "./TaskGroup";
import { TaskItem } from "./TaskItem";
import "./TaskList.css";

const NO_TAG_KEY = "none";
const AUTO_COLLAPSE_DELAY_MS = 250;

// Tag groups and notes share one combined drag domain (see layoutDrag
// below) - these prefixes are how a single reordered id array is told
// apart back into "which groups" vs "which notes" after a drop.
function groupItemId(key: string): string {
  return `group:${key}`;
}
function noteItemId(id: string): string {
  return `note:${id}`;
}

interface Occurrence {
  task: Task;
  completed: boolean;
}

interface Group {
  key: string;
  scopedKey: string;
  tag: Tag | undefined;
  occurrences: Occurrence[];
}

interface TaskListProps {
  selectedDate: string;
  occurrences: Occurrence[];
  tags: Tag[];
  onToggle: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (task: Task) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onReorderTags: (tagIds: string[]) => void;
  onSaveAsTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onRemoveTemplate: (templateId: string) => void;
  templates: Template[];
  templateTaskBlueprints: Record<string, TemplateTaskBlueprint[]>;
  notes: DayNote[];
  onEditNote: (note: DayNote) => void;
  onDeleteNote: (id: string) => void;
  onReorderNotePositions: (
    updates: { id: string; afterGroupKey: string | null; sortOrder: number }[],
  ) => void;
}

function sortOccurrences(occurrences: Occurrence[]): Occurrence[] {
  return [...occurrences].sort(
    (a, b) => a.task.sortOrder - b.task.sortOrder || a.task.id.localeCompare(b.task.id),
  );
}

/** Whether today's actual tasks for a category are exactly the template's
 *  saved starter tasks - order-independent, but every task must have a
 *  one-to-one match (same title/notes/time/priority) with no leftovers on
 *  either side. Used to tell "a template exists" apart from "today still
 *  matches it", since adding or removing a task after saving is exactly
 *  the case that should un-light the bookmark (see TaskGroup's hasTemplate). */
function occurrencesMatchTemplate(
  occurrences: Occurrence[],
  blueprint: TemplateTaskBlueprint[],
): boolean {
  if (occurrences.length !== blueprint.length) return false;
  const remaining = [...blueprint];
  for (const { task } of occurrences) {
    const idx = remaining.findIndex(
      (b) =>
        b.title === task.title &&
        b.notes === task.notes &&
        b.time === task.time &&
        b.priority === task.priority,
    );
    if (idx === -1) return false;
    remaining.splice(idx, 1);
  }
  return true;
}

export function TaskList({
  selectedDate,
  occurrences,
  tags,
  onToggle,
  onView,
  onDelete,
  onReorderTasks,
  onReorderTags,
  onSaveAsTemplate,
  onRemoveTemplate,
  templates,
  templateTaskBlueprints,
  notes,
  onEditNote,
  onDeleteNote,
  onReorderNotePositions,
}: TaskListProps) {
  // Collapse state and "have we seen this group finish before" tracking are
  // both scoped to `${selectedDate}:${tagKey}` - a tag collapsing because you
  // finished it today must not make that same tag show collapsed (and hide
  // fresh, unfinished tasks) on a different day.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const seenKeys = useRef<Set<string>>(new Set());
  const wasComplete = useRef<Record<string, boolean>>({});

  // Reordered via each row's own small grab handle (see useReorderDrag's
  // bindHandlePointerDown) rather than grab-anywhere, so the rest of the
  // panel keeps ordinary native scrolling. Tasks within their own group are
  // one domain; tag groups AND notes share a second, combined domain (see
  // layoutDrag below) so a note can be dropped anywhere among the groups,
  // not just reordered against other notes ("No tag" excluded from that
  // combined domain - it isn't a real group, it always stays last).
  const taskDrag = useReorderDrag((nextTaskIds) => onReorderTasks(nextTaskIds));
  const layoutDrag = useReorderDrag((nextIds) => {
    const nextTagIds = nextIds
      .filter((id) => id.startsWith("group:"))
      .map((id) => id.slice("group:".length));
    onReorderTags(nextTagIds);

    // Whichever group id most recently passed in this same reordered list
    // becomes every following note's new anchor, until the next group -
    // notes before the first group anchor to null ("top of the day").
    const noteUpdates: { id: string; afterGroupKey: string | null; sortOrder: number }[] = [];
    let currentAnchor: string | null = null;
    let sortOrder = 0;
    for (const id of nextIds) {
      if (id.startsWith("group:")) {
        currentAnchor = id.slice("group:".length);
        sortOrder = 0;
      } else if (id.startsWith("note:")) {
        noteUpdates.push({
          id: id.slice("note:".length),
          afterGroupKey: currentAnchor,
          sortOrder: sortOrder++,
        });
      }
    }
    onReorderNotePositions(noteUpdates);
  });

  const tagById = new Map(tags.map((t) => [t.id, t]));

  const groupMap = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = occ.task.tagId ? String(occ.task.tagId) : NO_TAG_KEY;
    const bucket = groupMap.get(key);
    if (bucket) bucket.push(occ);
    else groupMap.set(key, [occ]);
  }

  const groups: Group[] = Array.from(groupMap.entries())
    .map(([key, groupOccurrences]) => ({
      key,
      scopedKey: `${selectedDate}:${key}`,
      tag: key === NO_TAG_KEY ? undefined : tagById.get(key),
      occurrences: sortOccurrences(groupOccurrences),
    }))
    .sort((a, b) => {
      if (a.key === NO_TAG_KEY) return 1;
      if (b.key === NO_TAG_KEY) return -1;
      return (a.tag?.sortOrder ?? 0) - (b.tag?.sortOrder ?? 0);
    });

  const sortedNotes = [...notes].sort((a, b) => a.sortOrder - b.sortOrder);

  // Buckets of notes by which group they're anchored after (see
  // DayNote.afterGroupKey) - falls back to "before everything" if a note's
  // anchor doesn't match any group actually showing today (e.g. every task
  // under that tag was removed for this day), so a note can never silently
  // disappear.
  const notesByAnchor = new Map<string | null, DayNote[]>();
  for (const note of sortedNotes) {
    const anchor = groups.some((g) => g.key === note.afterGroupKey) ? note.afterGroupKey : null;
    const bucket = notesByAnchor.get(anchor);
    if (bucket) bucket.push(note);
    else notesByAnchor.set(anchor, [note]);
  }

  // One combined, ordered list for rendering: notes anchored before any
  // group, then each group followed immediately by whichever notes are
  // anchored to it. "No category" is never draggable (it always stays
  // last), but notes may still anchor to and render after it.
  interface LayoutEntry {
    itemId: string;
    note?: DayNote;
    group?: Group;
    draggable: boolean;
  }

  const layout: LayoutEntry[] = [];
  for (const note of notesByAnchor.get(null) ?? []) {
    layout.push({ itemId: noteItemId(note.id), note, draggable: true });
  }
  for (const group of groups) {
    layout.push({
      itemId: groupItemId(group.key),
      group,
      draggable: group.key !== NO_TAG_KEY,
    });
    for (const note of notesByAnchor.get(group.key) ?? []) {
      layout.push({ itemId: noteItemId(note.id), note, draggable: true });
    }
  }

  const draggableLayout = layout.filter((entry) => entry.draggable);

  // App.tsx builds a brand-new `occurrences` array on every render, even
  // when nothing actually changed (e.g. a background sync re-rendering the
  // whole tree). Depending on that array directly would tear down and
  // reschedule the collapse effect below on every such render, cancelling
  // an in-flight collapse timer before it ever fires. This signature only
  // changes when a task's completion actually changes, so it's what the
  // effect should really be reacting to.
  const completionSignature = occurrences
    .map((o) => `${o.task.id}:${o.completed}`)
    .join(",");

  useEffect(() => {
    const timers: number[] = [];

    for (const g of groups) {
      const isComplete = g.occurrences.length > 0 && g.occurrences.every((o) => o.completed);

      if (!seenKeys.current.has(g.scopedKey)) {
        // First time this day+tag combination has been seen: if it's
        // already fully done (e.g. reopening a finished day), start collapsed.
        seenKeys.current.add(g.scopedKey);
        if (isComplete) {
          setCollapsed((prev) => new Set(prev).add(g.scopedKey));
        }
      } else if (isComplete && wasComplete.current[g.scopedKey] === false) {
        // Just finished live - collapse after a short beat so the
        // checkmark/green state actually registers first.
        const timer = window.setTimeout(() => {
          setCollapsed((prev) => new Set(prev).add(g.scopedKey));
        }, AUTO_COLLAPSE_DELAY_MS);
        timers.push(timer);
      }

      wasComplete.current[g.scopedKey] = isComplete;
    }

    return () => {
      timers.forEach((t) => window.clearTimeout(t));
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [completionSignature, selectedDate]);

  // Which task/group is currently being dragged, derived from the hooks'
  // own draggedId rather than tracked separately - a task never changes
  // group mid-drag (only its position within one), so scanning the live
  // (always-current) `groups` for whichever one contains draggedTaskId is
  // all that's needed to know where to render the task's drop-line.
  const draggedTaskId = taskDrag.draggedId;
  const taskDropIndex = taskDrag.dropIndex;
  const draggingTaskGroupKey = draggedTaskId
    ? groups.find((g) => g.occurrences.some((o) => o.task.id === draggedTaskId))?.key ?? null
    : null;

  const draggedLayoutId = layoutDrag.draggedId;
  const layoutDropIndex = layoutDrag.dropIndex;
  const draggedGroupKey = draggedLayoutId?.startsWith("group:")
    ? draggedLayoutId.slice("group:".length)
    : null;
  const draggedNoteId = draggedLayoutId?.startsWith("note:")
    ? draggedLayoutId.slice("note:".length)
    : null;

  function toggleGroup(scopedKey: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(scopedKey)) next.delete(scopedKey);
      else next.add(scopedKey);
      return next;
    });
  }

  if (occurrences.length === 0 && notes.length === 0) {
    return (
      <EmptyState
        key={selectedDate}
        icon={<CheckIcon size={16} />}
        iconClassName="empty-state__icon--success"
      >
        Nothing scheduled for this day.
      </EmptyState>
    );
  }

  let draggableIndex = -1;

  return (
    <div className="task-list">
      {layout.map((entry) => {
        if (entry.draggable) draggableIndex += 1;
        const thisDraggableIndex = entry.draggable ? draggableIndex : null;
        const dropLineBefore =
          draggedLayoutId !== null &&
          thisDraggableIndex !== null &&
          layoutDropIndex === thisDraggableIndex && (
            <div className="task-list__drop-line" />
          );

        if (entry.note) {
          const note = entry.note;
          return (
            <Fragment key={entry.itemId}>
              {dropLineBefore}
              <div ref={layoutDrag.registerItemRef(entry.itemId)}>
                <NoteRow
                  note={note}
                  dragging={draggedNoteId === note.id}
                  onHandlePointerDown={layoutDrag.bindHandlePointerDown(entry.itemId, () =>
                    draggableLayout.map((e) => e.itemId),
                  )}
                  onEdit={() => onEditNote(note)}
                  onDelete={() => onDeleteNote(note.id)}
                />
              </div>
            </Fragment>
          );
        }

        const { key, scopedKey, tag, occurrences: groupOccurrences } = entry.group!;
        const isDraggable = entry.draggable;

        return (
          <Fragment key={entry.itemId}>
            {dropLineBefore}
            <div ref={isDraggable ? layoutDrag.registerItemRef(entry.itemId) : undefined}>
              <TaskGroup
                label={tag?.name ?? "No category"}
                color={tag?.color}
                totalCount={groupOccurrences.length}
                doneCount={groupOccurrences.filter((o) => o.completed).length}
                collapsed={collapsed.has(scopedKey)}
                onToggle={() => toggleGroup(scopedKey)}
                draggable={isDraggable}
                dragging={draggedGroupKey === key}
                onHandlePointerDown={
                  isDraggable
                    ? layoutDrag.bindHandlePointerDown(entry.itemId, () =>
                        draggableLayout.map((e) => e.itemId),
                      )
                    : undefined
                }
                suppressClick={layoutDrag.suppressClick}
                onSaveAsTemplate={
                  tag
                    ? () => {
                        const existing = templates.find((t) => t.tagId === tag.id);
                        const matches =
                          existing &&
                          occurrencesMatchTemplate(
                            groupOccurrences,
                            templateTaskBlueprints[existing.id] ?? [],
                          );
                        if (existing && matches) {
                          onRemoveTemplate(existing.id);
                        } else {
                          // Either no template exists yet, or one does but
                          // today's tasks have drifted from it - either way
                          // this (over)writes it to match today exactly.
                          // createTemplateFromTasks upserts by tagId, so an
                          // existing template is updated in place, not
                          // duplicated.
                          onSaveAsTemplate(
                            tag,
                            groupOccurrences.map(({ task }) => ({
                              title: task.title,
                              notes: task.notes,
                              time: task.time,
                              priority: task.priority,
                            })),
                          );
                        }
                      }
                    : undefined
                }
                hasTemplate={(() => {
                  if (!tag) return false;
                  const existing = templates.find((t) => t.tagId === tag.id);
                  if (!existing) return false;
                  return occurrencesMatchTemplate(
                    groupOccurrences,
                    templateTaskBlueprints[existing.id] ?? [],
                  );
                })()}
              >
                {groupOccurrences.map(({ task, completed }, index) => (
                  <Fragment key={task.id}>
                    {draggingTaskGroupKey === key && taskDropIndex === index && (
                      <div className="task-list__drop-line" />
                    )}
                    <div ref={taskDrag.registerItemRef(task.id)}>
                      <TaskItem
                        task={task}
                        completed={completed}
                        onToggle={() => onToggle(task)}
                        onView={() => onView(task)}
                        onDelete={() => onDelete(task)}
                        onHandlePointerDown={taskDrag.bindHandlePointerDown(
                          task.id,
                          () => groupOccurrences.map((o) => o.task.id),
                        )}
                        suppressClick={taskDrag.suppressClick}
                        dragging={draggedTaskId === task.id}
                      />
                    </div>
                  </Fragment>
                ))}
                {draggingTaskGroupKey === key && taskDropIndex === groupOccurrences.length && (
                  <div className="task-list__drop-line" />
                )}
              </TaskGroup>
            </div>
          </Fragment>
        );
      })}
      {draggedLayoutId !== null && layoutDropIndex === draggableLayout.length && (
        <div className="task-list__drop-line" />
      )}
    </div>
  );
}
