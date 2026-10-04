import "./TradingResultBadge.css";

interface TradingResultBadgeProps {
  value: number | null;
  onClick: () => void;
}

/** Entry point into TradingResultModal, next to "+ Add" - the number
 *  itself is only ever shown on the calendar grid cell, not here. Always
 *  the same dashed, transparent pill either way - only the label and the
 *  dot's color change once a result's actually been logged. */
export function TradingResultBadge({ value, onClick }: TradingResultBadgeProps) {
  if (value === null) {
    return (
      <button type="button" className="trading-result" onClick={onClick}>
        + Log result
      </button>
    );
  }

  return (
    <button
      type="button"
      className={`trading-result ${value > 0 ? "trading-result--positive" : value < 0 ? "trading-result--negative" : ""}`}
      onClick={onClick}
    >
      <span className="trading-result__dot" />
      Edit result
    </button>
  );
}
