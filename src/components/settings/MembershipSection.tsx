import { useState } from "react";
import type { ComponentType, CSSProperties } from "react";
import { buyPremium, CAN_BUY_PREMIUM_HERE } from "../../premium";
import { redeemPremiumCode, type Friend, type MembershipTier } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import { Button } from "../ui/Button";
import { BookmarkIcon, CheckIcon, FrostIcon, GridIcon, UsersIcon } from "../ui/icons";
import { AdminMembersList } from "./AdminMembersList";
import "./MembershipSection.css";

interface MembershipSectionProps {
  online: boolean;
  onViewMember: (friend: Friend) => void;
  membership: MembershipState;
}

// What each plan gets, row for row - one table instead of two cards that
// list the same four things twice.
const PERKS: {
  label: string;
  icon: ComponentType<{ size?: number }>;
  color: string;
  /** One short line under the name, for perks whose name alone doesn't
   *  explain itself. */
  hint?: string;
  free: string;
  premium: string;
}[] = [
  { label: "Day-panel widgets", icon: GridIcon, color: "#f97316", free: "1", premium: "All" },
  { label: "Friends", icon: UsersIcon, color: "#22c55e", free: "1", premium: "Unlimited" },
  { label: "Custom templates", icon: BookmarkIcon, color: "#8b5cf6", free: "–", premium: "✓" },
  {
    label: "Streak freezes",
    hint: "Miss a day without losing your streak",
    icon: FrostIcon,
    color: "#0ea5e9",
    free: "–",
    premium: "3 a month",
  },
];

export const TIER_LABEL: Record<MembershipTier, string> = {
  free: "Free Member",
  premium: "Premium Member",
  admin: "Admin",
};

/**
 * Your tier itself (and what it means) is the page's banner, drawn by
 * SettingsModal - this is everything under it.
 *
 * Read-only for now - there's no self-service billing yet (see
 * supabase/membership_schema.sql), so nothing here can change your real
 * tier. Tier/preview state itself lives in useMembership (App.tsx owns the
 * one instance) since App.tsx also needs it for feature gating - this
 * component just renders it. The "preview the app as" toggle lives in its
 * own AdminPreviewSection/tab now, not here - see SettingsModal.
 */
export function MembershipSection({ online, onViewMember, membership }: MembershipSectionProps) {
  const { effectiveTier, error } = membership;

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

  const codeRow = (
    <div className="settings-group-wrap">
      <span className="settings-group__title">Have a code?</span>
      <div className="settings-group">
        <div className="settings-group__row">
          <input
            className="settings-group__input membership-page__code"
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            placeholder="Enter a Premium code"
            aria-label="Premium code"
            autoComplete="off"
            spellCheck={false}
            maxLength={20}
            onKeyDown={(e) => {
              if (e.key === "Enter") void handleRedeem();
            }}
          />
          <button
            type="button"
            className="settings-row-action"
            onClick={() => void handleRedeem()}
            disabled={redeeming || !code.trim()}
          >
            {redeeming ? "…" : "Redeem"}
          </button>
        </div>
      </div>
      {redeemMessage && <span className="settings-footnote settings-footnote--success">{redeemMessage}</span>}
      {redeemError && <span className="settings-footnote settings-footnote--warning">{redeemError}</span>}
    </div>
  );

  return (
    <div className="settings-pages membership-page">
      {error && <span className="settings-footnote settings-footnote--warning">{error}</span>}

      {effectiveTier === "free" ? (
        <>
          <div className="membership-hero">
            <span className="membership-hero__title">Consistency Premium</span>
            <span className="membership-hero__price">
              €9,99 <span>· one-time, yours forever</span>
            </span>
            {CAN_BUY_PREMIUM_HERE && (
              <Button variant="primary" className="membership-hero__cta" onClick={buyPremium}>
                Request Premium by email
              </Button>
            )}
          </div>

          <div className="settings-group-wrap">
            <div className="membership-compare">
              <div className="membership-compare__head">
                <span />
                <span>Free</span>
                <span className="membership-compare__premium-col">Premium</span>
              </div>
              {PERKS.map((perk) => {
                const Icon = perk.icon;
                return (
                  <div className="membership-compare__row" key={perk.label}>
                    <span className="membership-compare__perk">
                      <span className="settings-tile" style={{ "--tile-color": perk.color } as CSSProperties}>
                        <Icon size={15} />
                      </span>
                      <span className="membership-compare__perk-text">
                        {perk.label}
                        {perk.hint && <span className="membership-compare__hint">{perk.hint}</span>}
                      </span>
                    </span>
                    <span className="membership-compare__free">{perk.free}</span>
                    <span className="membership-compare__premium-col membership-compare__premium">
                      {perk.premium === "✓" ? <CheckIcon size={15} /> : perk.premium}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>

          {codeRow}
        </>
      ) : effectiveTier === "premium" ? (
        // "You're Premium" is the page's banner (SettingsModal).
        <>
          <div className="settings-group-wrap">
            <span className="settings-group__title">Included</span>
            <div className="settings-group settings-group--tiles">
              {PERKS.map((perk) => {
                const Icon = perk.icon;
                return (
                  <div className="settings-group__row" key={perk.label}>
                    <span className="settings-tile" style={{ "--tile-color": perk.color } as CSSProperties}>
                      <Icon size={15} />
                    </span>
                    <span className="settings-group__label membership-compare__perk-text">
                      {perk.label}
                      {perk.hint && <span className="membership-compare__hint">{perk.hint}</span>}
                    </span>
                    <span className="settings-group__value">
                      {perk.premium === "✓" ? "Unlocked" : perk.premium}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        </>
      ) : null}

      {effectiveTier === "admin" && <AdminMembersList online={online} onView={onViewMember} />}
    </div>
  );
}
