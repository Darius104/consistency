import { Button } from "../ui/Button";
import { ChevronLeftIcon, ChevronRightIcon, QuoteIcon, SettingsIcon } from "../ui/icons";
import "./CalendarHeader.css";

interface CalendarHeaderProps {
  monthLabel: string;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  onOpenSettings: () => void;
  onOpenPhrase: () => void;
  phraseUnseen: boolean;
}

export function CalendarHeader({
  monthLabel,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
  onOpenPhrase,
  phraseUnseen,
}: CalendarHeaderProps) {
  return (
    <div className="cal-header">
      <h1 className="cal-header__title">{monthLabel}</h1>
      <div className="cal-header__nav">
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
        <Button onClick={onToday}>Today</Button>
        <Button className="btn--icon" onClick={onPrev} aria-label="Previous month">
          <ChevronLeftIcon size={15} />
        </Button>
        <Button className="btn--icon" onClick={onNext} aria-label="Next month">
          <ChevronRightIcon size={15} />
        </Button>
        <Button className="btn--icon" onClick={onOpenSettings} aria-label="Settings">
          <SettingsIcon size={15} />
        </Button>
      </div>
    </div>
  );
}
