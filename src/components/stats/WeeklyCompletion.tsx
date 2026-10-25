import { parseDateKey, todayKey } from "../../utils/dates";
import { WIDGET_COLORS } from "../../utils/panelOrder";
import type { WeeklyCompletion as WeeklyCompletionData } from "../../utils/stats";
import { CalendarIcon } from "../ui/icons";
import { WidgetCard } from "./WidgetCard";
import "./stats.css";

const LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

/** The week so far: the overall % big, and a bar per day (Monday to
 *  Sunday) filled with that day's share done - so you can see which days
 *  went well, not just the total. Today's bar is striped (still going). */
export function WeeklyCompletion({ data }: { data: WeeklyCompletionData }) {
  const today = todayKey();

  return (
    <WidgetCard
      color={WIDGET_COLORS.weekly}
      icon={<CalendarIcon size={13} />}
      title="This week"
      meta={`${data.completed} of ${data.scheduled} done`}
    >
      <div className="weekly">
        <div className="widget-big">
          {data.percent}
          <span>%</span>
        </div>
        <ol className="weekly__days" aria-label="Each day this week">
          {data.days.map((day, i) => (
            <li
              key={day.date}
              className={[
                "weekly__day",
                day.date === today && "weekly__day--today",
                day.date > today && "weekly__day--future",
                day.rate === null && "weekly__day--rest",
              ]
                .filter(Boolean)
                .join(" ")}
              aria-label={`${parseDateKey(day.date).toLocaleDateString(undefined, { weekday: "long" })}: ${
                day.rate === null ? "nothing scheduled" : `${Math.round(day.rate * 100)}% done`
              }`}
            >
              <span className="weekly__track">
                <span className="weekly__fill" style={{ height: `${(day.rate ?? 0) * 100}%` }} />
              </span>
              <span className="weekly__letter">{LETTERS[i]}</span>
            </li>
          ))}
        </ol>
      </div>
    </WidgetCard>
  );
}
