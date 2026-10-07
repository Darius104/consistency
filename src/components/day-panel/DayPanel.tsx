import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { FriendNote } from "../../db/friendNotes";
import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { AvatarId } from "../../utils/avatars";
import type { DayNote, Tag, Task, Template, TradingResult, TradingResultUnit } from "../../types";
import { formatDayName, parseDateKey, todayKey } from "../../utils/dates";
import { WIDGET_LABELS, type PanelBlockId, type WidgetId } from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import {
  MAX_FREEZES_PER_MONTH,
  type TemplateBreakdownItem,
  type TodayStatus,
  type WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { useMediaQuery } from "../../hooks/useMediaQuery";
import { usePanelGestures } from "../../hooks/usePanelGestures";
import { ActionSheet } from "../ui/ActionSheet";
import { Modal } from "../ui/Modal";
import { Button } from "../ui/Button";
import {
  ChevronDownIcon,
  ChevronUpIcon,
  GripIcon,
  MoreIcon,
  PlusIcon,
  RefreshIcon,
  XIcon,
} from "../ui/icons";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { FreezeSummary } from "../stats/FreezeSummary";
import { FriendStreakCompare } from "../stats/FriendStreakCompare";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { AddMenu } from "./AddMenu";
import { FriendNoteWidget } from "./FriendNoteWidget";
import { TaskList } from "./TaskList";
import { TradingResultBadge } from "./TradingResultBadge";
import { TradingResultModal } from "./TradingResultModal";
import { WidgetTiles } from "./WidgetTiles";
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
  yourAvatarId: AvatarId | null;
  friendStreakEntries: FriendStreakEntry[];
  friendStreaksLoading: boolean;
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
  templates: Template[];
  onApplyTemplate: (templateId: string, taskIndices: number[]) => void;
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
  /** Phone: swipe left/right across the panel for the next/previous day. */
  onSwipeDay: (delta: 1 | -1) => void;
  /** Phone: pull down from the top to sync now. */
  onRefresh: () => Promise<unknown>;
  tradingResult: TradingResult | null;
  /** Remembered last-used unit - just the modal's starting pick for a
   *  brand-new entry (see TradingResultModal); an already-logged day
   *  always starts from its own stored unit instead. */
  tradingResultUnit: TradingResultUnit;
  onSetTradingResult: (value: number | null, unit: TradingResultUnit) => void;
  /** See AddMenu's openRequest - the phone tab bar's "+" button. */
  addMenuOpenRequest?: number;
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
  yourAvatarId,
  friendStreakEntries,
  friendStreaksLoading,
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
  templates,
  onApplyTemplate,
  onAddTask,
  notes,
  onAddNote,
  onEditNote,
  onDeleteNote,
  onReorderNotePositions,
  expanded,
  onToggleExpanded,
  onSwipeDay,
  onRefresh,
  tradingResult,
  tradingResultUnit,
  onSetTradingResult,
  addMenuOpenRequest,
}: DayPanelProps) {
  const [tradingModalOpen, setTradingModalOpen] = useState(false);
  const [draggedId, setDraggedId] = useState<PanelBlockId | null>(null);
  // Which widget's "Remove widget / Arrange widgets" sheet is open, if any -
  // replaces what used to be a single-purpose "Arrange panel?" confirm
  // modal with no idea which block was actually held.
  const [actionSheetFor, setActionSheetFor] = useState<WidgetId | null>(null);
  // Phone only: widgets show as compact tiles (WidgetTiles) and tapping one
  // opens the full widget here, in a sheet.
  const isPhone = useMediaQuery("(max-width: 700px)");
  const panelRef = useRef<HTMLDivElement>(null);
  const { pull, refreshing, triggered } = usePanelGestures(panelRef, {
    enabled: isPhone,
    onRefresh,
    onSwipeDay,
  });
  const [openWidget, setOpenWidget] = useState<WidgetId | null>(null);
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
  // The dragged block's own height, measured once when the drag starts -
  // every other block shifts by exactly this much to open/close the gap it
  // leaves behind, regardless of that other block's own height.
  const draggedHeightRef = useRef(0);
  const lastAppliedDropIndexRef = useRef<number | null>(null);
  // Every block's position/height *before* any shift transform is applied
  // - see useReorderDrag's identical field for why indexForY must read
  // from this snapshot instead of live getBoundingClientRect() calls once
  // shifting starts.
  const originalRectsRef = useRef<Map<PanelBlockId, { top: number; height: number }>>(new Map());

  const label = parseDateKey(selectedDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
  const isPastDay = selectedDate < todayKey();
  // "Today" / "Tomorrow" / "Yesterday" up front when it applies, the date
  // underneath - so it's obvious at a glance which day you're looking at.
  const relativeName = formatDayName(selectedDate);
  const isRelative = relativeName !== label;

  // Manual pointer-based dragging instead of the native HTML5 DnD API -
  // WKWebView's support for native drag/drop is unreliable, and this also
  // gives full control over the drop-position indicator line.
  useEffect(() => {
    if (!draggedId) return;
    document.body.classList.add("is-dragging");

    const anyBlock = Object.values(blockRefs.current)[0] ?? null;
    scrollContainerRef.current = findScrollParent(anyBlock ?? null);
    initialScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    const draggedEl = blockRefs.current[draggedId];
    draggedHeightRef.current = draggedEl?.getBoundingClientRect().height ?? 0;
    originalRectsRef.current = new Map();
    for (const [id, el] of Object.entries(blockRefs.current)) {
      if (!el) continue;
      const rect = el.getBoundingClientRect();
      originalRectsRef.current.set(id as PanelBlockId, { top: rect.top, height: rect.height });
    }
    for (const [id, el] of Object.entries(blockRefs.current)) {
      if (id !== draggedId && el) el.style.transition = "transform 180ms ease";
    }

    // Slides every other block out of the dragged one's way as it passes
    // over them, the same way useReorderDrag does for tasks/tags - see its
    // own comment for the full reasoning.
    function applyShifts(dropIdx: number) {
      if (lastAppliedDropIndexRef.current === dropIdx) return;
      lastAppliedDropIndexRef.current = dropIdx;
      const from = order.indexOf(draggedId as PanelBlockId);
      if (from === -1) return;
      for (let i = 0; i < order.length; i++) {
        const id = order[i];
        if (id === draggedId) continue;
        const el = blockRefs.current[id];
        if (!el) continue;
        // See useReorderDrag's identical shift logic for why this must be
        // i < dropIdx (not i <= dropIdx) - an off-by-one here shifted one
        // block too many when dragging down, which broke un-shifting
        // cleanly on a reversed drag back toward the start.
        let shift = 0;
        if (from < dropIdx && i > from && i < dropIdx) {
          shift = -draggedHeightRef.current;
        } else if (from > dropIdx && i >= dropIdx && i < from) {
          shift = draggedHeightRef.current;
        }
        el.style.transform = shift !== 0 ? `translateY(${shift}px)` : "";
      }
    }

    function clearShifts() {
      lastAppliedDropIndexRef.current = null;
      for (const [id, el] of Object.entries(blockRefs.current)) {
        if (id !== draggedId && el) {
          el.style.transform = "";
          el.style.transition = "";
        }
      }
    }

    function applyDragTransform() {
      const el = blockRefs.current[draggedId as PanelBlockId];
      if (!el || dragStartYRef.current === null || lastPointerYRef.current === null) return;
      const container = scrollContainerRef.current;
      const scrollDelta = container ? container.scrollTop - initialScrollTopRef.current : 0;
      const pointerDelta = lastPointerYRef.current - dragStartYRef.current;
      el.style.transform = `translateY(${pointerDelta + scrollDelta}px)`;
    }

    function indexForY(clientY: number): number {
      const container = scrollContainerRef.current;
      const scrollDelta = container ? container.scrollTop - initialScrollTopRef.current : 0;
      for (let i = 0; i < order.length; i++) {
        // The dragged block is excluded for the same reason as before (its
        // own live position follows the pointer, not a real boundary) -
        // every other block now compares against its pre-shift snapshot
        // (adjusted for how much has scrolled since) rather than a live
        // rect, which a shift transform would otherwise have moved.
        if (order[i] === draggedId) continue;
        const original = originalRectsRef.current.get(order[i]);
        if (!original) continue;
        const top = original.top - scrollDelta;
        if (clientY < top + original.height / 2) return i;
      }
      return order.length;
    }

    function onMove(e: PointerEvent) {
      lastPointerYRef.current = e.clientY;
      const newDropIndex = indexForY(e.clientY);
      applyShifts(newDropIndex);

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
      clearShifts();
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
      clearShifts();
    };
  }, [draggedId, order, onReorder]);

  function startDrag(id: PanelBlockId, startY: number) {
    setDraggedId(id);
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
    friendStreaks: (
      <FriendStreakCompare
        primaryStreak={streak}
        primaryAvatarId={yourAvatarId}
        friends={friendStreakEntries}
        loading={friendStreaksLoading}
      />
    ),
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
        notes={notes}
        dayFrozen={selectedDate === todayKey() && todayStatus.frozen}
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
    <div className="day-panel" ref={panelRef}>
      {isPhone && (
        <div
          className={`day-panel__pull ${refreshing ? "day-panel__pull--refreshing" : ""}`}
          style={{ height: pull }}
          aria-hidden={!refreshing}
          role={refreshing ? "status" : undefined}
        >
          {(pull > 0 || refreshing) && (
            <span
              className="day-panel__pull-icon"
              style={{ transform: refreshing ? undefined : `rotate(${triggered ? 180 : pull * 2}deg)` }}
            >
              <RefreshIcon size={18} />
            </span>
          )}
          {refreshing && <span className="day-panel__pull-text">Syncing…</span>}
        </div>
      )}
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
        <h2 className="day-panel__date" key={selectedDate}>
          {isRelative ? (
            <>
              {relativeName}
              <span className="day-panel__date-sub">{label}</span>
            </>
          ) : (
            label
          )}
        </h2>
        <div className="day-panel__header-actions">
          <TradingResultBadge
            value={tradingResult?.value ?? null}
            onClick={() => setTradingModalOpen(true)}
          />
          <AddMenu
            templates={templates}
            onAddTask={onAddTask}
            onApplyTemplate={onApplyTemplate}
            onAddNote={onAddNote}
            disabled={isPastDay}
            openRequest={addMenuOpenRequest}
            dateKey={selectedDate}
            onLogResult={() => setTradingModalOpen(true)}
            hasResult={!!tradingResult}
          />
        </div>
      </div>
      {isPastDay && (
        <span className="day-panel__past-day-hint">
          This day is locked - use a Streak Freeze to fix a missed one.
        </span>
      )}
      {tradingModalOpen && (
        <TradingResultModal
          value={tradingResult?.value ?? null}
          unit={tradingResult?.unit ?? tradingResultUnit}
          dateKey={selectedDate}
          onSave={(value, unit) => {
            onSetTradingResult(value, unit);
            setTradingModalOpen(false);
          }}
          onClose={() => setTradingModalOpen(false)}
        />
      )}

      {arranging && (
        <div className="day-panel__arrange-bar">
          <span>{isPhone ? "Drag widgets to move them" : "Drag the handles to reorder"}</span>
          <Button onClick={onFinishArranging}>Done</Button>
        </div>
      )}

      {!arranging &&
        friendNotes.map((note) => (
          <FriendNoteWidget key={note.id} note={note} onDismiss={onDismissFriendNote} />
        ))}

      {isPhone && (
        <>
          <WidgetTiles
            ids={visibleOrder}
            tasks={blocks.tasks}
            streak={streak}
            bestStreak={bestStreak}
            todayStatus={todayStatus}
            weekly={weekly}
            freezesRemaining={freezesRemaining}
            freezesTotal={MAX_FREEZES_PER_MONTH}
            templateBreakdown={templateBreakdown}
            tags={tags}
            quote={quote}
            yourAvatarId={yourAvatarId}
            friendStreakEntries={friendStreakEntries}
            onOpen={setOpenWidget}
            onMenu={setActionSheetFor}
            arranging={arranging}
            onStartArranging={onStartArranging}
            onRemove={onHideWidget}
            onReorder={(visibleNext) => {
              // Only the visible slots (tasks + shown widgets) change -
              // hidden widgets keep their places in the saved order, so
              // they come back where they were when re-added.
              const queue = [...visibleNext];
              onReorder(
                order.map((id) =>
                  id === "tasks" || !hiddenWidgets.includes(id as WidgetId) ? (queue.shift() ?? id) : id,
                ),
              );
            }}
          />
          {arranging && hiddenWidgets.length > 0 && (
            <div className="widget-add-list">
              <span className="widget-section-label">More widgets</span>
              {hiddenWidgets.map((id) => (
                <button
                  key={id}
                  type="button"
                  className="widget-add-row"
                  onClick={() => onShowWidget(id)}
                >
                  <span className="widget-add-row__plus">
                    <PlusIcon size={14} />
                  </span>
                  {WIDGET_LABELS[id]}
                </button>
              ))}
            </div>
          )}
        </>
      )}

      {openWidget && (
        <Modal title={WIDGET_LABELS[openWidget]} onClose={() => setOpenWidget(null)}>
          {blocks[openWidget]}
        </Modal>
      )}

      {!isPhone && visibleOrder.map((id) => {
        const isWidget = id !== "tasks";
        return (
          <Fragment key={id}>
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
