import { useEffect, useMemo, useState } from "react";
import { AuthScreen } from "./auth/AuthScreen";
import { useSession } from "./auth/useSession";
import { CalendarView } from "./components/calendar/CalendarView";
import { PhraseModal } from "./components/calendar/PhraseModal";
import { DayPanel } from "./components/day-panel/DayPanel";
import { NoteForm } from "./components/day-panel/NoteForm";
import { TaskViewModal } from "./components/day-panel/TaskViewModal";
import { supabase } from "./lib/supabaseClient";
import { clearAllCache } from "./db/localCache";
import { ensureProfile, syncMyThemeToProfile, type Friend } from "./db/friends";
import { onSyncComplete, trySync } from "./sync";
import { useOnlineStatus } from "./hooks/useOnlineStatus";
import { useRealtimeSync } from "./hooks/useRealtimeSync";
import { usePresence } from "./hooks/usePresence";
import { FreezeSuggestionModal } from "./components/FreezeSuggestionModal";
import { OfflineBanner } from "./components/OfflineBanner";
import { PremiumPaywallModal } from "./components/PremiumPaywallModal";
import { TaskDeletedToast } from "./components/TaskDeletedToast";
import { WriteErrorToast } from "./components/WriteErrorToast";
import { FriendCalendarView } from "./components/friends/FriendCalendarView";
import { SettingsModal } from "./components/settings/SettingsModal";
import { TaskForm } from "./components/task-form/TaskForm";
import { ConfirmModal } from "./components/ui/ConfirmModal";
import {
  addStreakFreeze,
  applyTemplate,
  createNote,
  createTag,
  createTask,
  createTemplateFromTasks,
  deleteNote,
  deleteTag,
  deleteTask,
  deleteTemplate,
  getAllCompletions,
  getAllNotes,
  getAllTasks,
  getSetting,
  getStreakFreezes,
  getTags,
  getTemplates,
  getTemplateTasks,
  removeStreakFreeze,
  restoreTask,
  setCompletion,
  setSetting,
  updateNote,
  updateNotePositions,
  updateTag,
  updateTagOrder,
  updateTask,
  updateTaskOrder,
} from "./db/queries";
import type { DayNote, NewTask, Tag, Task, Template, TemplateTaskBlueprint, ThemeId } from "./types";
import { addDays, startOfWeek, todayKey } from "./utils/dates";
import { tasksScheduledOn } from "./utils/recurrence";
import {
  computeTemplateBreakdown,
  computeLongestStreak,
  computeStreak,
  computeTodayStatus,
  computeWeeklyCompletion,
  freezesRemainingInMonth,
  getFreezeCandidates,
} from "./utils/stats";
import { DEFAULT_THEME } from "./utils/themes";
import {
  generateRandomThemeColors,
  RANDOM_THEME_CSS_VARS,
  type RandomThemeColors,
} from "./utils/randomTheme";
import { getQuoteOfDay } from "./utils/quotes";
import {
  DEFAULT_PANEL_ORDER,
  parsePanelOrder,
  parseHiddenWidgets,
  FREE_WIDGET_LIMIT,
  WIDGET_IDS,
  type PanelBlockId,
  type WidgetId,
} from "./utils/panelOrder";
import { useTaskReminders } from "./hooks/useTaskReminders";
import { useMembership } from "./hooks/useMembership";
import { useSupportBadgeCount } from "./hooks/useSupportBadgeCount";
import { useFriendNotes } from "./hooks/useFriendNotes";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { UpdateAvailableModal } from "./components/UpdateAvailableModal";
import "./App.css";

