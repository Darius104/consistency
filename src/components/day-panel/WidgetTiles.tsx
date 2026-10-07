import { useEffect, useLayoutEffect, useRef, useState } from "react";
import type { CSSProperties, PointerEvent as ReactPointerEvent, ReactNode } from "react";
import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { Tag } from "../../types";
import type { AvatarId } from "../../utils/avatars";
import { WIDGET_LABELS, type PanelBlockId, type WidgetId } from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import type {
  TemplateBreakdownItem,
  TodayStatus,
  WeeklyCompletion,
} from "../../utils/stats";
import { AvatarBadge } from "../stats/AvatarBadge";
import { StreakCounter } from "../stats/StreakCounter";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { hapticImpact, hapticSelection } from "../../utils/haptics";
import { FrostIcon, MinusIcon, MoreIcon } from "../ui/icons";
import "./WidgetTiles.css";

/** Full-width tiles - everything else is a half-width square. */
const WIDE: ReadonlySet<PanelBlockId> = new Set(["tasks", "streak", "quote", "friendStreaks"]);

interface WidgetTilesProps {
  /** Everything on the panel in order - the widgets plus "tasks" (the
   *  task list itself, rendered from `tasks`), so widgets can be arranged
   *  above or below it. */
  ids: PanelBlockId[];
  tasks: ReactNode;
  streak: number;
  bestStreak: number;
  todayStatus: TodayStatus;
  weekly: WeeklyCompletion;
  freezesRemaining: number;
  freezesTotal: number;
  templateBreakdown: TemplateBreakdownItem[];
  tags: Tag[];
  quote: Quote;
  yourAvatarId: AvatarId | null;
  friendStreakEntries: FriendStreakEntry[];
  onOpen: (id: WidgetId) => void;
  onMenu: (id: WidgetId) => void;
  /** Home-screen-style "jiggle mode": tiles wiggle, any tile can be dragged
   *  anywhere in the grid (two small tiles side by side can swap left and
   *  right), and each shows a - to remove it. */
  arranging: boolean;
  /** Long-pressing a tile enters arrange mode, like the iPhone home screen. */
  onStartArranging: () => void;
  onReorder: (ids: PanelBlockId[]) => void;
  onRemove: (id: WidgetId) => void;
}

interface DragState {
  id: WidgetId;
  pointerId: number;
  /** Where inside the tile it was grabbed, so it doesn't jump to the finger. */
  grabX: number;
  grabY: number;
  x: number;
  y: number;
}

// Blocks the page's own native scroll for the rest of a drag that began
// from a long press - that gesture started while the tiles still allowed
// scrolling (touch-action is only read when a touch begins), so without
// this the panel would scroll under the tile as it's dragged. Module-level
// (one stable function) so removeEventListener always removes the exact
// function that was added - a per-render copy couldn't be, which left it
// attached and froze all scrolling after a drag.
function preventTouchScroll(e: TouchEvent) {
  if (e.cancelable) e.preventDefault();
}

/** A tile's untransformed position on screen - offsetLeft/Top ignore the
 *  drag/FLIP transforms, so this is always where the grid itself put it. */
function layoutRect(grid: HTMLElement, el: HTMLElement) {
  const g = grid.getBoundingClientRect();
  return {
    left: g.left + el.offsetLeft,
    top: g.top + el.offsetTop,
    width: el.offsetWidth,
    height: el.offsetHeight,
  };
}

/** Phone-only, iOS-widget-style summary of the day panel's widgets: one
 *  glanceable number per tile, tap a tile for the full widget in a sheet
 *  (see DayPanel). Desktop keeps the full stacked widgets instead. */
