import { useState } from "react";
import type { Task } from "../../types";
import {
  buildMonthGrid,
  isSameMonth,
  parseDateKey,
  todayKey,
  WEEKDAY_LABELS,
} from "../../utils/dates";
import { dayCompletionRate } from "../../utils/stats";
import { tasksScheduledOn } from "../../utils/recurrence";
import { CalendarDay } from "./CalendarDay";
import { CalendarHeader } from "./CalendarHeader";
import "./CalendarView.css";

interface CalendarViewProps {
  tasks: Task[];
  completions: Set<string>;
  freezes: Set<string>;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  onOpenSettings: () => void;
  onOpenPhrase: () => void;
  phraseUnseen: boolean;
}

export function CalendarView({
  tasks,
  completions,
  freezes,
  selectedDate,
  onSelectDate,
  onOpenSettings,
  onOpenPhrase,
  phraseUnseen,
}: CalendarViewProps) {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = parseDateKey(selectedDate);
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  });

  const { weeks, monthLabel } = buildMonthGrid(cursor.year, cursor.monthIndex);

  function shiftMonth(delta: number) {
    setCursor(({ year, monthIndex }) => {
      const d = new Date(year, monthIndex + delta, 1);
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    });
  }

  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), monthIndex: d.getMonth() });
    onSelectDate(today);
  }

  return (
    <div className="cal-view">
      <CalendarHeader
        monthLabel={monthLabel}
        onPrev={() => shiftMonth(-1)}
        onNext={() => shiftMonth(1)}
        onToday={goToday}
        onOpenSettings={onOpenSettings}
        onOpenPhrase={onOpenPhrase}
        phraseUnseen={phraseUnseen}
      />
      <div className="cal-view__weekdays">
        {WEEKDAY_LABELS.map((label) => (
          <div key={label} className="cal-view__weekday">
            {label}
          </div>
        ))}
      </div>
      <div className="cal-view__grid">
        {weeks.flat().map((dateKey) => (
          <CalendarDay
            key={dateKey}
            dateKey={dateKey}
            dayNumber={parseDateKey(dateKey).getDate()}
            isCurrentMonth={isSameMonth(dateKey, cursor.year, cursor.monthIndex)}
            isToday={dateKey === today}
            isSelected={dateKey === selectedDate}
            hasTasks={tasksScheduledOn(tasks, dateKey).length > 0}
            completionRate={dayCompletionRate(tasks, completions, dateKey)}
            isFrozen={freezes.has(dateKey)}
            onSelect={onSelectDate}
          />
        ))}
      </div>
    </div>
  );
}
