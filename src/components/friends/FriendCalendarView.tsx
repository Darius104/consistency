import type { ReactNode } from "react";
import { useEffect, useState } from "react";
import {
  fetchFriendCalendarData,
  fetchFriendOfFriendStreaks,
  type Friend,
  type FriendCalendarData,
  type FriendOfFriendStreakData,
} from "../../db/friends";
import type { Tag, Task } from "../../types";
import { parseDateKey, startOfWeek, todayKey } from "../../utils/dates";
import type { PanelBlockId, WidgetId } from "../../utils/panelOrder";
import { getQuoteOfDay } from "../../utils/quotes";
import { RANDOM_THEME_CSS_VARS, type RandomThemeColors } from "../../utils/randomTheme";
import { tasksScheduledOn } from "../../utils/recurrence";
import {
  computeLongestStreak,
  computeStreak,
  computeTemplateBreakdown,
  computeTodayStatus,
  computeWeeklyCompletion,
  freezesRemainingInMonth,
  MAX_FREEZES_PER_MONTH,
} from "../../utils/stats";
import { CalendarView } from "../calendar/CalendarView";
import "../day-panel/DayPanel.css";
import { TaskGroup } from "../day-panel/TaskGroup";
import "../day-panel/TaskList.css";
import { AvatarBadge } from "../stats/AvatarBadge";
import { FreezeSummary } from "../stats/FreezeSummary";
import { FriendStreakCompare } from "../stats/FriendStreakCompare";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { Button } from "../ui/Button";
import { EmptyState } from "../ui/EmptyState";
import { CheckIcon, ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon, NoteIcon } from "../ui/icons";
import { Skeleton } from "../ui/Skeleton";
import { FriendTaskRow } from "./FriendTaskRow";
import { SendNoteModal } from "./SendNoteModal";
import "./FriendCalendarView.css";

// Every hideable widget is replicated here, in the friend's own order and
// visibility - this view is meant to be an exact mirror of what the friend
// sees on their own device, never gated on the *viewer's* membership tier
// (freezesRemainingInMonth is a flat monthly cap, not tier-dependent - a
// free member just never has any dates in `freezes` to begin with, so it
// renders correctly regardless of their tier either way). "friendStreaks"
// shows *their* friends and *their* streaks (via
// fetchFriendOfFriendStreaks), not the viewer's.
const REPLICABLE_WIDGET_IDS: PanelBlockId[] = [
  "streak",
  "weekly",
  "freezes",
  "templates",
  "quote",
  "friendStreaks",
];

interface FriendCalendarViewProps {
  friend: Friend;
  onBack: () => void;
}

const NO_TAG_KEY = "none";

interface Occurrence {
  task: Task;
  completed: boolean;
}

interface Group {
  key: string;
  tag: Tag | undefined;
  occurrences: Occurrence[];
}

function groupByTag(occurrences: Occurrence[], tags: Tag[]): Group[] {
  const tagById = new Map(tags.map((t) => [t.id, t]));
  const groupMap = new Map<string, Occurrence[]>();
  for (const occ of occurrences) {
    const key = occ.task.tagId ? String(occ.task.tagId) : NO_TAG_KEY;
    const bucket = groupMap.get(key);
    if (bucket) bucket.push(occ);
    else groupMap.set(key, [occ]);
  }
  return Array.from(groupMap.entries())
    .map(([key, groupOccurrences]) => ({
      key,
      tag: key === NO_TAG_KEY ? undefined : tagById.get(key),
      occurrences: [...groupOccurrences].sort(
        (a, b) => a.task.sortOrder - b.task.sortOrder || a.task.id.localeCompare(b.task.id),
      ),
    }))
    .sort((a, b) => {
      if (a.key === NO_TAG_KEY) return 1;
      if (b.key === NO_TAG_KEY) return -1;
      return (a.tag?.sortOrder ?? 0) - (b.tag?.sortOrder ?? 0);
    });
}

