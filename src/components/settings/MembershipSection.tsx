import { useEffect, useState } from "react";
import { getMyMembership, type MembershipTier } from "../../db/friends";
import { CrownIcon } from "../ui/icons";
import { AdminMembersList } from "./AdminMembersList";
import "./MembershipSection.css";

const TIER_LABEL: Record<MembershipTier, string> = {
  free: "Free Member",
  premium: "Premium Member",
  admin: "Admin",
};

const TIER_HINT: Record<MembershipTier, string> = {
  free: "Everything's currently free - premium perks are coming later.",
  premium: "Thanks for supporting Consistency.",
  admin: "You can see every member below and change their tier.",
};

/**
 * Read-only for now - there's no self-service billing yet (see
 * supabase/membership_schema.sql), so nothing here can change your tier.
 * Self-contained like AppUpdateSection, since App.tsx has no other reason
 * to know a user's membership tier yet.
 */
export function MembershipSection() {
  const [tier, setTier] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getMyMembership()
      .then((result) => {
        if (!cancelled) setTier(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  return (
    <div className="settings__section">
      <span className="settings__label">Membership</span>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}
      {tier && (
        <div className={`membership-badge membership-badge--${tier}`}>
          <CrownIcon size={18} />
          <div className="membership-badge__text">
            <span className="membership-badge__tier">{TIER_LABEL[tier]}</span>
            <span className="membership-badge__hint">{TIER_HINT[tier]}</span>
          </div>
        </div>
      )}
      {tier === "admin" && <AdminMembersList />}
    </div>
  );
}
