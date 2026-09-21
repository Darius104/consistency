import { useEffect, useRef, useState } from "react";
import { MAX_FREEZES_PER_MONTH, type FreezeCandidate } from "../../utils/stats";
import { parseDateKey } from "../../utils/dates";
import { Button } from "../ui/Button";
import { FrostIcon, TrashIcon } from "../ui/icons";
import "./StreakFreezeManager.css";

// How long the "X frozen" confirmation stays up after clicking Freeze.
const CONFIRM_MS = 1800;

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
  // Keyed by a fresh id each time (not just the date) so freezing the same
  // date again later still replays the pop-in/fade instead of no-op'ing
  // because the key didn't change.
  const [confirmation, setConfirmation] = useState<{ date: string; id: number } | null>(null);
  const confirmTimerRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
    };
  }, []);

  function handleFreezeClick(date: string) {
    onFreeze(date);
    if (confirmTimerRef.current !== null) window.clearTimeout(confirmTimerRef.current);
    setConfirmation({ date, id: Date.now() });
    confirmTimerRef.current = window.setTimeout(() => setConfirmation(null), CONFIRM_MS);
  }

  return (
    <div className="freeze-manager">
      <div className="settings__section">
        <span className="freeze-manager__remaining">
          <FrostIcon size={13} />
          {freezesRemaining} of {MAX_FREEZES_PER_MONTH} freezes left this month
        </span>

        {confirmation && (
          <div className="freeze-manager__confirm" key={confirmation.id}>
            <FrostIcon size={13} />
            {formatDate(confirmation.date)} frozen - streak protected.
          </div>
        )}
      </div>

      {frozenDays.length > 0 && (
        <div className="freeze-manager__group settings__section">
          <span className="settings__label">Frozen days</span>
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
                  <TrashIcon size={13} />
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="freeze-manager__group settings__section">
        <span className="settings__label">Freeze a missed day</span>
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
                <Button onClick={() => handleFreezeClick(c.date)} disabled={freezesRemaining === 0}>
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
