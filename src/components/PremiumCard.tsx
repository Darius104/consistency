import { CAN_BUY_PREMIUM_HERE } from "../premium";
import { Button } from "./ui/Button";
import { CheckIcon, CrownIcon, ShieldIcon } from "./ui/icons";
import "./PremiumCard.css";

// Premium's perks as shown in the "this is a Premium feature" popup
// (PremiumPaywallModal). Settings > Membership shows the same four as a
// Free vs Premium table (PERKS in MembershipSection) - update both when a
// perk changes.
export const PREMIUM_PERKS = [
  "Save your own task templates",
  "Unlock every day-panel widget",
  "Protect your streak with freeze days",
  "Connect with more than 1 friend",
];

interface PremiumUpsellCardProps {
  /** Shown as a small line above the card when it's reached by hitting a
   *  specific locked feature (PremiumPaywallModal) - omitted on the
   *  Membership page itself, where there's no specific trigger to name. */
  gatedFeature?: string;
  ctaLabel: string;
  onBuy: () => void;
}

/** No real checkout yet - "buy" just opens an email (see src/premium.ts).
 *  Swap that for a real checkout call whenever that changes; nothing here
 *  needs to know how someone actually became Premium. */
export function PremiumUpsellCard({ gatedFeature, ctaLabel, onBuy }: PremiumUpsellCardProps) {
  return (
    <>
      {gatedFeature && <p className="premium-card__gated">{gatedFeature} is a Premium feature.</p>}
      <div className="premium-card">
        <span className="premium-card__label">
          <CrownIcon size={13} /> Premium
        </span>
        <div className="premium-card__price-row">
          <span className="premium-card__price">€9,99</span>
        </div>
        <span className="premium-card__price-sub">One-time payment - lifetime access</span>

        <ul className="premium-card__perks">
          {PREMIUM_PERKS.map((perk) => (
            <li key={perk}>
              <span className="premium-card__perk-check">
                <CheckIcon size={11} />
              </span>
              {perk}
            </li>
          ))}
        </ul>

        {CAN_BUY_PREMIUM_HERE ? (
          <>
            <Button variant="primary" className="premium-card__button" onClick={onBuy}>
              {ctaLabel}
            </Button>
            <div className="premium-card__trust">
              <ShieldIcon size={13} />
              One-time purchase - yours forever.
            </div>
          </>
        ) : (
          <div className="premium-card__trust">Have a Premium code? Redeem it in Settings › Membership.</div>
        )}
      </div>
    </>
  );
}
