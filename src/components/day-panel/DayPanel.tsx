import { Fragment, useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { Tag, Task, Template, TemplateTaskBlueprint } from "../../types";
import { parseDateKey } from "../../utils/dates";
import type { PanelBlockId } from "../../utils/panelOrder";
import type {
  TodayStatus,
  WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { Button } from "../ui/Button";
import { GripIcon } from "../ui/icons";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { TaskList } from "./TaskList";
import { TemplatePicker } from "./TemplatePicker";
import "./DayPanel.css";

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
  freezesRemainingThisMonth: number;
  order: PanelBlockId[];
  onReorder: (order: PanelBlockId[]) => void;
  arranging: boolean;
  onFinishArranging: () => void;
  onToggle: (task: Task) => void;
  onView: (task: Task) => void;
  onDelete: (task: Task) => void;
  onReorderTasks: (taskIds: number[]) => void;
  onReorderTags: (tagIds: number[]) => void;
  onSaveAsTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onRemoveTemplate: (templateId: number) => void;
  templates: Template[];
  onApplyTemplate: (templateId: number) => void;
  onAddTask: () => void;
}

export function DayPanel({
  selectedDate,
  occurrences,
  tags,
  streak,
  bestStreak,
  todayStatus,
  weekly,
  freezesRemainingThisMonth,
  order,
  onReorder,
  arranging,
  onFinishArranging,
  onToggle,
  onView,
  onDelete,
  onReorderTasks,
  onReorderTags,
  onSaveAsTemplate,
  onRemoveTemplate,
  templates,
  onApplyTemplate,
  onAddTask,
}: DayPanelProps) {
  const [draggedId, setDraggedId] = useState<PanelBlockId | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const blockRefs = useRef<Partial<Record<PanelBlockId, HTMLDivElement>>>({});

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

    function indexForY(clientY: number): number {
      for (let i = 0; i < order.length; i++) {
        const el = blockRefs.current[order[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return order.length;
    }

    function onMove(e: MouseEvent) {
      setDropIndex(indexForY(e.clientY));
    }

    function onUp(e: MouseEvent) {
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

    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("mousemove", onMove);
      window.removeEventListener("mouseup", onUp);
    };
  }, [draggedId, order, onReorder]);

  function startDrag(id: PanelBlockId) {
    setDraggedId(id);
    setDropIndex(order.indexOf(id));
  }

  const blocks: Record<PanelBlockId, ReactNode> = {
    streak: (
      <StreakCounter
        streak={streak}
        best={bestStreak}
        today={todayStatus}
        freezesRemaining={freezesRemainingThisMonth}
      />
    ),
    weekly: <WeeklyCompletion data={weekly} />,
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
      />
    ),
  };

  return (
    <div className="day-panel">
      <div className="day-panel__header">
        <h2 className="day-panel__date">{label}</h2>
        <div className="day-panel__header-actions">
          <TemplatePicker templates={templates} onApply={onApplyTemplate} />
          <Button
            variant="primary"
            className="day-panel__add-btn"
            onClick={onAddTask}
          >
            + Add task
          </Button>
        </div>
      </div>

      {arranging && (
        <div className="day-panel__arrange-bar">
          <span>Drag the handles to reorder</span>
          <Button onClick={onFinishArranging}>Done</Button>
        </div>
      )}

      {order.map((id, index) => (
        <Fragment key={id}>
          {draggedId !== null && dropIndex === index && (
            <div className="day-panel__drop-line" />
          )}
          <div
            ref={(el) => {
              blockRefs.current[id] = el ?? undefined;
            }}
            className={`day-panel__block ${arranging ? "day-panel__block--arranging" : ""} ${draggedId === id ? "day-panel__block--dragging" : ""}`}
          >
            {arranging && (
              <span
                className="day-panel__handle"
                aria-hidden="true"
                onMouseDown={() => startDrag(id)}
              >
                <GripIcon size={14} />
              </span>
            )}
            <div className="day-panel__block-content">{blocks[id]}</div>
          </div>
        </Fragment>
      ))}
      {draggedId !== null && dropIndex === order.length && (
        <div className="day-panel__drop-line" />
      )}
    </div>
  );
}
