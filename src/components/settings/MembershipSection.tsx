import { useState } from "react";
import { redeemPremiumCode, type Friend, type MembershipTier } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { CheckIcon, CrownIcon, ShieldIcon } from "../ui/icons";
import { AdminMembersList } from "./AdminMembersList";
import "./MembershipSection.css";

interface MembershipSectionProps {
  online: boolean;
  onViewMember: (friend: Friend) => void;
  membership: MembershipState;
  /** Opens PremiumPaywallModal directly, not gated behind hitting a
   *  specific locked feature - this is the only way a free member who
   *  comes straight to this page (rather than tripping a gate elsewhere)
   *  ever sees a way to actually upgrade. */
  onUpgrade: () => void;
}

const TIER_LABEL: Record<MembershipTier, string> = {
  free: "Free Member",
  premium: "Premium Member",
  admin: "Admin",
};

const TIER_HINT: Record<MembershipTier, string> = {
  free: "Upgrade for templates, extra widgets, and streak freezes.",
  premium: "Thanks for supporting Consistency.",
  admin: "You can see every member below and change their tier.",
};

const UPSELL_PERKS = [
  "Save your own task templates",
  "Unlock every day-panel widget",
  "Protect your streak with freeze days",
  "Connect with more than 1 friend",
];

const PREVIEW_OPTIONS: { value: "admin" | "free" | "premium"; label: string }[] = [
  { value: "admin", label: "Admin (You)" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

/**
 * Read-only for now - there's no self-service billing yet (see
 * supabase/membership_schema.sql), so nothing here can change your real
 * tier. Tier/preview state itself lives in useMembership (App.tsx owns the
 * one instance) since App.tsx also needs it for feature gating - this
 * component just renders it.
 */
export function MembershipSection({
  online,
  onViewMember,
  membership,
  onUpgrade,
}: MembershipSectionProps) {
  const { actualTier, effectiveTier, previewTier, setPreview, error } = membership;
  const isAdmin = actualTier === "admin";

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
    <Card>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}

      {effectiveTier === "free" ? (
        <div className="membership-upsell">
          <span className="membership-upsell__label">
            <CrownIcon size={13} /> Premium
          </span>
          <div className="membership-upsell__price-row">
            <span className="membership-upsell__price">€9,99</span>
          </div>
          <span className="membership-upsell__price-sub">One-time payment - lifetime access</span>

          <ul className="membership-upsell__perks">
            {UPSELL_PERKS.map((perk) => (
              <li key={perk}>
                <span className="membership-upsell__perk-check">
                  <CheckIcon size={11} />
                </span>
                {perk}
              </li>
            ))}
          </ul>

          <Button variant="primary" className="membership-upsell__button" onClick={onUpgrade}>
            Upgrade to Premium →
          </Button>

          <div className="membership-upsell__trust">
            <ShieldIcon size={13} />
            One-time purchase - yours forever, never a subscription.
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
        </div>
      ) : effectiveTier === "premium" ? (
        <div className="membership-upsell membership-upsell--active">
          <span className="membership-upsell__label membership-upsell__label--active">
            <CrownIcon size={13} /> Premium
          </span>

          <span className="membership-upsell__active-check">
            <CheckIcon size={24} />
          </span>
          <span className="membership-upsell__active-title">You have Premium</span>
          <span className="membership-upsell__price-sub">Thanks for supporting Consistency.</span>

          <ul className="membership-upsell__perks membership-upsell__perks--active">
            {UPSELL_PERKS.map((perk) => (
              <li key={perk}>
                <span className="membership-upsell__perk-check membership-upsell__perk-check--active">
                  <CheckIcon size={11} />
                </span>
                {perk}
              </li>
            ))}
          </ul>
        </div>
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

      {isAdmin && (
        <div className="membership-preview">
          <span className="settings__hint">Preview the app as</span>
          <div className="membership-preview__options">
            {PREVIEW_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                type="button"
                className={`membership-preview__btn ${
                  effectiveTier === opt.value ? "membership-preview__btn--active" : ""
                }`}
                onClick={() => setPreview(opt.value)}
              >
                {opt.label}
              </button>
            ))}
          </div>
          {previewTier && (
            <span className="settings__hint settings__hint--warning">
              Previewing as {TIER_LABEL[previewTier]} - only visible on this device, doesn't
              change your real account.
            </span>
          )}
        </div>
      )}

      {effectiveTier === "admin" && <AdminMembersList online={online} onView={onViewMember} />}
    </Card>
  );
}
