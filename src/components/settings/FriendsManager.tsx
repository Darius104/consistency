import { useEffect, useRef, useState } from "react";
import {
  type Friend,
  generateFriendCode,
  listFriends,
  redeemFriendCode,
  removeFriend,
} from "../../db/friends";
import { formatRelativeTime } from "../../utils/relativeTime";
import { AvatarBadge } from "../stats/AvatarBadge";
import { ChevronRightIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import "./FriendsManager.css";

interface FriendsManagerProps {
  online: boolean;
  onlineFriendIds: Set<string>;
  onViewFriend: (friend: Friend) => void;
  isPremium: boolean;
  /** Opens the paywall modal - checked client-side first so hitting the
   *  limit shows the actual upsell instead of a plain red error, but the
   *  real enforcement is server-side in redeem_friend_code() (see
   *  friends_schema.sql), since the other side of a redemption gains a
   *  friend too without ever calling this themselves. */
  onFriendLimitReached: () => void;
}

const FREE_FRIEND_LIMIT = 1;

export function FriendsManager({
  online,
  onlineFriendIds,
  onViewFriend,
  isPremium,
  onFriendLimitReached,
}: FriendsManagerProps) {
  const [friends, setFriends] = useState<Friend[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [code, setCode] = useState<{ code: string; expiresAt: string } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [redeemInput, setRedeemInput] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [now, setNow] = useState(() => Date.now());
  // Holds the friend awaiting a second confirming tap, so an accidental
  // stray tap on the X doesn't instantly unlink someone.
  const [confirmingRemoveId, setConfirmingRemoveId] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  // Remembered across loads (not reset each time) so the loading skeleton
  // guesses from how many friends you actually had last time, instead of a
  // fixed placeholder count that doesn't match and visibly resizes once the
  // real list loads in. Starts at 1 - a reasonable single-row guess before
  // this has ever loaded once.
  const lastKnownCountRef = useRef(1);

  async function loadAll() {
    setLoading(true);
    setError(null);
    try {
      const result = await listFriends();
      setFriends(result);
      lastKnownCountRef.current = Math.max(1, result.length);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't load your friends.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void loadAll();
  }, []);

  // Background refresh so a friend redeeming your code shows up here without
  // having to leave and reopen this screen - quiet (no loading/error UI) so
  // it never disrupts whatever you're doing while it ticks in the background.
  useEffect(() => {
    const id = window.setInterval(() => {
      listFriends()
        .then((result) => {
          setFriends(result);
          lastKnownCountRef.current = Math.max(1, result.length);
        })
        .catch(() => {});
    }, 4000);
    return () => window.clearInterval(id);
  }, []);

  // Drives the code's countdown - only ticking while one is actually showing.
  useEffect(() => {
    if (!code) return;
    const id = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(id);
  }, [code]);

  async function handleGenerateCode() {
    setGenerating(true);
    setError(null);
    try {
      setCode(await generateFriendCode());
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't generate a code.");
    } finally {
      setGenerating(false);
    }
  }

  async function handleRedeem() {
    const trimmed = redeemInput.trim();
    if (!trimmed) return;
    if (!isPremium && friends.length >= FREE_FRIEND_LIMIT) {
      onFriendLimitReached();
      return;
    }
    setRedeeming(true);
    setError(null);
    setRedeemMessage(null);
    try {
      const friend = await redeemFriendCode(trimmed);
      setRedeemMessage(`You're now friends with ${friend.displayName}.`);
      setRedeemInput("");
      await loadAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setRedeeming(false);
    }
  }

  async function handleConfirmRemove(friend: Friend) {
    try {
      await removeFriend(friend.userId);
      setFriends((prev) => prev.filter((f) => f.userId !== friend.userId));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't remove that friend.");
    } finally {
      setConfirmingRemoveId(null);
    }
  }

  const secondsLeft = code
    ? Math.max(0, Math.round((new Date(code.expiresAt).getTime() - now) / 1000))
    : 0;
  const codeExpired = code !== null && secondsLeft <= 0;

  return (
    <div className="settings-pages friends-manager">
      {error && <span className="settings-footnote settings-footnote--warning">{error}</span>}

      <div className="settings-group-wrap">
        <div className="friends-manager__title-row">
          <span className="settings-group__title">Your friends</span>
          {friends.length > 0 && (
            <button
              type="button"
              className="friends-manager__edit"
              onClick={() => {
                setEditing((v) => !v);
                setConfirmingRemoveId(null);
              }}
            >
              {editing ? "Done" : "Edit"}
            </button>
          )}
        </div>
        <div className="settings-group">
          {loading ? (
            Array.from({ length: lastKnownCountRef.current }, (_, i) => (
              <div className="settings-group__row" key={i}>
                <Skeleton width={40} height={40} radius="50%" />
                <Skeleton width={110} height="0.85em" />
              </div>
            ))
          ) : friends.length === 0 ? (
            <div className="settings-group__row settings-group__row--muted">No friends yet - add one below.</div>
          ) : (
            friends.map((friend) => {
              const isOnline = onlineFriendIds.has(friend.userId);
              const confirming = confirmingRemoveId === friend.userId;
              const status = isOnline
                ? "Online now"
                : friend.lastSeenAt
                  ? `Last seen ${formatRelativeTime(friend.lastSeenAt)}`
                  : "Offline";
              const body = (
                <>
                  <span className="friends-manager__avatar-wrap">
                    <AvatarBadge avatarId={friend.avatarId} size={40} />
                    <span
                      className={`friends-manager__status-dot ${isOnline ? "friends-manager__status-dot--online" : ""}`}
                    />
                  </span>
                  <span className="friends-manager__row-text">
                    <span className="friends-manager__name">{friend.displayName}</span>
                    <span className="friends-manager__status-text">{status}</span>
                  </span>
                </>
              );
              if (editing) {
                return (
                  <div className="settings-group__row" key={friend.userId}>
                    {body}
                    {confirming ? (
                      <button
                        type="button"
                        className="settings-row-action settings-row-action--danger"
                        onClick={() => void handleConfirmRemove(friend)}
                      >
                        Confirm
                      </button>
                    ) : (
                      <button
                        type="button"
                        className="friends-manager__remove-link"
                        onClick={() => setConfirmingRemoveId(friend.userId)}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                );
              }
              return (
                <button
                  type="button"
                  className="settings-group__row"
                  key={friend.userId}
                  onClick={() => onViewFriend(friend)}
                  disabled={!online}
                >
                  {body}
                  <span className="settings-group__value">Calendar</span>
                  <ChevronRightIcon size={15} className="settings-group__chevron" />
                </button>
              );
            })
          )}
        </div>
      </div>

      <div className="settings-group-wrap">
        <span className="settings-group__title">Add a friend</span>
        <div className="settings-group">
          <div className="settings-group__row">
            <span className="settings-group__label">Your code</span>
            {code && !codeExpired ? (
              <span className="friends-manager__code">
                <span className="friends-manager__code-value">{code.code}</span>
                <span className="friends-manager__code-timer">{secondsLeft}s</span>
              </span>
            ) : (
              <button
                type="button"
                className="settings-row-action"
                onClick={handleGenerateCode}
                disabled={generating || !online}
              >
                {generating ? "…" : "Get a code"}
              </button>
            )}
          </div>
          <div className="settings-group__row">
            <input
              className="settings-group__input friends-manager__redeem-input"
              value={redeemInput}
              onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
              placeholder="Enter a friend's code"
              aria-label="Friend code"
              autoComplete="off"
              spellCheck={false}
              maxLength={8}
              onKeyDown={(e) => {
                if (e.key === "Enter") void handleRedeem();
              }}
            />
            <button
              type="button"
              className="settings-row-action"
              onClick={() => void handleRedeem()}
              disabled={redeeming || !online || !redeemInput.trim()}
            >
              {redeeming ? "…" : "Add"}
            </button>
          </div>
        </div>
        {redeemMessage && (
          <span className="settings-footnote settings-footnote--success">{redeemMessage}</span>
        )}
        <span className="settings-footnote">
          {!online
            ? "Needs a connection."
            : !isPremium && friends.length >= FREE_FRIEND_LIMIT
              ? `Free members can have ${FREE_FRIEND_LIMIT} friend - Premium for more.`
              : "Send them your code, or enter theirs - you're linked right away."}
        </span>
      </div>
    </div>
  );
}
