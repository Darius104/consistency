import { Button } from "./ui/Button";
import { CheckIcon, CrownIcon, ShieldIcon, XIcon } from "./ui/icons";
import "./PremiumCard.css";

// The one place this app's Premium perks are listed - both the upsell
// card (Settings > Membership, and PremiumPaywallModal) and the paywall
// pull from here, so adding a perk never means updating it in two places.
// FreePlanCard's own list (below) is written to line up row-for-row with
// this one, so someone comparing the two side by side sees exactly what
// each perk becomes on Free vs. Premium, not just a vague "less".
export const PREMIUM_PERKS = [
  "Save your own task templates",
  "Unlock every day-panel widget",
  "Protect your streak with freeze days",
  "Connect with more than 1 friend",
];

const FREE_FEATURES: { label: string; included: boolean }[] = [
  { label: "1 day-panel widget", included: true },
  { label: "Connect with 1 friend", included: true },
  { label: "Save custom templates", included: false },
  { label: "Streak freeze protection", included: false },
];

/** Sits next to PremiumUpsellCard on Settings > Membership so a free
 *  member sees exactly what they have vs. what upgrading adds, instead of
 *  just a single "here's what you're missing" pitch. Purely informational
 *  - no button, since it's the plan they're already on. */
export function FreePlanCard() {
  return (
    <div className="premium-card premium-card--free">
      <span className="premium-card__label premium-card__label--free">Free</span>
      <div className="premium-card__price-row">
        <span className="premium-card__price">€0</span>
      </div>
      <span className="premium-card__price-sub">What you have now</span>

      <ul className="premium-card__perks">
        {FREE_FEATURES.map((f) => (
          <li key={f.label} className={f.included ? "" : "premium-card__perk--excluded"}>
            <span
              className={`premium-card__perk-check ${f.included ? "" : "premium-card__perk-check--excluded"}`}
            >
              {f.included ? <CheckIcon size={11} /> : <XIcon size={11} />}
            </span>
            {f.label}
          </li>
        ))}
      </ul>
    </div>
  );
}

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

        <Button variant="primary" className="premium-card__button" onClick={onBuy}>
          {ctaLabel}
        </Button>

        <div className="premium-card__trust">
          <ShieldIcon size={13} />
          One-time purchase - yours forever.
        </div>
      </div>
    </>
  );
}

/** Same card shell, recolored green with a pop-in checkmark - shown once
 *  someone already has Premium, so checking Settings > Membership confirms
 *  it rather than just repeating the pitch they've already accepted. */
export function PremiumActiveCard() {
  return (
    <div className="premium-card premium-card--active">
      <span className="premium-card__label premium-card__label--active">
        <CrownIcon size={13} /> Premium
      </span>

      <span className="premium-card__active-check">
        <CheckIcon size={24} />
      </span>
      <span className="premium-card__active-title">You have Premium</span>
      <span className="premium-card__price-sub">Thanks for supporting Consistency.</span>

      <ul className="premium-card__perks premium-card__perks--active">
        {PREMIUM_PERKS.map((perk) => (
          <li key={perk}>
            <span className="premium-card__perk-check premium-card__perk-check--active">
              <CheckIcon size={11} />
            </span>
            {perk}
          </li>
        ))}
      </ul>
    </div>
  );
}
