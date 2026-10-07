import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { streakTier, type TodayStatus, type WeekDayState } from "../../utils/stats";
import { CheckIcon, FrostIcon } from "../ui/icons";
import { Flame } from "./Flame";
import "./stats.css";

interface StreakCounterProps {
  streak: number;
  best: number;
  today: TodayStatus;
}

const WEEK_LETTERS = ["M", "T", "W", "T", "F", "S", "S"];

const WEEK_STATE_LABELS: Record<WeekDayState, string> = {
  done: "done",
  frozen: "frozen",
  missed: "missed",
  today: "in progress",
  rest: "nothing scheduled",
  future: "upcoming",
};

/** One short line - the old full sentence was too much for a widget. */
function statusPill(today: TodayStatus): { text: ReactNode; tone: string } {
  if (today.frozen) {
    return {
      text: (
        <>
          <FrostIcon size={12} />
          Frozen today
        </>
      ),
      tone: "frozen",
    };
  }
  if (!today.hasTasks) return { text: "Rest day", tone: "quiet" };
  if (today.allDone) {
    return {
      text: (
        <>
          <CheckIcon size={12} />
          Done today
        </>
      ),
      tone: "complete",
    };
  }
  return { text: `${today.remaining} left today`, tone: "pending" };
}

export function StreakCounter({ streak, best, today }: StreakCounterProps) {
  const t = streakTier(streak);
  const isRecordStreak = streak > 0 && streak >= best;

  // How alive the flame looks - driven by today's completion, not the
  // streak (that's what the card's own cold/low/warm/hot/blazing tier
  // above is for). 0 tasks done today is a dim ember; all done is a
  // roaring fire. Resets every day along with `today` itself.
  //
  // Nothing scheduled or today already frozen both mean the streak isn't
  // actually at risk - those must render as a full, alive flame rather
  // than "0 done", or a perfectly safe day would look identical to one
  // where the streak is dying (see the freeze-suggestion modal's own
  // dying-flame animation, which relies on 0 meaning real danger).
  const power = !today.hasTasks || today.frozen ? 1 : today.completed / today.scheduled;

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

  const pill = statusPill(today);

  return (
    <div className={`streak-hero streak-hero--${t}`}>
      <div className="streak-hero__main">
        <div className="streak-hero__primary">
          <Flame power={power} />
          <div className="streak-hero__text">
            <span className={`streak-hero__value ${pop ? "streak-hero__value--pop" : ""}`}>
              {streak}
            </span>
            <span className="streak-hero__unit">
              day streak
              {best > 0 &&
                (isRecordStreak ? (
                  <span className="streak-hero__best streak-hero__best--record"> · Personal best</span>
                ) : (
                  <span className="streak-hero__best"> · Best {best}</span>
                ))}
            </span>
          </div>
        </div>
        <span
          className={`streak-hero__pill streak-hero__pill--${pill.tone} ${
            barPop ? "streak-hero__pill--pop" : ""
          }`}
        >
          {pill.text}
        </span>
      </div>

      <ol className="streak-hero__week" aria-label="This week">
        {today.week.map((day, i) => (
          <li
            key={day.date}
            className={`streak-hero__day streak-hero__day--${day.state}`}
            aria-label={`${day.date}: ${WEEK_STATE_LABELS[day.state]}`}
          >
            <span className="streak-hero__day-dot">
              {day.state === "done" && <CheckIcon size={10} />}
              {day.state === "frozen" && <FrostIcon size={10} />}
            </span>
            <span className="streak-hero__day-letter">{WEEK_LETTERS[i]}</span>
          </li>
        ))}
      </ol>

      {/* Desktop's narrower panel: status and best move down to one quiet
          line instead of crowding the number (the phone keeps the pill). */}
      <div className="streak-hero__footer">
        <span className={`streak-hero__footer-status streak-hero__footer-status--${pill.tone}`}>
          {pill.text}
        </span>
        {best > 0 && (
          <span className={`streak-hero__footer-best ${isRecordStreak ? "streak-hero__best--record" : ""}`}>
            {isRecordStreak ? "Personal best" : `Best ${best}`}
          </span>
        )}
      </div>
    </div>
  );
}
