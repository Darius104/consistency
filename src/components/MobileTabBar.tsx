import type { AvatarId } from "../utils/avatars";
import { AvatarBadge } from "./stats/AvatarBadge";
import { CalendarIcon, PlusSquareIcon, ProfileIcon, TodayIcon, UsersIcon } from "./ui/icons";
import "./MobileTabBar.css";

export type MobileTab = "calendar" | "today";

interface MobileTabBarProps {
  activeTab: MobileTab;
  onSelectTab: (tab: MobileTab) => void;
  onAdd: () => void;
  onOpenFriends: () => void;
  onOpenProfile: () => void;
  avatarId: AvatarId | null;
  profileBadgeCount?: number;
}

/** Phone-only bottom navigation (hidden above 700px, where the calendar
 *  and day panel already sit side by side). Calendar and Today are real
 *  views of this screen; +, Friends and Profile open the same add menu /
 *  Settings sections the desktop header buttons do. */
export function MobileTabBar({
  activeTab,
  onSelectTab,
  onAdd,
  onOpenFriends,
  onOpenProfile,
  avatarId,
  profileBadgeCount,
}: MobileTabBarProps) {
  return (
    <nav className="mobile-tab-bar" aria-label="Main">
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
        <PlusSquareIcon size={26} />
      </button>
      <button type="button" className="mobile-tab-bar__item" onClick={onOpenFriends} aria-label="Friends">
        <UsersIcon size={24} />
      </button>
      <button type="button" className="mobile-tab-bar__item" onClick={onOpenProfile} aria-label="Profile">
        <span className="mobile-tab-bar__avatar">
          {avatarId ? <AvatarBadge avatarId={avatarId} size={28} /> : <ProfileIcon size={24} />}
          {!!profileBadgeCount && <span className="mobile-tab-bar__badge" aria-hidden="true" />}
        </span>
      </button>
    </nav>
  );
}