export function WidgetTiles(props: WidgetTilesProps) {
  const { ids, onOpen, onMenu, arranging, onStartArranging, onReorder, onRemove } = props;
  const gridRef = useRef<HTMLDivElement>(null);
  const tileRefs = useRef(new Map<PanelBlockId, HTMLDivElement>());
  const dragRef = useRef<DragState | null>(null);
  // Live order while dragging - the grid reflows as the tile passes over
  // others; only committed (onReorder) when the finger lifts. Mirrored in a
  // ref so the auto-scroll frame loop always sees the latest one.
  const [preview, setPreview] = useState<PanelBlockId[] | null>(null);
  const previewRef = useRef<PanelBlockId[] | null>(null);
  const [draggingId, setDraggingId] = useState<WidgetId | null>(null);
  // Every tile's position just before a reflow, for the FLIP slide below.
  const beforeRef = useRef(new Map<PanelBlockId, { left: number; top: number }>());
  const rafRef = useRef<number | null>(null);
  const scrollerRef = useRef<HTMLElement | null>(null);
  const longPressRef = useRef<{
    timer: number;
    el: HTMLDivElement;
    id: WidgetId;
    pointerId: number;
    x: number;
    y: number;
  } | null>(null);
  // Set when a long press just picked a tile up, so the tap that ends that
  // same press doesn't also open the widget's sheet.
  const suppressClickRef = useRef(false);

  const shown = preview ?? ids;

  function setPreviewOrder(next: PanelBlockId[] | null) {
    previewRef.current = next;
    setPreview(next);
  }

  function cancelLongPress() {
    if (longPressRef.current) window.clearTimeout(longPressRef.current.timer);
    longPressRef.current = null;
  }

  function positionDragged() {
    const drag = dragRef.current;
    const grid = gridRef.current;
    const el = drag && tileRefs.current.get(drag.id);
    if (!drag || !grid || !el) return;
    const r = layoutRect(grid, el);
    el.style.transform = `translate(${drag.x - drag.grabX - r.left}px, ${drag.y - drag.grabY - r.top}px) scale(1.04)`;
  }

  // FLIP: after the grid reflows to a new preview order, every other tile
  // starts from where it just was and slides to its new slot, instead of
  // teleporting; the dragged tile is re-pinned under the finger.
  useLayoutEffect(() => {
    const grid = gridRef.current;
    if (!grid || beforeRef.current.size === 0) return;
    for (const [id, el] of tileRefs.current) {
      if (id === dragRef.current?.id) continue;
      const before = beforeRef.current.get(id);
      if (!before) continue;
      const now = layoutRect(grid, el);
      const dx = before.left - now.left;
      const dy = before.top - now.top;
      if (dx === 0 && dy === 0) continue;
      el.style.transition = "none";
      el.style.transform = `translate(${dx}px, ${dy}px)`;
      void el.offsetWidth;
      el.style.transition = "transform 220ms cubic-bezier(0.32, 0.72, 0, 1)";
      el.style.transform = "";
    }
    beforeRef.current = new Map();
    positionDragged();
  }, [preview]);

  /** Moves the dragged tile into another tile's slot once the finger
   *  crosses that tile's MIDDLE in the direction it's travelling - the
   *  vertical middle normally, the horizontal one for two tiles sharing a
   *  row (so half-width tiles swap sides). After a swap the finger is
   *  always on the far side of that middle, so nothing can flip straight
   *  back - which is what made the tall task list flicker up and down when
   *  a widget was dragged over it (it moved by a tile's height, the finger
   *  was still over it, it swapped back, and so on). */
  function updateTarget() {
    const drag = dragRef.current;
    const grid = gridRef.current;
    const draggedEl = drag && tileRefs.current.get(drag.id);
    if (!drag || !grid || !draggedEl) return;
    const order = previewRef.current ?? ids;
    const from = order.indexOf(drag.id);
    const home = layoutRect(grid, draggedEl);
    let target = -1;
    order.forEach((id, i) => {
      if (id === drag.id || target !== -1) return;
      const el = tileRefs.current.get(id);
      if (!el) return;
      const r = layoutRect(grid, el);
      const inside =
        drag.x >= r.left && drag.x <= r.left + r.width && drag.y >= r.top && drag.y <= r.top + r.height;
      if (!inside) return;
      const sameRow = Math.abs(r.top - home.top) < 4;
      const crossed = sameRow
        ? i < from
          ? drag.x < r.left + r.width / 2
          : drag.x > r.left + r.width / 2
        : i < from
          ? drag.y < r.top + r.height / 2
          : drag.y > r.top + r.height / 2;
      if (crossed) target = i;
    });
    if (target === -1 || from === target) return;
    const next = [...order];
    next.splice(from, 1);
    next.splice(target, 0, drag.id);

    const snapshot = new Map<PanelBlockId, { left: number; top: number }>();
    for (const [id, el] of tileRefs.current) {
      const r = el.getBoundingClientRect();
      snapshot.set(id, { left: r.left, top: r.top });
    }
    beforeRef.current = snapshot;
    hapticSelection();
    setPreviewOrder(next);
  }

  /** Runs every frame while dragging: scrolls the panel when the finger is
   *  near its top/bottom edge (so a tile can be moved to a slot that's
   *  currently off-screen), keeping the tile pinned under the finger. */
  function frame(prev: number) {
    const now = performance.now();
    const dt = Math.min(now - prev, 50);
    const drag = dragRef.current;
    const scroller = scrollerRef.current;
    if (drag && scroller) {
      const r = scroller.getBoundingClientRect();
      const edge = 70;
      let speed = 0;
      if (drag.y < r.top + edge) speed = -((r.top + edge - drag.y) / edge);
      else if (drag.y > r.bottom - edge) speed = (drag.y - (r.bottom - edge)) / edge;
      if (speed !== 0) {
        scroller.scrollTop += Math.max(-1, Math.min(1, speed)) * 0.9 * dt;
        positionDragged();
        updateTarget();
      }
    }
    if (dragRef.current) rafRef.current = window.requestAnimationFrame(() => frame(now));
  }


  function beginDrag(id: WidgetId, el: HTMLDivElement, pointerId: number, x: number, y: number) {
    const grid = gridRef.current;
    if (!grid) return;
    try {
      el.setPointerCapture(pointerId);
    } catch {
      // The window-level touchmove block below still keeps this a drag.
    }
    const r = layoutRect(grid, el);
    dragRef.current = { id, pointerId, grabX: x - r.left, grabY: y - r.top, x, y };
    el.style.transition = "none";
    hapticImpact();
    setDraggingId(id);
    setPreviewOrder(ids);
    positionDragged();
    let node = grid.parentElement;
    while (node && !["auto", "scroll"].includes(getComputedStyle(node).overflowY)) node = node.parentElement;
    scrollerRef.current = node;
    window.addEventListener("touchmove", preventTouchScroll, { passive: false });
    window.addEventListener("pointerup", onWindowRelease);
    window.addEventListener("pointercancel", onWindowRelease);
    window.addEventListener("touchend", onWindowRelease);
    window.addEventListener("touchcancel", onWindowRelease);
    const start = performance.now();
    rafRef.current = window.requestAnimationFrame(() => frame(start));
  }

  // Never leave a frame loop, timer or scroll block behind if this unmounts
  // mid-gesture (e.g. switching tabs while dragging).
  useEffect(
    () => () => {
      cancelLongPress();
      window.removeEventListener("touchmove", preventTouchScroll);
      window.removeEventListener("pointerup", onWindowRelease);
      window.removeEventListener("pointercancel", onWindowRelease);
      window.removeEventListener("touchend", onWindowRelease);
      window.removeEventListener("touchcancel", onWindowRelease);
      if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  function onPointerDown(id: PanelBlockId, e: ReactPointerEvent<HTMLDivElement>) {
    // The task list is a drop target only - its own rows have their own
    // taps, checkboxes and reordering, so it's never picked up from here.
    if (id === "tasks" || dragRef.current) return;
    if ((e.target as HTMLElement).closest("button:not(.widget-tile)")) return;
    if (arranging) {
      beginDrag(id, e.currentTarget, e.pointerId, e.clientX, e.clientY);
      return;
    }
    // Not arranging yet: a long press enters arrange mode AND picks this
    // tile up in the same motion, like the iPhone home screen.
    cancelLongPress();
    const el = e.currentTarget;
    const { pointerId, clientX, clientY } = e;
    longPressRef.current = {
      el,
      id,
      pointerId,
      x: clientX,
      y: clientY,
      timer: window.setTimeout(() => {
        const press = longPressRef.current;
        longPressRef.current = null;
        if (!press) return;
        suppressClickRef.current = true;
        onStartArranging();
        beginDrag(press.id, press.el, press.pointerId, press.x, press.y);
      }, 450),
    };
  }

  function onPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const press = longPressRef.current;
    if (press && e.pointerId === press.pointerId) {
      // Moved like a scroll, not a hold - let it be a scroll.
      if (Math.hypot(e.clientX - press.x, e.clientY - press.y) > 8) cancelLongPress();
      return;
    }
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    drag.x = e.clientX;
    drag.y = e.clientY;
    positionDragged();
    updateTarget();
  }

  function onPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    cancelLongPress();
    const drag = dragRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    endDrag();
  }

  // Fail-safe: if iOS delivers the lift (or a cancel) anywhere other than
  // the captured tile, the drag still ends - otherwise the native-scroll
  // block above would stay on and freeze scrolling for the whole screen.
  const endDragRef = useRef<() => void>(() => {});
  // Stable for the same reason as preventTouchScroll - it's added in one
  // render and removed from another.
  const onWindowRelease = useRef(() => {
    if (dragRef.current) endDragRef.current();
  }).current;

  endDragRef.current = endDrag;
  function endDrag() {
    const drag = dragRef.current;
    if (!drag) return;
    dragRef.current = null;
    window.removeEventListener("touchmove", preventTouchScroll);
    window.removeEventListener("pointerup", onWindowRelease);
    window.removeEventListener("pointercancel", onWindowRelease);
    window.removeEventListener("touchend", onWindowRelease);
    window.removeEventListener("touchcancel", onWindowRelease);
    if (rafRef.current !== null) window.cancelAnimationFrame(rafRef.current);
    rafRef.current = null;
    const el = tileRefs.current.get(drag.id);
    if (el) {
      // Settle into its slot from wherever it was let go.
      el.style.transition = "transform 240ms cubic-bezier(0.32, 0.72, 0, 1)";
      el.style.transform = "";
    }
    const finalOrder = previewRef.current;
    setDraggingId(null);
    setPreviewOrder(null);
    if (finalOrder && finalOrder.join() !== ids.join()) onReorder(finalOrder);
  }

  if (shown.length === 0) return null;

  return (
    <div ref={gridRef} className={`widget-tiles ${arranging ? "widget-tiles--arranging" : ""}`}>
      {shown.map((id, i) => (
        <div
          key={id}
          ref={(el) => {
            if (el) tileRefs.current.set(id, el);
            else tileRefs.current.delete(id);
          }}
          className={[
            "widget-slot",
            WIDE.has(id) && "widget-slot--wide",
            id === "tasks" && "widget-slot--tasks",
            draggingId === id && "widget-slot--dragging",
          ]
            .filter(Boolean)
            .join(" ")}
          // Alternate wiggle phase so neighbours don't move in lockstep.
          style={{ "--wiggle-delay": `${(i % 3) * -0.09}s` } as CSSProperties}
          onPointerDown={(e) => onPointerDown(id, e)}
          onPointerMove={onPointerMove}
          onPointerUp={onPointerUp}
          onPointerCancel={onPointerUp}
        >
          {arranging && id !== "tasks" && (
            <button
              type="button"
              className="widget-slot__remove"
              aria-label={`Remove ${WIDGET_LABELS[id]}`}
              onClick={() => onRemove(id)}
            >
              <MinusIcon size={12} />
            </button>
          )}
          {id === "tasks" ? (
            props.tasks
          ) : id === "streak" ? (
            // The app's core number - the real, full streak card (tier
            // colors, today's progress, "N left to keep it alive") spanning
            // the grid, not shrunk into a tile you'd have to open.
            <div className="widget-tile-hero">
              <StreakCounter streak={props.streak} best={props.bestStreak} today={props.todayStatus} />
              {!arranging && (
                <button
                  type="button"
                  className="widget-tile__menu"
                  aria-label={`${WIDGET_LABELS[id]} options`}
                  onClick={() => onMenu(id)}
                >
                  <MoreIcon size={14} />
                </button>
              )}
            </div>
          ) : (
            <div
              role="button"
              tabIndex={0}
              className="widget-tile"
              onClick={() => {
                if (suppressClickRef.current) {
                  suppressClickRef.current = false;
                  return;
                }
                if (!arranging) onOpen(id);
              }}
              onKeyDown={(e) => {
                if (!arranging && (e.key === "Enter" || e.key === " ")) onOpen(id);
              }}
            >
              {!arranging && (
                <button
                  type="button"
                  className="widget-tile__menu"
                  aria-label={`${WIDGET_LABELS[id]} options`}
                  onClick={(e) => {
                    e.stopPropagation();
                    onMenu(id);
                  }}
                >
                  <MoreIcon size={14} />
                </button>
              )}
              <TileContent {...props} id={id} />
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

function TileContent({
  id,
  ...p
}: WidgetTilesProps & { id: Exclude<WidgetId, "streak"> }) {
  switch (id) {
    case "weekly":
      return (
        <>
          <span className="widget-tile__label widget-tile__label--top">This week</span>
          <span className="widget-tile__value">{p.weekly.percent}%</span>
          <span className="widget-tile__bar">
            <span style={{ width: `${p.weekly.percent}%` }} />
          </span>
          <span className="widget-tile__sub">
            {p.weekly.completed}/{p.weekly.scheduled} tasks
          </span>
        </>
      );
    case "freezes":
      return (
        <>
          <span className="widget-tile__icon widget-tile__icon--frost">
            <FrostIcon size={20} />
          </span>
          <span className="widget-tile__value">
            {p.freezesRemaining}
            <span className="widget-tile__value-of">/{p.freezesTotal}</span>
          </span>
          <span className="widget-tile__label">freezes left</span>
          <span className="widget-tile__sub">this month</span>
        </>
      );
    case "templates":
      return <TemplateBreakdown data={p.templateBreakdown} tags={p.tags} compact />;
    case "quote":
      return (
        <>
          <span className="widget-tile__label widget-tile__label--top">Quote of the day</span>
          <span className="widget-tile__quote">“{p.quote.text}”</span>
        </>
      );
    case "friendStreaks": {
      const people = [
        ...(p.yourAvatarId
          ? [{ userId: "you", displayName: "You", avatarId: p.yourAvatarId, streak: p.streak }]
          : []),
        ...p.friendStreakEntries,
      ]
        .sort((a, b) => b.streak - a.streak)
        .slice(0, 5);
      return (
        <>
          <span className="widget-tile__label widget-tile__label--top">Friend streaks</span>
          {people.length <= 1 ? (
            <span className="widget-tile__sub">Add friends to compare streaks</span>
          ) : (
            <span className="widget-tile__people">
              {people.map((f) => (
                <span key={f.userId} className="widget-tile__person">
                  <AvatarBadge avatarId={f.avatarId} size={34} />
                  <span className="widget-tile__person-streak">{f.streak}</span>
                  <span className="widget-tile__person-name">{f.displayName}</span>
                </span>
              ))}
            </span>
          )}
        </>
      );
    }
  }
}
