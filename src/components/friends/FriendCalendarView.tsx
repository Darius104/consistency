import { useEffect, useState } from "react";
import { fetchFriendCalendarData, type Friend, type FriendCalendarData } from "../../db/friends";
import type { Tag, Task } from "../../types";
import { parseDateKey, todayKey } from "../../utils/dates";
import { RANDOM_THEME_CSS_VARS, type RandomThemeColors } from "../../utils/randomTheme";
import { tasksScheduledOn } from "../../utils/recurrence";
import { computeLongestStreak, computeStreak, computeTodayStatus } from "../../utils/stats";
import { CalendarView } from "../calendar/CalendarView";
import "../day-panel/DayPanel.css";
import { TaskGroup } from "../day-panel/TaskGroup";
import { AvatarBadge } from "../stats/AvatarBadge";
import { StreakCounter } from "../stats/StreakCounter";
import { Button } from "../ui/Button";
import { ChevronDownIcon, ChevronLeftIcon, ChevronUpIcon } from "../ui/icons";
import { FriendTaskRow } from "./FriendTaskRow";
import "./FriendCalendarView.css";

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
    const active = data.theme === "random" ? data.randomColors : null;
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
          Viewing <strong>{friend.displayName}</strong>'s calendar (read-only)
        </span>
        <Button onClick={onBack} className="friend-view__back">
          <ChevronLeftIcon size={14} /> Back to your calendar
        </Button>
      </div>

      {loading && <div className="friend-view__status">Loading…</div>}

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
              friend={friend}
              data={data}
              selectedDate={selectedDate}
              collapsed={collapsed}
              onToggleGroup={toggleGroup}
              expanded={expanded}
              onToggleExpanded={() => setExpanded((v) => !v)}
            />
          </div>
        </div>
      )}
    </div>
  );
}

function FriendDayContent({
  friend,
  data,
  selectedDate,
  collapsed,
  onToggleGroup,
  expanded,
  onToggleExpanded,
}: {
  friend: Friend;
  data: FriendCalendarData;
  selectedDate: string;
  collapsed: Set<string>;
  onToggleGroup: (key: string) => void;
  expanded: boolean;
  onToggleExpanded: () => void;
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

  const groups = groupByTag(occurrences, data.tags);

  return (
    <>
      <div className="friend-view__profile">
        <AvatarBadge avatarId={data.avatarId} size={48} />
        <div className="friend-view__profile-text">
          <span className="friend-view__profile-name">{friend.displayName}</span>
          {data.bio && <span className="friend-view__profile-bio">{data.bio}</span>}
        </div>
      </div>
      <div className="friend-view__day-header">
        <button
          type="button"
          className="day-panel__expand-toggle"
          onClick={onToggleExpanded}
          aria-label={expanded ? "Collapse to show calendar" : "Expand to full screen"}
        >
          {expanded ? <ChevronDownIcon size={16} /> : <ChevronUpIcon size={16} />}
        </button>
        <h2 className="friend-view__date">{label}</h2>
      </div>
      <StreakCounter streak={streak} best={bestStreak} today={todayStatus} />
      {occurrences.length === 0 ? (
        <div className="friend-view__empty">Nothing scheduled for this day.</div>
      ) : (
        groups.map((group) => (
          <TaskGroup
            key={group.key}
            label={group.tag?.name ?? "No category"}
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
        ))
      )}
    </>
  );
}
