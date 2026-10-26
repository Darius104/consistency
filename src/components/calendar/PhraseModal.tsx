import { useEffect, useRef, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { addDays, parseDateKey, todayKey } from "../../utils/dates";
import {
  QUOTE_CATEGORY_COLOR,
  QUOTE_CATEGORY_LABEL,
  getQuoteOfDay,
  type Quote,
  type QuoteCategory,
} from "../../utils/quotes";
import { Modal, useModalClose } from "../ui/Modal";
import {
  CheckIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  ClockIcon,
  HeartIcon,
  ShieldIcon,
  SparklesIcon,
  XIcon,
} from "../ui/icons";
import "./PhraseModal.css";

interface PhraseModalProps {
  /** Today's phrase. */
  quote: Quote;
  onClose: () => void;
}

const CATEGORY_ICON: Record<QuoteCategory, ComponentType<{ size?: number; className?: string }>> = {
  risk: ShieldIcon,
  mindset: SparklesIcon,
  patience: ClockIcon,
  life: HeartIcon,
};

// A week of phrases - one dot each, today the last.
const DAYS = 7;

/** The phrase of the day as the whole window: its category's color, a big
 *  faint icon behind the text, a dot per day of the last week to step
 *  back through. */
export function PhraseModal({ quote, onClose }: PhraseModalProps) {
  return (
    <Modal title="Phrase of the day" onClose={onClose} bare>
      <PhraseCard quote={quote} />
    </Modal>
  );
}

function PhraseCard({ quote }: { quote: Quote }) {
  const close = useModalClose();
  // 0 = today, 1 = yesterday...
  const [daysBack, setDaysBack] = useState(0);
  const date = addDays(todayKey(), -daysBack);
  const shown = daysBack === 0 ? quote : getQuoteOfDay(date);
  const Icon = CATEGORY_ICON[shown.category];
  // "Copied" for a moment after Copy.
  const [copied, setCopied] = useState(false);
  const copiedTimerRef = useRef<number | null>(null);
  useEffect(() => () => {
    if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
  }, []);

  const cardRef = useRef<HTMLDivElement>(null);

  function handleCopy() {
    void copyText(`“${shown.text}”`, cardRef.current).then((ok) => {
      if (!ok) return;
      setCopied(true);
      if (copiedTimerRef.current !== null) window.clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = window.setTimeout(() => setCopied(false), 2000);
    });
  }
  const dayLabel =
    daysBack === 0
      ? "Today"
      : daysBack === 1
        ? "Yesterday"
        : parseDateKey(date).toLocaleDateString(undefined, { weekday: "long" });

  return (
    <div
      ref={cardRef}
      className="phrase-card"
      style={{ "--phrase-color": QUOTE_CATEGORY_COLOR[shown.category] } as CSSProperties}
    >
      <Icon size={190} className="phrase-card__watermark" />

      <div className="phrase-card__top">
        <span className="phrase-card__kicker">
          <SparklesIcon size={12} />
          Phrase of the day · {dayLabel}
        </span>
        <button type="button" className="phrase-card__close" onClick={close} aria-label="Close">
          <XIcon size={16} />
        </button>
      </div>

      {/* Keyed by day, so each one fades in as you step through. */}
      <div className="phrase-card__body" key={date}>
        <span className="phrase-card__mark" aria-hidden="true">
          “
        </span>
        <p className="phrase-card__text">{shown.text}</p>
        <span className="phrase-card__category">
          <Icon size={12} />
          {QUOTE_CATEGORY_LABEL[shown.category]}
        </span>
      </div>

      <div className="phrase-card__dots" role="tablist" aria-label="Last 7 days">
        {Array.from({ length: DAYS }, (_, i) => {
          const back = DAYS - 1 - i;
          return (
            <button
              key={back}
              type="button"
              role="tab"
              aria-selected={back === daysBack}
              aria-label={back === 0 ? "Today" : back === 1 ? "Yesterday" : `${back} days ago`}
              className={`phrase-card__dot ${back === daysBack ? "phrase-card__dot--on" : ""}`}
              onClick={() => setDaysBack(back)}
            />
          );
        })}
      </div>

      <div className="phrase-card__actions">
        <button
          type="button"
          className="phrase-card__step"
          aria-label="The day before"
          onClick={() => setDaysBack((d) => Math.min(DAYS - 1, d + 1))}
          disabled={daysBack >= DAYS - 1}
        >
          <ChevronLeftIcon size={18} />
        </button>
        <span className="phrase-card__middle">
          <button
            type="button"
            className={`phrase-card__copy ${copied ? "phrase-card__copy--done" : ""}`}
            onClick={handleCopy}
          >
            {/* Keyed, so the check pops in fresh each time. */}
            <span key={copied ? "done" : "copy"} className="phrase-card__copy-icon">
              {copied ? <CheckIcon size={16} /> : <CopyIcon />}
            </span>
            {copied ? "Copied" : "Copy"}
          </button>
          <span className="phrase-card__announce" aria-live="polite">
            {copied ? "Phrase copied" : ""}
          </span>
          <button type="button" className="phrase-card__done" onClick={close}>
            Got it
          </button>
        </span>
        <button
          type="button"
          className="phrase-card__step"
          aria-label="The day after"
          onClick={() => setDaysBack((d) => Math.max(0, d - 1))}
          disabled={daysBack === 0}
        >
          <ChevronRightIcon size={18} />
        </button>
      </div>
    </div>
  );
}

/** Copies text: the Clipboard API where there is one, else the older
 *  select-and-copy - the Clipboard API only exists on secure pages (so not
 *  in the preview, loaded over the local network) and a webview can refuse
 *  it. The fallback's hidden field goes inside the card (`host`), since the
 *  modal keeps focus from leaving it. */
async function copyText(text: string, host: HTMLElement | null): Promise<boolean> {
  try {
    if (navigator.clipboard) {
      await navigator.clipboard.writeText(text);
      return true;
    }
  } catch {
    // Refused - try the fallback below.
  }
  if (!host) return false;
  const active = document.activeElement as HTMLElement | null;
  const field = document.createElement("textarea");
  field.value = text;
  field.setAttribute("readonly", "");
  field.style.cssText = "position:absolute;opacity:0;pointer-events:none;width:1px;height:1px";
  host.appendChild(field);
  field.select();
  let ok = false;
  try {
    ok = document.execCommand("copy");
  } catch {
    ok = false;
  }
  field.remove();
  active?.focus();
  return ok;
}

function CopyIcon() {
  return (
    <svg
      width="15"
      height="15"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <rect x="8" y="8" width="13" height="13" rx="2.5" />
      <path d="M16 8V5.5A2.5 2.5 0 0 0 13.5 3h-8A2.5 2.5 0 0 0 3 5.5v8A2.5 2.5 0 0 0 5.5 16H8" />
    </svg>
  );
}
