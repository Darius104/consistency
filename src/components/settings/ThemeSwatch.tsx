import type { ThemeMeta } from "../../utils/themes";
import "./ThemeSwatch.css";

interface ThemeSwatchProps {
  theme: ThemeMeta;
  selected: boolean;
  onSelect: () => void;
}

export function ThemeSwatch({ theme, selected, onSelect }: ThemeSwatchProps) {
  return (
    <button
      type="button"
      className={`theme-swatch ${selected ? "theme-swatch--selected" : ""}`}
      onClick={onSelect}
      aria-pressed={selected}
    >
      <span className="theme-swatch__preview" style={{ background: theme.bg }}>
        <span className="theme-swatch__dot" style={{ background: theme.accent }} />
      </span>
      <span className="theme-swatch__name">{theme.name}</span>
    </button>
  );
}
