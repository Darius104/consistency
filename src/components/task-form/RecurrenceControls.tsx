import type { RecurrenceType } from "../../types";
import { Checkbox } from "../ui/Checkbox";
import "./RecurrenceControls.css";

const WEEKDAY_OPTIONS: { label: string; value: number }[] = [
  { label: "Mon", value: 1 },
  { label: "Tue", value: 2 },
  { label: "Wed", value: 3 },
  { label: "Thu", value: 4 },
  { label: "Fri", value: 5 },
  { label: "Sat", value: 6 },
  { label: "Sun", value: 0 },
];

const WEEKDAYS_ONLY = [1, 2, 3, 4, 5];

interface RecurrenceControlsProps {
  type: RecurrenceType;
  days: number[];
  onChange: (type: RecurrenceType, days: number[]) => void;
}

export function RecurrenceControls({
  type,
  days,
  onChange,
}: RecurrenceControlsProps) {
  function selectType(t: RecurrenceType) {
    if (t === type) return;
    // Fresh default whenever the repeat mode itself changes: daily starts
    // including weekends, weekly starts with no days picked yet.
    onChange(t, []);
  }

  function toggleWeeklyDay(day: number) {
    const next = days.includes(day)
      ? days.filter((d) => d !== day)
      : [...days, day];
    onChange("weekly", next);
  }

  function toggleIncludeWeekends(includeWeekends: boolean) {
    onChange("daily", includeWeekends ? [] : WEEKDAYS_ONLY);
  }

  return (
    <div className="recurrence">
      <div className="recurrence__types">
        {(["none", "daily", "weekly"] as RecurrenceType[]).map((t) => (
          <button
            type="button"
            key={t}
            className={`recurrence__type ${type === t ? "recurrence__type--active" : ""}`}
            onClick={() => selectType(t)}
          >
            {t === "none" ? "Doesn't repeat" : t === "daily" ? "Daily" : "Weekly"}
          </button>
        ))}
      </div>

      {type === "daily" && (
        <div className="recurrence__weekend-toggle">
          <Checkbox
            checked={days.length === 0}
            onChange={toggleIncludeWeekends}
            label="Also repeat on weekends"
          />
        </div>
      )}

      {type === "weekly" && (
        <div className="recurrence__days">
          {WEEKDAY_OPTIONS.map((opt) => (
            <button
              type="button"
              key={opt.value}
              className={`recurrence__day ${days.includes(opt.value) ? "recurrence__day--active" : ""}`}
              onClick={() => toggleWeeklyDay(opt.value)}
            >
              {opt.label[0]}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
