import type { ThemeId } from "../../types";
import type { ThemeMeta } from "../../utils/themes";
import { ThemeSwatch } from "./ThemeSwatch";
import "./ThemeCarousel.css";

interface ThemeCarouselProps {
  themes: ThemeMeta[];
  selected: ThemeId;
  onSelect: (id: ThemeId) => void;
}

// A wrapping grid instead of a 4-at-a-time horizontal strip with paging
// arrows - the settings pane is plenty wide enough to just show every theme
// at once, so nothing is hidden behind an extra click before you even know
// it exists.
export function ThemeCarousel({ themes, selected, onSelect }: ThemeCarouselProps) {
  return (
    <div className="theme-carousel">
      {themes.map((t) => (
        <ThemeSwatch key={t.id} theme={t} selected={t.id === selected} onSelect={() => onSelect(t.id)} />
      ))}
    </div>
  );
}
