import { useRef, useState } from "react";
import type { ThemeId } from "../../types";
import type { ThemeMeta } from "../../utils/themes";
import { ChevronLeftIcon, ChevronRightIcon } from "../ui/icons";
import { ThemeSwatch } from "./ThemeSwatch";
import "./ThemeCarousel.css";

interface ThemeCarouselProps {
  themes: ThemeMeta[];
  selected: ThemeId;
  onSelect: (id: ThemeId) => void;
}

export function ThemeCarousel({ themes, selected, onSelect }: ThemeCarouselProps) {
  const itemRefs = useRef<Partial<Record<ThemeId, HTMLDivElement>>>({});
  const [leadIndex, setLeadIndex] = useState(0);

  function go(delta: number) {
    const next = Math.max(0, Math.min(themes.length - 1, leadIndex + delta));
    setLeadIndex(next);
    itemRefs.current[themes[next].id]?.scrollIntoView({
      behavior: "smooth",
      inline: "start",
      block: "nearest",
    });
  }

  return (
    <div className="theme-carousel">
      <button
        type="button"
        className="theme-carousel__arrow"
        onClick={() => go(-1)}
        disabled={leadIndex === 0}
        aria-label="Previous theme"
      >
        <ChevronLeftIcon size={15} />
      </button>

      <div className="theme-carousel__scroller">
        {themes.map((t) => (
          <div
            key={t.id}
            className="theme-carousel__item"
            ref={(el) => {
              itemRefs.current[t.id] = el ?? undefined;
            }}
          >
            <ThemeSwatch
              theme={t}
              selected={t.id === selected}
              onSelect={() => onSelect(t.id)}
            />
          </div>
        ))}
      </div>

      <button
        type="button"
        className="theme-carousel__arrow"
        onClick={() => go(1)}
        disabled={leadIndex === themes.length - 1}
        aria-label="Next theme"
      >
        <ChevronRightIcon size={15} />
      </button>
    </div>
  );
}
