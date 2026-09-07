import { useState } from "react";
import type { ReactNode } from "react";
import { BookmarkIcon, CheckIcon, ChevronRightIcon, GripIcon } from "../ui/icons";
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
  onDragHandleDown?: () => void;
  onSaveAsTemplate?: () => void;
  hasTemplate?: boolean;
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
  onDragHandleDown,
  onSaveAsTemplate,
  hasTemplate,
}: TaskGroupProps) {
  const [justClicked, setJustClicked] = useState(false);
  const isComplete = totalCount > 0 && doneCount === totalCount;

  return (
    <div
      className={`task-group ${isComplete ? "task-group--complete" : ""} ${dragging ? "task-group--dragging" : ""}`}
    >
      <button
        type="button"
        className="task-group__header"
        onClick={onToggle}
        aria-expanded={!collapsed}
      >
        {draggable && (
          <span
            className="task-group__handle"
            aria-hidden="true"
            onMouseDown={(e) => {
              e.stopPropagation();
              onDragHandleDown?.();
            }}
            onClick={(e) => e.stopPropagation()}
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
              hasTemplate ? `Update ${label} template` : `Save ${label} as a template`
            }
            title={hasTemplate ? "Saved as template - click to update" : "Save as template"}
            onClick={(e) => {
              e.stopPropagation();
              onSaveAsTemplate();
              if (!hasTemplate) {
                setJustClicked(true);
                setTimeout(() => setJustClicked(false), 900);
              }
            }}
          >
            {justClicked ? (
              <CheckIcon size={13} />
            ) : (
              <BookmarkIcon size={13} fill={hasTemplate ? "currentColor" : "none"} />
            )}
          </button>
        )}
      </button>
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
