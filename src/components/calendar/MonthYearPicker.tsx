import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import "./MonthYearPicker.css";

const ITEM_HEIGHT = 44;
const VISIBLE_ITEMS = 5;
const YEARS_EACH_SIDE = 5;

const MONTHS = Array.from({ length: 12 }, (_, i) =>
  new Date(2000, i, 1).toLocaleDateString(undefined, { month: "long" }),
);

interface WheelProps {
  items: string[];
  index: number;
  onChange: (index: number) => void;
}

/** One iOS-style scroll wheel - scroll-snap does the physics, this just
 *  reads which item ended up centered and fades the others by distance. */
function Wheel({ items, index, onChange }: WheelProps) {
  const ref = useRef<HTMLDivElement>(null);
  const [scrollTop, setScrollTop] = useState(index * ITEM_HEIGHT);
  const settleTimer = useRef<number | null>(null);

  useEffect(() => {
    if (ref.current) ref.current.scrollTop = index * ITEM_HEIGHT;
    // Only on mount - after that the wheel's own scroll position is the
    // source of truth, and re-applying `index` would fight the user's flick.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function handleScroll() {
    const top = ref.current?.scrollTop ?? 0;
    setScrollTop(top);
    if (settleTimer.current !== null) window.clearTimeout(settleTimer.current);
    settleTimer.current = window.setTimeout(() => {
      const next = Math.max(0, Math.min(items.length - 1, Math.round(top / ITEM_HEIGHT)));
      if (next !== index) onChange(next);
    }, 90);
  }

  return (
    <div className="month-picker__wheel" ref={ref} onScroll={handleScroll}>
      {items.map((label, i) => {
        const distance = Math.abs(i * ITEM_HEIGHT - scrollTop) / ITEM_HEIGHT;
        return (
          <button
            type="button"
            key={label}
            className="month-picker__item"
            style={{ opacity: Math.max(0.15, 1 - distance * 0.32) }}
            onClick={() => ref.current?.scrollTo({ top: i * ITEM_HEIGHT, behavior: "smooth" })}
          >
            {label}
          </button>
        );
      })}
    </div>
  );
}

interface MonthYearPickerProps {
  year: number;
  monthIndex: number;
  onChange: (year: number, monthIndex: number) => void;
  onClose: () => void;
}

/** Drops down from the top of the screen when the month title is tapped -
 *  the calendar behind updates live as either wheel settles. Tap anywhere
 *  outside the panel to close. */
export function MonthYearPicker({ year, monthIndex, onChange, onClose }: MonthYearPickerProps) {
  // Fixed for the lifetime of this open picker, so the year list doesn't
  // shift under the wheel while it's being scrolled.
  const [baseYear] = useState(year);
  const years = Array.from({ length: YEARS_EACH_SIDE * 2 + 1 }, (_, i) => baseYear - YEARS_EACH_SIDE + i);

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose]);

  return createPortal(
    <div className="month-picker" onClick={onClose}>
      <div
        className="month-picker__panel"
        onClick={(e) => e.stopPropagation()}
        style={{ height: ITEM_HEIGHT * VISIBLE_ITEMS }}
      >
        <div className="month-picker__highlight" style={{ height: ITEM_HEIGHT }} aria-hidden="true" />
        <Wheel items={MONTHS} index={monthIndex} onChange={(m) => onChange(year, m)} />
        <Wheel
          items={years.map(String)}
          index={years.indexOf(year)}
          onChange={(i) => onChange(years[i], monthIndex)}
        />
      </div>
    </div>,
    document.body,
  );
}
