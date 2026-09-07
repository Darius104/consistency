import { useEffect, useRef, useState } from "react";
import { XIcon } from "../ui/icons";
import "./TimePicker.css";

interface TimePickerProps {
  /** "HH:MM" 24-hour, or "" for no time set (all day). */
  value: string;
  onChange: (value: string) => void;
}

const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0..23
const MINUTES = Array.from({ length: 12 }, (_, i) => i * 5); // 0,5,...,55

function pad(n: number): string {
  return String(n).padStart(2, "0");
}

interface ScrollSelectProps {
  value: number;
  options: number[];
  onChange: (value: number) => void;
  ariaLabel: string;
  isOpen: boolean;
  onOpen: () => void;
  onClose: () => void;
}

// Native <select> popups are OS-rendered chrome - there's no CSS that can
// cap their height or give them a visible scrollbar. This is a custom
// listbox instead, so a long option list (like 24 hours) actually scrolls
// inside a fixed-height panel we control. Which one is open is owned by the
// parent (only one at a time), not this component, so opening one always
// closes the other rather than relying on outside-click timing.
function ScrollSelect({
  value,
  options,
  onChange,
  ariaLabel,
  isOpen,
  onOpen,
  onClose,
}: ScrollSelectProps) {
  const rootRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    if (!isOpen) return;
    function onOutside(e: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) activeRef.current?.scrollIntoView({ block: "center" });
  }, [isOpen]);

  return (
    <div className="time-picker__dropdown" ref={rootRef}>
      <button
        type="button"
        className="time-picker__select"
        aria-label={ariaLabel}
        aria-expanded={isOpen}
        onClick={() => (isOpen ? onClose() : onOpen())}
        onKeyDown={(e) => {
          if (e.key === "Escape") onClose();
        }}
      >
        {pad(value)}
      </button>
      {isOpen && (
        <div className="time-picker__popup" role="listbox" aria-label={ariaLabel}>
          {options.map((opt) => (
            <button
              type="button"
              key={opt}
              ref={opt === value ? activeRef : undefined}
              role="option"
              aria-selected={opt === value}
              className={`time-picker__option ${opt === value ? "time-picker__option--active" : ""}`}
              onClick={() => {
                onChange(opt);
                onClose();
              }}
            >
              {pad(opt)}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function TimePicker({ value, onChange }: TimePickerProps) {
  const [openField, setOpenField] = useState<"hour" | "minute" | null>(null);
  const hasTime = value !== "";

  if (!hasTime) {
    return (
      <button
        type="button"
        className="time-picker__enable"
        onClick={() => onChange("09:00")}
      >
        + Set a time
      </button>
    );
  }

  const [hour, minute] = value.split(":").map(Number);

  return (
    <div className="time-picker">
      <ScrollSelect
        value={hour}
        options={HOURS}
        onChange={(h) => onChange(`${pad(h)}:${pad(minute)}`)}
        ariaLabel="Hour"
        isOpen={openField === "hour"}
        onOpen={() => setOpenField("hour")}
        onClose={() => setOpenField((f) => (f === "hour" ? null : f))}
      />
      <span className="time-picker__colon">:</span>
      <ScrollSelect
        value={minute}
        options={MINUTES}
        onChange={(m) => onChange(`${pad(hour)}:${pad(m)}`)}
        ariaLabel="Minute"
        isOpen={openField === "minute"}
        onOpen={() => setOpenField("minute")}
        onClose={() => setOpenField((f) => (f === "minute" ? null : f))}
      />
      <button
        type="button"
        className="time-picker__clear"
        onClick={() => onChange("")}
        aria-label="Clear time"
      >
        <XIcon size={12} />
      </button>
    </div>
  );
}
