import type { WeeklyCompletion as WeeklyCompletionData } from "../../utils/stats";
import "./stats.css";

export function WeeklyCompletion({ data }: { data: WeeklyCompletionData }) {
  return (
    <div className="stat-card">
      <div className="stat-card__value">{data.percent}%</div>
      <div className="stat-card__label">this week</div>
      <div className="week-bar">
        <div className="week-bar__fill" style={{ width: `${data.percent}%` }} />
      </div>
      <div className="stat-card__sub">
        {data.completed} / {data.scheduled} completed
      </div>
    </div>
  );
}
