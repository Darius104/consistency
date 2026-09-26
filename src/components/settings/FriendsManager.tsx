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
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { EmptyState } from "../ui/EmptyState";
import { UsersIcon, TrashIcon } from "../ui/icons";
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
    <div className="friends-manager">
      {error && <div className="friends-manager__error">{error}</div>}

      <Card>
        <span className="settings__label">Invite a friend</span>
        <span className="settings__hint">
          Ask them for a code (or generate your own here and send it to them) - entering a valid
          code links you both automatically, no approval step needed.
        </span>
        {code && !codeExpired ? (
          <div className="friends-manager__code">
            <span className="friends-manager__code-value">{code.code}</span>
            <span className="friends-manager__code-timer">expires in {secondsLeft}s</span>
          </div>
        ) : (
          <Button onClick={handleGenerateCode} disabled={generating || !online}>
            {generating ? "Generating…" : "Generate a code"}
          </Button>
        )}
        {!online && <span className="settings__hint">Needs a connection.</span>}
      </Card>

      <Card>
        <span className="settings__label">Redeem a code</span>
        <div className="friends-manager__redeem">
          <input
            className="friends-manager__input friends-manager__input--code"
            value={redeemInput}
            onChange={(e) => setRedeemInput(e.target.value.toUpperCase())}
            placeholder="ABC123"
            maxLength={8}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRedeem();
            }}
          />
          <Button
            variant="primary"
            onClick={handleRedeem}
            disabled={redeeming || !online || !redeemInput.trim()}
          >
            {redeeming ? "…" : "Redeem"}
          </Button>
        </div>
        {redeemMessage && <span className="friends-manager__success">{redeemMessage}</span>}
        {!isPremium && friends.length >= FREE_FRIEND_LIMIT && (
          <span className="settings__hint">
            Free members can have {FREE_FRIEND_LIMIT} friend - upgrade to Premium to add more.
          </span>
        )}
      </Card>

      <Card>
        <span className="settings__label">Your friends</span>
        {loading ? (
          <div className="friends-manager__list">
            {Array.from({ length: lastKnownCountRef.current }, (_, i) => (
              <div className="friends-manager__row" key={i}>
                <div className="friends-manager__identity">
                  <Skeleton width={28} height={28} radius="50%" />
                  <Skeleton width={90} height="0.85em" />
                </div>
              </div>
            ))}
          </div>
        ) : friends.length === 0 ? (
          <EmptyState icon={<UsersIcon size={16} />}>No friends linked yet.</EmptyState>
        ) : (
          <div className="friends-manager__list">
            {friends.map((friend) => {
              const isOnline = onlineFriendIds.has(friend.userId);
              return confirmingRemoveId === friend.userId ? (
                <div className="friends-manager__row" key={friend.userId}>
                  <span className="friends-manager__name">Remove {friend.displayName}?</span>
                  <div className="friends-manager__row-actions">
                    <Button onClick={() => setConfirmingRemoveId(null)}>Cancel</Button>
                    <Button variant="danger" onClick={() => handleConfirmRemove(friend)}>
                      Remove
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="friends-manager__row" key={friend.userId}>
                  <div className="friends-manager__identity">
                    <span className="friends-manager__avatar-wrap">
                      <AvatarBadge avatarId={friend.avatarId} size={28} />
                      <span
                        className={`friends-manager__status-dot ${isOnline ? "friends-manager__status-dot--online" : ""}`}
                      />
                    </span>
                    <span className="friends-manager__name">{friend.displayName}</span>
                    {!isOnline && friend.lastSeenAt && (
                      <span className="friends-manager__last-seen">
                        Last seen {formatRelativeTime(friend.lastSeenAt)}
                      </span>
                    )}
                  </div>
                  <div className="friends-manager__row-actions">
                    <Button variant="primary" onClick={() => onViewFriend(friend)} disabled={!online}>
                      View calendar
                    </Button>
                    <button
                      type="button"
                      className="friends-manager__remove"
                      aria-label={`Remove ${friend.displayName}`}
                      onClick={() => setConfirmingRemoveId(friend.userId)}
                    >
                      <TrashIcon size={13} />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </Card>
    </div>
  );
}
