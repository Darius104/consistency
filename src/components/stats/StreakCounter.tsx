import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import type { TodayStatus } from "../../utils/stats";
import { FrostIcon } from "../ui/icons";
import { Flame } from "./Flame";
import "./stats.css";

interface StreakCounterProps {
  streak: number;
  best: number;
  today: TodayStatus;
  freezesRemaining: number;
}

function tier(streak: number): "cold" | "low" | "warm" | "hot" | "blazing" {
  if (streak === 0) return "cold";
  if (streak < 3) return "low";
  if (streak < 7) return "warm";
  if (streak < 30) return "hot";
  return "blazing";
}

function statusModifier(today: TodayStatus): string {
  if (today.frozen || !today.hasTasks) return "";
  if (today.allDone) return "streak-hero__status--complete";
  return "streak-hero__status--pending";
}

function statusMessage(streak: number, today: TodayStatus): ReactNode {
  if (today.frozen) {
    return (
      <>
        <FrostIcon size={12} className="streak-hero__inline-icon" />
        Today is frozen - streak protected either way.
      </>
    );
  }
  if (!today.hasTasks) {
    return streak > 0 ? "Nothing scheduled today - streak is safe." : "Nothing scheduled today.";
  }
  if (today.allDone) {
    return "All done for today. Streak secured.";
  }
  const noun = today.remaining === 1 ? "task" : "tasks";
  return (
    <>
      <span className="streak-hero__status-number">{today.remaining}</span>
      {` ${noun} left today to ${streak > 0 ? "keep the streak alive" : "start a streak"}.`}
    </>
  );
}

export function StreakCounter({
  streak,
  best,
  today,
  freezesRemaining,
}: StreakCounterProps) {
  const t = tier(streak);
  const isRecordStreak = streak > 0 && streak >= best;

  // How alive the flame looks - driven by today's completion, not the
  // streak (that's what the card's own cold/low/warm/hot/blazing tier
  // above is for). 0 tasks done today is a dim ember; all done is a
  // roaring fire. Resets every day along with `today` itself.
  const power = today.hasTasks ? today.completed / today.scheduled : 0;

  // Rare, once-a-day-at-most event (the streak only ever increments when a
  // day gets completed) - exactly the delight-tier moment this component
  // exists to earn, per the comment below on why it's the app's one
  // deliberately prominent element.
  const prevStreak = useRef(streak);
  const [pop, setPop] = useState(false);

  useEffect(() => {
    if (streak > prevStreak.current) {
      setPop(true);
      const timer = window.setTimeout(() => setPop(false), 380);
      prevStreak.current = streak;
      return () => window.clearTimeout(timer);
    }
    prevStreak.current = streak;
  }, [streak]);

  return (
    <div className={`streak-hero streak-hero--${t}`}>
      <div className="streak-hero__main">
        <div className="streak-hero__primary">
          <Flame power={power} />
          <div className={`streak-hero__value ${pop ? "streak-hero__value--pop" : ""}`}>
            {streak}
            <span className="streak-hero__unit">day streak</span>
          </div>
        </div>
        {best > 0 && (
          <div className="streak-hero__stats">
            <div className="streak-hero__stat">
              <span className="streak-hero__stat-value">{best}</span>
              <span
                className={`streak-hero__stat-label ${
                  isRecordStreak ? "streak-hero__stat-label--record" : ""
                }`}
              >
                {isRecordStreak ? "New best!" : "Best"}
              </span>
            </div>
          </div>
        )}
      </div>
      <div className="streak-hero__secondary">
        <div className={`streak-hero__status ${statusModifier(today)}`}>
          {statusMessage(streak, today)}
        </div>
        <div className="streak-hero__freezes">
          <FrostIcon size={12} className="streak-hero__inline-icon" />
          {freezesRemaining} freeze{freezesRemaining === 1 ? "" : "s"} left this month
        </div>
      </div>
    </div>
  );
}
