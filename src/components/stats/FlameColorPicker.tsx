import type { CSSProperties } from "react";
import { FLAME_COLORS, type FlameColor } from "../../utils/panelOrder";
import "./FlameColorPicker.css";

interface FlameColorPickerProps {
  value: FlameColor;
  onChange: (color: FlameColor) => void;
}

/** A row of colored dots - the Day Streak's flame color (Settings > Widgets
 *  > Day Streak, and the streak widget's own menu). */
export function FlameColorPicker({ value, onChange }: FlameColorPickerProps) {
  return (
    <div className="flame-picker" role="radiogroup" aria-label="Flame color">
      <span className="flame-picker__label">Flame</span>
      <div className="flame-picker__dots">
        {FLAME_COLORS.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={value === c.id}
            aria-label={c.label}
            title={c.label}
            className={`flame-picker__dot ${value === c.id ? "flame-picker__dot--on" : ""}`}
            style={{ "--dot": c.swatch } as CSSProperties}
            onClick={() => onChange(c.id)}
          />
        ))}
      </div>
    </div>
  );
}
