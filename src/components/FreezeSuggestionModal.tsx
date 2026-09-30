import { Flame } from "./stats/Flame";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { parseDateKey } from "../utils/dates";
import "./FreezeSuggestionModal.css";

interface FreezeSuggestionModalProps {
  date: string;
  isPremium: boolean;
  onFreeze: () => void;
  onGoPremium: () => void;
  onClose: () => void;
}

function formatDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Shown once per missed day (see freezeSuggestionDate in App.tsx). The
 * flame sits in a small badge already out (power 0), the same way every
 * other special-purpose modal in Settings (Donate's heart, Membership's
 * crown) uses a modest icon to identify what this is about - the message
 * itself carries the urgency, not an oversized centerpiece graphic.
 */
export function FreezeSuggestionModal({
  date,
  isPremium,
  onFreeze,
  onGoPremium,
  onClose,
}: FreezeSuggestionModalProps) {
  return (
    <Modal title="Don't lose your streak" onClose={onClose}>
      <div className="freeze-modal">
        <div className="freeze-modal__badge">
          <Flame power={0} />
        </div>
        <span className="freeze-modal__eyebrow">Streak at risk</span>
        <p className="freeze-modal__message">You missed {formatDate(date)}.</p>
        <p className="freeze-modal__sub">
          {isPremium
            ? "Use a freeze now to protect it before it's gone."
            : "Premium members can freeze a missed day to protect their streak."}
        </p>
        <div className="freeze-modal__actions">
          <Button onClick={onClose}>Maybe later</Button>
          <Button
            variant="primary"
            className="freeze-modal__freeze-btn"
            onClick={isPremium ? onFreeze : onGoPremium}
          >
            {isPremium ? "Freeze it" : "Go Premium"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
