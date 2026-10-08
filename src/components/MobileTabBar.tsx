import { useEffect, useRef } from "react";
import type { AvatarId } from "../utils/avatars";
import { AvatarBadge } from "./stats/AvatarBadge";
import { CalendarIcon, PlusIcon, ProfileIcon, SettingsIcon, TodayIcon } from "./ui/icons";
import "./MobileTabBar.css";

export type MobileTab = "calendar" | "today";
/** Which tab is highlighted - Settings and Profile are tabs too, shown as
 *  pages above the bar (see Modal's asTab). */
export type ActiveTab = MobileTab | "settings" | "profile";

interface MobileTabBarProps {
  activeTab: ActiveTab;
  onSelectTab: (tab: MobileTab) => void;
  onAdd: () => void;
  onOpenProfile: () => void;
  onOpenSettings: () => void;
  avatarId: AvatarId | null;
  profileBadgeCount?: number;
}

/** Phone-only bottom navigation (hidden above 700px, where the calendar
 *  and day panel already sit side by side). Calendar and Today are real
 *  views of this screen; +, Settings and Profile open the same add menu /
 *  Settings sections the desktop header buttons do. */
export function MobileTabBar({
  activeTab,
  onSelectTab,
  onAdd,
  onOpenProfile,
  onOpenSettings,
  avatarId,
  profileBadgeCount,
}: MobileTabBarProps) {
  // Publishes the bar's real height (incl. the home-indicator inset) so tab
  // pages like Settings can stop right above it.
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    const el = navRef.current;
    if (!el) return;
    const root = document.documentElement;
    const update = () => root.style.setProperty("--tabbar-h", `${el.offsetHeight}px`);
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => {
      ro.disconnect();
      root.style.removeProperty("--tabbar-h");
    };
  }, []);

  return (
    <nav className="mobile-tab-bar" aria-label="Main" ref={navRef}>
      <button
        type="button"
        className={`mobile-tab-bar__item ${activeTab === "calendar" ? "mobile-tab-bar__item--active" : ""}`}
        onClick={() => onSelectTab("calendar")}
        aria-label="Calendar"
        aria-current={activeTab === "calendar" ? "page" : undefined}
      >
        <CalendarIcon size={24} />
      </button>
      <button
        type="button"
        className={`mobile-tab-bar__item ${activeTab === "today" ? "mobile-tab-bar__item--active" : ""}`}
        onClick={() => onSelectTab("today")}
        aria-label="Today"
        aria-current={activeTab === "today" ? "page" : undefined}
      >
        <TodayIcon size={24} />
      </button>
      <button type="button" className="mobile-tab-bar__item" onClick={onAdd} aria-label="Add">
        {/* The app's main action - filled, so it stands apart from the tabs. */}
        <span className="mobile-tab-bar__add">
          <PlusIcon size={22} />
        </span>
      </button>
      <button
        type="button"
        className={`mobile-tab-bar__item ${activeTab === "settings" ? "mobile-tab-bar__item--active" : ""}`}
        onClick={onOpenSettings}
        aria-label="Settings"
        aria-current={activeTab === "settings" ? "page" : undefined}
      >
        <span className="mobile-tab-bar__avatar">
          <SettingsIcon size={24} />
          {!!profileBadgeCount && <span className="mobile-tab-bar__badge" aria-hidden="true" />}
        </span>
      </button>
      <button
        type="button"
        className={`mobile-tab-bar__item ${activeTab === "profile" ? "mobile-tab-bar__item--active" : ""}`}
        onClick={onOpenProfile}
        aria-label="Profile"
        aria-current={activeTab === "profile" ? "page" : undefined}
      >
        <span className="mobile-tab-bar__avatar">
          {avatarId ? <AvatarBadge avatarId={avatarId} size={28} /> : <ProfileIcon size={24} />}
        </span>
      </button>
    </nav>
  );
}
