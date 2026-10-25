import type { MembershipState } from "../../hooks/useMembership";
import { TIER_LABEL } from "./MembershipSection";

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
    <div className="settings-group-wrap">
      <span className="settings-group__title">Preview the app as</span>
      <div className="settings-segmented" role="radiogroup" aria-label="Preview the app as">
        {PREVIEW_OPTIONS.map((opt) => (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={effectiveTier === opt.value}
            className={`settings-segmented__option ${
              effectiveTier === opt.value ? "settings-segmented__option--active" : ""
            }`}
            onClick={() => setPreview(opt.value)}
          >
            {opt.label}
          </button>
        ))}
      </div>
      {previewTier ? (
        <span className="settings-footnote settings-footnote--warning">
          Previewing as {TIER_LABEL[previewTier]} - only on this device, your real account
          doesn't change.
        </span>
      ) : (
        <span className="settings-footnote">
          See exactly what a Free or Premium member sees, without changing your real account.
        </span>
      )}
    </div>
  );
}
