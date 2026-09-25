import { useEffect, useRef, useState } from "react";
import { listFriends, type Friend } from "../../db/friends";
import { AvatarBadge } from "../stats/AvatarBadge";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { Skeleton } from "../ui/Skeleton";
import { UsersIcon } from "../ui/icons";
import "./FriendSwitcher.css";

interface FriendSwitcherProps {
  onlineFriendIds: Set<string>;
  onViewFriend: (friend: Friend) => void;
  /** Unseen notes from friends - see useFriendNoteBadgeCount. */
  badgeCount?: number;
}

// A quick way to jump straight to a friend's calendar from the calendar
// itself - the alternative (Settings -> Friends -> View calendar) is a
// perfectly good place for the full friend-management UI, but too many
// steps for the everyday "just let me peek at their calendar" case.
export function FriendSwitcher({ onlineFriendIds, onViewFriend, badgeCount }: FriendSwitcherProps) {
  const [open, setOpen] = useState(false);
  const [friends, setFriends] = useState<Friend[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    listFriends()
      .then(setFriends)
      .catch((err) => setError(err instanceof Error ? err.message : "Couldn't load your friends."));
  }, [open]);

  useEffect(() => {
    if (!open) return;
    function onOutside(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("pointerdown", onOutside);
    return () => document.removeEventListener("pointerdown", onOutside);
  }, [open]);

  return (
    <div className="friend-switcher" ref={rootRef}>
      <Button
        className="btn--icon"
        onClick={() => setOpen((v) => !v)}
        aria-label="View a friend's calendar"
      >
        <UsersIcon size={15} />
        {!!badgeCount && (
          <span className="cal-header__count-badge">{badgeCount > 9 ? "9+" : badgeCount}</span>
        )}
      </Button>
      {open && (
        <div className="friend-switcher__popup">
          {error ? (
            <span className="friend-switcher__hint friend-switcher__hint--warning">{error}</span>
          ) : !friends ? (
            <div className="friend-switcher__list">
              {[0, 1].map((i) => (
                <div className="friend-switcher__row" key={i}>
                  <Skeleton width={24} height={24} radius="50%" />
                  <Skeleton width={90} height="0.85em" />
                </div>
              ))}
            </div>
          ) : friends.length === 0 ? (
            <EmptyState icon={<UsersIcon size={16} />}>
              No friends yet - add one in Settings.
            </EmptyState>
          ) : (
            <div className="friend-switcher__list">
              {friends.map((friend) => (
                <button
                  key={friend.userId}
                  type="button"
                  className="friend-switcher__row"
                  onClick={() => {
                    onViewFriend(friend);
                    setOpen(false);
                  }}
                >
                  <span className="friend-switcher__avatar-wrap">
                    <AvatarBadge avatarId={friend.avatarId} size={24} />
                    <span
                      className={`friend-switcher__status-dot ${
                        onlineFriendIds.has(friend.userId) ? "friend-switcher__status-dot--online" : ""
                      }`}
                    />
                  </span>
                  <span className="friend-switcher__name">{friend.displayName}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
