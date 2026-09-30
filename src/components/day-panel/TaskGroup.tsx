import { useState } from "react";
import type { PointerEvent, ReactNode, SyntheticEvent } from "react";
import { formatCountdown } from "../../utils/dates";
import { BookmarkIcon, ChevronRightIcon, ClockIcon, GripIcon } from "../ui/icons";
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
  onHandlePointerDown?: (e: PointerEvent) => void;
  suppressClick?: (e: SyntheticEvent) => boolean;
  onSaveAsTemplate?: () => void;
  hasTemplate?: boolean;
  /** Milliseconds left until the end-of-day cutoff, only once that's close
   *  enough to matter (see TaskList's URGENCY_WINDOW_MS) - null/undefined
   *  hides the banner entirely, including on days this doesn't apply to. */
  urgentMsLeft?: number | null;
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
  onHandlePointerDown,
  suppressClick,
  onSaveAsTemplate,
  hasTemplate,
  urgentMsLeft,
}: TaskGroupProps) {
  const [justClicked, setJustClicked] = useState(false);
  const isComplete = totalCount > 0 && doneCount === totalCount;
  const isUrgent = urgentMsLeft != null;

  return (
    <div
      className={`task-group ${isComplete ? "task-group--complete" : ""} ${dragging ? "task-group--dragging" : ""} ${isUrgent ? "task-group--urgent" : ""}`}
    >
      {urgentMsLeft != null && (
        <div className="task-group__urgency">
          <ClockIcon size={12} className="task-group__urgency-icon" />
          {formatCountdown(urgentMsLeft)} to keep your streak
        </div>
      )}
      <div
        className="task-group__header"
        role="button"
        tabIndex={0}
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
        {draggable && (
          <span
            className="task-group__handle"
            onPointerDown={onHandlePointerDown}
            aria-hidden="true"
          >
            <GripIcon size={13} />
          </span>
        )}
        <ChevronRightIcon
          size={13}
          className={`task-group__chevron ${collapsed ? "" : "task-group__chevron--open"}`}
        />
        {color && <span className="task-group__dot" style={{ background: color }} />}
        <span className="task-group__label">{label}</span>
        <span className="task-group__count">
          {doneCount}/{totalCount}
        </span>
        {onSaveAsTemplate && (
          <button
            type="button"
            className={`task-group__save-template ${hasTemplate ? "task-group__save-template--saved" : ""} ${
              justClicked ? "task-group__save-template--pop" : ""
            }`}
            aria-label={
              hasTemplate ? `Remove ${label} template` : `Save ${label} as a template`
            }
            title={hasTemplate ? "Saved as template - click to remove" : "Save as template"}
            onClick={(e) => {
              e.stopPropagation();
              onSaveAsTemplate();
              setJustClicked(true);
              setTimeout(() => setJustClicked(false), 480);
            }}
          >
            <BookmarkIcon size={13} fill={hasTemplate ? "currentColor" : "none"} />
          </button>
        )}
      </div>
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
