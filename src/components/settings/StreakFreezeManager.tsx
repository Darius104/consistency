import { useEffect, useRef, useState } from "react";
import { MAX_FREEZES_PER_MONTH, type FreezeCandidate } from "../../utils/stats";
import { parseDateKey, todayKey } from "../../utils/dates";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { FrostIcon, TrashIcon } from "../ui/icons";
import { SettingsCardHeader } from "./SettingsCardHeader";
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
    <div className="freeze-manager">
      <Card>
        <SettingsCardHeader
          icon={<FrostIcon size={16} />}
          label="Streak Freezes"
          hint="Protect your streak on a day you miss, without breaking it."
          color="#5ec8e8"
        />

        <div className="freeze-manager__remaining">
          <span className="freeze-manager__remaining-count">{freezesRemaining}</span>
          <span className="freeze-manager__remaining-text">
            of {MAX_FREEZES_PER_MONTH} freezes left this month
          </span>
        </div>

        {confirmation && (
          <div className="freeze-manager__confirm" key={confirmation.id}>
            <FrostIcon size={13} />
            {formatDate(confirmation.date)} frozen - streak protected.
          </div>
        )}
      </Card>

      {frozenDays.length > 0 && (
        <Card className="freeze-manager__group">
          <span className="settings__label">Frozen days</span>
          <div className="freeze-manager__list">
            {frozenDays.map((date) => (
              <div className="freeze-manager__row freeze-manager__row--frozen" key={date}>
                <span className="freeze-manager__date">
                  <FrostIcon size={13} />
                  {formatDate(date)}
                </span>
                {isCurrentMonth(date) && (
                  <button
                    type="button"
                    className="freeze-manager__unfreeze"
                    aria-label={`Unfreeze ${formatDate(date)}`}
                    onClick={() => onUnfreeze(date)}
                  >
                    <TrashIcon size={13} />
                  </button>
                )}
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card className="freeze-manager__group">
        <span className="settings__label">Freeze a missed day</span>
        {candidates.length === 0 ? (
          <EmptyState icon={<FrostIcon size={16} />}>
            Nothing to freeze - no incomplete days this month.
          </EmptyState>
        ) : (
          <div className="freeze-manager__list">
            {candidates.map((c) => {
              const percent = Math.round(c.rate * 100);
              return (
                <div className="freeze-manager__row freeze-manager__row--candidate" key={c.date}>
                  <div className="freeze-manager__candidate-info">
                    <div className="freeze-manager__candidate-header">
                      <span className="freeze-manager__date">{formatDate(c.date)}</span>
                      <span className="freeze-manager__rate">{percent}% done</span>
                    </div>
                    <div className="freeze-manager__progress">
                      <div className="freeze-manager__progress-fill" style={{ width: `${percent}%` }} />
                    </div>
                  </div>
                  <Button
                    variant="primary"
                    className="freeze-manager__freeze-btn"
                    onClick={() => handleFreezeClick(c.date)}
                    disabled={freezesRemaining === 0}
                  >
                    Freeze
                  </Button>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
