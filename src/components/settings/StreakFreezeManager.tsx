import { useEffect, useRef, useState } from "react";
import type { FreezeCandidate } from "../../utils/stats";
import { parseDateKey, todayKey } from "../../utils/dates";
import { FrostIcon } from "../ui/icons";
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

/** A past month's freezes are locked in - removing one would let a closed
 *  month's streak record be rewritten after the fact, and its freeze
 *  allowance can't be spent again anyway. */
export function isCurrentMonth(dateKey: string): boolean {
  return dateKey.slice(0, 7) === todayKey().slice(0, 7);
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
    // How many are left this month is in the page's banner (SettingsModal).
    <div className="settings-pages freeze-manager">
      {confirmation && (
        <div className="freeze-manager__confirm" key={confirmation.id}>
          <FrostIcon size={13} />
          {formatDate(confirmation.date)} frozen - streak protected.
        </div>
      )}

      <div className="settings-group-wrap">
        <span className="settings-group__title">Missed days you can freeze</span>
        {candidates.length === 0 ? (
          <div className="settings-group">
            <div className="settings-group__row settings-group__row--muted">Nothing to freeze this month</div>
          </div>
        ) : (
          <div className="settings-group settings-group--tiles">
            {candidates.map((c) => {
              const percent = Math.round(c.rate * 100);
              return (
                <div className="settings-group__row" key={c.date}>
                  <span className="settings-tile settings-tile--muted" aria-hidden="true">
                    {parseDateKey(c.date).getDate()}
                  </span>
                  <span className="settings-group__label settings-group__label--stack">
                    {formatDate(c.date)}
                    <small>{percent}% done</small>
                  </span>
                  <button
                    type="button"
                    className="settings-row-action"
                    onClick={() => handleFreezeClick(c.date)}
                    disabled={freezesRemaining === 0}
                  >
                    Freeze
                  </button>
                </div>
              );
            })}
          </div>
        )}
        {freezesRemaining === 0 && candidates.length > 0 && (
          <span className="settings-footnote">No freezes left this month.</span>
        )}
      </div>

      {frozenDays.length > 0 && (
        <div className="settings-group-wrap">
          <span className="settings-group__title">Frozen</span>
          <div className="settings-group settings-group--tiles">
            {frozenDays.map((date) => (
              <div className="settings-group__row" key={date}>
                <span className="settings-tile" aria-hidden="true">
                  <FrostIcon size={14} />
                </span>
                <span className="settings-group__label freeze-manager__date">{formatDate(date)}</span>
                {isCurrentMonth(date) ? (
                  <button
                    type="button"
                    className="settings-row-action settings-row-action--danger"
                    aria-label={`Unfreeze ${formatDate(date)}`}
                    onClick={() => onUnfreeze(date)}
                  >
                    Remove
                  </button>
                ) : (
                  <span className="settings-group__value">Locked</span>
                )}
              </div>
            ))}
          </div>
          <span className="settings-footnote">Past months' freezes are locked in.</span>
        </div>
      )}
    </div>
  );
}
