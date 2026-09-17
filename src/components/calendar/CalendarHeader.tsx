import { Button } from "../ui/Button";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  QuoteIcon,
  RefreshIcon,
  SettingsIcon,
} from "../ui/icons";
import "./CalendarHeader.css";

interface CalendarHeaderProps {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Omitted entirely (not just a no-op) while viewing a friend's read-only
   *  calendar - neither applies there, so the buttons don't render at all
   *  instead of sitting there doing nothing when tapped. */
  onOpenSettings?: () => void;
  onOpenPhrase?: () => void;
  phraseUnseen?: boolean;
  /** Desktop-only manual "sync now" - mobile gets pull-to-refresh instead
   *  (see DayPanel.tsx), so this button is hidden there via CSS rather than
   *  giving the same action two different triggers on the same platform. */
  onSyncNow?: () => void;
  syncing?: boolean;
}

export function CalendarHeader({
  monthLabel,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
  onOpenPhrase,
  phraseUnseen,
  onSyncNow,
  syncing,
}: CalendarHeaderProps) {
  return (
    <div className="cal-header">
      <h1 className="cal-header__title">{monthLabel}</h1>
      <div className="cal-header__nav">
        {onOpenPhrase && (
          <span className="cal-header__phrase-wrap">
            <Button
              className="btn--icon"
              onClick={onOpenPhrase}
              aria-label="Phrase of the day"
            >
              <QuoteIcon size={15} />
              {phraseUnseen && <span className="cal-header__phrase-badge" aria-hidden="true" />}
            </Button>
            {phraseUnseen && (
              <div className="cal-header__phrase-tooltip" role="status">
                <span className="cal-header__phrase-tooltip-arrow" aria-hidden="true" />
                Click to see the phrase of the day
              </div>
            )}
          </span>
        )}
        <Button onClick={onToday}>Today</Button>
        <Button className="btn--icon" onClick={onPrev} aria-label="Previous month">
          <ChevronLeftIcon size={15} />
        </Button>
        <Button className="btn--icon" onClick={onNext} aria-label="Next month">
          <ChevronRightIcon size={15} />
        </Button>
        {onSyncNow && (
          <Button
            className="btn--icon only-desktop"
            onClick={onSyncNow}
            disabled={syncing}
            aria-label="Sync now"
            title="Sync now"
          >
            <RefreshIcon
              size={15}
              className={syncing ? "cal-header__sync-icon--spinning" : ""}
            />
          </Button>
        )}
        {onOpenSettings && (
          <Button className="btn--icon" onClick={onOpenSettings} aria-label="Settings">
            <SettingsIcon size={15} />
          </Button>
        )}
      </div>
    </div>
  );
}
