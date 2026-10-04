import { useState } from "react";
import type { TradingResultUnit } from "../../types";
import { TRADING_RESULT_UNIT_OPTIONS, parseTradingResultInput } from "../../utils/trading";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./TradingResultModal.css";

const PLACEHOLDER: Record<TradingResultUnit, string> = {
  r: "e.g. 2 or -1.5",
  percent: "e.g. 4 or -2.5",
  usd: "e.g. 150,00",
};

interface TradingResultModalProps {
  value: number | null;
  /** The unit this entry's already logged in, or the remembered
   *  last-used unit for a brand-new entry - just the picker's starting
   *  position, since it's chosen fresh (and can be changed) every time. */
  unit: TradingResultUnit;
  onSave: (value: number | null, unit: TradingResultUnit) => void;
  onClose: () => void;
}

export function TradingResultModal({ value, unit, onSave, onClose }: TradingResultModalProps) {
  const [draft, setDraft] = useState(value !== null ? String(value) : "");
  const [selectedUnit, setSelectedUnit] = useState<TradingResultUnit>(unit);

  function commit() {
    if (draft.trim() === "") {
      onSave(null, selectedUnit);
      return;
    }
    const parsed = parseTradingResultInput(draft);
    if (parsed === null) return;
    onSave(parsed, selectedUnit);
  }

  return (
    <Modal title={value !== null ? "Edit result" : "Log today's result"} onClose={onClose}>
      <div className="trading-result-modal">
        <input
          type="text"
          inputMode="decimal"
          className="trading-result-modal__input"
          placeholder={PLACEHOLDER[selectedUnit]}
          aria-label="Result value"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") commit();
            if (e.key === "Escape") onClose();
          }}
          autoFocus
        />
        <div className="trading-result-modal__units">
          {TRADING_RESULT_UNIT_OPTIONS.map((opt) => (
            <Button
              key={opt.id}
              type="button"
              variant={selectedUnit === opt.id ? "primary" : "ghost"}
              onClick={() => setSelectedUnit(opt.id)}
            >
              {opt.label}
            </Button>
          ))}
        </div>
        <div className="trading-result-modal__actions">
          {value !== null && <Button onClick={() => onSave(null, selectedUnit)}>Clear</Button>}
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={commit}>
            Save
          </Button>
        </div>
      </div>
    </Modal>
  );
}
