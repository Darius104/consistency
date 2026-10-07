import type { CSSProperties, PointerEvent, ReactNode, SyntheticEvent } from "react";
import { formatCountdown } from "../../utils/dates";
import { CheckIcon, ChevronRightIcon, ClockIcon } from "../ui/icons";
import type { UrgencyLevel } from "./TaskList";
import "./TaskGroup.css";

interface TaskGroupProps {
  label: string;
  color?: string;
  totalCount: number;
  doneCount: number;
  collapsed: boolean;
  onToggle: () => void;
  children: ReactNode;
  draggable?: boolean;
  dragging?: boolean;
  /** Long-press (touch) / drag (mouse) the header to reorder groups - see
   *  useReorderDrag's bindLongPress. */
  onDragPointerDown?: (e: PointerEvent) => void;
  suppressClick?: (e: SyntheticEvent) => boolean;
  /** Set when today's deadline is close and this group still has tasks
   *  left (see TaskList's UrgencyLevel) - shows the countdown strip across
   *  the top of the card, amber then red. */
  urgency?: UrgencyLevel | null;
  /** Time left until midnight, for that strip. */
  msLeft?: number | null;
}

export function TaskGroup({
  label,
  color,
  totalCount,
  doneCount,
  collapsed,
  onToggle,
  children,
  draggable,
  dragging,
  onDragPointerDown,
  suppressClick,
  urgency,
  msLeft,
}: TaskGroupProps) {
  const isComplete = totalCount > 0 && doneCount === totalCount;

  // A finished group that's been folded away shrinks to one quiet line
  // (TaskList also moves it to the bottom) - what's left to do stays on top.
  const isDoneCompact = isComplete && collapsed;
  const percent = totalCount === 0 ? 0 : (doneCount / totalCount) * 100;

  return (
    <div
      className={[
        "task-group",
        isComplete && "task-group--complete",
        isDoneCompact && "task-group--done-compact",
        dragging && "task-group--dragging",
        urgency && `task-group--urgency-${urgency}`,
      ]
        .filter(Boolean)
        .join(" ")}
      style={color ? ({ "--group-color": color } as CSSProperties) : undefined}
    >
      {urgency && msLeft != null && (
        <div className="task-group__urgency" role="status">
          <ClockIcon size={13} className="task-group__urgency-icon" />
          <span className="task-group__urgency-text">
            <strong>{formatCountdown(msLeft)}</strong> to keep your streak
          </span>
          <span className="task-group__urgency-count">
            {totalCount - doneCount} to go
          </span>
        </div>
      )}
      <div
        className={`task-group__header ${draggable ? "task-group__header--draggable" : ""}`}
        role="button"
        tabIndex={0}
        onPointerDown={draggable ? onDragPointerDown : undefined}
        onClick={(e) => {
          if (suppressClick?.(e)) return;
          onToggle();
        }}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggle();
          }
        }}
        aria-expanded={!collapsed}
      >
        {isDoneCompact ? (
          <span className="task-group__done-icon" aria-hidden="true">
            <CheckIcon size={11} />
          </span>
        ) : (
          <span className="task-group__dot" aria-hidden="true" />
        )}
        <span className="task-group__label">{label}</span>
        <span className="task-group__count">
          {doneCount}/{totalCount}
        </span>
        <ChevronRightIcon
          size={14}
          className={`task-group__chevron ${collapsed ? "" : "task-group__chevron--open"}`}
        />
      </div>
      {!isDoneCompact && (
        <div className="task-group__progress" aria-hidden="true">
          <span style={{ width: `${percent}%` }} />
        </div>
      )}
      <div
        className={`task-group__items-wrapper ${collapsed ? "task-group__items-wrapper--collapsed" : ""}`}
        aria-hidden={collapsed}
        inert={collapsed || undefined}
      >
        <div className="task-group__items">{children}</div>
      </div>
    </div>
  );
}
