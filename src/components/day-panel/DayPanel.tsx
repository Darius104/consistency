import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { FriendNote } from "../../db/friendNotes";
import type { DayNote, Tag, Task, Template, TemplateTaskBlueprint } from "../../types";
import { parseDateKey } from "../../utils/dates";
import { WIDGET_LABELS, type PanelBlockId, type WidgetId } from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import {
  MAX_FREEZES_PER_MONTH,
  type TemplateBreakdownItem,
  type TodayStatus,
  type WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { ActionSheet } from "../ui/ActionSheet";
import { Button } from "../ui/Button";
import { ChevronDownIcon, ChevronUpIcon, GripIcon, MoreIcon, XIcon } from "../ui/icons";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { FreezeSummary } from "../stats/FreezeSummary";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { AddMenu } from "./AddMenu";
import { FriendNoteWidget } from "./FriendNoteWidget";
import { TaskList } from "./TaskList";
import "./DayPanel.css";

// How close the pointer needs to get to the scrollable container's top/
// bottom edge before auto-scroll kicks in, and the fastest it'll scroll
// right at that edge.
const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_MAX_SPEED = 14;

// Outside Arrange mode, the streak/weekly blocks have no drag handle at all
// (Arrange mode is the only way to reorder them - see the top-level plan
// decision to keep this list's interaction model unchanged), so holding one
// as if to drag it would otherwise just do nothing. This turns that same
// gesture into a discoverable prompt instead of a dead end.
const ARRANGE_SUGGEST_HOLD_MS = 450;
const ARRANGE_SUGGEST_CANCEL_PX = 8;

/** Nearest scrollable ancestor, walking up from an element inside the list. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowY === "auto" || style.overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

interface Occurrence {
  task: Task;
  completed: boolean;
}

interface DayPanelProps {
  selectedDate: string;
  occurrences: Occurrence[];
  tags: Tag[];
  streak: number;
  bestStreak: number;
  todayStatus: TodayStatus;
  weekly: WeeklyCompletionData;
  freezesRemaining: number;
  templateBreakdown: TemplateBreakdownItem[];
  quote: Quote;
  order: PanelBlockId[];
  onReorder: (order: PanelBlockId[]) => void;
  arranging: boolean;
  onFinishArranging: () => void;
  onStartArranging: () => void;
  hiddenWidgets: WidgetId[];
  onHideWidget: (id: WidgetId) => void;
  onShowWidget: (id: WidgetId) => void;
  /** Temporary, not part of the arrangeable widget system - rendered above
   *  it, one per pending note, gone the moment it's dismissed (see
   *  useFriendNotes). */
  friendNotes: FriendNote[];
  onDismissFriendNote: (id: string) => void;
  onToggle: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (task: Task) => void;
  onReorderTasks: (taskIds: string[]) => void;
  onReorderTags: (tagIds: string[]) => void;
  onSaveAsTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onRemoveTemplate: (templateId: string) => void;
  templates: Template[];
  templateTaskBlueprints: Record<string, TemplateTaskBlueprint[]>;
  onApplyTemplate: (templateId: string) => void;
  onAddTask: () => void;
  notes: DayNote[];
  onAddNote: () => void;
  onEditNote: (note: DayNote) => void;
  onDeleteNote: (id: string) => void;
  onReorderNotePositions: (
    updates: { id: string; afterGroupKey: string | null; sortOrder: number }[],
  ) => void;
  /** Mobile-only: whether this panel currently fills the screen instead of
   * sharing it with the compact calendar above. Ignored on wider screens. */
  expanded: boolean;
  onToggleExpanded: () => void;
}

