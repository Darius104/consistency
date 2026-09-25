import { useEffect, useState } from "react";
import { countUnseenMessagesForMember, countUnseenTicketsForAdmin } from "../db/support";

// One badge number, wherever it's shown (the Settings button, and the
// Support row inside Settings) - what it counts depends on the role, since
// an admin and a member care about different things here: an admin wants
// to know about tickets they haven't opened yet (new, or replied-to since
// they last looked), a member wants to know about admin replies they
// haven't read yet. Both reset the moment the relevant thread is opened
// (see markTicketSeenByAdmin/markTicketSeenByMember).
const POLL_MS = 5000;

export function useSupportBadgeCount(isAdmin: boolean): number {
  const [count, setCount] = useState(0);

  useEffect(() => {
    let cancelled = false;
    function load() {
      const fetchCount = isAdmin ? countUnseenTicketsForAdmin : countUnseenMessagesForMember;
      fetchCount()
        .then((n) => {
          if (!cancelled) setCount(n);
        })
        .catch(() => {});
    }
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
  }, [isAdmin]);

  return count;
}
