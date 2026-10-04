import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { listFriends, type Friend } from "../../db/friends";
import { AvatarBadge } from "../stats/AvatarBadge";
import "./FriendAvatarRow.css";

interface FriendAvatarRowProps {
  onlineFriendIds: Set<string>;
  onViewFriend: (friend: Friend) => void;
  /** Opens Settings straight to the Friends section (code generation/
   *  redemption lives there - see FriendsManager) - this row is just a
   *  quick way in, not a second place that duplicates that flow. */
  onAddFriend: () => void;
}

interface HoverState {
  friend: Friend;
  left: number;
  top: number;
  /** How far the box's own center had to shift away from the avatar's true
   *  center to stay on-screen (see showTooltip) - the arrow counter-shifts
   *  by this same amount so it still points at the avatar even when the
   *  box itself has been nudged inward near a screen edge. */
  arrowShift: number;
}

// Half of the tooltip's own CSS max-width (180px) plus a little breathing
// room from the screen edge - the real rendered width depends on the
// friend's name, but the max-width is a hard cap, so clamping against half
// of it is always enough to keep the box fully on-screen.
const TOOLTIP_HALF_WIDTH = 98;

// Replaces the old "Friends" header button + dropdown - friends are
// frequent enough to want visible at a glance, not tucked behind an icon
// you have to remember is there. The "+ Friends" button always shows, even
// with zero friends yet, so there's still a visible way to add your first
// one instead of this row only appearing once you already have someone.
export function FriendAvatarRow({ onlineFriendIds, onViewFriend, onAddFriend }: FriendAvatarRowProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  // The tooltip is portaled to <body> and positioned from a measured rect
  // instead of plain CSS (position:absolute + top/left on the avatar
  // itself) - this row lives inside .cal-view, which clips overflow for
  // the pull-to-refresh gesture, so a same-subtree tooltip would get cut
  // off instead of floating freely above everything.
  const [hover, setHover] = useState<HoverState | null>(null);

  useEffect(() => {
    let cancelled = false;
    listFriends()
      .then((result) => {
        if (!cancelled) setFriends(result);
      })
      .catch(() => {
        // Best-effort - an empty row is a reasonable fallback for a feature
        // that's purely a convenience shortcut anyway.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function showTooltip(friend: Friend, el: HTMLElement) {
    const rect = el.getBoundingClientRect();
    const trueCenter = rect.left + rect.width / 2;
    const clampedCenter = Math.min(
      Math.max(trueCenter, TOOLTIP_HALF_WIDTH + 8),
      window.innerWidth - TOOLTIP_HALF_WIDTH - 8,
    );
    setHover({
      friend,
      left: clampedCenter,
      top: rect.bottom + 10,
      arrowShift: trueCenter - clampedCenter,
    });
  }

  return (
    <div className="friend-avatar-row">
      {friends.map((friend) => (
        <button
          type="button"
          key={friend.userId}
          className="friend-avatar-row__item"
          onClick={() => onViewFriend(friend)}
          onMouseEnter={(e) => showTooltip(friend, e.currentTarget)}
          onMouseLeave={() => setHover(null)}
          onFocus={(e) => showTooltip(friend, e.currentTarget)}
          onBlur={() => setHover(null)}
        >
          <span className="friend-avatar-row__avatar-wrap">
            <AvatarBadge avatarId={friend.avatarId} size={30} />
            <span
              className={`friend-avatar-row__status-dot ${
                onlineFriendIds.has(friend.userId) ? "friend-avatar-row__status-dot--online" : ""
              }`}
            />
          </span>
        </button>
      ))}
      <button type="button" className="friend-avatar-row__add" onClick={onAddFriend}>
        + Friends
      </button>
      {hover &&
        createPortal(
          <div
            className="friend-avatar-row__tooltip"
            role="tooltip"
            style={{ left: hover.left, top: hover.top }}
          >
            <span
              className="friend-avatar-row__tooltip-arrow"
              style={{ left: `calc(50% + ${hover.arrowShift}px)` }}
              aria-hidden="true"
            />
            View {hover.friend.displayName}'s planning
          </div>,
          document.body,
        )}
    </div>
  );
}
