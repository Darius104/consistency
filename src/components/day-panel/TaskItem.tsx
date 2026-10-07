import { useEffect, useRef, useState } from "react";
import type { PointerEvent, SyntheticEvent } from "react";
import type { Task } from "../../types";
import { Checkbox } from "../ui/Checkbox";
import { PriorityDot } from "../ui/PriorityDot";
import { TrashIcon } from "../ui/icons";
import "./TaskItem.css";

// Swipe left reveals a Delete button this wide; swiping past most of the
// row's width deletes straight away (the iOS Mail/Reminders "full swipe").
const REVEAL_PX = 84;
const FULL_SWIPE_FRACTION = 0.55;

interface TaskItemProps {
  task: Task;
  completed: boolean;
  /** True once this row's day is already over - completions and deletes
   *  are locked in at that point (see handleToggle/handleRequestDeleteTask
   *  in App.tsx, which are the real enforcement; this just keeps the
   *  controls from offering an action that would silently no-op). */
  locked?: boolean;
  onToggle: () => void;
  onView: () => void;
  onDelete: () => void;
  /** Long-press (touch) / drag (mouse) to reorder - see useReorderDrag's
   *  bindLongPress. */
  onDragPointerDown: (e: PointerEvent) => void;
  suppressClick: (e: SyntheticEvent) => boolean;
  dragging: boolean;
}

interface SwipeGesture {
  pointerId: number;
  startX: number;
  startY: number;
  startOffset: number;
  mode: "pending" | "swipe" | "none";
}

export function TaskItem({
  task,
  completed,
  locked = false,
  onToggle,
  onView,
  onDelete,
  onDragPointerDown,
  suppressClick,
  dragging,
}: TaskItemProps) {
  const rowRef = useRef<HTMLDivElement>(null);
  const gestureRef = useRef<SwipeGesture | null>(null);
  const swipedRef = useRef(false);
  const [offset, setOffset] = useState(0);
  const [tracking, setTracking] = useState(false);
  const open = offset !== 0 && !tracking;

  // An open row closes again when you touch anywhere else.
  useEffect(() => {
    if (!open) return;
    function onOutside(e: globalThis.PointerEvent) {
      if (!rowRef.current?.parentElement?.contains(e.target as Node)) setOffset(0);
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  function onPointerDown(e: PointerEvent<HTMLDivElement>) {
    onDragPointerDown(e);
    if (locked || e.pointerType === "mouse") return;
    if ((e.target as HTMLElement).closest("button")) return;
    gestureRef.current = {
      pointerId: e.pointerId,
      startX: e.clientX,
      startY: e.clientY,
      startOffset: offset,
      mode: "pending",
    };
  }

  function onPointerMove(e: PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId || g.mode === "none") return;
    const dx = e.clientX - g.startX;
    const dy = e.clientY - g.startY;
    if (g.mode === "pending") {
      // Decide once: clearly sideways is a swipe; anything else belongs to
      // the native vertical scroll (or a long-press drag).
      if (Math.abs(dx) > 10 && Math.abs(dx) > Math.abs(dy) * 1.3) {
        g.mode = "swipe";
        e.currentTarget.setPointerCapture(e.pointerId);
        setTracking(true);
      } else if (Math.abs(dy) > 10) {
        g.mode = "none";
        return;
      } else {
        return;
      }
    }
    const width = rowRef.current?.offsetWidth ?? 320;
    let next = g.startOffset + dx;
    // Resists past the closed position instead of stopping dead.
    if (next > 0) next = Math.sqrt(next) * 2;
    setOffset(Math.max(next, -width));
  }

  function onPointerEnd(e: PointerEvent<HTMLDivElement>) {
    const g = gestureRef.current;
    if (!g || e.pointerId !== g.pointerId) return;
    gestureRef.current = null;
    if (g.mode !== "swipe") return;
    swipedRef.current = true;
    setTracking(false);
    const width = rowRef.current?.offsetWidth ?? 320;
    if (offset < -width * FULL_SWIPE_FRACTION) {
      setOffset(0);
      onDelete();
    } else if (offset < -REVEAL_PX / 2) {
      setOffset(-REVEAL_PX);
    } else {
      setOffset(0);
    }
  }

  const showMeta = !!task.time || task.priority === "high";

  return (
    <div className={`task-swipe ${open ? "task-swipe--open" : ""}`}>
      {!locked && (
        <button
          type="button"
          className="task-swipe__delete"
          tabIndex={open ? 0 : -1}
          aria-hidden={!open}
          onClick={() => {
            setOffset(0);
            onDelete();
          }}
        >
          <TrashIcon size={16} />
          Delete
        </button>
      )}
      <div
        ref={rowRef}
        className={[
          "task-item",
          completed && "task-item--completed",
          dragging && "task-item--dragging",
          tracking && "task-item--swiping",
        ]
          .filter(Boolean)
          .join(" ")}
        style={offset ? { transform: `translateX(${offset}px)` } : undefined}
        role="button"
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerEnd}
        onPointerCancel={onPointerEnd}
        onClick={(e) => {
          if (suppressClick(e)) return;
          if (swipedRef.current) {
            swipedRef.current = false;
            return;
          }
          if (offset !== 0) {
            setOffset(0);
            return;
          }
          onView();
        }}
        onKeyDown={(e) => {
          // Only when the row itself has focus - the checkbox and delete
          // button are their own real, separately-focusable controls that
          // already handle their own Enter/Space, and this would otherwise
          // also fire from their bubbled keydown events.
          if (e.target !== e.currentTarget) return;
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onView();
          }
        }}
      >
        <Checkbox
          checked={completed}
          onChange={onToggle}
          disabled={locked}
          ariaLabel={`Mark ${task.title} complete`}
        />
        <div className="task-item__main">
          <span className="task-item__title">{task.title}</span>
          {/* Only when it says something - "All day" and a Low/Medium badge
              on every single row were noise. */}
          {showMeta && (
            <div className="task-item__meta-row">
              {task.priority === "high" && <PriorityDot priority="high" />}
              {task.time && <span className="task-item__time">{task.time}</span>}
            </div>
          )}
          {task.notes && <div className="task-item__notes">{task.notes}</div>}
        </div>
        {!locked && (
          <button
            className="task-item__delete"
            aria-label="Delete task"
            onClick={(e) => {
              e.stopPropagation();
              onDelete();
            }}
          >
            <TrashIcon size={14} />
          </button>
        )}
      </div>
    </div>
  );
}
