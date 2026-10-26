import { Fragment, useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties } from "react";
import { useNow } from "../../hooks/useNow";
import { useReorderDrag } from "../../hooks/useReorderDrag";
import type { DayNote, Tag, Task } from "../../types";
import { addDays, todayKey } from "../../utils/dates";
import { occurrenceDateTime } from "../../utils/recurrence";
import { EmptyState } from "../ui/EmptyState";
import { CheckIcon, ChevronRightIcon } from "../ui/icons";
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
const URGENCY_HIGH_MS = 60 * 60 * 1000;
const URGENCY_CRITICAL_MS = 15 * 60 * 1000;

/** How close today's deadline is, once it's within URGENCY_WINDOW_MS:
 *  "warn" (calm amber, plenty of time), "high" (red, under an hour),
 *  "critical" (red and pulsing, under 15 minutes). */
export type UrgencyLevel = "warn" | "high" | "critical";
// A finished template stays put this long - so the last tick and its full
// ring register - then plays its exit (FOLD_MS) into the Done card.
const AUTO_COLLAPSE_DELAY_MS = 450;
const FOLD_MS = 460;
// How long a deleted task stays on screen playing its exit (see TaskItem's
// `leaving`) - matches the slide-out + collapse there.
const LEAVE_MS = 380;

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
  /** Move an unfinished one-off task to another day (see MoveTaskModal). */
  onMove?: (task: Task) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onReorderTags: (tagIds: string[]) => void;
  notes: DayNote[];
  /** Today is protected by a freeze - the streak isn't at risk, so no
   *  deadline warning. */
  dayFrozen?: boolean;
  /** Data is confirmed current - deadline strips wait for this, so they
   *  don't flash on tasks already done on another device. */
  dataFresh?: boolean;
  onEditNote: (note: DayNote) => void;
  onDeleteNote: (id: string) => void;
  onChangeNoteContent: (id: string, content: string) => void;
  onReorderNotePositions: (
    updates: { id: string; afterGroupKey: string | null; sortOrder: number }[],
  ) => void;
}

function sortOccurrences(occurrences: Occurrence[]): Occurrence[] {
  return [...occurrences].sort(
    (a, b) =>
      a.task.sortOrder - b.task.sortOrder || a.task.id.localeCompare(b.task.id),
  );
}

