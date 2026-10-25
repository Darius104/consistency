import { useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { addDays, parseDateKey, todayKey } from "../../utils/dates";
import {
  QUOTE_CATEGORY_COLOR,
  QUOTE_CATEGORY_LABEL,
  getQuoteOfDay,
  type Quote,
  type QuoteCategory,
} from "../../utils/quotes";
import { inkOn } from "../day-panel/addKinds";
import { Modal } from "../ui/Modal";
import {
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  HeartIcon,
  ShieldIcon,
  SparklesIcon,
} from "../ui/icons";
import "./PhraseModal.css";

interface PhraseModalProps {
  /** Today's phrase. */
  quote: Quote;
  onClose: () => void;
}

const CATEGORY_ICON: Record<QuoteCategory, ComponentType<{ size?: number }>> = {
  risk: ShieldIcon,
  mindset: SparklesIcon,
  patience: ClockIcon,
  life: HeartIcon,
};

// How far back ‹ goes - a month of phrases.
const MAX_DAYS_BACK = 30;

/** The phrase of the day as a bold card in its category's color, with ‹ ›
 *  to look back at the phrases of the last few weeks. */
export function PhraseModal({ quote, onClose }: PhraseModalProps) {
  // 0 = today, 1 = yesterday...
  const [daysBack, setDaysBack] = useState(0);
  const date = addDays(todayKey(), -daysBack);
  const shown = daysBack === 0 ? quote : getQuoteOfDay(date);
  const color = QUOTE_CATEGORY_COLOR[shown.category];
  const Icon = CATEGORY_ICON[shown.category];
  const dateLabel =
    daysBack === 0
      ? "Today"
      : daysBack === 1
        ? "Yesterday"
        : parseDateKey(date).toLocaleDateString(undefined, {
            weekday: "long",
            month: "long",
            day: "numeric",
          });

  return (
    <Modal
      title="Phrase of the day"
      icon={<SparklesIcon size={14} style={{ color: "#2a2103" }} />}
      accent="#f5c442"
      onClose={onClose}
    >
      <div
        className="phrase-modal"
        style={{ "--phrase-color": color, "--phrase-ink": inkOn(color) } as CSSProperties}
      >
        {/* Keyed by day, so each one plays a small fade in as you step. */}
        <div className="phrase-modal__card" key={date}>
          <span className="phrase-modal__category">
            <Icon size={12} />
            {QUOTE_CATEGORY_LABEL[shown.category]}
          </span>
          <p className="phrase-modal__text">{shown.text}</p>
          <span className="phrase-modal__date">{dateLabel}</span>
        </div>

        <div className="phrase-modal__actions">
          <button
            type="button"
            className="phrase-modal__step"
            aria-label="The day before"
            onClick={() => setDaysBack((d) => Math.min(MAX_DAYS_BACK, d + 1))}
            disabled={daysBack >= MAX_DAYS_BACK}
          >
            <ChevronLeftIcon size={18} />
          </button>
          <button type="button" className="phrase-modal__done" onClick={onClose}>
            Got it
          </button>
          <button
            type="button"
            className="phrase-modal__step"
            aria-label="The day after"
            onClick={() => setDaysBack((d) => Math.max(0, d - 1))}
            disabled={daysBack === 0}
          >
            <ChevronRightIcon size={18} />
          </button>
        </div>
      </div>
    </Modal>
  );
}
