import { useEffect, useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { getMyProfile } from "../../db/friends";
import type { AvatarId } from "../../utils/avatars";
import { inkOn } from "../day-panel/addKinds";
import { AvatarBadge } from "../stats/AvatarBadge";
import { ChevronRightIcon, CrownIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import "./SettingsHome.css";

/** One page of Settings - its id, name and icon (and a count badge). */
export interface SettingsSection {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  badge?: number;
}

export interface SettingsHomeRow {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  /** The icon square's color. */
  color: string;
  /** Current value, shown on the right - "On", "2 left", "Premium"... */
  value?: string;
  badge?: number;
}

interface SettingsHomeProps {
  groups: SettingsHomeRow[][];
  avatarId: AvatarId | null;
  streak: number;
  isPremium: boolean;
  /** Profile's own color - the tint behind it while its page is open. */
  profileColor: string;
  onSelect: (id: string) => void;
  onSignOut: () => void;
  /** Desktop: the page currently open next to this list, highlighted. */
  activeId?: string;
}

/** The Settings list, laid out like the iPhone's own Settings app: your
 *  profile card on top, then inset groups of rows with colored icon
 *  squares and each one's current value on the right, and Sign out at the
 *  bottom. Full screen on a phone; on desktop the left sidebar - a flat
 *  list where the open page is a solid pill in its own color. */
export function SettingsHome({
  groups,
  avatarId,
  streak,
  isPremium,
  profileColor,
  onSelect,
  onSignOut,
  activeId,
}: SettingsHomeProps) {
  const [name, setName] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyProfile()
      .then((p) => {
        if (!cancelled) setName(p.displayName);
      })
      .catch(() => {
        if (!cancelled) setName("");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings-home">
      <button
        type="button"
        className={`settings-home__profile ${activeId === "profile" ? "settings-home__profile--active" : ""}`}
        style={{ "--row-color": profileColor } as CSSProperties}
        onClick={() => onSelect("profile")}
      >
        {avatarId ? (
          <AvatarBadge avatarId={avatarId} size={56} />
        ) : (
          <span className="settings-home__avatar-placeholder" />
        )}
        <span className="settings-home__profile-text">
          <span className="settings-home__name">
            {name === null ? <Skeleton width={120} height={18} /> : name || "Your profile"}
            {isPremium && (
              <span className="settings-home__premium">
                <CrownIcon size={11} />
                Premium
              </span>
            )}
          </span>
          <span className="settings-home__sub">
            {streak > 0 ? `🔥 ${streak} day streak · ` : ""}Edit profile
          </span>
        </span>
        <ChevronRightIcon size={16} className="settings-home__chevron" />
      </button>

      {groups.map((rows, i) => (
        <div className="settings-home__group" key={i}>
          {rows.map((row) => {
            const Icon = row.icon;
            return (
              <button
                type="button"
                key={row.id}
                className={`settings-home__row ${activeId === row.id ? "settings-home__row--active" : ""}`}
                style={{ "--row-color": row.color, "--row-ink": inkOn(row.color) } as CSSProperties}
                onClick={() => onSelect(row.id)}
              >
                <span className="settings-home__icon">
                  <Icon size={16} />
                </span>
                <span className="settings-home__label">{row.label}</span>
                {!!row.badge && (
                  <span className="settings-home__badge">{row.badge > 9 ? "9+" : row.badge}</span>
                )}
                {row.value && <span className="settings-home__value">{row.value}</span>}
                <ChevronRightIcon size={15} className="settings-home__chevron" />
              </button>
            );
          })}
        </div>
      ))}

      <div className="settings-home__group">
        <button type="button" className="settings-home__row settings-home__row--danger" onClick={onSignOut}>
          Sign out
        </button>
      </div>
    </div>
  );
}
