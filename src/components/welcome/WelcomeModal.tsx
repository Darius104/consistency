import { useState } from "react";
import type { CSSProperties } from "react";
import type { NewTask } from "../../types";
import { Button } from "../ui/Button";
import { CheckIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import "./WelcomeModal.css";

type StarterTask = Omit<NewTask, "tagId" | "startDate">;

export interface StarterPack {
  id: string;
  name: string;
  color: string;
  emoji: string;
  summary: string;
  tasks: StarterTask[];
}

const daily = (title: string, time: string | null = null): StarterTask => ({
  title,
  time,
  priority: "medium",
  recurrenceType: "daily",
});

// Ready-made groups a new account can start from in one tap - each becomes
// a real template group (a tag) with repeating tasks, all editable after.
export const STARTER_PACKS: StarterPack[] = [
  {
    id: "morning",
    name: "Morning routine",
    color: "#f59e0b",
    emoji: "☀️",
    summary: "Water, make the bed, stretch",
    tasks: [daily("Drink a glass of water", "07:00"), daily("Make your bed"), daily("10 minutes of stretching")],
  },
  {
    id: "workout",
    name: "Workout",
    color: "#22c55e",
    emoji: "💪",
    summary: "Train Mon, Wed and Fri",
    tasks: [
      { title: "Workout - 30 minutes", time: "18:00", priority: "medium", recurrenceType: "weekly", recurrenceDays: [1, 3, 5] },
    ],
  },
  {
    id: "trading",
    name: "Trading",
    color: "#3b82f6",
    emoji: "📈",
    summary: "Prepare, follow the plan, journal",
    tasks: [
      daily("Review the market before the open", "08:30"),
      daily("Only take trades from my plan"),
      daily("Journal today's trades", "18:00"),
    ],
  },
];

interface WelcomeModalProps {
  onStart: (packs: StarterPack[]) => Promise<void>;
  onClose: () => void;
}

/** First run only (a brand-new, empty account - see App.tsx): pick one or
 *  more starter groups so the first screen isn't an empty calendar, or
 *  start empty. */
export function WelcomeModal({ onStart, onClose }: WelcomeModalProps) {
  const [picked, setPicked] = useState<Set<string>>(new Set(["morning"]));
  const [busy, setBusy] = useState(false);

  function toggle(id: string) {
    setPicked((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  async function start() {
    setBusy(true);
    try {
      await onStart(STARTER_PACKS.filter((p) => picked.has(p.id)));
    } finally {
      setBusy(false);
    }
  }

  return (
    <Modal title="Welcome to Consistency" onClose={onClose}>
      <div className="welcome">
        <p className="welcome__intro">
          Build habits one day at a time. Pick a few to start with - you can change everything later.
        </p>

        <div className="welcome__packs">
          {STARTER_PACKS.map((pack) => {
            const on = picked.has(pack.id);
            return (
              <button
                type="button"
                key={pack.id}
                className={`welcome__pack ${on ? "welcome__pack--on" : ""}`}
                style={{ "--pack-color": pack.color } as CSSProperties}
                aria-pressed={on}
                onClick={() => toggle(pack.id)}
              >
                <span className="welcome__emoji" aria-hidden="true">
                  {pack.emoji}
                </span>
                <span className="welcome__pack-text">
                  <span className="welcome__pack-name">{pack.name}</span>
                  <span className="welcome__pack-summary">{pack.summary}</span>
                </span>
                <span className="welcome__check" aria-hidden="true">
                  {on && <CheckIcon size={13} />}
                </span>
              </button>
            );
          })}
        </div>

        <Button
          variant="primary"
          className="welcome__start"
          onClick={() => void start()}
          disabled={busy || picked.size === 0}
        >
          {busy ? "Setting up…" : picked.size === 0 ? "Pick at least one" : "Get started"}
        </Button>
        <button type="button" className="welcome__empty" onClick={onClose} disabled={busy}>
          Start with an empty calendar
        </button>
      </div>
    </Modal>
  );
}
