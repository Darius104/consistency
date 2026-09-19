import type { Friend, MembershipTier } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import { CrownIcon } from "../ui/icons";
import { AdminMembersList } from "./AdminMembersList";
import "./MembershipSection.css";

interface MembershipSectionProps {
  online: boolean;
  onViewMember: (friend: Friend) => void;
  membership: MembershipState;
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
export function MembershipSection({ online, onViewMember, membership }: MembershipSectionProps) {
  const { actualTier, effectiveTier, previewTier, setPreview, error } = membership;
  const isAdmin = actualTier === "admin";

  return (
    <div className="settings__section">
      <span className="settings__label">Membership</span>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}
      {effectiveTier && (
        <div className={`membership-badge membership-badge--${effectiveTier}`}>
          <CrownIcon size={18} />
          <div className="membership-badge__text">
            <span className="membership-badge__tier">{TIER_LABEL[effectiveTier]}</span>
            <span className="membership-badge__hint">{TIER_HINT[effectiveTier]}</span>
          </div>
        </div>
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
    </div>
  );
}