export function DayPanel({
  selectedDate,
  occurrences,
  tags,
  streak,
  bestStreak,
  todayStatus,
  weekly,
  freezesRemaining,
  templateBreakdown,
  quote,
  order,
  onReorder,
  arranging,
  onFinishArranging,
  onStartArranging,
  hiddenWidgets,
  onHideWidget,
  onShowWidget,
  friendNotes,
  onDismissFriendNote,
  onToggle,
  onView,
  onDelete,
  onReorderTasks,
  onReorderTags,
  onSaveAsTemplate,
  onRemoveTemplate,
  templates,
  templateTaskBlueprints,
  onApplyTemplate,
  onAddTask,
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onReorderNotePositions,
  expanded,
  onToggleExpanded,
}: DayPanelProps) {
  const [draggedId, setDraggedId] = useState<PanelBlockId | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  // Which widget's "Remove widget / Arrange widgets" sheet is open, if any -
  // replaces what used to be a single-purpose "Arrange panel?" confirm
  // modal with no idea which block was actually held.
  const [actionSheetFor, setActionSheetFor] = useState<WidgetId | null>(null);
  const [addWidgetSheetOpen, setAddWidgetSheetOpen] = useState(false);
  const blockRefs = useRef<Partial<Record<PanelBlockId, HTMLDivElement>>>({});

  // Where the drag started, so the dragged block can be translated by
  // however far the pointer has moved since - applied directly to the DOM
  // node so it tracks the finger/cursor 1:1 in real time.
  const dragStartYRef = useRef<number | null>(null);
  // Auto-scroll state (this panel scrolls on its own once its content
  // overflows, on both desktop and mobile) plus what's needed to recompute
  // the drag transform every animation frame instead of only on
  // pointermove - holding the pointer still near the edge to keep
  // scrolling produces no new pointermove events, so without this the
  // dragged block would visually drift away from the pointer while the
  // panel kept scrolling underneath it.
  const scrollSpeedRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const lastPointerYRef = useRef<number | null>(null);
  const initialScrollTopRef = useRef(0);

  const label = parseDateKey(selectedDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  // Manual pointer-based dragging instead of the native HTML5 DnD API -
  // WKWebView's support for native drag/drop is unreliable, and this also
  // gives full control over the drop-position indicator line.
  useEffect(() => {
    if (!draggedId) return;
    document.body.classList.add("is-dragging");

    const anyBlock = Object.values(blockRefs.current)[0] ?? null;
    scrollContainerRef.current = findScrollParent(anyBlock ?? null);
    initialScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    function applyDragTransform() {
      const el = blockRefs.current[draggedId as PanelBlockId];
      if (!el || dragStartYRef.current === null || lastPointerYRef.current === null) return;
      const container = scrollContainerRef.current;
      const scrollDelta = container ? container.scrollTop - initialScrollTopRef.current : 0;
      const pointerDelta = lastPointerYRef.current - dragStartYRef.current;
      el.style.transform = `translateY(${pointerDelta + scrollDelta}px)`;
    }

    function indexForY(clientY: number): number {
      for (let i = 0; i < order.length; i++) {
        // The dragged block's own rect is displaced by the live translateY
        // transform following the pointer (see onMove below) - it's not a
        // real boundary to compare against, and checking it anyway can
        // spuriously match against its own relocated position and stop the
        // drop index from advancing (most visible dragging something from
        // near the top of the list further down).
        if (order[i] === draggedId) continue;
        const el = blockRefs.current[order[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return order.length;
    }

    function onMove(e: PointerEvent) {
      lastPointerYRef.current = e.clientY;
      setDropIndex(indexForY(e.clientY));

      scrollSpeedRef.current = 0;
      const container = scrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
          const depth = (rect.top + AUTO_SCROLL_EDGE_PX - e.clientY) / AUTO_SCROLL_EDGE_PX;
          scrollSpeedRef.current = -AUTO_SCROLL_MAX_SPEED * Math.min(1, Math.max(0, depth));
        } else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
          const depth = (e.clientY - (rect.bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX;
          scrollSpeedRef.current = AUTO_SCROLL_MAX_SPEED * Math.min(1, Math.max(0, depth));
        }
      }

      applyDragTransform();
    }

    function onUp(e: PointerEvent) {
      scrollSpeedRef.current = 0;
      const draggedEl = blockRefs.current[draggedId as PanelBlockId];
      if (draggedEl) draggedEl.style.transform = "";
      dragStartYRef.current = null;
      lastPointerYRef.current = null;

      const to = indexForY(e.clientY);
      const from = order.indexOf(draggedId as PanelBlockId);
      const next = [...order];
      next.splice(from, 1);
      next.splice(to > from ? to - 1 : to, 0, draggedId as PanelBlockId);
      if (next.some((id, i) => id !== order[i])) {
        onReorder(next);
      }
      setDraggedId(null);
      setDropIndex(null);
    }

    let rafId = window.requestAnimationFrame(function tick() {
      const container = scrollContainerRef.current;
      if (container && scrollSpeedRef.current !== 0) {
        container.scrollTop += scrollSpeedRef.current;
      }
      applyDragTransform();
      rafId = window.requestAnimationFrame(tick);
    });

    // Pointer Events (not mouse-only) so this also works via touch on mobile.
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.cancelAnimationFrame(rafId);
      scrollSpeedRef.current = 0;
      scrollContainerRef.current = null;
      lastPointerYRef.current = null;
      const el = blockRefs.current[draggedId as PanelBlockId];
      if (el) el.style.transform = "";
    };
  }, [draggedId, order, onReorder]);

  function startDrag(id: PanelBlockId, startY: number) {
    setDraggedId(id);
    setDropIndex(order.indexOf(id));
    dragStartYRef.current = startY;
  }

  /** Held on a widget block (outside Arrange mode, and never on the task
   *  list - that block is full of its own tap/scroll/drag interactions
   *  already) without much movement for a beat surfaces the remove/arrange
   *  sheet for that specific widget, rather than a hold there just silently
   *  doing nothing. */
  function bindArrangeSuggestion(id: WidgetId) {
    return (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest("button, input, a, [data-no-drag]")) return;
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;

      function onMove(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        if (dist > ARRANGE_SUGGEST_CANCEL_PX) cleanup();
      }
      function onUp(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        cleanup();
      }
      function cleanup() {
        window.clearTimeout(timer);
        window.removeEventListener("pointermove", onMove);
        window.removeEventListener("pointerup", onUp);
      }

      window.addEventListener("pointermove", onMove);
      window.addEventListener("pointerup", onUp);
      const timer = window.setTimeout(() => {
        cleanup();
        setActionSheetFor(id);
      }, ARRANGE_SUGGEST_HOLD_MS);
    };
  }

  const blocks: Record<PanelBlockId, ReactNode> = {
    streak: (
      <StreakCounter streak={streak} best={bestStreak} today={todayStatus} />
    ),
    weekly: <WeeklyCompletion data={weekly} />,
    freezes: <FreezeSummary remaining={freezesRemaining} total={MAX_FREEZES_PER_MONTH} />,
    templates: <TemplateBreakdown data={templateBreakdown} tags={tags} />,
    quote: <QuoteWidget quote={quote} />,
    tasks: (
      <TaskList
        selectedDate={selectedDate}
        occurrences={occurrences}
        tags={tags}
        onToggle={onToggle}
        onView={onView}
        onDelete={onDelete}
        onReorderTasks={onReorderTasks}
        onReorderTags={onReorderTags}
        onSaveAsTemplate={onSaveAsTemplate}
        onRemoveTemplate={onRemoveTemplate}
        templates={templates}
        templateTaskBlueprints={templateTaskBlueprints}
        notes={notes}
        onEditNote={onEditNote}
        onDeleteNote={onDeleteNote}
        onReorderNotePositions={onReorderNotePositions}
      />
    ),
  };

  // Hidden widgets stay in `order` (so their position is remembered for
  // when they're re-added) but are skipped here at render time - the drag
  // math below already tolerates ids with no rendered block (blockRefs
  // just never gets an entry for them), so nothing else needs to change to
  // support a gap in the middle of `order`.
  const visibleOrder = order.filter((id) => id === "tasks" || !hiddenWidgets.includes(id as WidgetId));

  return (
    <div className="day-panel">
      <div className="day-panel__expand-toggle-wrap">
        <button
          type="button"
          className="day-panel__expand-toggle"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse to show calendar" : "Expand to full screen"}
        >
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
        </button>
      </div>
      <div className="day-panel__header">
        <h2 className="day-panel__date">{label}</h2>
        <div className="day-panel__header-actions">
          <AddMenu
            templates={templates}
            onAddTask={onAddTask}
            onApplyTemplate={onApplyTemplate}
            onAddNote={onAddNote}
          />
        </div>
      </div>

      {arranging && (
        <div className="day-panel__arrange-bar">
          <span>Drag the handles to reorder</span>
          <Button onClick={onFinishArranging}>Done</Button>
        </div>
      )}

      {!arranging &&
        friendNotes.map((note) => (
          <FriendNoteWidget key={note.id} note={note} onDismiss={onDismissFriendNote} />
        ))}

      {visibleOrder.map((id) => {
        const trueIndex = order.indexOf(id);
        const isWidget = id !== "tasks";
        return (
          <Fragment key={id}>
            {draggedId !== null && dropIndex === trueIndex && (
              <div className="day-panel__drop-line" />
            )}
            <div
              ref={(el) => {
                blockRefs.current[id] = el ?? undefined;
              }}
              className={`day-panel__block ${arranging ? "day-panel__block--arranging" : ""} ${draggedId === id ? "day-panel__block--dragging" : ""} ${!arranging && isWidget ? "day-panel__block--suggestable" : ""}`}
              onPointerDown={!arranging && isWidget ? bindArrangeSuggestion(id) : undefined}
            >
              {arranging && (
                <span
                  className="day-panel__handle"
                  aria-hidden="true"
                  onPointerDown={(e) => startDrag(id, e.clientY)}
                >
                  <GripIcon size={14} />
                </span>
              )}
              <div className="day-panel__block-content">{blocks[id]}</div>
              {!arranging && isWidget && (
                <button
                  type="button"
                  className="day-panel__widget-menu"
                  aria-label={`${WIDGET_LABELS[id]} options`}
                  onClick={() => setActionSheetFor(id)}
                >
                  <MoreIcon size={14} />
                </button>
              )}
            </div>
          </Fragment>
        );
      })}
      {draggedId !== null && dropIndex === order.length && (
        <div className="day-panel__drop-line" />
      )}

      {!arranging && hiddenWidgets.length > 0 && (
        <button
          type="button"
          className="day-panel__add-widget"
          onClick={() => setAddWidgetSheetOpen(true)}
        >
          + Add widget
        </button>
      )}

      {actionSheetFor && (
        <ActionSheet
          title={WIDGET_LABELS[actionSheetFor]}
          onClose={() => setActionSheetFor(null)}
          actions={[
            {
              label: "Remove widget",
              icon: <XIcon size={16} />,
              onSelect: () => onHideWidget(actionSheetFor),
            },
            {
              label: "Arrange widgets",
              icon: <GripIcon size={16} />,
              onSelect: onStartArranging,
            },
          ]}
        />
      )}

      {addWidgetSheetOpen && (
        <ActionSheet
          title="Add a widget"
          onClose={() => setAddWidgetSheetOpen(false)}
          actions={hiddenWidgets.map((id) => ({
            label: WIDGET_LABELS[id],
            onSelect: () => onShowWidget(id),
          }))}
        />
      )}
    </div>
  );
}
