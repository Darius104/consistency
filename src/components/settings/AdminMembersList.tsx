import { useEffect, useState } from "react";
import { listAllMembers, setMemberTier, type Member } from "../../db/friends";
import { Button } from "../ui/Button";
import "./AdminMembersList.css";

/** Only ever rendered by MembershipSection when the signed-in account's own
 *  tier is "admin" - the actual access control lives server-side though
 *  (see supabase/membership_admin_schema.sql's RLS policy and
 *  admin_set_membership_tier() function), so this component being visible
 *  is a convenience, not the security boundary. */
export function AdminMembersList() {
  const [members, setMembers] = useState<Member[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

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
      {!members && !error && <span className="settings__hint">Loading members…</span>}
      {members && (
        <div className="admin-members__list">
          {members.map((member) => (
            <div className="admin-members__row" key={member.userId}>
              <span className="admin-members__name">{member.displayName}</span>
              <span className={`admin-members__tier admin-members__tier--${member.tier}`}>
                {member.tier}
              </span>
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
