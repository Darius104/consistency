import { useEffect, useRef } from "react";
import type { ReactNode } from "react";
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
 *  and day panel already sit side by side): a floating capsule of tabs and
 *  a round + beside it. Calendar and Today are real views of this screen;
 *  +, Settings and Profile open the same add menu / Settings sections the
 *  desktop header buttons do. */
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

  const tabs: {
    id: ActiveTab;
    label: string;
    icon: ReactNode;
    onClick: () => void;
    badge?: boolean;
  }[] = [
    { id: "calendar", label: "Calendar", icon: <CalendarIcon size={21} />, onClick: () => onSelectTab("calendar") },
    { id: "today", label: "Today", icon: <TodayIcon size={21} />, onClick: () => onSelectTab("today") },
    {
      id: "settings",
      label: "Settings",
      icon: <SettingsIcon size={21} />,
      onClick: onOpenSettings,
      badge: !!profileBadgeCount,
    },
    {
      id: "profile",
      label: "Profile",
      icon: avatarId ? <AvatarBadge avatarId={avatarId} size={26} /> : <ProfileIcon size={21} />,
      onClick: onOpenProfile,
    },
  ];

  return (
    <nav className="mobile-tab-bar" aria-label="Main" ref={navRef}>
      {/* A frosted capsule floating at the bottom - the open tab grows into
          a blue pill with its name; the others are just their icons. */}
      <div className="mobile-tab-bar__capsule">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            className={`mobile-tab-bar__item ${activeTab === tab.id ? "mobile-tab-bar__item--active" : ""}`}
            onClick={tab.onClick}
            aria-label={tab.label}
            aria-current={activeTab === tab.id ? "page" : undefined}
          >
            <span className="mobile-tab-bar__icon">
              {tab.icon}
              {tab.badge && <span className="mobile-tab-bar__badge" aria-hidden="true" />}
            </span>
            <span className="mobile-tab-bar__label" aria-hidden="true">
              {tab.label}
            </span>
          </button>
        ))}
      </div>
      {/* The app's main action - its own round blue button beside the bar. */}
      <button type="button" className="mobile-tab-bar__add" onClick={onAdd} aria-label="Add">
        <PlusIcon size={24} />
      </button>
    </nav>
  );
}
