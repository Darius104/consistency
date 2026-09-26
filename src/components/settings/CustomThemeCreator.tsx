import { useMemo, useState } from "react";
import { generateCustomThemeColors, type RandomThemeColors } from "../../utils/randomTheme";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CheckIcon } from "../ui/icons";
import "./CustomThemeCreator.css";

interface CustomThemeCreatorProps {
  /** True when "custom" is the currently applied theme. */
  active: boolean;
  /** Your last saved custom pick, if any - used to prefill the picker so
   *  reopening this shows what you already built, not a blank default. */
  colors: RandomThemeColors | null;
  onApply: (hexColor: string) => void;
}

const DEFAULT_PICKER_COLOR = "#7c9eff";

/** Lets you build your own theme instead of only choosing from the eight
 *  fixed swatches or rolling "random" - you pick one color, and it's mapped
 *  onto the exact same dark-mode shape every other theme uses (see
 *  generateCustomThemeColors), so whatever you pick still comes out legible
 *  and "in family" rather than a raw, ungoverned color scheme. */
export function CustomThemeCreator({ active, colors, onApply }: CustomThemeCreatorProps) {
  const [pickerColor, setPickerColor] = useState(colors?.accent ?? DEFAULT_PICKER_COLOR);

  const preview = useMemo(() => generateCustomThemeColors(pickerColor), [pickerColor]);

  return (
    <Card className="custom-theme">
      <div className="custom-theme__header">
        <span className="settings__label">Create your own theme</span>
        {active && (
          <span className="custom-theme__active">
            <CheckIcon size={11} /> Active
          </span>
        )}
      </div>
      <span className="settings__hint">Pick a color and it becomes your theme's accent.</span>

      <div className="custom-theme__row">
        <label className="custom-theme__swatch" style={{ background: preview.bg }}>
          <input
            type="color"
            className="custom-theme__input"
            value={pickerColor}
            onChange={(e) => setPickerColor(e.target.value)}
            aria-label="Pick a theme color"
          />
          <span className="custom-theme__swatch-surface" style={{ background: preview.surface }}>
            <span className="custom-theme__swatch-dot" style={{ background: preview.accent }} />
          </span>
        </label>

        <Button variant="primary" onClick={() => onApply(pickerColor)}>
          Use this theme
        </Button>
      </div>
    </Card>
  );
}
