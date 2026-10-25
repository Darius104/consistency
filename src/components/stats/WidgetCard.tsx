import type { CSSProperties, ReactNode } from "react";
import "./stats.css";

interface WidgetCardProps {
  /** The widget's own color (WIDGET_COLORS) - its edge and icon. */
  color: string;
  icon: ReactNode;
  title: string;
  /** A short note on the right of the title ("this week", "34 of 40"). */
  meta?: ReactNode;
  className?: string;
  children: ReactNode;
}

/** Every day-panel widget's card: the same soft surface as the template
 *  cards, the widget's color as an edge down the left, and a small header
 *  with its colored icon and name. */
export function WidgetCard({ color, icon, title, meta, className, children }: WidgetCardProps) {
  return (
    <section
      className={`widget-card ${className ?? ""}`}
      style={{ "--widget-color": color } as CSSProperties}
    >
      <header className="widget-card__head">
        <span className="widget-card__icon" aria-hidden="true">
          {icon}
        </span>
        <h3 className="widget-card__title">{title}</h3>
        {meta && <span className="widget-card__meta">{meta}</span>}
      </header>
      {children}
    </section>
  );
}