export function TaskList({
  selectedDate,
  occurrences: liveOccurrences,
  tags,
  onToggle,
  onView,
  onDelete,
  onMove,
  onReorderTasks,
  onReorderTags,
  notes,
  dayFrozen = false,
  dataFresh = true,
  onEditNote,
  onDeleteNote,
  onChangeNoteContent,
  onReorderNotePositions,
}: TaskListProps) {
  // A day that's already over is read-only for completions/deletes (see
  // handleToggle/handleRequestDeleteTask in App.tsx, which enforce this for
  // real) - this just keeps the checkbox and delete button from offering
  // an action that would silently no-op.
  const isPastDay = selectedDate < todayKey();

  // A task that disappears from this day (deleted - by swipe, trash, the
  // task window or the form, or from another device) stays rendered for a
  // moment as a "leaving" ghost so it can slide out and collapse, instead
  // of the rows below jumping up instantly. Detected here rather than at
  // each delete call site so every path gets it.
  const [leaving, setLeaving] = useState<Map<string, Occurrence>>(new Map());
  const prevLiveRef = useRef<{ date: string; occurrences: Occurrence[] }>({
    date: selectedDate,
    occurrences: liveOccurrences,
  });
  useLayoutEffect(() => {
    const prev = prevLiveRef.current;
    prevLiveRef.current = { date: selectedDate, occurrences: liveOccurrences };
    // Switching days isn't a deletion.
    if (prev.date !== selectedDate) {
      setLeaving(new Map());
      return;
    }
    const liveIds = new Set(liveOccurrences.map((o) => o.task.id));
    const gone = prev.occurrences.filter((o) => !liveIds.has(o.task.id));
    if (gone.length === 0) return;
    setLeaving((cur) => {
      const next = new Map(cur);
      for (const o of gone) next.set(o.task.id, o);
      return next;
    });
    const ids = gone.map((o) => o.task.id);
    window.setTimeout(() => {
      setLeaving((cur) => {
        const next = new Map(cur);
        for (const id of ids) next.delete(id);
        return next;
      });
    }, LEAVE_MS);
  }, [liveOccurrences, selectedDate]);

  const occurrences: Occurrence[] = [
    ...liveOccurrences,
    ...[...leaving.values()].filter(
      (o) => !liveOccurrences.some((l) => l.task.id === o.task.id),
    ),
  ];

  // Only today can ever be "urgent" - a future day's own deadline hasn't
  // started counting down yet, and a past day is already locked regardless.
  // 30s is plenty granular for a countdown that only ever displays minutes.
  const now = useNow(30_000);
  const msUntilMidnight =
    selectedDate === todayKey()
      ? occurrenceDateTime(addDays(selectedDate, 1), "00:00").getTime() -
        now.getTime()
      : null;
  const remainingCount = liveOccurrences.filter((o) => !o.completed).length;
  const urgency: UrgencyLevel | null =
    msUntilMidnight === null ||
    msUntilMidnight <= 0 ||
    msUntilMidnight > URGENCY_WINDOW_MS ||
    remainingCount === 0 ||
    dayFrozen ||
    !dataFresh
      ? null
      : msUntilMidnight <= URGENCY_CRITICAL_MS
        ? "critical"
        : msUntilMidnight <= URGENCY_HIGH_MS
          ? "high"
          : "warn";

  // Collapse state and "have we seen this group finish before" tracking are
  // both scoped to `${selectedDate}:${tagKey}` - a tag collapsing because you
  // finished it today must not make that same tag show collapsed (and hide
  // fresh, unfinished tasks) on a different day.
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // The finished templates' one-line summary, unfolded to list them.
  const [doneOpen, setDoneOpen] = useState(false);
  // Opening a template from the Done list moves it back to its place in
  // the list - this remembers where its row was on screen, so the card can
  // glide from there to its spot (see the layout effect below) instead of
  // just vanishing from Done.
  const listRef = useRef<HTMLDivElement>(null);
  const flyRef = useRef<{ key: string; top: number; color: string } | null>(null);

  useLayoutEffect(() => {
    const fly = flyRef.current;
    if (!fly) return;
    flyRef.current = null;
    const wrap = listRef.current?.querySelector<HTMLElement>(
      `[data-group="${CSS.escape(fly.key)}"]`,
    );
    if (!wrap) return;
    // Bring its new spot into view first (instantly), then measure - the
    // slide starts from where the row was on screen either way.
    wrap.scrollIntoView({ block: "nearest" });
    const dy = fly.top - wrap.getBoundingClientRect().top;
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduceMotion && Math.abs(dy) > 2) {
      // Travels above the cards it passes, not underneath them.
      wrap.style.position = "relative";
      wrap.style.zIndex = "6";
      wrap
        .animate(
          [
            { transform: `translateY(${dy}px) scale(0.97)`, opacity: 0.6 },
            { transform: "none", opacity: 1 },
          ],
          { duration: 420, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
        )
        .finished.catch(() => {})
        .finally(() => {
          wrap.style.position = "";
          wrap.style.zIndex = "";
        });
    }
    // A brief glow in the template's color, so the eye lands on it.
    wrap.firstElementChild?.animate(
      [
        { boxShadow: `0 0 0 2px ${fly.color}` },
        { boxShadow: `0 0 0 2px ${fly.color}`, offset: 0.4 },
        { boxShadow: "0 0 0 0 transparent" },
      ],
      { duration: 1100, easing: "ease-out" },
    );
  });
  const seenKeys = useRef<Set<string>>(new Set());
  const wasComplete = useRef<Record<string, boolean>>({});

  // A template finishing live: after a beat its card shrinks and slides
  // down out of the list (FOLD_MS), then folds into the Done card, which
  // takes it in with a glow in its color and its dot popping into the
  // stack. Per template, in a ref rather than the completion effect's
  // cleanup, so ticking a task elsewhere meanwhile doesn't cancel it;
  // unticking one of its own tasks does (see cancelFold).
  const foldsRef = useRef(new Map<string, { timer: number; anim?: Animation; wrap?: HTMLElement }>());
  const [arrived, setArrived] = useState<{ key: string; color: string; first: boolean } | null>(null);

  function cancelFold(scopedKey: string) {
    const fold = foldsRef.current.get(scopedKey);
    if (!fold) return;
    window.clearTimeout(fold.timer);
    fold.anim?.cancel();
    if (fold.wrap) fold.wrap.style.overflow = "";
    foldsRef.current.delete(scopedKey);
  }

  function startFold(scopedKey: string, color: string) {
    cancelFold(scopedKey);
    const fold: { timer: number; anim?: Animation; wrap?: HTMLElement } = { timer: 0 };
    const finish = () => {
      foldsRef.current.delete(scopedKey);
      setCollapsed((prev) => new Set(prev).add(scopedKey));
      setArrived({ key: scopedKey, color, first: !listRef.current?.querySelector(".task-list__done") });
    };
    fold.timer = window.setTimeout(() => {
      const list = listRef.current;
      const wrap = list?.querySelector<HTMLElement>(`[data-group="${CSS.escape(scopedKey)}"]`);
      if (!list || !wrap || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
        finish();
        return;
      }
      // Closes the list's gap too, so the cards below glide up the whole
      // way instead of jumping the last few px when it's removed.
      const gap = parseFloat(getComputedStyle(list).rowGap) || 0;
      const height = wrap.offsetHeight;
      wrap.style.overflow = "hidden";
      fold.wrap = wrap;
      fold.anim = wrap.animate(
        [
          { height: `${height}px`, marginBottom: "0px", opacity: 1, transform: "none" },
          { height: `${height}px`, marginBottom: "0px", opacity: 1, transform: "scale(0.98)", offset: 0.2 },
          { height: "0px", marginBottom: `${-gap}px`, opacity: 0, transform: "translateY(14px) scale(0.94)" },
        ],
        { duration: FOLD_MS, easing: "cubic-bezier(0.32, 0.72, 0, 1)", fill: "forwards" },
      );
      // Cancelled (a task unticked mid-way) - it stays where it is.
      fold.anim.finished.then(finish, () => {});
    }, AUTO_COLLAPSE_DELAY_MS);
    foldsRef.current.set(scopedKey, fold);
  }

  useEffect(() => {
    const folds = foldsRef.current;
    return () => {
      folds.forEach((fold) => {
        window.clearTimeout(fold.timer);
        fold.anim?.cancel();
      });
      folds.clear();
    };
  }, []);

  // The Done card taking in the template that just folded into it.
  useLayoutEffect(() => {
    if (!arrived) return;
    const done = listRef.current?.querySelector<HTMLElement>(".task-list__done");
    if (!done) return;
    if (arrived.first) {
      done.animate(
        [{ opacity: 0, transform: "translateY(-10px) scale(0.97)" }, { opacity: 1, transform: "none" }],
        { duration: 360, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
      );
    }
    done.animate(
      [
        { boxShadow: `0 0 0 2px ${arrived.color}` },
        { boxShadow: `0 0 0 2px ${arrived.color}`, offset: 0.35 },
        { boxShadow: "0 0 0 0 transparent" },
      ],
      { duration: 1000, easing: "ease-out" },
    );
    const pop = [{ transform: "scale(0.3)" }, { transform: "scale(1.25)", offset: 0.6 }, { transform: "scale(1)" }];
    done.querySelector(".task-list__done-check")?.animate(pop, { duration: 380, easing: "ease-out" });
    done
      .querySelector(`[data-done-key="${CSS.escape(arrived.key)}"]`)
      ?.animate(pop, { duration: 420, delay: 80, easing: "ease-out", fill: "backwards" });
  }, [arrived]);

  // Reordered via each row's own small grab handle (see useReorderDrag's
  // bindHandlePointerDown) rather than grab-anywhere, so the rest of the
  // panel keeps ordinary native scrolling. Tasks within their own group are
  // one domain; tag groups AND notes share a second, combined domain (see
  // layoutDrag below) so a note can be dropped anywhere among the groups,
  // not just reordered against other notes ("No tag" excluded from that
  // combined domain - it isn't a real group, it always stays last).
  const taskDrag = useReorderDrag((nextTaskIds) => onReorderTasks(nextTaskIds));
  const layoutDrag = useReorderDrag((nextVisibleIds) => {
    // Finished, folded templates sit in the "Done" card instead of the
    // list, so they aren't part of a drag - put them back in their own
    // saved slots and fill the rest in the dragged order.
    const queue = [...nextVisibleIds];
    const nextIds = draggableLayout.map((entry) =>
      doneItemIds.has(entry.itemId) ? entry.itemId : (queue.shift() ?? entry.itemId),
    );
    const nextTagIds = nextIds
      .filter((id) => id.startsWith("group:"))
      .map((id) => id.slice("group:".length));
    onReorderTags(nextTagIds);

    // Whichever group id most recently passed in this same reordered list
    // becomes every following note's new anchor, until the next group -
    // notes before the first group anchor to null ("top of the day").
    const noteUpdates: {
      id: string;
      afterGroupKey: string | null;
      sortOrder: number;
    }[] = [];
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
    const anchor = groups.some((g) => g.key === note.afterGroupKey)
      ? note.afterGroupKey
      : null;
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

  // Finished and folded: shown together in one "Done" card at the end
  // instead of a card each.
  const isDoneFolded = (g: Group) =>
    g.occurrences.length > 0 &&
    g.occurrences.every((o) => o.completed) &&
    collapsed.has(g.scopedKey);
  const doneGroups = groups.filter(isDoneFolded);
  const doneItemIds = new Set(doneGroups.map((g) => groupItemId(g.key)));
  const visibleLayout = layout.filter((entry) => !doneItemIds.has(entry.itemId));
  const visibleDraggable = visibleLayout.filter((entry) => entry.draggable);
  const finishedCount = groups.filter(
    (g) => g.occurrences.length > 0 && g.occurrences.every((o) => o.completed),
  ).length;
  const firstGroupItemId = visibleLayout.find((entry) => entry.group)?.itemId;

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
    for (const g of groups) {
      const isComplete =
        g.occurrences.length > 0 && g.occurrences.every((o) => o.completed);

      if (!seenKeys.current.has(g.scopedKey)) {
        // First time this day+tag combination has been seen: if it's
        // already fully done (e.g. reopening a finished day), start collapsed.
        seenKeys.current.add(g.scopedKey);
        if (isComplete) {
          setCollapsed((prev) => new Set(prev).add(g.scopedKey));
        }
      } else if (isComplete && wasComplete.current[g.scopedKey] === false) {
        // Just finished live - folds into Done after a short beat so the
        // checkmark/green state actually registers first.
        startFold(g.scopedKey, g.tag?.color ?? "var(--text-muted)");
      } else if (!isComplete) {
        cancelFold(g.scopedKey);
      }

      wasComplete.current[g.scopedKey] = isComplete;
    }
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
    <div className="task-list" ref={listRef}>
      {visibleLayout.map((entry) => {
        if (entry.note) {
          const note = entry.note;
          return (
            <Fragment key={entry.itemId}>
              <div ref={layoutDrag.registerItemRef(entry.itemId)}>
                <NoteRow
                  note={note}
                  dragging={draggedNoteId === note.id}
                  onDragPointerDown={layoutDrag.bindLongPress(
                    entry.itemId,
                    () => visibleDraggable.map((e) => e.itemId),
                  )}
                  suppressClick={layoutDrag.suppressClick}
                  onEdit={() => onEditNote(note)}
                  onDelete={() => onDeleteNote(note.id)}
                  onChangeContent={(content) =>
                    onChangeNoteContent(note.id, content)
                  }
                />
              </div>
            </Fragment>
          );
        }

        const {
          key,
          scopedKey,
          tag,
          occurrences: groupOccurrences,
        } = entry.group!;
        const isDraggable = entry.draggable;

        return (
          <Fragment key={entry.itemId}>
            {entry.itemId === firstGroupItemId && templatesHeading()}
            <div
              data-group={entry.group!.scopedKey}
              ref={
                isDraggable
                  ? layoutDrag.registerItemRef(entry.itemId)
                  : undefined
              }
            >
              <TaskGroup
                label={tag?.name ?? "No template"}
                color={tag?.color}
                totalCount={groupOccurrences.length}
                doneCount={groupOccurrences.filter((o) => o.completed).length}
                collapsed={collapsed.has(scopedKey)}
                onToggle={() => toggleGroup(scopedKey)}
                draggable={isDraggable}
                dragging={draggedGroupKey === key}
                onDragPointerDown={
                  isDraggable
                    ? layoutDrag.bindLongPress(entry.itemId, () =>
                        visibleDraggable.map((e) => e.itemId),
                      )
                    : undefined
                }
                suppressClick={layoutDrag.suppressClick}
                urgency={
                  urgency && groupOccurrences.some((o) => !o.completed)
                    ? urgency
                    : null
                }
                msLeft={msUntilMidnight}
              >
                {/* Completed tasks stay exactly where they are (ticked and
                    greyed out) - nothing moves when you tick one. */}
                {groupOccurrences.map(({ task, completed }) => (
                  <Fragment key={task.id}>
                    <div
                      ref={
                        leaving.has(task.id)
                          ? undefined
                          : taskDrag.registerItemRef(task.id)
                      }
                    >
                      <TaskItem
                        task={task}
                        completed={completed}
                        leaving={leaving.has(task.id)}
                        locked={isPastDay}
                        onToggle={() => onToggle(task)}
                        onView={() => onView(task)}
                        onDelete={() => onDelete(task)}
                        onMove={
                          onMove && !completed && task.recurrenceType === "none"
                            ? () => onMove(task)
                            : undefined
                        }
                        onDragPointerDown={taskDrag.bindLongPress(task.id, () =>
                          groupOccurrences.map((o) => o.task.id),
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

      {/* Finished and folded templates, together in one card - a line
          each (tap one to open it back up where it was). */}
      {/* Every template finished: the heading goes over this card. */}
      {!firstGroupItemId && doneGroups.length > 0 && templatesHeading()}
      {doneGroups.length > 0 && (
        // Finished templates fold into one line - "5 templates done" with
        // their colors stacked; tap it to list them, tap one to open it.
        <div className={`task-list__done ${doneOpen ? "task-list__done--open" : ""}`}>
          <button
            type="button"
            className="task-list__done-head"
            onClick={() => setDoneOpen((v) => !v)}
            aria-expanded={doneOpen}
          >
            <span className="task-list__done-check" aria-hidden="true">
              <CheckIcon size={11} />
            </span>
            <span className="task-list__done-text">
              <span className="task-list__done-title">
                {doneGroups.length === 1
                  ? "1 template done"
                  : `${doneGroups.length} templates done`}
              </span>
              {!doneOpen && (
                <span className="task-list__done-names">
                  {doneGroups.map((g) => g.tag?.name ?? "No template").join(", ")}
                </span>
              )}
            </span>
            <span className="task-list__done-stack" aria-hidden="true">
              {doneGroups.slice(0, 5).map((g) => (
                <i
                  key={g.key}
                  data-done-key={g.scopedKey}
                  style={{ background: g.tag?.color ?? "var(--text-muted)" }}
                />
              ))}
            </span>
            <ChevronRightIcon
              size={14}
              className={`task-list__done-chevron ${doneOpen ? "task-list__done-chevron--open" : ""}`}
            />
          </button>
          {doneOpen &&
            doneGroups.map((g) => (
              <button
                key={g.key}
                type="button"
                data-done-key={g.scopedKey}
                className="task-list__done-row"
                style={{ "--group-color": g.tag?.color ?? "var(--text-muted)" } as CSSProperties}
                onClick={(e) => {
                  flyRef.current = {
                    key: g.scopedKey,
                    top: e.currentTarget.getBoundingClientRect().top,
                    color: g.tag?.color ?? "var(--text-muted)",
                  };
                  toggleGroup(g.scopedKey);
                }}
                aria-expanded={false}
              >
                <span className="task-list__done-dot" aria-hidden="true">
                  <CheckIcon size={10} />
                </span>
                <span className="task-list__done-name">{g.tag?.name ?? "No template"}</span>
                <span className="task-list__done-tally">
                  {g.occurrences.length}/{g.occurrences.length}
                </span>
                <ChevronRightIcon size={13} className="task-list__done-go" />
              </button>
            ))}
        </div>
      )}
    </div>
  );

  // "Templates" over the first template, with how many are finished today.
  function templatesHeading() {
    return (
      <div className="task-list__heading">
        <span>Templates</span>
        <span
          className={`task-list__heading-progress ${finishedCount === groups.length ? "task-list__heading-progress--all" : ""}`}
        >
          {finishedCount === groups.length ? "All done" : `${finishedCount} of ${groups.length} done`}
        </span>
      </div>
    );
  }
}
