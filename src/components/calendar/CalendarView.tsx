import { useEffect, useState } from "react";
import type { PointerEvent as ReactPointerEvent } from "react";
import { invoke } from "@tauri-apps/api/core";
import type { Friend, MembershipTier } from "../../db/friends";
import type { Task } from "../../types";
import {
  buildMonthGrid,
  isSameMonth,
  parseDateKey,
  todayKey,
  WEEKDAY_LABELS,
} from "../../utils/dates";
import { dayCompletionRate } from "../../utils/stats";
import { tasksScheduledOn } from "../../utils/recurrence";
import { RefreshIcon } from "../ui/icons";
import { CalendarDay } from "./CalendarDay";
import { CalendarHeader } from "./CalendarHeader";
import "./CalendarView.css";

// Mobile pull-to-refresh lives here, not in the day panel below - this is
// the actual top of the app on a phone (the calendar never scrolls out of
// view above it), and unlike every reorderable row in the day panel, a
// calendar day cell has no competing touch gesture of its own to fight
// with, so a plain custom pointer-drag works without the WebKit
// touch-action complications a scrollable list would introduce.
const PULL_MAX_PX = 70;
const PULL_TRIGGER_PX = 50;
const PULL_RESISTANCE = 0.5;
// A tap has effectively zero movement, so only a real pull attempt (moved
// down past this) is treated as a gesture whose trailing click needs
// swallowing - a plain tap on a day cell is left completely alone.
const PULL_ENGAGE_PX = 10;

// The click that follows right after releasing an engaged pull started on a
// day cell would otherwise also fire that cell's own onSelect - this is
// added (once, capture-phase, directly on the element the gesture started
// on) only when that's actually happened, so it can stop that one click
// before it ever reaches the cell's React handler.
function suppressNextClick(ev: Event) {
  ev.preventDefault();
  ev.stopPropagation();
}

interface CalendarViewProps {
  tasks: Task[];
  completions: Set<string>;
  freezes: Set<string>;
  selectedDate: string;
  onSelectDate: (dateKey: string) => void;
  /** Omitted while viewing a friend's read-only calendar - see CalendarHeader. */
  tier?: MembershipTier;
  onOpenSettings?: () => void;
  onOpenPhrase?: () => void;
  phraseUnseen?: boolean;
  onSyncNow?: () => void;
  syncing?: boolean;
  onViewFriend?: (friend: Friend) => void;
  onlineFriendIds?: Set<string>;
  settingsBadgeCount?: number;
  friendNoteBadgeCount?: number;
}

