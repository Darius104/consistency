import { PremiumUpsellCard } from "./PremiumCard";
import { buyPremium } from "../premium";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import "./PremiumPaywallModal.css";

interface PremiumPaywallModalProps {
  feature: string;
  onClose: () => void;
}

/** Shown whenever a Free account hits a gated action (see useMembership's
 *  isPremium + the gates in App.tsx) - the same PremiumUpsellCard used on
 *  Settings > Membership, just reached a different way (a specific locked
 *  feature here, vs. browsing to the Membership page directly there), so
 *  the two never look like two different products. */
export function PremiumPaywallModal({ feature, onClose }: PremiumPaywallModalProps) {
  return (
    <Modal title="Go Premium" onClose={onClose}>
      <div className="paywall">
        <PremiumUpsellCard gatedFeature={feature} ctaLabel="Buy Premium →" onBuy={buyPremium} />
        <Button className="paywall__later" onClick={onClose}>
          Maybe later
        </Button>
      </div>
    </Modal>
  );
}
