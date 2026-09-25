import { useCallback, useEffect, useState } from "react";
import { countUnseenFriendNotes } from "../db/friendNotes";

// Same shape as useSupportBadgeCount - polled in the background so the
// Settings > Friends badge (and the calendar's friend-switcher icon) stay
// current, with a refresh() the Friends tab calls the instant it marks
// notes seen instead of waiting out the rest of this interval.
const POLL_MS = 5000;

export function useFriendNoteBadgeCount(): { count: number; refresh: () => void } {
  const [count, setCount] = useState(0);

  const load = useCallback(() => {
    countUnseenFriendNotes()
      .then(setCount)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  return { count, refresh: load };
}
