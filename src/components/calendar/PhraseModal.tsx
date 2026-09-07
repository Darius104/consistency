import type { CSSProperties } from "react";
import type { QuoteCategory } from "../../utils/quotes";
import { QUOTE_CATEGORY_LABEL, type Quote } from "../../utils/quotes";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./PhraseModal.css";

interface PhraseModalProps {
  quote: Quote;
  onClose: () => void;
}

// Reuses the app's existing semantic color tokens instead of inventing new
// ones - each category gets a color that already means something similar
// elsewhere (risk -> the same red as a high-priority task, life -> the
// same green as a completed one).
const CATEGORY_COLOR_VAR: Record<QuoteCategory, string> = {
  risk: "--priority-high",
  mindset: "--accent",
  patience: "--priority-medium",
  life: "--success",
};

export function PhraseModal({ quote, onClose }: PhraseModalProps) {
  const colorVar = CATEGORY_COLOR_VAR[quote.category];

  return (
    <Modal title="Phrase of the Day" onClose={onClose}>
      <div className="phrase-modal" style={{ "--phrase-color": `var(${colorVar})` } as CSSProperties}>
        <span className="phrase-modal__mark" aria-hidden="true">
          “
        </span>
        <span className="phrase-modal__category">{QUOTE_CATEGORY_LABEL[quote.category]}</span>
        <p className="phrase-modal__text">{quote.text}</p>
        <Button variant="primary" className="phrase-modal__done" onClick={onClose}>
          Got it
        </Button>
      </div>
    </Modal>
  );
}
