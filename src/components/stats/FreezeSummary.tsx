import { FrostIcon } from "../ui/icons";
import "./stats.css";

interface FreezeSummaryProps {
  remaining: number;
  total: number;
}

export function FreezeSummary({ remaining, total }: FreezeSummaryProps) {
  return (
    <div className="stat-card">
      <div className="freeze-summary__top">
        <div>
          <div className="stat-card__value">{remaining}</div>
          <div className="stat-card__label">
            freeze{remaining === 1 ? "" : "s"} left this month
          </div>
        </div>
        <FrostIcon size={26} className="freeze-summary__icon" />
      </div>
      <div className="freeze-pips" role="img" aria-label={`${remaining} of ${total} freezes left this month`}>
        {Array.from({ length: total }, (_, i) => (
          <span key={i} className={`freeze-pip ${i < remaining ? "freeze-pip--available" : ""}`} />
        ))}
      </div>
    </div>
  );
}
