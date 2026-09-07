import type { FreezeCandidate } from "../../utils/stats";
import { parseDateKey } from "../../utils/dates";
import { Button } from "../ui/Button";
import { FrostIcon, XIcon } from "../ui/icons";
import "./StreakFreezeManager.css";

interface StreakFreezeManagerProps {
  frozenDays: string[];
  candidates: FreezeCandidate[];
  freezesRemaining: number;
  onFreeze: (date: string) => void;
  onUnfreeze: (date: string) => void;
}

function formatDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });
}

export function StreakFreezeManager({
  frozenDays,
  candidates,
  freezesRemaining,
  onFreeze,
  onUnfreeze,
}: StreakFreezeManagerProps) {
  return (
    <div className="freeze-manager">
      <span className="freeze-manager__remaining">
        <FrostIcon size={13} />
        {freezesRemaining} of 3 freezes left this month
      </span>

      {frozenDays.length > 0 && (
        <div className="freeze-manager__group">
          <span className="freeze-manager__group-label">Frozen days</span>
          <div className="freeze-manager__list">
            {frozenDays.map((date) => (
              <div className="freeze-manager__row" key={date}>
                <span className="freeze-manager__date">
                  <FrostIcon size={13} />
                  {formatDate(date)}
                </span>
                <button
                  type="button"
                  className="freeze-manager__unfreeze"
                  aria-label={`Unfreeze ${formatDate(date)}`}
                  onClick={() => onUnfreeze(date)}
                >
                  <XIcon size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="freeze-manager__group">
        <span className="freeze-manager__group-label">Freeze a missed day</span>
        {candidates.length === 0 ? (
          <span className="freeze-manager__empty">
            Nothing to freeze - no incomplete days this month.
          </span>
        ) : (
          <div className="freeze-manager__list">
            {candidates.map((c) => (
              <div className="freeze-manager__row" key={c.date}>
                <span className="freeze-manager__date">
                  {formatDate(c.date)}
                  <span className="freeze-manager__rate">
                    {Math.round(c.rate * 100)}% done
                  </span>
                </span>
                <Button onClick={() => onFreeze(c.date)} disabled={freezesRemaining === 0}>
                  Freeze
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
