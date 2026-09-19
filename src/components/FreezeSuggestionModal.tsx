import { useEffect, useState } from "react";
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

// Same Flame used in the streak widget, driven continuously from full power
// down to exactly 0 (not just "low") over a few seconds via
// requestAnimationFrame - Flame.css only fades the fire fully out and shows
// pure smoke once power hits 0, so anything above that would still leave a
// flicker of fire visible at the end, undercutting "your streak is gone."
const BURN_DOWN_MS = 3200;

function formatDate(dateKey: string): string {
  return parseDateKey(dateKey).toLocaleDateString(undefined, {
    weekday: "long",
    month: "short",
    day: "numeric",
  });
}

/**
 * Shown once per missed day (see freezeSuggestionDate in App.tsx) in place
 * of a quiet banner - the dying flame is meant to actually communicate
 * urgency, not just inform.
 */
export function FreezeSuggestionModal({
  date,
  isPremium,
  onFreeze,
  onGoPremium,
  onClose,
}: FreezeSuggestionModalProps) {
  const [power, setPower] = useState(1);

  useEffect(() => {
    let raf: number;
    const start = performance.now();
    function tick(now: number) {
      const t = Math.min(1, (now - start) / BURN_DOWN_MS);
      setPower(1 - t);
      if (t < 1) raf = requestAnimationFrame(tick);
    }
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, []);

  return (
    <Modal title="Don't lose your streak" onClose={onClose}>
      <div className="freeze-modal">
        <div className="freeze-modal__flame">
          <Flame power={power} />
        </div>
        <p className="freeze-modal__message">You missed {formatDate(date)} - your streak is fading.</p>
        <p className="freeze-modal__sub">
          {isPremium
            ? "Use a freeze now to protect it before it's gone."
            : "Premium members can freeze a missed day to protect their streak."}
        </p>
        <div className="freeze-modal__actions">
          <Button onClick={onClose}>Maybe later</Button>
          <Button variant="primary" onClick={isPremium ? onFreeze : onGoPremium}>
            {isPremium ? "Freeze it" : "Go Premium"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
