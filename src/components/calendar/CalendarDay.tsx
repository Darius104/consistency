import type { CSSProperties } from "react";
import { FrostIcon } from "../ui/icons";
import "./CalendarDay.css";

interface CalendarDayProps {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasTasks: boolean;
  completionRate: number | null; // null = nothing scheduled
  isFrozen: boolean;
  onSelect: (dateKey: string) => void;
}

export function CalendarDay({
  dateKey,
  dayNumber,
  isCurrentMonth,
  isToday,
  isSelected,
  hasTasks,
  completionRate,
  isFrozen,
  onSelect,
}: CalendarDayProps) {
  const isFullyCompleted = completionRate === 1;
  const heatAlpha = completionRate === null ? 0 : 0.12 + completionRate * 0.48;

  return (
    <button
      className={[
        "cal-day",
        !isCurrentMonth && "cal-day--dim",
        isSelected && "cal-day--selected",
        isFullyCompleted && "cal-day--complete",
      ]
        .filter(Boolean)
        .join(" ")}
      style={{ "--heat-alpha": heatAlpha } as CSSProperties}
      onClick={() => onSelect(dateKey)}
    >
      <span className={`cal-day__number ${isToday ? "cal-day__number--today" : ""}`}>
        {dayNumber}
      </span>
      <span className="cal-day__badges">
        {isFullyCompleted && (
          <span className="cal-day__check" aria-label="All tasks completed">
            <svg viewBox="0 0 16 16" width="8" height="8">
              <path
                d="M2 8.5L6 12.5L14 3.5"
                stroke="currentColor"
                strokeWidth="2.5"
                fill="none"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </span>
        )}
        {isFrozen && (
          <span className="cal-day__frozen" aria-label="Streak frozen this day">
            <FrostIcon size={10} />
          </span>
        )}
      </span>
      {hasTasks && <span className="cal-day__indicator" />}
    </button>
  );
}
