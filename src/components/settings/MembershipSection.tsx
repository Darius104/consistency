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

const PREVIEW_KEY = "consistency:membershipPreviewTier";

function loadPreview(): "free" | "premium" | null {
  try {
    const v = localStorage.getItem(PREVIEW_KEY);
    return v === "free" || v === "premium" ? v : null;
  } catch {
    return null;
  }
}

const PREVIEW_OPTIONS: { value: "admin" | "free" | "premium"; label: string }[] = [
  { value: "admin", label: "Admin (You)" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

/**
 * Read-only for now - there's no self-service billing yet (see
 * supabase/membership_schema.sql), so nothing here can change your real
 * tier. Self-contained like AppUpdateSection, since App.tsx has no other
 * reason to know a user's membership tier yet.
 *
 * Admins additionally get a local-only "preview as" toggle, so you can see
 * what Free/Premium looks like without actually changing your own account
 * (which would also be visible to anyone who can see your profile). It's
 * stored in localStorage rather than the database on purpose - it's a
 * per-device viewing preference, not real account state, and it only ever
 * takes effect on top of an *actual* admin tier (see effectiveTier below).
 */
export function MembershipSection() {
  const [actualTier, setActualTier] = useState<MembershipTier | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [previewTier, setPreviewTier] = useState<"free" | "premium" | null>(loadPreview);

  useEffect(() => {
    let cancelled = false;
    getMyMembership()
      .then((result) => {
        if (!cancelled) setActualTier(result);
      })
      .catch((err) => {
        if (!cancelled) setError(err instanceof Error ? err.message : String(err));
      });
    return () => {
      cancelled = true;
    };
  }, []);

  function setPreview(next: "admin" | "free" | "premium") {
    const value = next === "admin" ? null : next;
    setPreviewTier(value);
    try {
      if (value) localStorage.setItem(PREVIEW_KEY, value);
      else localStorage.removeItem(PREVIEW_KEY);
    } catch {
      // Best-effort - a preview that doesn't persist across restarts is fine.
    }
  }

  const isAdmin = actualTier === "admin";
  const effectiveTier = isAdmin ? (previewTier ?? "admin") : actualTier;

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

      {effectiveTier === "admin" && <AdminMembersList />}
    </div>
  );
}
