import { Button } from "./ui/Button";
import { CrownIcon } from "./ui/icons";
import { Modal } from "./ui/Modal";
import "./PremiumPaywallModal.css";

interface PremiumPaywallModalProps {
  feature: string;
  onClose: () => void;
}

const PERKS = ["Save your own task templates", "Unlock every day-panel widget", "Protect your streak with freeze days"];

/**
 * Shown whenever a Free account hits a gated action (see useMembership's
 * isPremium + the gates in App.tsx). No real checkout yet - "Buy Premium"
 * just opens an email, since there's no payment processing wired up (see
 * the plan this was built from: a placeholder until it's worth setting up
 * real billing). Swap that mailto for a real checkout call whenever that
 * changes - the rest of the gating logic doesn't need to know how someone
 * actually became Premium.
 */
export function PremiumPaywallModal({ feature, onClose }: PremiumPaywallModalProps) {
  return (
    <Modal title="Go Premium" onClose={onClose}>
      <div className="paywall">
        <div className="paywall__icon">
          <CrownIcon size={26} />
        </div>
        <p className="paywall__feature">{feature} is a Premium feature.</p>
        <ul className="paywall__perks">
          {PERKS.map((perk) => (
            <li key={perk}>{perk}</li>
          ))}
        </ul>
        <p className="paywall__price">One-time purchase - yours forever, no subscription.</p>
        <div className="paywall__actions">
          <Button onClick={onClose}>Maybe later</Button>
          <Button
            variant="primary"
            onClick={() =>
              window.open(
                "mailto:darius@islive.com?subject=Consistency%20Premium",
                "_blank",
              )
            }
          >
            Buy Premium
          </Button>
        </div>
      </div>
    </Modal>
  );
}
