import type { CSSProperties } from "react";
import { QUOTE_CATEGORY_COLOR_VAR, QUOTE_CATEGORY_LABEL, type Quote } from "../../utils/quotes";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
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
