import type { ReactNode } from "react";
import "./SettingsCardHeader.css";

interface SettingsCardHeaderProps {
  icon: ReactNode;
  label: string;
  hint?: string;
  /** A fixed, always-legible color for this card's icon badge - never the
   *  theme's own --accent, which can wash out to near-invisible under a
   *  muted theme (Steel, Midnight). Each Settings card that uses this gets
   *  its own, so they stay visually distinct from one another at a glance
   *  (gold=Premium, green=Membership, red=Donate, blue=Support,
   *  violet=Profile, teal=Appearance) - pass a plain 6-digit hex, since the
   *  badge background is derived from it (hex + alpha). */
  color: string;
}

/** Shared "icon badge + label + hint" card header, used by every Settings
 *  card that has real content below it (Support, Profile, Appearance).
 *  Donate and Membership intentionally keep their own bespoke, more
 *  illustrative header treatment (a centered hero icon, a status pill) -
 *  this is for the plainer "here's what this card is" case. */
export function SettingsCardHeader({ icon, label, hint, color }: SettingsCardHeaderProps) {
  return (
    <div className="settings-card-header">
      <span
        className="settings-card-header__icon"
        style={{ background: `${color}29`, color }}
      >
        {icon}
      </span>
      <div className="settings-card-header__text">
        <span className="settings__label">{label}</span>
        {hint && <span className="settings__hint">{hint}</span>}
      </div>
    </div>
  );
}
