import { useEffect, useState } from "react";
import { listAllMembers, setMemberTier, type Friend, type Member } from "../../db/friends";
import { DEFAULT_AVATAR_ID } from "../../utils/avatars";
import { Button } from "../ui/Button";
import { EyeIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import "./AdminMembersList.css";

interface AdminMembersListProps {
  online: boolean;
  onView: (friend: Friend) => void;
}

/** Only ever rendered by MembershipSection when the signed-in account's own
 *  tier is "admin" - the actual access control lives server-side though
 *  (see supabase/membership_admin_schema.sql's RLS policy and
 *  admin_set_membership_tier() function), so this component being visible
 *  is a convenience, not the security boundary. */
export function AdminMembersList({ online, onView }: AdminMembersListProps) {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const [query, setQuery] = useState("");

  function load() {
    listAllMembers()
      .then(setMembers)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  async function handleToggle(member: Member) {
    const nextTier = member.tier === "premium" ? "free" : "premium";
    setPendingUserId(member.userId);
    setError(null);
    try {
      await setMemberTier(member.userId, nextTier);
      setMembers((prev) =>
        prev?.map((m) => (m.userId === member.userId ? { ...m, tier: nextTier } : m)) ?? prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingUserId(null);
    }
  }

  const premiumCount = members?.filter((m) => m.tier === "premium").length ?? 0;
  const visibleMembers = members?.filter((m) =>
    m.displayName.toLowerCase().includes(query.trim().toLowerCase()),
  );

  function handleView(member: Member) {
    // FriendCalendarView never actually renders friend.avatarId (it uses
    // the avatar_id it fetches fresh as part of the calendar data itself),
    // so this placeholder is never shown - see FriendCalendarView.tsx.
    onView({
      userId: member.userId,
      displayName: member.displayName,
      avatarId: DEFAULT_AVATAR_ID,
      lastSeenAt: null,
    });
  }

  return (
    <div className="admin-members">
      <div className="admin-members__header">
        <span className="settings__label">All Members</span>
        {members && (
          <span className="admin-members__count">
            {members.length} total · {premiumCount} premium
          </span>
        )}
      </div>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}
      {!members && !error && (
        <div className="admin-members__list">
          {[0, 1, 2].map((i) => (
            <div className="admin-members__row" key={i}>
              <Skeleton width="35%" height="0.85em" />
            </div>
          ))}
        </div>
      )}
      {members && (
        <input
          type="text"
          className="admin-members__search"
          placeholder="Search members by name…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      )}
      {members && visibleMembers && visibleMembers.length === 0 && (
        <span className="admin-members__empty">No members match "{query}".</span>
      )}
      {visibleMembers && visibleMembers.length > 0 && (
        <div className="admin-members__list">
          {visibleMembers.map((member) => (
            <div className="admin-members__row" key={member.userId}>
              <span className="admin-members__name">{member.displayName}</span>
              <span className={`admin-members__tier admin-members__tier--${member.tier}`}>
                {member.tier}
              </span>
              <button
                type="button"
                className="admin-members__view"
                aria-label={`View ${member.displayName}'s calendar`}
                onClick={() => handleView(member)}
                disabled={!online}
              >
                <EyeIcon size={15} />
              </button>
              {member.tier !== "admin" && (
                <Button
                  onClick={() => void handleToggle(member)}
                  disabled={pendingUserId === member.userId}
                >
                  {pendingUserId === member.userId
                    ? "Saving…"
                    : member.tier === "premium"
                      ? "Make Free"
                      : "Make Premium"}
                </Button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
