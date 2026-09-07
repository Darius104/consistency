import type { ThemeMeta } from "../../utils/themes";
import { ShuffleIcon } from "../ui/icons";
import "./ThemeSwatch.css";

interface ThemeSwatchProps {
  theme: ThemeMeta;
  selected: boolean;
  onSelect: () => void;
}

const RAINBOW =
  "conic-gradient(from 0deg, #ef4565, #f0b429, #34d399, #38bdf8, #b794f6, #f472b6, #ef4565)";

export function ThemeSwatch({ theme, selected, onSelect }: ThemeSwatchProps) {
  const isRandom = theme.id === "random";

  return (
    <button
      type="button"
      className={`theme-swatch ${selected ? "theme-swatch--selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
      title={isRandom ? "Rolls a new random color scheme each time you pick it" : undefined}
    >
      <span
        className="theme-swatch__preview"
        style={{ background: isRandom ? RAINBOW : theme.bg }}
      >
        {isRandom ? (
          <span className="theme-swatch__shuffle">
            <ShuffleIcon size={16} />
          </span>
        ) : (
          <span className="theme-swatch__dot" style={{ background: theme.accent }} />
        )}
      </span>
      <span className="theme-swatch__name">{theme.name}</span>
    </button>
  );
}
