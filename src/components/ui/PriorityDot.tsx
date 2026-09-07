import type { Priority } from "../../types";
import "./PriorityDot.css";

const LABEL: Record<Priority, string> = {
  low: "Low",
  medium: "Medium",
  high: "High",
};

const LETTER: Record<Priority, string> = {
  low: "L",
  medium: "M",
  high: "H",
};

// Color-coded but never color-only: the letter carries the same
// information for colorblind users and at a glance in a busy list.
export function PriorityDot({ priority }: { priority: Priority }) {
  return (
    <span
      className={`priority-badge priority-badge--${priority}`}
      title={`${LABEL[priority]} priority`}
      aria-label={`${LABEL[priority]} priority`}
    >
      {LETTER[priority]}
    </span>
  );
}
