import type { MembershipState } from "../../hooks/useMembership";
import { Card } from "../ui/Card";
import { TIER_LABEL } from "./MembershipSection";
import "./AdminPreviewSection.css";

interface AdminPreviewSectionProps {
  membership: MembershipState;
}

const PREVIEW_OPTIONS: { value: "admin" | "free" | "premium"; label: string }[] = [
  { value: "admin", label: "Admin (You)" },
  { value: "free", label: "Free" },
  { value: "premium", label: "Premium" },
];

/** Admin-only - this tab itself only ever appears in SettingsModal's
 *  section list when membership.actualTier === "admin", so getting here
 *  at all already implies that. Used to live inside Settings > Membership,
 *  split out into its own tab since it's a testing tool for you, not
 *  something that belongs mixed in with the actual membership/upsell UI. */
export function AdminPreviewSection({ membership }: AdminPreviewSectionProps) {
  const { effectiveTier, previewTier, setPreview } = membership;

  return (
    <Card>
      <span className="settings__label">Preview the app as</span>
      <span className="settings__hint">
        See exactly what a Free or Premium member sees, without changing your real account.
      </span>
      <div className="admin-preview__options">
        {PREVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            className={`admin-preview__btn ${
              effectiveTier === opt.value ? "admin-preview__btn--active" : ""
            }`}
            onClick={() => setPreview(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {previewTier && (
        <span className="settings__hint settings__hint--warning">
          Previewing as {TIER_LABEL[previewTier]} - only visible on this device, doesn't change
          your real account.
        </span>
      )}
    </Card>
  );
}
