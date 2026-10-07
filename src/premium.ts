import { isIOS } from "./utils/platform";

// Shared by PremiumCard's callers (Settings > Membership and
// PremiumPaywallModal) - there's no real checkout yet, "buying" just opens
// an email (see PremiumCard's own doc comment for why).
export const PREMIUM_BUY_URL = "mailto:comandarius@gmail.com?subject=Consistency%20Premium";

export function buyPremium(): void {
  window.open(PREMIUM_BUY_URL, "_blank");
}

/** Apple's App Store rules (guideline 3.1.1) only allow unlocking app
 *  features through their own in-app purchase - a button sending iPhone
 *  users to email/a website to buy Premium gets the app rejected. So on
 *  iOS there's no buy button at all, only "Have a code?". */
export const CAN_BUY_PREMIUM_HERE = !isIOS();
