import type { CSSProperties, ReactNode } from "react";
import { WIDGET_COLORS, WIDGET_LABELS, type WidgetId } from "../../utils/panelOrder";
import {
  BookmarkIcon,
  CalendarIcon,
  FrostIcon,
  GridIcon,
  PlusIcon,
  SparklesIcon,
  TrendingUpIcon,
  UsersIcon,
} from "../ui/icons";
import { Modal } from "../ui/Modal";
import "./WidgetGallery.css";

interface WidgetGalleryProps {
  /** The widgets not on the panel yet - the ones you can add. */
  widgets: WidgetId[];
  onAdd: (id: WidgetId) => void;
  onClose: () => void;
}

// The window's own color - the same orange as Widgets in Settings.
const GALLERY_COLOR = "#f97316";

/** Each widget's color, icon and one line about it - here and in
 *  Settings > Widgets. */
export const WIDGET_INFO: Record<WidgetId, { color: string; icon: ReactNode; text: string }> = {
  streak: { color: WIDGET_COLORS.streak, icon: <TrendingUpIcon size={15} />, text: "Your streak and this week" },
  weekly: { color: WIDGET_COLORS.weekly, icon: <CalendarIcon size={15} />, text: "How much you finished each day" },
  freezes: { color: WIDGET_COLORS.freezes, icon: <FrostIcon size={15} />, text: "Freezes left this month" },
  templates: { color: WIDGET_COLORS.templates, icon: <BookmarkIcon size={15} />, text: "Progress for each template" },
  quote: { color: WIDGET_COLORS.quote, icon: <SparklesIcon size={15} />, text: "A new phrase every morning" },
  friendStreaks: { color: WIDGET_COLORS.friendStreaks, icon: <UsersIcon size={15} />, text: "Your streak next to your friends'" },
};

/** A small drawing of what the widget shows - just an impression of it,
 *  not live data. */
function Preview({ id }: { id: WidgetId }) {
  switch (id) {
    case "streak":
      return (
        <div className="widget-gallery__pv-streak">
          <span className="widget-gallery__pv-number">44</span>
          <span className="widget-gallery__pv-dots">
            {[1, 1, 1, 1, 0, 0, 0].map((on, i) => (
              <i key={i} className={on ? "on" : ""} />
            ))}
          </span>
        </div>
      );
    case "weekly":
      return (
        <div className="widget-gallery__pv-bars">
          {[60, 90, 40, 100, 75, 30, 8].map((h, i) => (
            <i key={i} style={{ height: `${h}%` }} />
          ))}
        </div>
      );
    case "freezes":
      return (
        <div className="widget-gallery__pv-freezes">
          {[1, 1, 0].map((on, i) => (
            <i key={i} className={on ? "on" : ""}>
              <FrostIcon size={12} />
            </i>
          ))}
        </div>
      );
    case "templates":
      return (
        <div className="widget-gallery__pv-rows">
          {(
            [
              ["#22c55e", 80],
              ["#3b82f6", 45],
              ["#ef4444", 20],
            ] as const
          ).map(([c, w], i) => (
            <i key={i}>
              <b style={{ background: c, width: `${w}%` }} />
            </i>
          ))}
        </div>
      );
    case "quote":
      return <p className="widget-gallery__pv-quote">“Good trades come to those who wait.”</p>;
    case "friendStreaks":
      return (
        <div className="widget-gallery__pv-friends">
          <span>🦊 44</span>
          <span>🐼 31</span>
          <span>🐸 12</span>
        </div>
      );
  }
}

// "Add a widget": a card per widget you don't have yet - a little drawing
// of it, its colored icon, what it shows, and a round + to add it.
export function WidgetGallery({ widgets, onAdd, onClose }: WidgetGalleryProps) {
  return (
    <Modal title="Add a widget" icon={<GridIcon size={14} />} accent={GALLERY_COLOR} onClose={onClose}>
      <div className="widget-gallery">
        {widgets.map((id) => {
          const info = WIDGET_INFO[id];
          return (
            <button
              key={id}
              type="button"
              className="widget-gallery__card"
              style={{ "--widget-color": info.color } as CSSProperties}
              onClick={() => {
                onAdd(id);
                onClose();
              }}
            >
              <span className="widget-gallery__preview" aria-hidden="true">
                <Preview id={id} />
              </span>
              <span className="widget-gallery__meta">
                <span className="widget-gallery__icon">{info.icon}</span>
                <span className="widget-gallery__text">
                  <span className="widget-gallery__name">{WIDGET_LABELS[id]}</span>
                  <span className="widget-gallery__desc">{info.text}</span>
                </span>
                <span className="widget-gallery__add" aria-hidden="true">
                  <PlusIcon size={14} />
                </span>
              </span>
            </button>
          );
        })}
      </div>
    </Modal>
  );
}
