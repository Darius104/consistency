import { useCallback, useEffect, useState } from "react";
import { fetchFriendCalendarData, getMyProfile, listFriends } from "../db/friends";
import type { AvatarId } from "../utils/avatars";
import { todayKey } from "../utils/dates";
import { computeStreak } from "../utils/stats";

export interface FriendStreakEntry {
  userId: string;
  displayName: string;
  avatarId: AvatarId;
  streak: number;
}

// Fetches the same full task/completion payload FriendCalendarView uses,
// once per friend, just to compute one number each - fine for the handful
// of friends this app supports, but not worth polling aggressively for a
// leaderboard nobody's watching second-to-second.
const POLL_MS = 3 * 60 * 1000;

/** Backs the "Friend comparison" widget - your own streak is already
 *  computed in App.tsx from local state, so this only fetches what isn't:
 *  your avatar (for the leaderboard row) and each friend's current streak.
 *  Only runs while the widget is actually visible (see `enabled`), since a
 *  hidden widget shouldn't be paying for a per-friend network fetch. */
export function useFriendStreaks(enabled: boolean): {
  yourAvatarId: AvatarId | null;
  friends: FriendStreakEntry[];
  loading: boolean;
} {
  const [yourAvatarId, setYourAvatarId] = useState<AvatarId | null>(null);
  const [friends, setFriends] = useState<FriendStreakEntry[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      const today = todayKey();
      const [profile, friendList] = await Promise.all([getMyProfile(), listFriends()]);
      setYourAvatarId(profile.avatarId);
      const results = await Promise.all(
        friendList.map(async (f): Promise<FriendStreakEntry | null> => {
          try {
            const data = await fetchFriendCalendarData(f.userId);
            return {
              userId: f.userId,
              displayName: f.displayName,
              avatarId: f.avatarId,
              streak: computeStreak(data.tasks, data.completions, data.freezes, today),
            };
          } catch {
            return null;
          }
        }),
      );
      setFriends(results.filter((r): r is FriendStreakEntry => r !== null));
    } catch {
      // Leave whatever was last successfully loaded.
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!enabled) return;
    void load();
    const id = window.setInterval(() => void load(), POLL_MS);
    return () => window.clearInterval(id);
  }, [enabled, load]);

  return { yourAvatarId, friends, loading };
}
