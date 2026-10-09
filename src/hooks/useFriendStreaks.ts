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

/** Backs the "Friend comparison" widget, in two parts:
 *  - light (your avatar + your friends' ids): loaded on mount and again
 *    whenever `refreshKey` changes (App passes the signed-in user + "Settings
 *    is open"), for the
 *    profile card, the tab bar avatar and the "N online" count;
 *  - heavy (each friend's full calendar, to compute their streak): only
 *    while `streaksEnabled` - the widget is visible, or Settings' Widgets
 *    page (where its preview lives) is open. */
export function useFriendStreaks(
  streaksEnabled: boolean,
  refreshKey: string,
): {
  yourAvatarId: AvatarId | null;
  friendIds: string[];
  friends: FriendStreakEntry[];
  loading: boolean;
} {
  const [yourAvatarId, setYourAvatarId] = useState<AvatarId | null>(null);
  const [friendIds, setFriendIds] = useState<string[]>([]);
  const [friends, setFriends] = useState<FriendStreakEntry[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    Promise.all([getMyProfile(), listFriends()])
      .then(([profile, friendList]) => {
        if (cancelled) return;
        setYourAvatarId(profile.avatarId);
        setFriendIds(friendList.map((f) => f.userId));
      })
      .catch(() => {
        // Leave whatever was last successfully loaded.
      });
    return () => {
      cancelled = true;
    };
  }, [refreshKey]);

  const loadStreaks = useCallback(async () => {
    try {
      const today = todayKey();
      const friendList = await listFriends();
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
    if (!streaksEnabled) return;
    void loadStreaks();
    const id = window.setInterval(() => void loadStreaks(), POLL_MS);
    return () => window.clearInterval(id);
  }, [streaksEnabled, loadStreaks]);

  return { yourAvatarId, friendIds, friends, loading };
}
