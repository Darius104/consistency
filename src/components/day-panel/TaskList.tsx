import { Fragment, useEffect, useRef, useState } from "react";
import type { Tag, Task, Template, TemplateTaskBlueprint } from "../../types";
import { CheckIcon } from "../ui/icons";
import { TaskGroup } from "./TaskGroup";
import { TaskItem } from "./TaskItem";
import "./TaskList.css";

const NO_TAG_KEY = "none";
const AUTO_COLLAPSE_DELAY_MS = 250;

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
  onReorderTasks: (taskIds: number[]) => void;
  onReorderTags: (tagIds: number[]) => void;
  onSaveAsTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onRemoveTemplate: (templateId: number) => void;
  templates: Template[];
}

function sortOccurrences(occurrences: Occurrence[]): Occurrence[] {
  return [...occurrences].sort(
    (a, b) => a.task.sortOrder - b.task.sortOrder || a.task.id - b.task.id,
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
  onSaveAsTemplate,
  onRemoveTemplate,
  templates,
}: TaskListProps) {
  // Collapse state and "have we seen this group finish before" tracking are
  // both scoped to `${selectedDate}:${tagKey}` - a tag collapsing because you
  // finished it today must not make that same tag show collapsed (and hide
  // fresh, unfinished tasks) on a different day.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  const seenKeys = useRef<Set<string>>(new Set());
  const wasComplete = useRef<Record<string, boolean>>({});

  // Dragging a task within its own group.
  const [draggedTaskId, setDraggedTaskId] = useState<number | null>(null);
  const [draggingTaskGroupKey, setDraggingTaskGroupKey] = useState<string | null>(null);
  const [taskDropIndex, setTaskDropIndex] = useState<number | null>(null);
  const taskRefs = useRef<Partial<Record<number, HTMLDivElement>>>({});

  // Dragging a whole tag group among the other groups ("No tag" excluded -
  // it isn't a real tag, it always stays last).
  const [draggedGroupKey, setDraggedGroupKey] = useState<string | null>(null);
  const [groupDropIndex, setGroupDropIndex] = useState<number | null>(null);
  const groupRefs = useRef<Partial<Record<string, HTMLDivElement>>>({});

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
      tag: key === NO_TAG_KEY ? undefined : tagById.get(Number(key)),
      occurrences: sortOccurrences(groupOccurrences),
    }))
    .sort((a, b) => {
      if (a.key === NO_TAG_KEY) return 1;
      if (b.key === NO_TAG_KEY) return -1;
      return (a.tag?.sortOrder ?? 0) - (b.tag?.sortOrder ?? 0);
    });

  const draggableGroups = groups.filter((g) => g.key !== NO_TAG_KEY);

  // Kept fresh every render (not a dependency of the drag effects below) so
  // dragging always reads current data without tearing down/rebuilding the
  // window listeners on every mousemove-triggered re-render.
  const groupsRef = useRef(groups);
  groupsRef.current = groups;
  const draggableGroupsRef = useRef(draggableGroups);
  draggableGroupsRef.current = draggableGroups;

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
  }, [occurrences, selectedDate]);

  // Manual pointer-based dragging (same approach as the day-panel block
  // reorder) - reliable inside WKWebView unlike the native HTML5 DnD API,
  // and constrained to reordering within the dragged task's own group.
  useEffect(() => {
    if (draggedTaskId === null || draggingTaskGroupKey === null) return;
    document.body.classList.add("is-dragging");

    function currentGroup(): Group | undefined {
      return groupsRef.current.find((g) => g.key === draggingTaskGroupKey);
    }

    function indexForY(clientY: number): number {
      const group = currentGroup();
      if (!group) return 0;
      for (let i = 0; i < group.occurrences.length; i++) {
        const el = taskRefs.current[group.occurrences[i].task.id];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return group.occurrences.length;
    }

    function onMove(e: MouseEvent) {
      setTaskDropIndex(indexForY(e.clientY));
    }

    function onUp(e: MouseEvent) {
      const group = currentGroup();
      if (group) {
        const ids = group.occurrences.map((o) => o.task.id);
        const from = ids.indexOf(draggedTaskId as number);
        const to = indexForY(e.clientY);
        if (from !== -1) {
          const next = [...ids];
          next.splice(from, 1);
          next.splice(to > from ? to - 1 : to, 0, draggedTaskId as number);
          if (next.some((id, i) => id !== ids[i])) {
            onReorderTasks(next);
          }
        }
      }
      setDraggedTaskId(null);
      setDraggingTaskGroupKey(null);
      setTaskDropIndex(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggedTaskId, draggingTaskGroupKey, onReorderTasks]);

  // Same pattern again, one level up: dragging a whole tag group among the
  // other tag groups (never involves "No tag", which always stays last).
  useEffect(() => {
    if (draggedGroupKey === null) return;
    document.body.classList.add("is-dragging");

    function indexForY(clientY: number): number {
      const list = draggableGroupsRef.current;
      for (let i = 0; i < list.length; i++) {
        const el = groupRefs.current[list[i].key];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return list.length;
    }

    function onMove(e: MouseEvent) {
      setGroupDropIndex(indexForY(e.clientY));
    }

    function onUp(e: MouseEvent) {
      const list = draggableGroupsRef.current;
      const ids = list.map((g) => Number(g.key));
      const from = ids.indexOf(Number(draggedGroupKey));
      const to = indexForY(e.clientY);
      if (from !== -1) {
        const next = [...ids];
        next.splice(from, 1);
        next.splice(to > from ? to - 1 : to, 0, Number(draggedGroupKey));
        if (next.some((id, i) => id !== ids[i])) {
          onReorderTags(next);
        }
      }
      setDraggedGroupKey(null);
      setGroupDropIndex(null);
    }

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggedGroupKey, onReorderTags]);

  function startTaskDrag(taskId: number, groupKey: string) {
    const group = groups.find((g) => g.key === groupKey);
    if (!group) return;
    setDraggedTaskId(taskId);
    setDraggingTaskGroupKey(groupKey);
    setTaskDropIndex(group.occurrences.findIndex((o) => o.task.id === taskId));
  }

  function startGroupDrag(groupKey: string) {
    const index = draggableGroups.findIndex((g) => g.key === groupKey);
    if (index === -1) return;
    setDraggedGroupKey(groupKey);
    setGroupDropIndex(index);
  }

  function toggleGroup(scopedKey: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(scopedKey)) next.delete(scopedKey);
      else next.add(scopedKey);
      return next;
    });
  }

  if (occurrences.length === 0) {
    return (
      <div className="task-list__empty" key={selectedDate}>
        <span className="task-list__empty-icon" aria-hidden="true">
          <CheckIcon size={16} />
        </span>
        Nothing scheduled for this day.
      </div>
    );
  }

  let draggableIndex = -1;

  return (
    <div className="task-list">
      {groups.map(({ key, scopedKey, tag, occurrences: groupOccurrences }) => {
        const isDraggable = key !== NO_TAG_KEY;
        if (isDraggable) draggableIndex += 1;
        const thisDraggableIndex = draggableIndex;

        return (
          <Fragment key={key}>
            {draggedGroupKey !== null && groupDropIndex === thisDraggableIndex && isDraggable && (
              <div className="task-list__drop-line" />
            )}
            <div
              ref={(el) => {
                if (isDraggable) groupRefs.current[key] = el ?? undefined;
              }}
            >
              <TaskGroup
                label={tag?.name ?? "No category"}
                color={tag?.color}
                totalCount={groupOccurrences.length}
                doneCount={groupOccurrences.filter((o) => o.completed).length}
                collapsed={collapsed.has(scopedKey)}
                onToggle={() => toggleGroup(scopedKey)}
                draggable={isDraggable}
                dragging={draggedGroupKey === key}
                onDragHandleDown={() => startGroupDrag(key)}
                onSaveAsTemplate={
                  tag
                    ? () => {
                        const existing = templates.find((t) => t.tagId === tag.id);
                        if (existing) {
                          onRemoveTemplate(existing.id);
                        } else {
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
                hasTemplate={tag ? templates.some((t) => t.tagId === tag.id) : false}
              >
                {groupOccurrences.map(({ task, completed }, index) => (
                  <Fragment key={task.id}>
                    {draggingTaskGroupKey === key && taskDropIndex === index && (
                      <div className="task-list__drop-line" />
                    )}
                    <div
                      ref={(el) => {
                        taskRefs.current[task.id] = el ?? undefined;
                      }}
                    >
                      <TaskItem
                        task={task}
                        completed={completed}
                        onToggle={() => onToggle(task)}
                        onView={() => onView(task)}
                        onDelete={() => onDelete(task)}
                        onDragHandleDown={() => startTaskDrag(task.id, key)}
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
      {draggedGroupKey !== null && groupDropIndex === draggableGroups.length && (
        <div className="task-list__drop-line" />
      )}
    </div>
  );
}
