import { useState } from "react";
import { FreePlanCard, PremiumActiveCard, PremiumUpsellCard } from "../PremiumCard";
import { buyPremium } from "../../premium";
import { redeemPremiumCode, type Friend, type MembershipTier } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CrownIcon } from "../ui/icons";
import { AdminMembersList } from "./AdminMembersList";
import "./MembershipSection.css";

interface MembershipSectionProps {
  online: boolean;
  onViewMember: (friend: Friend) => void;
  membership: MembershipState;
}

export const TIER_LABEL: Record<MembershipTier, string> = {
  free: "Free Member",
  premium: "Premium Member",
  admin: "Admin",
};

const TIER_HINT: Record<MembershipTier, string> = {
  free: "Upgrade for templates, extra widgets, and streak freezes.",
  premium: "Thanks for supporting Consistency.",
  admin: "You can see every member below and change their tier.",
};

/**
 * Read-only for now - there's no self-service billing yet (see
 * supabase/membership_schema.sql), so nothing here can change your real
 * tier. Tier/preview state itself lives in useMembership (App.tsx owns the
 * one instance) since App.tsx also needs it for feature gating - this
 * component just renders it. The "preview the app as" toggle lives in its
 * own AdminPreviewSection/tab now, not here - see SettingsModal.
 */
export function MembershipSection({ online, onViewMember, membership }: MembershipSectionProps) {
  const { effectiveTier, error } = membership;

  const [showRedeem, setShowRedeem] = useState(false);
  const [code, setCode] = useState("");
  const [redeeming, setRedeeming] = useState(false);
  const [redeemMessage, setRedeemMessage] = useState<string | null>(null);
  const [redeemError, setRedeemError] = useState<string | null>(null);

  async function handleRedeem() {
    const trimmed = code.trim();
    if (!trimmed) return;
    setRedeeming(true);
    setRedeemError(null);
    setRedeemMessage(null);
    try {
      await redeemPremiumCode(trimmed);
      setRedeemMessage("Code redeemed - welcome to Premium!");
      setCode("");
    } catch (err) {
      setRedeemError(err instanceof Error ? err.message : "That code didn't work.");
    } finally {
      setRedeeming(false);
    }
  }

  return (
    <Card className={effectiveTier === "premium" ? "membership-section-card--center" : ""}>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}

      {effectiveTier === "free" ? (
        <>
          <div className="premium-compare">
            <FreePlanCard />
            <PremiumUpsellCard ctaLabel="Upgrade to Premium →" onBuy={buyPremium} />
          </div>

          {showRedeem ? (
            <div className="membership-upsell__redeem">
              <input
                className="membership-upsell__redeem-input"
                value={code}
                onChange={(e) => setCode(e.target.value.toUpperCase())}
                placeholder="CODE"
                maxLength={20}
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === "Enter") void handleRedeem();
                }}
              />
              <Button onClick={() => void handleRedeem()} disabled={redeeming || !code.trim()}>
                {redeeming ? "…" : "Redeem"}
              </Button>
            </div>
          ) : (
            <button
              type="button"
              className="membership-upsell__redeem-toggle"
              onClick={() => setShowRedeem(true)}
            >
              Have a code?
            </button>
          )}
          {redeemMessage && <span className="settings__hint">{redeemMessage}</span>}
          {redeemError && (
            <span className="settings__hint settings__hint--warning">{redeemError}</span>
          )}
        </>
      ) : effectiveTier === "premium" ? (
        <PremiumActiveCard />
      ) : (
        effectiveTier && (
          <div className={`membership-badge membership-badge--${effectiveTier}`}>
            <CrownIcon size={18} />
            <div className="membership-badge__text">
              <span className="membership-badge__tier">{TIER_LABEL[effectiveTier]}</span>
              <span className="membership-badge__hint">{TIER_HINT[effectiveTier]}</span>
            </div>
          </div>
        )
      )}

      {effectiveTier === "admin" && <AdminMembersList online={online} onView={onViewMember} />}
    </Card>
  );
}
