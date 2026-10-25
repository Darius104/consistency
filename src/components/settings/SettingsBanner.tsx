import type { CSSProperties, ReactNode } from "react";
import { inkOn } from "../day-panel/addKinds";
import "./SettingsBanner.css";

interface SettingsBannerProps {
  icon: ReactNode;
  /** The page's own color - the same as its icon in the Settings list. */
  color: string;
  title: string;
  subtitle?: ReactNode;
  /** The page's key number, big on the right: "1" over "of 3 left". */
  stat?: { value: ReactNode; label: string };
  /** Or something else in that spot - a switch, a tier pill. */
  aside?: ReactNode;
}

/** The colored banner at the top of every Settings page: the page's icon,
 *  name and a line about it, plus its key number - on a soft wash of the
 *  page's color. Side by side on desktop, stacked and centered on a phone. */
export function SettingsBanner({ icon, color, title, subtitle, stat, aside }: SettingsBannerProps) {
  return (
    <div
      className="settings-banner"
      style={{ "--banner-color": color, "--banner-ink": inkOn(color) } as CSSProperties}
    >
      <span className="settings-banner__icon" aria-hidden="true">
        {icon}
      </span>
      <span className="settings-banner__text">
        <h3 className="settings-banner__title">{title}</h3>
        {subtitle && <span className="settings-banner__sub">{subtitle}</span>}
      </span>
      {stat && (
        <span className="settings-banner__stat">
          <span className="settings-banner__stat-value">{stat.value}</span>
          <span className="settings-banner__stat-label">{stat.label}</span>
        </span>
      )}
      {aside && <span className="settings-banner__aside">{aside}</span>}
    </div>
  );
}
