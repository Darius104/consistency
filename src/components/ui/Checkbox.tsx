import type { ReactNode } from "react";
import "./Checkbox.css";

interface CheckboxProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
  ariaLabel?: string;
  /** When set, renders the box + label as one clickable row instead of a bare box. */
  label?: ReactNode;
}

const CHECKMARK = (
  <svg viewBox="0 0 16 16" width="10" height="10">
    <path
      d="M2 8.5L6 12.5L14 3.5"
      stroke="currentColor"
      strokeWidth="2"
      fill="none"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
);

export function Checkbox({ checked, onChange, ariaLabel, label }: CheckboxProps) {
  const box = (
    <span className={`checkbox ${checked ? "checkbox--checked" : ""}`}>
      <span className="checkbox__check">{CHECKMARK}</span>
    </span>
  );

  function handleClick(e: React.MouseEvent) {
    e.stopPropagation();
    onChange(!checked);
  }

  if (label) {
    // A single real button, not a <label> wrapping a nested button - WebKit
    // doesn't reliably forward label clicks to custom controls, which made
    // clicking the text (instead of the tiny box) silently do nothing.
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        aria-label={ariaLabel}
        className="checkbox-row"
        onClick={handleClick}
      >
        {box}
        <span className="checkbox-row__label">{label}</span>
      </button>
    );
  }

  return (
    <button
      type="button"
      role="checkbox"
      aria-checked={checked}
      aria-label={ariaLabel}
      className={`checkbox ${checked ? "checkbox--checked" : ""}`}
      onClick={handleClick}
    >
      <span className="checkbox__check">{CHECKMARK}</span>
    </button>
  );
}
