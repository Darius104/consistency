import type { Friend, MembershipTier } from "../../db/friends";
import { Button } from "../ui/Button";
import { BookmarkIcon, ChevronLeftIcon, ChevronRightIcon, SettingsIcon, SparklesIcon } from "../ui/icons";
import { FriendAvatarRow } from "./FriendAvatarRow";
import "./CalendarHeader.css";

const TIER_PLAN_LABEL: Record<MembershipTier, string> = {
  free: "Free Plan",
  premium: "Premium Plan",
  admin: "Admin Plan",
};

interface CalendarHeaderProps {
  monthLabel: string;
  /** Omitted while viewing a friend's read-only calendar - that's their
   *  plan to show, not yours, and this component has no way to know it. */
  tier?: MembershipTier;
  onPrev: () => void;
  onNext: () => void;
  onToday: () => void;
  /** Omitted entirely (not just a no-op) while viewing a friend's read-only
   *  calendar - neither applies there, so the buttons don't render at all
   *  instead of sitting there doing nothing when tapped. */
  onOpenSettings?: () => void;
  /** Same "omitted, not just a no-op" rule as onOpenSettings - there's
   *  nothing to create a template of while viewing a friend's calendar. */
  onOpenCreateTemplate?: () => void;
  onOpenPhrase?: () => void;
  phraseUnseen?: boolean;
  /** Omitted entirely (not just a no-op) while viewing a friend's read-only
   *  calendar - there's no friends list to jump to from in there. */
  onViewFriend?: (friend: Friend) => void;
  onlineFriendIds?: Set<string>;
  onAddFriend?: () => void;
  /** Open tickets (admin) or unseen replies (member) - see
   *  useSupportBadgeCount. Omitted while viewing a friend's calendar, same
   *  as onOpenSettings itself. */
  settingsBadgeCount?: number;
}

export function CalendarHeader({
  monthLabel,
  tier,
  onPrev,
  onNext,
  onToday,
  onOpenSettings,
  onOpenCreateTemplate,
  onOpenPhrase,
  phraseUnseen,
  onViewFriend,
  onlineFriendIds,
  onAddFriend,
  settingsBadgeCount,
}: CalendarHeaderProps) {
  return (
    <div className="cal-header">
      <div className="cal-header__title-group">
        <h1 className="cal-header__title">{monthLabel}</h1>
        {tier && <span className={`cal-header__tier cal-header__tier--${tier}`}>{TIER_PLAN_LABEL[tier]}</span>}
      </div>
      <div className="cal-header__row">
        {onViewFriend && onAddFriend && (
          <FriendAvatarRow
            onlineFriendIds={onlineFriendIds ?? new Set()}
            onViewFriend={onViewFriend}
            onAddFriend={onAddFriend}
          />
        )}
        <div className="cal-header__nav">
          {onOpenPhrase && (
            <span className="cal-header__phrase-wrap">
              <Button
                className="btn--icon"
                onClick={onOpenPhrase}
                aria-label="Phrase of the day"
              >
                <SparklesIcon size={15} />
                {phraseUnseen && <span className="cal-header__phrase-badge" aria-hidden="true" />}
              </Button>
              {phraseUnseen && (
                <div className="cal-header__phrase-tooltip" role="status">
                  <span className="cal-header__phrase-tooltip-arrow" aria-hidden="true" />
                  Click to see the phrase of the day
                </div>
              )}
            </span>
          )}
          {onOpenCreateTemplate && (
            <Button className="btn--icon" onClick={onOpenCreateTemplate} aria-label="Templates">
              <BookmarkIcon size={15} />
            </Button>
          )}
          <div className="cal-header__date-nav">
            <Button className="btn--icon" onClick={onPrev} aria-label="Previous month">
              <ChevronLeftIcon size={15} />
            </Button>
            <Button onClick={onToday}>Today</Button>
            <Button className="btn--icon" onClick={onNext} aria-label="Next month">
              <ChevronRightIcon size={15} />
            </Button>
          </div>
          {onOpenSettings && (
            <Button className="btn--icon cal-header__settings" onClick={onOpenSettings} aria-label="Settings">
              <SettingsIcon size={15} />
              {!!settingsBadgeCount && (
                <span className="cal-header__count-badge">
                  {settingsBadgeCount > 9 ? "9+" : settingsBadgeCount}
                </span>
              )}
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}
