import { WIDGET_COLORS } from "../../utils/panelOrder";
import { FrostIcon } from "../ui/icons";
import { WidgetCard } from "./WidgetCard";
import "./stats.css";

interface FreezeSummaryProps {
  remaining: number;
  total: number;
}

/** "1 of 3 left" - a snowflake per freeze this month, the used ones
 *  greyed, and when they come back. */
export function FreezeSummary({ remaining, total }: FreezeSummaryProps) {
  const now = new Date();
  const refill = new Date(now.getFullYear(), now.getMonth() + 1, 1).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });

  return (
    <WidgetCard
      color={WIDGET_COLORS.freezes}
      icon={<FrostIcon size={13} />}
      title="Streak freezes"
      meta={now.toLocaleDateString(undefined, { month: "long" })}
    >
      <div className="freeze-summary">
        <div className="widget-big">
          {remaining}
          <small>of {total} left</small>
        </div>
        <div className="freeze-summary__pips" role="img" aria-label={`${remaining} of ${total} freezes left this month`}>
          {Array.from({ length: total }, (_, i) => (
            <span
              key={i}
              className={`freeze-summary__pip ${i < remaining ? "freeze-summary__pip--left" : ""}`}
            >
              <FrostIcon size={14} />
            </span>
          ))}
        </div>
      </div>
      <p className="widget-card__foot">
        {remaining < total ? `Back to ${total} on ${refill}` : `Each one saves your streak on a missed day.`}
      </p>
    </WidgetCard>
  );
}
