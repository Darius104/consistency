import { useEffect, useRef, useState } from "react";
import { useNow } from "../../hooks/useNow";
import { formatRelativeTime } from "../../utils/relativeTime";
import "./FriendPresenceStatus.css";

interface FriendPresenceStatusProps {
  isOnline: boolean;
  lastSeenAt: string | null;
}

/** "Online" / "Last seen 5m ago" - the matching green/gray dot lives on
 *  the avatar itself (see FriendCalendarView's profile card). */
export function FriendPresenceStatus({ isOnline, lastSeenAt }: FriendPresenceStatusProps) {
  // Re-renders once a minute so "Last seen 5m ago" keeps advancing.
  useNow(60_000);

  // lastSeenAt is only as fresh as this view's own fetch - if they drop
  // offline while you're watching, the moment it happened is the better
  // answer than a heartbeat timestamp from before you even opened this.
  const [wentOfflineAt, setWentOfflineAt] = useState<string | null>(null);
  const wasOnlineRef = useRef(isOnline);
  useEffect(() => {
    if (wasOnlineRef.current && !isOnline) setWentOfflineAt(new Date().toISOString());
    wasOnlineRef.current = isOnline;
  }, [isOnline]);

  const seenAt = wentOfflineAt ?? lastSeenAt;
  const label = isOnline ? "Online" : seenAt ? `Last seen ${formatRelativeTime(seenAt)}` : "Offline";

  return (
    <span className={`friend-presence ${isOnline ? "friend-presence--online" : ""}`}>{label}</span>
  );
}
