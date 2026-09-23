import { useEffect, useState } from "react";
import { touchLastSeen } from "../db/friends";
import { supabase } from "../lib/supabaseClient";

const HEARTBEAT_MS = 60_000;

/**
 * Live "who's currently online" via Supabase Realtime Presence - one
 * shared channel every signed-in account joins, keyed by their own user
 * id, so any client can see the full set of currently-present ids. Not
 * scoped to just your friends server-side (Presence has no per-pair
 * privacy), but the only thing ever broadcast is "this user id is
 * connected right now" - callers (FriendsManager) only ever display it
 * for ids already in the caller's own friend list, so it's never actually
 * shown for anyone else.
 *
 * Also runs a periodic heartbeat writing profiles.last_seen_at (see
 * supabase/presence_schema.sql) - the "last seen X ago" fallback for
 * whenever a friend is next viewed while NOT in this online set.
 */
export function usePresence(userId: string | null): Set<string> {
  const [onlineIds, setOnlineIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    if (!userId) {
      setOnlineIds(new Set());
      return;
    }

    const channel = supabase.channel("online-users", {
      config: { presence: { key: userId } },
    });

    function syncState() {
      setOnlineIds(new Set(Object.keys(channel.presenceState())));
    }

    channel.on("presence", { event: "sync" }, syncState).subscribe((status) => {
      if (status === "SUBSCRIBED") void channel.track({ online_at: new Date().toISOString() });
    });

    touchLastSeen().catch(() => {});
    const heartbeat = window.setInterval(() => {
      touchLastSeen().catch(() => {});
    }, HEARTBEAT_MS);

    return () => {
      window.clearInterval(heartbeat);
      void supabase.removeChannel(channel);
    };
  }, [userId]);

  return onlineIds;
}
