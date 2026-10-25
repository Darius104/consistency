import { useRef } from "react";
import type { ReactNode } from "react";
import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { AvatarId } from "../../utils/avatars";
import { WIDGET_COLORS } from "../../utils/panelOrder";
import { CrownIcon, UsersIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import { AvatarBadge } from "./AvatarBadge";
import { Flame } from "./Flame";
import { WidgetCard } from "./WidgetCard";
import "./stats.css";
import "./FriendStreakCompare.css";

interface FriendStreakCompareProps {
  primaryStreak: number;
  primaryAvatarId: AvatarId | null;
  /** "You" on your own day panel - the friend's own name when this widget
   *  is replicated onto their calendar view (see FriendCalendarView), so it
   *  reads as "them vs. their friends", not "you vs. their friends". */
  primaryLabel?: string;
  friends: FriendStreakEntry[];
  loading: boolean;
  /** Shown instead of the list when there's nobody to compare against yet -
   *  differs between "you have no friends" (your own widget) and "they
   *  have no friends" (replicated onto a friend's calendar). */
  emptyMessage?: string;
}

interface Row {
  userId: string;
  displayName: string;
  avatarId: AvatarId | null;
  streak: number;
  isPrimary: boolean;
}

export function FriendStreakCompare({
  primaryStreak,
  primaryAvatarId,
  primaryLabel = "You",
  friends,
  loading,
  emptyMessage = "Add a friend in Settings to compare streaks.",
}: FriendStreakCompareProps) {
  // Remembered across loads (this component stays mounted for as long as
  // the widget is visible) so a *later* refresh's brief loading flip
  // doesn't flash an empty/wrong-sized skeleton - only the very first
  // load, before any real count is known, falls back to guessing 1.
  const lastKnownCountRef = useRef(1);
  if (friends.length > 0) lastKnownCountRef.current = friends.length;

  // Only for the first load - once there's *any* real data, a later
  // background refresh keeps showing it as-is instead of replacing it with
  // a skeleton every few minutes.
  if (loading && friends.length === 0) {
    return (
      <FriendsCard>
        <ul className="friend-streak-compare" aria-hidden="true">
          {Array.from({ length: lastKnownCountRef.current + 1 }, (_, i) => (
            <li className="friend-streak-compare__row" key={i}>
              <span className="friend-streak-compare__rank" />
              <Skeleton width={26} height={26} radius="50%" />
              <Skeleton width={100} height="0.85em" />
            </li>
          ))}
        </ul>
      </FriendsCard>
    );
  }

  if (!loading && friends.length === 0) {
    return (
      <FriendsCard>
        <p className="widget-card__foot">{emptyMessage}</p>
      </FriendsCard>
    );
  }

  const rows: Row[] = [
    {
      userId: "primary",
      displayName: primaryLabel,
      avatarId: primaryAvatarId,
      streak: primaryStreak,
      isPrimary: true,
    },
    ...friends.map((f) => ({ ...f, isPrimary: false })),
  ].sort((a, b) => b.streak - a.streak);

  return (
    <FriendsCard>
      <ul className="friend-streak-compare">
        {rows.map((row, i) => (
          <li
            key={row.userId}
            className={`friend-streak-compare__row ${
              row.isPrimary ? "friend-streak-compare__row--you" : ""
            }`}
          >
            <span className="friend-streak-compare__rank">
              {i === 0 && row.streak > 0 ? <CrownIcon size={13} /> : i + 1}
            </span>
            {row.avatarId && <AvatarBadge avatarId={row.avatarId} size={26} />}
            <span className="friend-streak-compare__name">{row.displayName}</span>
            <span className="friend-streak-compare__streak">
              <Flame power={row.streak > 0 ? 1 : 0} showLogs={false} />
              {row.streak}
            </span>
          </li>
        ))}
      </ul>
    </FriendsCard>
  );
}

function FriendsCard({ children }: { children: ReactNode }) {
  return (
    <WidgetCard color={WIDGET_COLORS.friendStreaks} icon={<UsersIcon size={13} />} title="Friends" meta="streaks">
      {children}
    </WidgetCard>
  );
}
