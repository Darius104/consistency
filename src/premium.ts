// Shared by PremiumCard's two callers (Settings > Membership and
// PremiumPaywallModal) - there's no real checkout yet, "buying" just opens
// an email (see PremiumCard's own doc comment for why).
export const PREMIUM_BUY_URL = "mailto:comandarius@gmail.com?subject=Consistency%20Premium";

export function buyPremium(): void {
  window.open(PREMIUM_BUY_URL, "_blank");
}
