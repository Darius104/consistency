import type { CSSProperties } from "react";
import { QUOTE_CATEGORY_COLOR_VAR, QUOTE_CATEGORY_LABEL, type Quote } from "../../utils/quotes";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { SparklesIcon } from "../ui/icons";
import "./PhraseModal.css";

interface PhraseModalProps {
  quote: Quote;
  onClose: () => void;
}

export function PhraseModal({ quote, onClose }: PhraseModalProps) {
  const colorVar = QUOTE_CATEGORY_COLOR_VAR[quote.category];

  return (
    <Modal title="Phrase of the Day" onClose={onClose}>
      <div className="phrase-modal" style={{ "--phrase-color": `var(${colorVar})` } as CSSProperties}>
        <div className="phrase-modal__hero">
          <div className="phrase-modal__icon">
            <SparklesIcon size={13} />
          </div>
          <span className="phrase-modal__eyebrow">{QUOTE_CATEGORY_LABEL[quote.category]}</span>
        </div>
        <div className="phrase-modal__quote-row">
          <span className="phrase-modal__bar" aria-hidden="true" />
          <p className="phrase-modal__text">{quote.text}</p>
        </div>
        <div className="phrase-modal__footer">
          <Button variant="primary" className="phrase-modal__done" onClick={onClose}>
            Got it
          </Button>
        </div>
      </div>
    </Modal>
  );
}
