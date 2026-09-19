import { Button } from "./ui/Button";
import { CheckIcon, CrownIcon } from "./ui/icons";
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
        <div className="paywall__icon-wrap">
          <span className="paywall__sparkle paywall__sparkle--1">✦</span>
          <span className="paywall__sparkle paywall__sparkle--2">✦</span>
          <span className="paywall__sparkle paywall__sparkle--3">✦</span>
          <div className="paywall__icon">
            <CrownIcon size={28} />
          </div>
        </div>
        <p className="paywall__feature">{feature} is a Premium feature.</p>
        <ul className="paywall__perks">
          {PERKS.map((perk, i) => (
            <li key={perk} style={{ animationDelay: `${120 + i * 90}ms` }}>
              <span className="paywall__perk-check">
                <CheckIcon size={12} />
              </span>
              {perk}
            </li>
          ))}
        </ul>
        <div className="paywall__price">
          <span className="paywall__price-badge">One-time purchase</span>
          <span className="paywall__price-sub">Yours forever - never a subscription.</span>
        </div>
        <div className="paywall__actions">
          <Button onClick={onClose}>Maybe later</Button>
          <Button
            variant="primary"
            className="paywall__buy"
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
