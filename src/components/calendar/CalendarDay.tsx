import type { CSSProperties } from "react";
import type { TradingResult } from "../../types";
import { parseDateKey } from "../../utils/dates";
import { formatTradingResult } from "../../utils/trading";
import { MinusIcon, TrendingUpIcon } from "../ui/icons";
import "./CalendarDay.css";

export interface DayChip {
  id: string;
  title: string;
  /** The task's tag color - null for an untagged task. */
  color: string | null;
  done: boolean;
}

const MAX_CHIPS = 2;

interface CalendarDayProps {
  dateKey: string;
  dayNumber: number;
  isCurrentMonth: boolean;
  isToday: boolean;
  isSelected: boolean;
  hasTasks: boolean;
  /** Before today - see the task dot below. */
  isPast?: boolean;
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
  isPast = false,
  completionRate,
  isFrozen,
  tradingResult,
  chips,
  onSelect,
}: CalendarDayProps) {
  const isFullyCompleted = completionRate === 1;
  const weekday = parseDateKey(dateKey).getDay();
  const isWeekend = weekday === 0 || weekday === 6;
  // The day's progress as a thin bar along the bottom - only where it says
  // something: today, and past days that weren't finished. A fully done
  // day is just tinted green (most days are, so they stay calm), and a
  // frozen one is protected either way - its ice says it all.
  const showProgress =
    completionRate !== null && !isFullyCompleted && !isFrozen && (isPast || isToday);

  // Said aloud only - on screen it's the cell's color (green done, ice
  // frozen), no icons.
  const status = isFrozen ? ", frozen" : isFullyCompleted ? ", all done" : "";

  return (
    <button
      aria-label={`${parseDateKey(dateKey).toLocaleDateString(undefined, {
        weekday: "long",
        month: "long",
        day: "numeric",
      })}${status}`}
      className={[
        "cal-day",
        !isCurrentMonth && "cal-day--dim",
        isSelected && "cal-day--selected",
        isFullyCompleted && "cal-day--complete",
        isFrozen && "cal-day--frozen",
        isWeekend && "cal-day--weekend",
        tradingResult !== null && "cal-day--has-result",
      ]
        .filter(Boolean)
        .join(" ")}
      onClick={() => onSelect(dateKey)}
    >
      <span className={`cal-day__number ${isToday ? "cal-day__number--today" : ""}`}>
        {dayNumber}
      </span>
      {tradingResult !== null && (
        <span
          className={`cal-day__result-center ${
            tradingResult.value > 0
              ? "cal-day__result-center--positive"
              : tradingResult.value < 0
                ? "cal-day__result-center--negative"
                : "cal-day__result-center--even"
          }`}
        >
          {/* Desktop: the trend arrow before the number (hidden on phone). */}
          <span className="cal-day__result-icon" aria-hidden="true">
            {tradingResult.value === 0 ? <MinusIcon size={13} /> : <TrendingUpIcon size={13} />}
          </span>
          {formatTradingResult(tradingResult.value, tradingResult.unit)}
        </span>
      )}
      {/* Only on days still ahead - on past days it was on nearly every
          cell and said nothing (their fill/check already tell the story). */}
      {hasTasks && !isPast && !isToday && tradingResult === null && (
        <span className="cal-day__indicator" />
      )}
      {showProgress && (
        <span className="cal-day__progress" aria-hidden="true">
          <span style={{ width: `${(completionRate ?? 0) * 100}%` }} />
        </span>
      )}
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