const THEME_SETTING_KEY = "theme";
const RANDOM_THEME_SETTING_KEY = "randomThemeColors";
const REMINDERS_SETTING_KEY = "remindersEnabled";
const PANEL_ORDER_SETTING_KEY = "panelOrder";
const HIDDEN_WIDGETS_SETTING_KEY = "hiddenWidgets";
const PHRASE_VIEW_SETTING_KEY = "lastPhraseViewDate";
const FREEZE_SUGGESTION_DISMISSED_KEY = "freezeSuggestionDismissedDate";

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  // Keyed by template id - loaded whenever `templates` changes so the day
  // panel can tell "this tag has a template" apart from "today's
  // tasks for this tag actually still match it" (see TaskList.tsx's
  // hasTemplate computation).
  const [templateTaskBlueprints, setTemplateTaskBlueprints] = useState<
    Record<string, TemplateTaskBlueprint[]>
  >({});
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [freezes, setFreezes] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [selectedDate, setSelectedDate] = useState(todayKey());
  // Only meaningful on phone-sized screens (see the max-width:700px query in
  // CalendarView.css/App.css) - lets the day panel take over the whole
  // screen instead of always sharing it with the compact calendar above.
  const [dayPanelExpanded, setDayPanelExpanded] = useState(false);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [randomColors, setRandomColors] = useState<RandomThemeColors | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [panelOrder, setPanelOrder] = useState<PanelBlockId[]>(DEFAULT_PANEL_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>([]);
  const [arranging, setArranging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phraseModalOpen, setPhraseModalOpen] = useState(false);
  const [lastPhraseViewDate, setLastPhraseViewDate] = useState<string | null>(null);
  const [freezeSuggestionDismissedDate, setFreezeSuggestionDismissedDate] = useState<
    string | null
  >(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [formState, setFormState] = useState<
    { open: false } | { open: true; task?: Task }
  >({ open: false });
  const [noteFormState, setNoteFormState] = useState<
    { open: false } | { open: true; note?: DayNote }
  >({ open: false });
  // Non-null while confirming a task deletion - both the row's quick delete
  // button and the task form's own Delete button set this instead of
  // deleting immediately, so both paths get the same confirmation step.
  // Desktop-width windows skip this entirely (see handleRequestDeleteTask) -
  // a deliberate click on the small trash icon is unlikely to be
  // accidental the way a touch tap/swipe is, and deleting several tasks in
  // a row without a modal per task is exactly what desktop users asked for.
  const [pendingDeleteTask, setPendingDeleteTask] = useState<Task | null>(null);
  // Non-null right after a desktop delete went through without confirmation
  // - shows the Undo toast for a few seconds instead of a modal beforehand.
  const [deletedTaskUndo, setDeletedTaskUndo] = useState<Task | null>(null);
  // Same confirmation step for notes - free-typed content is just as easy
  // to lose to a stray tap as a task, and previously had no confirmation
  // at all, unlike every task-deletion path.
  const [pendingDeleteNote, setPendingDeleteNote] = useState<DayNote | null>(null);
  // Non-null while looking at a friend's read-only calendar instead of your
  // own - never persisted, always starts back at null (your own calendar)
  // on a fresh launch.
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);

  const { session } = useSession();
  const { online, syncing, syncNow } = useOnlineStatus(!!session);
  useRealtimeSync(session?.user.id ?? null);
  const onlineFriendIds = usePresence(session?.user.id ?? null);

  useEffect(() => {
    if (!session) return;
    void refreshAll();
    // Covers both cold start (empty cache, first sign-in on this device)
    // and switching accounts without restarting the app - useOnlineStatus's
    // own mount-time sync only ever fires once per app lifetime.
    void trySync();
    // A no-op after the first time (it never overwrites a name you've since
    // customized) - safe to just call unconditionally every session.
    void ensureProfile();
  }, [session]);

  // Re-reads from the cache into React state whenever a background sync
  // actually pulls fresh data (a queued write flushing, a reconnect, etc.)
  // - not just in response to a user action in this window.
  useEffect(() => onSyncComplete(() => void refreshAll()), []);

  useEffect(() => {
    let cancelled = false;
    Promise.all(templates.map((t) => getTemplateTasks(t.id).then((tasks) => [t.id, tasks] as const)))
      .then((entries) => {
        if (!cancelled) setTemplateTaskBlueprints(Object.fromEntries(entries));
      })
      .catch(() => {
        // Best-effort - a stale/missing entry here just means hasTemplate
        // falls back to "no template" for that tag, not a crash.
      });
    return () => {
      cancelled = true;
    };
  }, [templates]);

  // Skipped while viewing a friend's calendar - FriendCalendarView takes over
  // applying (and restoring) the document's theme for that duration instead,
  // since it needs to show the friend's colors, not your own.
  useEffect(() => {
    if (viewingFriend) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, viewingFriend]);

  // The eight hand-picked themes are static [data-theme] blocks in
  // tokens.css; "random" has no such block, so its colors are applied
  // directly as inline custom properties instead - and cleared again the
  // moment a real theme is picked, so its static block takes back over.
  useEffect(() => {
    if (viewingFriend) return;
    const root = document.documentElement.style;
    const active = theme === "random" ? randomColors : null;
    for (const key of Object.keys(RANDOM_THEME_CSS_VARS) as (keyof RandomThemeColors)[]) {
      const cssVar = RANDOM_THEME_CSS_VARS[key];
      if (active) root.setProperty(cssVar, active[key]);
      else root.removeProperty(cssVar);
    }
  }, [theme, randomColors, viewingFriend]);

  const reminderStatus = useTaskReminders(tasks, completions, remindersEnabled);

  const membership = useMembership();
  const { count: supportBadgeCount, refresh: refreshSupportBadge } = useSupportBadgeCount(
    membership.effectiveTier === "admin",
  );
  const { notes: friendNotes, dismiss: dismissFriendNote } = useFriendNotes();
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  // Desktop-only (see useAppUpdater's own doc comment) - checked once on
  // launch here; Settings also exposes a manual "Check for updates" using
  // the same hook. Dismissing ("Later") is tracked by version, not just a
  // boolean, so dismissing this update doesn't also hide a newer one that
  // shows up on a later check within the same session.
  const appUpdater = useAppUpdater();
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<string | null>(null);
  const pendingUpdate =
    appUpdater.update && appUpdater.update.version !== dismissedUpdateVersion
      ? appUpdater.update
      : null;

  // computeStreak/computeLongestStreak walk every day from the earliest
  // task's start date to today - that scales with how long this account has
  // existed, not how many tasks it has, and App re-renders on almost any
  // state change (toggling a single task, opening a modal, ...). Memoized so
  // that full walk only re-runs when the inputs that could actually change
  // its result do. Placed here (with the other hooks, before any early
  // return below) rather than down near where streak is used, since Hooks
  // can't be called conditionally.
  const today = todayKey();
  const streak = useMemo(
    () => computeStreak(tasks, completions, freezes, today),
    [tasks, completions, freezes, today],
  );
  const bestStreak = useMemo(
    () => Math.max(streak, computeLongestStreak(tasks, completions, freezes, today)),
    [streak, tasks, completions, freezes, today],
  );

  async function refreshAll() {
    const [
      taskRows,
      tagRows,
      templateRows,
      completionRows,
      freezeRows,
      noteRows,
      savedTheme,
      savedRandomColors,
      savedReminders,
      savedPanelOrder,
      savedHiddenWidgets,
      savedPhraseViewDate,
      savedFreezeSuggestionDismissedDate,
    ] = await Promise.all([
      getAllTasks(),
      getTags(),
      getTemplates(),
      getAllCompletions(),
      getStreakFreezes(),
      getAllNotes(),
      getSetting(THEME_SETTING_KEY),
      getSetting(RANDOM_THEME_SETTING_KEY),
      getSetting(REMINDERS_SETTING_KEY),
      getSetting(PANEL_ORDER_SETTING_KEY),
      getSetting(HIDDEN_WIDGETS_SETTING_KEY),
      getSetting(PHRASE_VIEW_SETTING_KEY),
      getSetting(FREEZE_SUGGESTION_DISMISSED_KEY),
    ]);
    setTasks(taskRows);
    setTags(tagRows);
    setTemplates(templateRows);
    setCompletions(completionRows);
    setFreezes(freezeRows);
    setNotes(noteRows);
    const resolvedTheme = savedTheme ? (savedTheme as ThemeId) : DEFAULT_THEME;
    const resolvedRandomColors = savedRandomColors ? JSON.parse(savedRandomColors) : null;
    if (savedTheme) setTheme(resolvedTheme);
    if (savedRandomColors) setRandomColors(resolvedRandomColors);
    if (savedReminders !== null) setRemindersEnabled(savedReminders === "true");
    setPanelOrder(parsePanelOrder(savedPanelOrder));
    setHiddenWidgets(parseHiddenWidgets(savedHiddenWidgets));
    setLastPhraseViewDate(savedPhraseViewDate);
    setFreezeSuggestionDismissedDate(savedFreezeSuggestionDismissedDate);
    setLoading(false);
    // Covers accounts whose theme was already set before profiles/friends
    // existed - not just future changes via handleChangeTheme below.
    void syncMyThemeToProfile(resolvedTheme, resolvedRandomColors).catch(() => {});
  }

  async function handleSignOut() {
    await supabase.auth.signOut();
    // A different account signing in on this same device must never see
    // this account's cached rows or replay its queued writes.
    await clearAllCache();
    // Otherwise a different account signing in without an app restart could
    // be left pointed at the previous account's friend.
    setViewingFriend(null);
  }

  // Called after DeleteAccountModal's own delete_my_account() RPC already
  // succeeded server-side - this just tidies up the now-invalid local
  // session/cache exactly like signing out does, since the account (and
  // the session token's own backing row) no longer exists either way.
  async function handleAccountDeleted() {
    await supabase.auth.signOut();
    await clearAllCache();
    setViewingFriend(null);
    setSettingsOpen(false);
  }

  async function handleOpenPhrase() {
    setPhraseModalOpen(true);
    setLastPhraseViewDate(todayKey());
    await setSetting(PHRASE_VIEW_SETTING_KEY, todayKey());
  }

  async function handleDismissFreezeSuggestion(date: string) {
    setFreezeSuggestionDismissedDate(date);
    await setSetting(FREEZE_SUGGESTION_DISMISSED_KEY, date);
  }

  async function handleChangeTheme(next: ThemeId) {
    setTheme(next);
    await setSetting(THEME_SETTING_KEY, next);

    // Re-rolls every time "random" is picked, even if it's already active -
    // that's the whole point of it being random rather than just one more
    // fixed swatch.
    let nextRandomColors: RandomThemeColors | null = null;
    if (next === "random") {
      nextRandomColors = generateRandomThemeColors();
      setRandomColors(nextRandomColors);
      await setSetting(RANDOM_THEME_SETTING_KEY, JSON.stringify(nextRandomColors));
    }
    await syncMyThemeToProfile(next, nextRandomColors);
  }

  async function handleChangeRemindersEnabled(next: boolean) {
    setRemindersEnabled(next);
    await setSetting(REMINDERS_SETTING_KEY, String(next));
  }

  async function handleReorderPanel(next: PanelBlockId[]) {
    setPanelOrder(next);
    await setSetting(PANEL_ORDER_SETTING_KEY, JSON.stringify(next));
  }

  async function handleHideWidget(id: WidgetId) {
    const next = hiddenWidgets.includes(id) ? hiddenWidgets : [...hiddenWidgets, id];
    setHiddenWidgets(next);
    await setSetting(HIDDEN_WIDGETS_SETTING_KEY, JSON.stringify(next));
  }

  async function handleShowWidget(id: WidgetId) {
    const next = hiddenWidgets.filter((w) => w !== id);
    const visibleCount = WIDGET_IDS.length - next.length;
    if (!membership.isPremium && visibleCount > FREE_WIDGET_LIMIT) {
      setPaywallFeature("More widgets");
      return;
    }
    setHiddenWidgets(next);
    await setSetting(HIDDEN_WIDGETS_SETTING_KEY, JSON.stringify(next));
  }

  function handleStartArranging() {
    setArranging(true);
    setSettingsOpen(false);
  }

  async function handleToggle(task: Task) {
    const key = `${task.id}:${selectedDate}`;
    const nextCompleted = !completions.has(key);
    setCompletions((prev) => {
      const next = new Set(prev);
      if (nextCompleted) next.add(key);
      else next.delete(key);
      return next;
    });
    await setCompletion(task.id, selectedDate, nextCompleted);
  }

  async function handleFreezeDay(date: string) {
    if (!membership.isPremium) {
      setPaywallFeature("Streak freezes");
      return;
    }
    if (freezesRemainingInMonth(freezes, date) === 0) return;
    setFreezes((prev) => new Set(prev).add(date));
    await addStreakFreeze(date);
  }

  async function handleUnfreezeDay(date: string) {
    setFreezes((prev) => {
      const next = new Set(prev);
      next.delete(date);
      return next;
    });
    await removeStreakFreeze(date);
  }

  async function handleSaveTask(data: NewTask) {
    if (formState.open && formState.task) {
      await updateTask(formState.task.id, data);
    } else {
      await createTask(data);
    }
    setFormState({ open: false });
    await refreshAll();
  }

  async function handleDeleteTask(task: Task) {
    await deleteTask(task.id);
    setFormState({ open: false });
    await refreshAll();
  }

  // Matches the same 700px breakpoint SettingsModal.css already uses for
  // its own desktop/mobile split (see .only-desktop/.only-mobile there) -
  // this is about window width/interaction model, not actual OS.
  function isDesktopWidth(): boolean {
    return window.matchMedia("(min-width: 701px)").matches;
  }

  function handleRequestDeleteTask(task: Task) {
    if (isDesktopWidth()) {
      void handleDeleteTask(task);
      setDeletedTaskUndo(task);
    } else {
      setPendingDeleteTask(task);
    }
  }

  async function handleUndoDeleteTask() {
    if (!deletedTaskUndo) return;
    await restoreTask(deletedTaskUndo);
    setDeletedTaskUndo(null);
    await refreshAll();
  }

  async function handleConfirmDeleteTask() {
    if (!pendingDeleteTask) return;
    await handleDeleteTask(pendingDeleteTask);
    setPendingDeleteTask(null);
  }

  async function handleReorderTasks(taskIds: string[]) {
    const orderMap = new Map(taskIds.map((id, i) => [id, i]));
    setTasks((prev) =>
      prev.map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t)),
    );
    await updateTaskOrder(taskIds);
  }

  async function handleCreateTag(name: string, color: string): Promise<Tag> {
    // New tags get the next sort_order server-side, so appending here
    // (rather than re-sorting) already matches the correct order.
    const tag = await createTag(name, color);
    setTags((prev) => [...prev, tag]);
    return tag;
  }

  async function handleUpdateTag(id: string, name: string, color: string) {
    await updateTag(id, name, color);
    await refreshAll();
  }

  async function handleDeleteTag(id: string) {
    await deleteTag(id);
    await refreshAll();
  }

  async function handleReorderTags(tagIds: string[]) {
    const orderMap = new Map(tagIds.map((id, i) => [id, i]));
    setTags((prev) =>
      [...prev]
        .map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
    await updateTagOrder(tagIds);
  }

  async function handleSaveAsTemplate(tag: Tag, tasks: TemplateTaskBlueprint[]) {
    if (!membership.isPremium) {
      setPaywallFeature("Saving templates");
      return;
    }
    const template = await createTemplateFromTasks(tag.name, tag.id, tasks);
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id);
      const next = exists
        ? prev.map((t) => (t.id === template.id ? template : t))
        : [...prev, template];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function handleApplyTemplate(templateId: string) {
    await applyTemplate(templateId, selectedDate);
    await refreshAll();
  }

  function handleEditFromView() {
    if (!viewingTask) return;
    setFormState({ open: true, task: viewingTask });
    setViewingTask(null);
  }

  async function handleDeleteTemplate(id: string) {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSaveNote(content: string) {
    if (noteFormState.open && noteFormState.note) {
      const id = noteFormState.note.id;
      setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
      await updateNote(id, content);
    } else {
      const note = await createNote(selectedDate, content);
      setNotes((prev) => [...prev, note]);
    }
    setNoteFormState({ open: false });
  }

  async function handleDeleteNote(id: string) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    await deleteNote(id);
  }

  function handleRequestDeleteNote(id: string) {
    setPendingDeleteNote(notes.find((n) => n.id === id) ?? null);
  }

  async function handleConfirmDeleteNote() {
    if (!pendingDeleteNote) return;
    await handleDeleteNote(pendingDeleteNote.id);
    setPendingDeleteNote(null);
  }

  async function handleReorderNotePositions(
    updates: { id: string; afterGroupKey: string | null; sortOrder: number }[],
  ) {
    const byId = new Map(updates.map((u) => [u.id, u]));
    setNotes((prev) =>
      prev.map((n) => {
        const u = byId.get(n.id);
        return u ? { ...n, afterGroupKey: u.afterGroupKey, sortOrder: u.sortOrder } : n;
      }),
    );
    await updateNotePositions(updates);
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loading) {
    return (
      <div className="app-loading">
        <img className="app-loading__icon" src="/app-icon.png" alt="" />
      </div>
    );
  }

  if (viewingFriend) {
    return <FriendCalendarView friend={viewingFriend} onBack={() => setViewingFriend(null)} />;
  }

  const occurrences = tasksScheduledOn(tasks, selectedDate).map((task) => ({
    task,
    completed: completions.has(`${task.id}:${selectedDate}`),
  }));
  const dayNotes = notes.filter((n) => n.date === selectedDate);

  const todayStatus = computeTodayStatus(tasks, completions, freezes, todayKey());
  const weekly = computeWeeklyCompletion(
    tasks,
    completions,
    startOfWeek(selectedDate),
  );

  const freezesRemainingThisMonth = freezesRemainingInMonth(freezes, todayKey());
  const frozenDaysThisMonth = Array.from(freezes)
    .filter((d) => d.startsWith(todayKey().slice(0, 7)))
    .sort()
    .reverse();
  const freezeCandidates = getFreezeCandidates(tasks, completions, freezes, todayKey());
  const yesterdayKey = addDays(todayKey(), -1);
  const missedYesterday = freezeCandidates.some((c) => c.date === yesterdayKey);
  // Free members always see the suggestion (it's the moment a paywall
  // actually lands - a real broken streak, not an abstract feature list).
  // Premium/admin only sees it while a freeze is actually available to use,
  // since suggesting one they can't spend would just be a dead end.
  const freezeSuggestionDate =
    missedYesterday &&
    freezeSuggestionDismissedDate !== yesterdayKey &&
    (membership.isPremium ? freezesRemainingThisMonth > 0 : true)
      ? yesterdayKey
      : null;
  const phraseUnseen = lastPhraseViewDate !== todayKey();
  const quote = getQuoteOfDay(todayKey());

  const templateBreakdown = computeTemplateBreakdown(
    tasks,
    completions,
    startOfWeek(selectedDate),
  );

  return (
    <div className={`app ${dayPanelExpanded ? "app--day-expanded" : ""}`}>
      <OfflineBanner online={online} syncing={syncing} />
      <WriteErrorToast />
      {deletedTaskUndo && (
        <TaskDeletedToast
          key={deletedTaskUndo.id}
          taskTitle={deletedTaskUndo.title}
          onUndo={() => void handleUndoDeleteTask()}
          onDismiss={() => setDeletedTaskUndo(null)}
        />
      )}
      {freezeSuggestionDate && (
        <FreezeSuggestionModal
          date={freezeSuggestionDate}
          isPremium={membership.isPremium}
          onFreeze={() => {
            void handleFreezeDay(freezeSuggestionDate);
            void handleDismissFreezeSuggestion(freezeSuggestionDate);
          }}
          onGoPremium={() => {
            setPaywallFeature("Streak freezes");
            void handleDismissFreezeSuggestion(freezeSuggestionDate);
          }}
          onClose={() => void handleDismissFreezeSuggestion(freezeSuggestionDate)}
        />
      )}
      <CalendarView
        tasks={tasks}
        completions={completions}
        freezes={freezes}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        tier={membership.effectiveTier ?? undefined}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPhrase={handleOpenPhrase}
        phraseUnseen={phraseUnseen}
        onSyncNow={syncNow}
        syncing={syncing}
        onViewFriend={setViewingFriend}
        onlineFriendIds={onlineFriendIds}
        settingsBadgeCount={supportBadgeCount}
      />
      {/* Mobile-only divider between the calendar and the day panel below it -
          a separate element, not the day panel's own border, since that edge
          is where the day panel's scroll-fade mask fades to transparent (see
          DayPanel.css) and would fade a border drawn there away too. */}
      <div className="mobile-divider" aria-hidden="true" />
      <DayPanel
        selectedDate={selectedDate}
        occurrences={occurrences}
        tags={tags}
        streak={streak}
        bestStreak={bestStreak}
        todayStatus={todayStatus}
        weekly={weekly}
        freezesRemaining={freezesRemainingThisMonth}
        templateBreakdown={templateBreakdown}
        quote={quote}
        order={panelOrder}
        onReorder={handleReorderPanel}
        hiddenWidgets={hiddenWidgets}
        onHideWidget={handleHideWidget}
        onShowWidget={handleShowWidget}
        friendNotes={friendNotes}
        onDismissFriendNote={dismissFriendNote}
        arranging={arranging}
        onFinishArranging={() => setArranging(false)}
        onStartArranging={() => setArranging(true)}
        onToggle={handleToggle}
        onView={setViewingTask}
        onDelete={handleRequestDeleteTask}
        onReorderTasks={handleReorderTasks}
        onReorderTags={handleReorderTags}
        onSaveAsTemplate={handleSaveAsTemplate}
        onRemoveTemplate={handleDeleteTemplate}
        templates={templates}
        templateTaskBlueprints={templateTaskBlueprints}
        onApplyTemplate={handleApplyTemplate}
        onAddTask={() => setFormState({ open: true })}
        notes={dayNotes}
        onAddNote={() => setNoteFormState({ open: true })}
        onEditNote={(note) => setNoteFormState({ open: true, note })}
        onDeleteNote={handleRequestDeleteNote}
        onReorderNotePositions={handleReorderNotePositions}
        expanded={dayPanelExpanded}
        onToggleExpanded={() => setDayPanelExpanded((v) => !v)}
      />

      {noteFormState.open && (
        <NoteForm
          note={noteFormState.note}
          onSave={handleSaveNote}
          onClose={() => setNoteFormState({ open: false })}
        />
      )}

      {formState.open && (
        <TaskForm
          task={formState.task}
          defaultDate={selectedDate}
          tags={tags}
          onCreateTag={handleCreateTag}
          onSave={handleSaveTask}
          onDelete={
            formState.task ? () => handleRequestDeleteTask(formState.task!) : undefined
          }
          onClose={() => setFormState({ open: false })}
        />
      )}

      {settingsOpen && (
        <SettingsModal
          theme={theme}
          onChangeTheme={handleChangeTheme}
          remindersEnabled={remindersEnabled}
          onChangeRemindersEnabled={handleChangeRemindersEnabled}
          reminderStatus={reminderStatus}
          tasks={tasks}
          completions={completions}
          tags={tags}
          onCreateTag={handleCreateTag}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          onReorderTags={handleReorderTags}
          templates={templates}
          onSaveAsTemplate={handleSaveAsTemplate}
          onDeleteTemplate={handleDeleteTemplate}
          frozenDays={frozenDaysThisMonth}
          freezeCandidates={freezeCandidates}
          freezesRemaining={freezesRemainingThisMonth}
          onFreezeDay={handleFreezeDay}
          onUnfreezeDay={handleUnfreezeDay}
          onStartArranging={handleStartArranging}
          hiddenWidgets={hiddenWidgets}
          onHideWidget={handleHideWidget}
          onShowWidget={handleShowWidget}
          streak={streak}
          bestStreak={bestStreak}
          todayStatus={todayStatus}
          weekly={weekly}
          templateBreakdown={templateBreakdown}
          quote={quote}
          onClose={() => setSettingsOpen(false)}
          onSignOut={handleSignOut}
          onAccountDeleted={handleAccountDeleted}
          onUpgrade={() => setPaywallFeature("")}
          online={online}
          onViewFriend={setViewingFriend}
          membership={membership}
          onlineFriendIds={onlineFriendIds}
          supportBadgeCount={supportBadgeCount}
          onSupportSeen={refreshSupportBadge}
        />
      )}

      {paywallFeature !== null && (
        <PremiumPaywallModal
          feature={paywallFeature || undefined}
          onClose={() => setPaywallFeature(null)}
        />
      )}

      {phraseModalOpen && (
        <PhraseModal
          quote={quote}
          onClose={() => setPhraseModalOpen(false)}
        />
      )}

      {viewingTask && (
        <TaskViewModal
          task={viewingTask}
          tag={tags.find((t) => t.id === viewingTask.tagId)}
          onEdit={handleEditFromView}
          onClose={() => setViewingTask(null)}
        />
      )}

      {pendingDeleteTask && (
        <ConfirmModal
          title="Delete task"
          message={`Delete "${pendingDeleteTask.title}"? This can't be undone.`}
          onConfirm={handleConfirmDeleteTask}
          onClose={() => setPendingDeleteTask(null)}
        />
      )}

      {pendingDeleteNote && (
        <ConfirmModal
          title="Delete note"
          message={`Delete "${
            pendingDeleteNote.content.length > 80
              ? `${pendingDeleteNote.content.slice(0, 80)}…`
              : pendingDeleteNote.content
          }"? This can't be undone.`}
          onConfirm={handleConfirmDeleteNote}
          onClose={() => setPendingDeleteNote(null)}
        />
      )}

      {pendingUpdate && (
        <UpdateAvailableModal
          update={pendingUpdate}
          installing={appUpdater.installing}
          error={appUpdater.error}
          onInstall={() => void appUpdater.installAndRestart()}
          onLater={() => setDismissedUpdateVersion(pendingUpdate.version)}
        />
      )}
    </div>
  );
}
