import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { AvatarId } from "../../utils/avatars";
import { CrownIcon } from "../ui/icons";
import { AvatarBadge } from "./AvatarBadge";
import { Flame } from "./Flame";
import "./stats.css";
import "./FriendStreakCompare.css";

interface FriendStreakCompareProps {
  yourStreak: number;
  yourAvatarId: AvatarId | null;
  friends: FriendStreakEntry[];
  loading: boolean;
}

interface Row {
  userId: string;
  displayName: string;
  avatarId: AvatarId | null;
  streak: number;
  isYou: boolean;
}

export function FriendStreakCompare({
  yourStreak,
  yourAvatarId,
  friends,
  loading,
}: FriendStreakCompareProps) {
  if (!loading && friends.length === 0) {
    return (
      <div className="stat-card">
        <div className="stat-card__label">Friend comparison</div>
        <p className="stat-card__sub">Add a friend in Settings to compare streaks.</p>
      </div>
    );
  }

  const rows: Row[] = [
    { userId: "you", displayName: "You", avatarId: yourAvatarId, streak: yourStreak, isYou: true },
    ...friends.map((f) => ({ ...f, isYou: false })),
  ].sort((a, b) => b.streak - a.streak);

  return (
    <div className="stat-card">
      <div className="stat-card__label">Friend comparison</div>
      <ul className="friend-streak-compare">
        {rows.map((row, i) => (
          <li
            key={row.userId}
            className={`friend-streak-compare__row ${
              row.isYou ? "friend-streak-compare__row--you" : ""
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
    </div>
  );
}
