import { useState } from "react";
import type { TradingResultUnit } from "../../types";
import { formatDayName } from "../../utils/dates";
import {
  TRADING_RESULT_UNIT_OPTIONS,
  parseTradingResultInput,
} from "../../utils/trading";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./TradingResultModal.css";

const PLACEHOLDER: Record<TradingResultUnit, string> = {
  r: "e.g. 2 or 1.5",
  percent: "e.g. 4 or 2.5",
  usd: "e.g. 150,00",
};

// Shown right after the number on the line - so you see the value the way
// the calendar cell will show it. $ has none there (see formatTradingResult).
const UNIT_SUFFIX: Record<TradingResultUnit, string> = {
  r: "R",
  percent: "%",
  usd: "",
};

type Side = "profit" | "loss";

interface TradingResultModalProps {
  value: number | null;
  /** The unit this entry's already logged in, or the remembered
   *  last-used unit for a brand-new entry - just the picker's starting
   *  position, since it's chosen fresh (and can be changed) every time. */
  unit: TradingResultUnit;
  /** The day this result is for - named in the title. */
  dateKey: string;
  onSave: (value: number | null, unit: TradingResultUnit) => void;
  onClose: () => void;
}


export function TradingResultModal({
  value,
  unit,
  dateKey,
  onSave,
  onClose,
}: TradingResultModalProps) {
  // The sign is its own Profit/Loss switch, and the field holds just the
  // amount - the iPhone's number keypad has no minus key, so a loss
  // couldn't be typed at all as "-1.5".
  const [side, setSide] = useState<Side>(
    value !== null && value < 0 ? "loss" : "profit",
  );
  const [draft, setDraft] = useState(
    value !== null ? String(Math.abs(value)) : "",
  );
  const [selectedUnit, setSelectedUnit] = useState<TradingResultUnit>(unit);
  const [invalid, setInvalid] = useState(false);

  function onDraftChange(next: string) {
    // A "-" typed on a hardware keyboard still works - it just flips the
    // switch to Loss instead of living in the field.
    if (next.includes("-")) {
      setSide("loss");
      next = next.replace(/-/g, "");
    }
    setDraft(next);
    setInvalid(false);
  }

  function commit() {
    if (draft.trim() === "") {
      onSave(null, selectedUnit);
      return;
    }
    const parsed = parseTradingResultInput(draft);
    if (parsed === null) {
      setInvalid(true);
      return;
    }
    const magnitude = Math.abs(parsed);
    onSave(side === "loss" ? -magnitude : magnitude, selectedUnit);
  }

  const hasAmount = draft.trim() !== "";

  return (
    <Modal title={`Result · ${formatDayName(dateKey)}`} onClose={onClose}>
      <div className={`trading-result-modal trading-result-modal--${side}`}>
        <div
          className="trading-result-modal__side"
          role="radiogroup"
          aria-label="Profit or loss"
        >
          {(["profit", "loss"] as const).map((s) => (
            <button
              key={s}
              type="button"
              role="radio"
              aria-checked={side === s}
              className={`trading-result-modal__side-option trading-result-modal__side-option--${s} ${
                side === s ? "trading-result-modal__side-option--active" : ""
              }`}
              onClick={() => setSide(s)}
            >
              {s === "profit" ? "Profit" : "Loss"}
            </button>
          ))}
        </div>

        <div
          className={`trading-result-modal__field ${invalid ? "trading-result-modal__field--invalid" : ""}`}
        >
          {hasAmount && (
            <span className="trading-result-modal__sign" aria-hidden="true">
              {side === "loss" ? "−" : "+"}
            </span>
          )}
          <input
            type="text"
            inputMode="decimal"
            className="trading-result-modal__input"
            placeholder={PLACEHOLDER[selectedUnit]}
            aria-label="Amount"
            aria-invalid={invalid}
            value={draft}
            onChange={(e) => onDraftChange(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") commit();
              if (e.key === "Escape") onClose();
            }}
            autoFocus
          />
          {hasAmount && UNIT_SUFFIX[selectedUnit] && (
            <span className="trading-result-modal__suffix" aria-hidden="true">
              {UNIT_SUFFIX[selectedUnit]}
            </span>
          )}
        </div>
        {invalid && (
          <span className="trading-result-modal__error">
            Enter a number, like 2 or 1,5
          </span>
        )}

        <div
          className="trading-result-modal__units"
          role="radiogroup"
          aria-label="Unit"
        >
          {TRADING_RESULT_UNIT_OPTIONS.map((opt) => (
            <button
              key={opt.id}
              type="button"
              role="radio"
              aria-checked={selectedUnit === opt.id}
              className={`trading-result-modal__unit ${
                selectedUnit === opt.id
                  ? "trading-result-modal__unit--active"
                  : ""
              }`}
              onClick={() => setSelectedUnit(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="trading-result-modal__actions">
          <Button onClick={onClose} className="trading-result-modal__cancel">
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={commit}
            className="trading-result-modal__save"
          >
            Save
          </Button>
        </div>
        {value !== null && (
          <button
            type="button"
            className="trading-result-modal__remove"
            onClick={() => onSave(null, selectedUnit)}
          >
            Remove result
          </button>
        )}
      </div>
    </Modal>
  );
}
