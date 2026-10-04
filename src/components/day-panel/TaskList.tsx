import { Fragment, useEffect, useRef, useState } from "react";
import { useNow } from "../../hooks/useNow";
import { useReorderDrag } from "../../hooks/useReorderDrag";
import type { DayNote, Tag, Task } from "../../types";
import { addDays, todayKey } from "../../utils/dates";
import { occurrenceDateTime } from "../../utils/recurrence";
import { EmptyState } from "../ui/EmptyState";
import { CheckIcon } from "../ui/icons";
import { NoteRow } from "./NoteRow";
import { TaskGroup } from "./TaskGroup";
import { TaskItem } from "./TaskItem";
import "./TaskList.css";

const NO_TAG_KEY = "none";
// The real deadline is midnight, when the day actually ends - not the 9 PM
// reminder time (see useTaskReminders' own, separate END_OF_DAY_REMINDER_TIME),
// which is just a heads-up sent partway through this same window. Counting
// down to 21:00 itself would hit 0 and vanish right as the reminder fires,
// even though there'd still be 3 hours left to actually act on it.
const URGENCY_WINDOW_MS = 3 * 60 * 60 * 1000;
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

export function TaskList({
  selectedDate,
  occurrences,
  tags,
  onToggle,
  onView,
  onDelete,
  onReorderTasks,
  onReorderTags,
  notes,
  onEditNote,
  onDeleteNote,
  onReorderNotePositions,
}: TaskListProps) {
  // A day that's already over is read-only for completions/deletes (see
  // handleToggle/handleRequestDeleteTask in App.tsx, which enforce this for
  // real) - this just keeps the checkbox and delete button from offering
  // an action that would silently no-op.
  const isPastDay = selectedDate < todayKey();

  // Only today can ever be "urgent" - a future day's own deadline hasn't
  // started counting down yet, and a past day is already locked regardless.
  // 30s is plenty granular for a countdown that only ever displays minutes.
  const now = useNow(30_000);
  const msUntilMidnight =
    selectedDate === todayKey()
      ? occurrenceDateTime(addDays(selectedDate, 1), "00:00").getTime() - now.getTime()
      : null;
  const showUrgency =
    msUntilMidnight !== null && msUntilMidnight > 0 && msUntilMidnight <= URGENCY_WINDOW_MS;

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
  // anchored to it. "No template" is never draggable (it always stays
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

  const draggedTaskId = taskDrag.draggedId;

  const draggedLayoutId = layoutDrag.draggedId;
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

  return (
    <div className="task-list">
      {layout.map((entry) => {
        if (entry.note) {
          const note = entry.note;
          return (
            <Fragment key={entry.itemId}>
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
            <div ref={isDraggable ? layoutDrag.registerItemRef(entry.itemId) : undefined}>
              <TaskGroup
                label={tag?.name ?? "No template"}
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
                urgentMsLeft={
                  showUrgency && groupOccurrences.some((o) => !o.completed) ? msUntilMidnight : null
                }
              >
                {groupOccurrences.map(({ task, completed }) => (
                  <Fragment key={task.id}>
                    <div ref={taskDrag.registerItemRef(task.id)}>
                      <TaskItem
                        task={task}
                        completed={completed}
                        locked={isPastDay}
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
              </TaskGroup>
            </div>
          </Fragment>
        );
      })}
    </div>
  );
}
