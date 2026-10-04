import { useMemo } from "react";
import { generateCustomThemeColors } from "../../utils/randomTheme";
import "./CustomThemeCreator.css";

interface CustomThemeCreatorProps {
  hue: number;
  onHueChange: (hue: number) => void;
}

// The gradient the slider's track is painted with is built from this app's
// own OKLCH shape (see randomTheme.ts), not a generic rainbow - it needs to
// actually match what picking each point on the track produces, which a
// plain CSS hue-rotate gradient wouldn't (OKLCH's "same lightness" doesn't
// land at the same spot as HSL's).
const GRADIENT_STOPS = Array.from({ length: 13 }, (_, i) => generateCustomThemeColors(i * 30).accent);

/** Lets you build your own theme instead of only choosing from the seven
 *  fixed swatches - drag the hue slider, and it's mapped onto the exact
 *  same dark-mode shape every other theme uses (see
 *  generateCustomThemeColors), so wherever you land always comes out
 *  legible and "in family" rather than a raw, ungoverned color scheme.
 *
 *  A plain controlled component - the hue it's showing and the one Save
 *  button that actually commits it both live in AppearancePicker, the
 *  parent both this and ThemeCarousel sit inside (see its own comment for
 *  why: picking from either one is just "staging a choice" now, not an
 *  instant, separately-triggered write). */
export function CustomThemeCreator({ hue, onHueChange }: CustomThemeCreatorProps) {
  const preview = useMemo(() => generateCustomThemeColors(hue), [hue]);

  return (
    <div className="custom-theme">
      <span className="settings__label">Or build your own</span>
      <span className="settings__hint">Drag to pick a hue - it becomes your theme's accent.</span>

      <div className="custom-theme__row">
        <div className="custom-theme__swatch">
          <span className="custom-theme__swatch-surface" style={{ background: preview.surface }}>
            <span className="custom-theme__swatch-dot" style={{ background: preview.accent }} />
          </span>
        </div>

        <input
          type="range"
          className="custom-theme__hue-slider"
          min={0}
          max={360}
          value={hue}
          onChange={(e) => onHueChange(Number(e.target.value))}
          style={{ background: `linear-gradient(to right, ${GRADIENT_STOPS.join(", ")})` }}
          aria-label="Theme hue"
        />
      </div>
    </div>
  );
}