export function CalendarView({
  tasks,
  completions,
  freezes,
  selectedDate,
  onSelectDate,
  tier,
  onOpenSettings,
  onOpenPhrase,
  phraseUnseen,
  onSyncNow,
  syncing,
  onViewFriend,
  settingsBadgeCount,
  friendNoteBadgeCount,
  onlineFriendIds,
}: CalendarViewProps) {
  const today = todayKey();
  const [cursor, setCursor] = useState(() => {
    const d = parseDateKey(selectedDate);
    return { year: d.getFullYear(), monthIndex: d.getMonth() };
  });

  const [pullDistance, setPullDistance] = useState(0);
  const [pullSettling, setPullSettling] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  // Collapses the pinned-open indicator once the triggered sync actually
  // finishes, rather than the instant you let go.
  useEffect(() => {
    if (refreshing && !syncing) {
      setRefreshing(false);
      setPullDistance(0);
    }
  }, [refreshing, syncing]);

  function handlePullPointerDown(e: ReactPointerEvent) {
    if (!onSyncNow || e.pointerType === "mouse" || refreshing) return;
    // A day cell (see CalendarDay.tsx) is itself a <button>, so it must be
    // excluded from this guard - otherwise starting the pull gesture on any
    // day (i.e. almost anywhere in the grid) would bail out before the pull
    // ever begins. The trailing click it would otherwise cause on release
    // is handled separately below (suppressNextClick), so excluding it here
    // is safe.
    if ((e.target as HTMLElement).closest("button:not(.cal-day), input, a, [data-no-drag]")) {
      return;
    }

    const syncNow = onSyncNow;
    const startY = e.clientY;
    const pointerId = e.pointerId;
    const startTarget = e.target as HTMLElement;
    let engaged = false;
    // So the "you can let go now" buzz fires once per crossing, not every
    // frame the pull sits past the trigger point - and can fire again if
    // the finger drifts back under the threshold and past it a second time.
    let pastTrigger = false;

    function onMove(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      const delta = ev.clientY - startY;
      if (delta <= 0) return; // not pulling down - leave taps/scrolls alone
      if (delta > PULL_ENGAGE_PX) engaged = true;
      ev.preventDefault();
      setPullSettling(false);
      const next = Math.min(PULL_MAX_PX, delta * PULL_RESISTANCE);
      setPullDistance(next);
      if (next >= PULL_TRIGGER_PX) {
        if (!pastTrigger) {
          pastTrigger = true;
          // No web Vibration API on iOS/WebKit - this goes straight to a
          // native haptic instead (see haptic_impact in src-tauri/src/lib.rs).
          invoke("haptic_impact").catch(() => {});
        }
      } else {
        pastTrigger = false;
      }
    }

    function onUp(ev: PointerEvent) {
      if (ev.pointerId !== pointerId) return;
      cleanup();
      if (engaged) {
        startTarget.addEventListener("click", suppressNextClick, { capture: true, once: true });
      }
      setPullSettling(true);
      setPullDistance((current) => {
        if (current >= PULL_TRIGGER_PX) {
          setRefreshing(true);
          syncNow();
          return PULL_TRIGGER_PX;
        }
        return 0;
      });
    }

    function cleanup() {
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
    }

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
  }

  const { weeks, monthLabel } = buildMonthGrid(cursor.year, cursor.monthIndex);

  function shiftMonth(delta: number) {
    setCursor(({ year, monthIndex }) => {
      const d = new Date(year, monthIndex + delta, 1);
      return { year: d.getFullYear(), monthIndex: d.getMonth() };
    });
  }

  function goToday() {
    const d = new Date();
    setCursor({ year: d.getFullYear(), monthIndex: d.getMonth() });
    onSelectDate(today);
  }

  return (
    <div className="cal-view" onPointerDown={handlePullPointerDown}>
      {onSyncNow && (
        <div className="cal-view__pull-indicator" aria-hidden="true">
          <RefreshIcon
            size={16}
            className={refreshing ? "cal-view__pull-icon--spinning" : ""}
            style={
              refreshing
                ? undefined
                : { transform: `rotate(${Math.min(1, pullDistance / PULL_TRIGGER_PX) * 180}deg)` }
            }
          />
        </div>
      )}
      {/* Slides down by the pull distance (a transform, not a size change) -
          the calendar's own box never resizes or squeezes its grid, it just
          reveals the indicator sitting behind it, then springs back on
          release. */}
      <div
        className={`cal-view__content ${pullSettling ? "cal-view__content--settling" : ""}`}
        style={pullDistance ? { transform: `translateY(${pullDistance}px)` } : undefined}
      >
        <CalendarHeader
          monthLabel={monthLabel}
          tier={tier}
          onPrev={() => shiftMonth(-1)}
          onNext={() => shiftMonth(1)}
          onToday={goToday}
          onOpenSettings={onOpenSettings}
          onOpenPhrase={onOpenPhrase}
          phraseUnseen={phraseUnseen}
          onSyncNow={onSyncNow}
          syncing={syncing}
          onViewFriend={onViewFriend}
          onlineFriendIds={onlineFriendIds}
          settingsBadgeCount={settingsBadgeCount}
          friendNoteBadgeCount={friendNoteBadgeCount}
        />
        <div className="cal-view__weekdays">
          {WEEKDAY_LABELS.map((label) => (
            <div key={label} className="cal-view__weekday">
              {label}
            </div>
          ))}
        </div>
        <div className="cal-view__grid">
          {weeks.flat().map((dateKey) => (
            <CalendarDay
              key={dateKey}
              dateKey={dateKey}
              dayNumber={parseDateKey(dateKey).getDate()}
              isCurrentMonth={isSameMonth(dateKey, cursor.year, cursor.monthIndex)}
              isToday={dateKey === today}
              isSelected={dateKey === selectedDate}
              hasTasks={tasksScheduledOn(tasks, dateKey).length > 0}
              completionRate={dayCompletionRate(tasks, completions, dateKey)}
              isFrozen={freezes.has(dateKey)}
              onSelect={onSelectDate}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