export function FriendCalendarView({ friend, onBack }: FriendCalendarViewProps) {
  const [data, setData] = useState<FriendCalendarData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [collapsed, setCollapsed] = useState<Set<string>>(new Set());
  // Mobile-only, mirrors the same expand/collapse toggle on your own day
  // panel (see App.tsx's dayPanelExpanded) - lets this panel take over the
  // whole screen instead of always sharing it with the compact calendar.
  const [expanded, setExpanded] = useState(false);
  const [sendingNote, setSendingNote] = useState(false);
  const [friendOfFriendStreaks, setFriendOfFriendStreaks] = useState<FriendOfFriendStreakData[]>(
    [],
  );
  const [friendStreaksLoading, setFriendStreaksLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    fetchFriendCalendarData(friend.userId)
      .then((result) => {
        if (!cancelled) setData(result);
      })
      .catch((err) => {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Couldn't load this calendar.");
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friend.userId]);

  // Separate from the main fetch above - the Friend Comparison widget is
  // decorative, and a slow or failed fetch for it shouldn't hold up (or
  // fail) showing the rest of the friend's calendar.
  useEffect(() => {
    let cancelled = false;
    setFriendStreaksLoading(true);
    fetchFriendOfFriendStreaks(friend.userId)
      .then((result) => {
        if (!cancelled) setFriendOfFriendStreaks(result);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFriendStreaksLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [friend.userId]);

  // Shows the friend's calendar in THEIR chosen colors, not yours - App.tsx
  // skips applying your own theme to the document for as long as this
  // component is mounted (see its own theme effects), so this is the only
  // thing touching data-theme/the random-theme CSS vars while viewing a
  // friend. Restores exactly what was there before on cleanup (unmount, or
  // if the friend's data ever refetches with a different theme).
  useEffect(() => {
    if (!data) return;
    const root = document.documentElement;
    const prevTheme = root.getAttribute("data-theme");
    const prevRandomVars = new Map<string, string>();
    for (const cssVar of Object.values(RANDOM_THEME_CSS_VARS)) {
      prevRandomVars.set(cssVar, root.style.getPropertyValue(cssVar));
    }

    root.setAttribute("data-theme", data.theme);
    const active =
      data.theme === "random" || data.theme === "custom" ? data.randomColors : null;
    for (const key of Object.keys(RANDOM_THEME_CSS_VARS) as (keyof RandomThemeColors)[]) {
      const cssVar = RANDOM_THEME_CSS_VARS[key];
      if (active) root.style.setProperty(cssVar, active[key]);
      else root.style.removeProperty(cssVar);
    }

    return () => {
      if (prevTheme) root.setAttribute("data-theme", prevTheme);
      else root.removeAttribute("data-theme");
      for (const [cssVar, value] of prevRandomVars) {
        if (value) root.style.setProperty(cssVar, value);
        else root.style.removeProperty(cssVar);
      }
    };
  }, [data]);

  function toggleGroup(key: string) {
    setCollapsed((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }

  return (
    <div className={`friend-view ${expanded ? "friend-view--day-expanded" : ""}`}>
      <div className="friend-view__bar">
        <span className="friend-view__bar-text">
          {/* Prefers the freshly-fetched name once loaded (data.displayName) over
              the Friends-list prop, which can be stale if they've renamed
              themselves since that list was last fetched - falls back to the
              prop only for the brief moment before this view's own fetch resolves. */}
          Viewing <strong>{data?.displayName ?? friend.displayName}</strong>'s calendar (read-only)
        </span>
        <div className="friend-view__bar-actions">
          <Button onClick={() => setSendingNote(true)} className="friend-view__send-note">
            <NoteIcon size={14} /> Send a note
          </Button>
          <Button onClick={onBack} className="friend-view__back">
            <ChevronLeftIcon size={14} /> Back to your calendar
          </Button>
        </div>
      </div>

      {loading && (
        <div className="friend-view__body">
          <div className="friend-view__calendar-skeleton">
            {Array.from({ length: 35 }).map((_, i) => (
              <Skeleton key={i} height="auto" />
            ))}
          </div>
          <div className="friend-view__divider" aria-hidden="true" />
          <div className="friend-view__day">
            <Skeleton height={64} radius="var(--radius-lg)" />
            <div className="friend-view__day-skeleton-rows">
              {[0, 1, 2].map((i) => (
                <Skeleton key={i} height={52} radius="var(--radius-md)" />
              ))}
            </div>
          </div>
        </div>
      )}

      {error && !loading && (
        <div className="friend-view__status friend-view__status--error">{error}</div>
      )}

      {data && !loading && !error && (
        <div className="friend-view__body">
          <CalendarView
            tasks={data.tasks}
            completions={data.completions}
            freezes={data.freezes}
            selectedDate={selectedDate}
            onSelectDate={setSelectedDate}
          />
          <div className="friend-view__divider" aria-hidden="true" />
          <div className="friend-view__day">
            <FriendDayContent
              data={data}
              selectedDate={selectedDate}
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((v) => !v)}
              friendOfFriendStreaks={friendOfFriendStreaks}
              friendStreaksLoading={friendStreaksLoading}
            />
          </div>
        </div>
      )}

      {sendingNote && (
        <SendNoteModal
          recipientId={friend.userId}
          recipientName={data?.displayName ?? friend.displayName}
          onClose={() => setSendingNote(false)}
        />
      )}
    </div>
  );
}

function FriendDayContent({
  data,
  selectedDate,
  collapsed,
  onToggleGroup,
  expanded,
  onToggleExpanded,
  friendOfFriendStreaks,
  friendStreaksLoading,
}: {
  data: FriendCalendarData;
  selectedDate: string;
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
  friendOfFriendStreaks: FriendOfFriendStreakData[];
  friendStreaksLoading: boolean;
}) {
  const label = parseDateKey(selectedDate).toLocaleDateString(undefined, {
    weekday: "short",
    month: "short",
    day: "numeric",
  });

  const occurrences: Occurrence[] = tasksScheduledOn(data.tasks, selectedDate).map((task) => ({
    task,
    completed: data.completions.has(`${task.id}:${selectedDate}`),
  }));

  const streak = computeStreak(data.tasks, data.completions, data.freezes, todayKey());
  const bestStreak = Math.max(
    streak,
    computeLongestStreak(data.tasks, data.completions, data.freezes, todayKey()),
  );
  const todayStatus = computeTodayStatus(data.tasks, data.completions, data.freezes, todayKey());
  const weekStart = startOfWeek(selectedDate);
  const weekly = computeWeeklyCompletion(data.tasks, data.completions, weekStart);
  const templateBreakdown = computeTemplateBreakdown(data.tasks, data.completions, weekStart);

  const groups = groupByTag(occurrences, data.tags);

  const friendStreakEntries = friendOfFriendStreaks.map((f) => ({
    userId: f.userId,
    displayName: f.displayName,
    avatarId: f.avatarId,
    streak: computeStreak(f.tasks, f.completions, f.freezes, todayKey()),
  }));

  // "tasks" is included here (unlike REPLICABLE_WIDGET_IDS, which only
  // covers the hideable widgets) so the task list renders in its actual
  // position in the friend's order - it's a fixed anchor in their own
  // panelOrder, not always last, so hardcoding it after every widget would
  // misplace it for anyone who's dragged it above one.
  const blocks: Partial<Record<PanelBlockId, ReactNode>> = {
    streak: <StreakCounter streak={streak} best={bestStreak} today={todayStatus} />,
    weekly: <WeeklyCompletion data={weekly} />,
    freezes: (
      <FreezeSummary
        remaining={freezesRemainingInMonth(data.freezes, selectedDate)}
        total={MAX_FREEZES_PER_MONTH}
      />
    ),
    templates: <TemplateBreakdown data={templateBreakdown} tags={data.tags} />,
    quote: <QuoteWidget quote={getQuoteOfDay(todayKey())} />,
    friendStreaks: (
      <FriendStreakCompare
        primaryStreak={streak}
        primaryAvatarId={data.avatarId}
        primaryLabel={data.displayName}
        friends={friendStreakEntries}
        loading={friendStreaksLoading}
        emptyMessage={`${data.displayName} hasn't added any friends yet.`}
      />
    ),
    tasks:
      occurrences.length === 0 ? (
        <EmptyState icon={<CheckIcon size={16} />} iconClassName="empty-state__icon--success">
          Nothing scheduled for this day.
        </EmptyState>
      ) : (
        // Bare siblings here have no spacing of their own (unlike TaskList,
        // which bakes its own gap in) - this reuses that same .task-list
        // gap so groups aren't left touching each other once they're
        // sitting inside .day-panel__block-content, which has none itself.
        <div className="task-list">
          {groups.map((group) => (
            <TaskGroup
              key={group.key}
              label={group.tag?.name ?? "No template"}
              color={group.tag?.color}
              totalCount={group.occurrences.length}
              doneCount={group.occurrences.filter((o) => o.completed).length}
              collapsed={collapsed.has(group.key)}
              onToggle={() => onToggleGroup(group.key)}
            >
              {group.occurrences.map(({ task, completed }) => (
                <FriendTaskRow key={task.id} task={task} completed={completed} />
              ))}
            </TaskGroup>
          ))}
        </div>
      ),
  };
  const visibleOrder = data.panelOrder.filter(
    (id) => id === "tasks" || (REPLICABLE_WIDGET_IDS.includes(id) && !data.hiddenWidgets.includes(id as WidgetId)),
  );

  return (
    <>
      <div className="day-panel__expand-toggle-wrap">
        <button
          type="button"
          className="day-panel__expand-toggle"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse to show calendar" : "Expand to full screen"}
        >
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
        </button>
      </div>
      <div className="friend-view__profile">
        <AvatarBadge avatarId={data.avatarId} size={48} />
        <div className="friend-view__profile-text">
          <span className="friend-view__profile-name">{data.displayName}</span>
          {data.bio && <span className="friend-view__profile-bio">{data.bio}</span>}
        </div>
      </div>
      <div className="friend-view__day-header">
        <h2 className="friend-view__date">{label}</h2>
      </div>
      {visibleOrder.map((id) => (
        <div className="day-panel__block" key={id}>
          <div className="day-panel__block-content">{blocks[id]}</div>
        </div>
      ))}
    </>
  );
}
