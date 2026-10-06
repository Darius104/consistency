import type { CSSProperties } from "react";
import type { TradingResult } from "../../types";
import { formatTradingResult } from "../../utils/trading";
import { FrostIcon } from "../ui/icons";
import "./CalendarDay.css";

export interface DayChip {
  id: string;
  title: string;
  /** The task's tag color - null for an untagged task. */
  color: string | null;
  done: boolean;
}

const MAX_CHIPS = 3;

interface CalendarDayProps {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasTasks: boolean;
  completionRate: number | null; // null = nothing scheduled
  isFrozen: boolean;
  /** This day's logged trading result (see TradingResultBadge) - null if
   *  nothing was logged. Always shown in its own stored unit, never
   *  reinterpreted under the current global display preference. */
  tradingResult: TradingResult | null;
  /** That day's tasks, rendered as chips on phone widths only (see
   *  CalendarDay.css) - desktop cells stay a plain dot. */
  chips: DayChip[];
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
  tradingResult,
  chips,
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
        isFrozen && "cal-day--frozen",
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
            <FrostIcon size={8} />
          </span>
        )}
      </span>
      {tradingResult !== null && (
        <span
          className={`cal-day__result-center ${
            tradingResult.value > 0
              ? "cal-day__result-center--positive"
              : tradingResult.value < 0
                ? "cal-day__result-center--negative"
                : ""
          }`}
        >
          {formatTradingResult(tradingResult.value, tradingResult.unit)}
        </span>
      )}
      {hasTasks && <span className="cal-day__indicator" />}
      {chips.length > 0 && (
        <span className="cal-day__chips">
          {chips.slice(0, MAX_CHIPS).map((chip) => (
            <span
              key={chip.id}
              className={`cal-day__chip ${chip.done ? "cal-day__chip--done" : ""}`}
              style={chip.color ? ({ "--chip-color": chip.color } as CSSProperties) : undefined}
            >
              {chip.title}
            </span>
          ))}
          {chips.length > MAX_CHIPS && (
            <span className="cal-day__chip-more">+{chips.length - MAX_CHIPS}</span>
          )}
        </span>
      )}
    </button>
  );
}
