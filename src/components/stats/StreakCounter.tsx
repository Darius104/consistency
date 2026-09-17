import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { streakTier, type TodayStatus } from "../../utils/stats";
import { FrostIcon } from "../ui/icons";
import { Flame } from "./Flame";
import "./stats.css";

interface StreakCounterProps {
  streak: number;
  best: number;
  today: TodayStatus;
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

export function StreakCounter({ streak, best, today }: StreakCounterProps) {
  const t = streakTier(streak);
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

  // A second, distinct one-shot moment from the streak pop above - this
  // fires the instant *today* gets finished, which isn't always the same
  // event as the streak incrementing (a frozen day protects the streak
  // without needing every task done, so completing it afterward should
  // still feel like a small win of its own).
  const prevAllDone = useRef(today.allDone);
  const [barPop, setBarPop] = useState(false);

  useEffect(() => {
    if (today.allDone && !prevAllDone.current) {
      setBarPop(true);
      const timer = window.setTimeout(() => setBarPop(false), 500);
      prevAllDone.current = today.allDone;
      return () => window.clearTimeout(timer);
    }
    prevAllDone.current = today.allDone;
  }, [today.allDone]);

  const progressState = today.allDone ? "complete" : today.frozen ? "frozen" : "pending";

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
        <div
          className={`streak-hero__progress streak-hero__progress--${progressState} ${
            barPop ? "streak-hero__progress--pop" : ""
          }`}
          role="progressbar"
          aria-valuenow={Math.round(power * 100)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Today's progress"
        >
          <div className="streak-hero__progress-fill" style={{ width: `${power * 100}%` }} />
        </div>
        <div className={`streak-hero__status ${statusModifier(today)}`}>
          {statusMessage(streak, today)}
        </div>
      </div>
    </div>
  );
}
