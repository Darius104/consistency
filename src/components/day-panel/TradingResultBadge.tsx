import type { TradingResultUnit } from "../../types";
import { formatTradingResult } from "../../utils/trading";
import { MinusIcon, PlusIcon, TrendingUpIcon } from "../ui/icons";
import "./TradingResultBadge.css";

interface TradingResultBadgeProps {
  value: number | null;
  /** The unit it was logged in - shown the same way as on the calendar. */
  unit: TradingResultUnit | null;
  onClick: () => void;
}

/** Next to "+ Add": the day's result itself once it's logged (↗ +2R in
 *  green, ↘ in red, − 0R in amber - tap to change it), and an empty dashed
 *  "+ Result" slot until then. Opens TradingResultModal either way. */
export function TradingResultBadge({ value, unit, onClick }: TradingResultBadgeProps) {
  if (value === null) {
    return (
      <button type="button" className="trading-result trading-result--empty" onClick={onClick}>
        <PlusIcon size={13} />
        Result
      </button>
    );
  }

  const tone = value > 0 ? "positive" : value < 0 ? "negative" : "even";
  return (
    <button
      type="button"
      className={`trading-result trading-result--${tone}`}
      onClick={onClick}
      aria-label={`Today's result: ${formatTradingResult(value, unit ?? "r")} - change it`}
    >
      {value === 0 ? (
        <MinusIcon size={14} />
      ) : (
        <TrendingUpIcon size={14} className="trading-result__trend" />
      )}
      {formatTradingResult(value, unit ?? "r")}
    </button>
  );
}
