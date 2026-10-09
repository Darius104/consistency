import { Suspense, lazy, useEffect, useMemo, useRef, useState } from "react";
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
import { unregisterPushDevice, usePushRegistration } from "./hooks/usePushRegistration";
import { FreezeSuggestionModal } from "./components/FreezeSuggestionModal";
import { MobileTabBar, type MobileTab } from "./components/MobileTabBar";
import { OfflineBanner } from "./components/OfflineBanner";
import { TaskDeletedToast } from "./components/TaskDeletedToast";
import { WriteErrorToast } from "./components/WriteErrorToast";
import { WelcomeModal, type StarterPack } from "./components/welcome/WelcomeModal";
import { isCurrentMonth } from "./components/settings/StreakFreezeManager";
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
  deleteTradingResult,
  getAllCompletions,
  getAllNotes,
  getAllTasks,
  getAllTradingResults,
  getSetting,
  getStreakFreezes,
  getTags,
  getTemplates,
  removeStreakFreeze,
  restoreTask,
  setCompletion,
  setSetting,
  setTradingResult,
  updateNote,
  updateNotePositions,
  updateTag,
  updateTagOrder,
  updateTask,
  updateTaskOrder,
} from "./db/queries";
import type {
  DayNote,
  NewTask,
  Tag,
  Task,
  Template,
  TemplateTaskBlueprint,
  ThemeId,
  TradingResult,
  TradingResultUnit,
} from "./types";
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
import { DEFAULT_THEME, THEMES, type AppearanceMode } from "./utils/themes";
import { noteToPlainText } from "./utils/richNote";
import {
  generateCustomThemeColors,
  hexToOklch,
  RANDOM_THEME_CSS_VARS,
  type RandomThemeColors,
} from "./utils/randomTheme";
import { getQuoteOfDay } from "./utils/quotes";
import {
  DEFAULT_PANEL_ORDER,
  parsePanelOrder,
  parseHiddenWidgets,
  resolveNewWidgetIds,
  FREE_WIDGET_LIMIT,
  WIDGET_IDS,
  type PanelBlockId,
  type WidgetId,
} from "./utils/panelOrder";
import { useTaskReminders } from "./hooks/useTaskReminders";
import { useFriendStreaks } from "./hooks/useFriendStreaks";
import { useMembership } from "./hooks/useMembership";
import { useSupportBadgeCount } from "./hooks/useSupportBadgeCount";
import { useFriendNotes } from "./hooks/useFriendNotes";
import { useAppUpdater } from "./hooks/useAppUpdater";
import { UpdateAvailableModal } from "./components/UpdateAvailableModal";
import "./App.css";

// Opened on demand, so they're not part of the code the app has to load
// before it can show anything (they're each a fair chunk of the bundle).
const FriendCalendarView = lazy(() =>
  import("./components/friends/FriendCalendarView").then((m) => ({
    default: m.FriendCalendarView,
  })),
);
const TemplatesModal = lazy(() =>
  import("./components/settings/TemplatesModal").then((m) => ({
    default: m.TemplatesModal,
  })),
);
const SettingsModal = lazy(() =>
  import("./components/settings/SettingsModal").then((m) => ({
    default: m.SettingsModal,
  })),
);
const PremiumPaywallModal = lazy(() =>
  import("./components/PremiumPaywallModal").then((m) => ({
    default: m.PremiumPaywallModal,
  })),
);

// Legacy keys - each theme change used to write these as two or three
// separate setSetting() calls. Every write kicks off its own sync (see
// db/queries.ts's kickSync()), and pushPendingOps/pullFromServer aren't
// atomic across separate calls - a pull triggered by the *first* write's
// realtime echo could land between the two pushes and pull back a
// theme="random" row paired with the *previous* roll's still-unpushed
// randomThemeColors row, which refreshAll() would then apply, visible as a
// flash back to the old colors before the second write's own sync caught
// up and corrected it. Kept only for the one-time migration in refreshAll.
const THEME_SETTING_KEY = "theme";
const RANDOM_THEME_SETTING_KEY = "randomThemeColors";
const CUSTOM_THEME_SETTING_KEY = "customThemeColors";
// theme + randomColors + customColors together in one JSON value under one
// key, so a theme change is exactly one setSetting() call - one push, one
// consistent pull - and can't be observed half-applied.
const THEME_STATE_SETTING_KEY = "themeState";
const REMINDERS_SETTING_KEY = "remindersEnabled";
const PANEL_ORDER_SETTING_KEY = "panelOrder";
const HIDDEN_WIDGETS_SETTING_KEY = "hiddenWidgets";
// Separate from hiddenWidgets - see resolveNewWidgetIds's own comment for
// why hiddenWidgets alone can't tell "shown" apart from "never migrated".
const KNOWN_WIDGET_IDS_SETTING_KEY = "knownWidgetIds";
const PHRASE_VIEW_SETTING_KEY = "lastPhraseViewDate";
const FREEZE_SUGGESTION_DISMISSED_KEY = "freezeSuggestionDismissedDate";
const TRADING_RESULT_UNIT_SETTING_KEY = "tradingResultUnit";
const DEFAULT_TRADING_RESULT_UNIT: TradingResultUnit = "r";

interface StoredThemeState {
  theme: ThemeId;
  randomColors: RandomThemeColors | null;
  customColors: RandomThemeColors | null;
}

async function persistThemeState(state: StoredThemeState): Promise<void> {
  await setSetting(THEME_STATE_SETTING_KEY, JSON.stringify(state));
}

// Light/dark follows your account (synced like the color theme), so
// changing it on one device changes it on the others. The local copy is
// only so the app opens in the right mode before the account data loads.
const APPEARANCE_MODE_SETTING_KEY = "appearanceMode";
// How long a fresh tick overrides what a reload reads - see withRecentToggles.
const RECENT_TOGGLE_MS = 15_000;
const APPEARANCE_MODE_KEY = "consistency:appearanceMode";

function readLocalAppearanceMode(): AppearanceMode | null {
  try {
    const v = localStorage.getItem(APPEARANCE_MODE_KEY);
    return v === "light" || v === "dark" ? v : null;
  } catch {
    return null;
  }
}

function rememberAppearanceModeLocally(mode: AppearanceMode) {
  try {
    localStorage.setItem(APPEARANCE_MODE_KEY, mode);
  } catch {
    // Storage unavailable - it'll just load in after the account data.
  }
}

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  // See withRecentToggles / writeCompletion.
  const recentTogglesRef = useRef<Map<string, { completed: boolean; at: number }>>(new Map());
  const completionWritesRef = useRef<Promise<unknown>>(Promise.resolve());
  const [freezes, setFreezes] = useState<Set<string>>(new Set());
  const [notes, setNotes] = useState<DayNote[]>([]);
  const [tradingResults, setTradingResults] = useState<
    Record<string, TradingResult>
  >({});
  const [tradingResultUnit, setTradingResultUnit] = useState<TradingResultUnit>(
    DEFAULT_TRADING_RESULT_UNIT,
  );
  const [selectedDate, setSelectedDate] = useState(todayKey());
  // Only meaningful on phone-sized screens (see the max-width:700px query in
  // CalendarView.css/App.css) - which of the bottom tab bar's two real
  // views fills the screen: the month grid, or the selected day's panel.
  const [mobileTab, setMobileTab] = useState<MobileTab>("calendar");
  // See AddMenu's openRequest - bumped by the tab bar's "+" button.
  const [addMenuOpenRequest, setAddMenuOpenRequest] = useState(0);
  const [resetMonthRequest, setResetMonthRequest] = useState(0);
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  // Guards handleChangeTheme/handleSetCustomTheme against rapid repeated
  // calls (switching themes quickly) completing out of order - each
  // persist/sync write takes a moment, and two overlapping calls can
  // resolve in a different order than they were started in, which without
  // this would let an older, now-stale call's write land *after* a newer
  // one's and silently overwrite it - visible as the theme flashing back
  // to a previous pick a moment after you've already moved on from it.
  const themeRequestRef = useRef(0);
  const [randomColors, setRandomColors] = useState<RandomThemeColors | null>(
    null,
  );
  // The profile page's "create your own theme" builder's last saved pick -
  // kept separate from randomColors so switching random <-> custom back and
  // forth never clobbers the other one's saved colors.
  // Light or dark, for whichever theme is picked - see
  // APPEARANCE_MODE_SETTING_KEY.
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(
    () => readLocalAppearanceMode() ?? "dark",
  );
  function handleChangeAppearanceMode(mode: AppearanceMode) {
    setAppearanceMode(mode);
    rememberAppearanceModeLocally(mode);
    void setSetting(APPEARANCE_MODE_SETTING_KEY, mode);
  }
  const [customColors, setCustomColors] = useState<RandomThemeColors | null>(
    null,
  );
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [panelOrder, setPanelOrder] =
    useState<PanelBlockId[]>(DEFAULT_PANEL_ORDER);
  const [hiddenWidgets, setHiddenWidgets] = useState<WidgetId[]>([]);
  const [arranging, setArranging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  // Which Settings section to land on next time it opens - reset to
  // "profile" on the ordinary gear-icon path, overridden to "friends" by
  // the "+ Friends" shortcut in the calendar header so that one jumps
  // straight there instead of always opening to the top.
  const [settingsSection, setSettingsSection] = useState("profile");
  // Phone: Settings and Profile are tabs - which one is showing, and a key
  // bumped to reopen it at its top level (tapping the active tab again).
  const [settingsTab, setSettingsTab] = useState<"settings" | "profile">("settings");
  const [settingsKey, setSettingsKey] = useState(0);
  const [createTemplateOpen, setCreateTemplateOpen] = useState(false);
  const [phraseModalOpen, setPhraseModalOpen] = useState(false);
  const [lastPhraseViewDate, setLastPhraseViewDate] = useState<string | null>(
    null,
  );
  const [freezeSuggestionDismissedDate, setFreezeSuggestionDismissedDate] =
    useState<string | null>(null);
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
  // "Completed · Undo" after ticking a task, for a mis-tap - shares the
  // delete toast's spot, so only one of the two shows at a time.
  const [completedUndo, setCompletedUndo] = useState<{
    task: Task;
    date: string;
  } | null>(null);
  // Same confirmation step for notes - free-typed content is just as easy
  // to lose to a stray tap as a task, and previously had no confirmation
  // at all, unlike every task-deletion path.
  const [pendingDeleteNote, setPendingDeleteNote] = useState<DayNote | null>(
    null,
  );
  // Non-null while looking at a friend's read-only calendar instead of your
  // own - never persisted, always starts back at null (your own calendar)
  // on a fresh launch.
  const [viewingFriend, setViewingFriend] = useState<Friend | null>(null);

  const { session } = useSession();
  // True once this session's first sync with the server has finished and
  // been read back in - before that, an empty task list may just mean this
  // device hasn't downloaded anything yet (see the welcome sheet below).
  const [syncedOnce, setSyncedOnce] = useState(false);
  const [welcomeDismissed, setWelcomeDismissed] = useState(false);
  // On opening the app: wait (briefly) for the first sync before showing
  // anything, so you never see this device's out-of-date copy flash by
  // before what you did on another device arrives. Opens after the sync,
  // or after 2s at most (slow connection - then "Syncing..." shows instead).
  const [openGateOpen, setOpenGateOpen] = useState(false);
  const { online, syncing, syncNow } = useOnlineStatus(!!session);
  // Data confirmed current with the server (or there's no server to ask).
  // "Attention" signals - the phrase dot, deadline strips, the freeze
  // suggestion - wait for this, so they never appear and then vanish.
  const dataFresh = syncedOnce || !online;
  useEffect(() => {
    if (!session) {
      setOpenGateOpen(false);
      return;
    }
    if (syncedOnce || !online) {
      setOpenGateOpen(true);
      return;
    }
    const timer = window.setTimeout(() => setOpenGateOpen(true), 2000);
    return () => window.clearTimeout(timer);
  }, [session, syncedOnce, online]);
  useRealtimeSync(session?.user.id ?? null);
  const onlineFriendIds = usePresence(session?.user.id ?? null);

  useEffect(() => {
    if (!session) return;
    void refreshAll();
    // Covers both cold start (empty cache, first sign-in on this device)
    // and switching accounts without restarting the app - useOnlineStatus's
    // own mount-time sync only ever fires once per app lifetime.
    setSyncedOnce(false);
    void trySync().then(async (ok) => {
      if (!ok) return;
      await refreshAll();
      setSyncedOnce(true);
    });
    // A no-op after the first time (it never overwrites a name you've since
    // customized) - safe to just call unconditionally every session.
    void ensureProfile();
  }, [session]);

  // Re-reads from the cache into React state whenever a background sync
  // actually pulls fresh data (a queued write flushing, a reconnect, etc.)
  // - not just in response to a user action in this window.
  useEffect(() => onSyncComplete(() => void refreshAll()), []);

  // Skipped while viewing a friend's calendar - FriendCalendarView takes over
  // applying (and restoring) the document's theme for that duration instead,
  // since it needs to show the friend's colors, not your own.
  useEffect(() => {
    if (viewingFriend) return;
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme, viewingFriend]);

  // The eight hand-picked themes are static [data-theme] blocks in
  // tokens.css; "custom" has no such block, so its colors are applied
  // directly as inline custom properties instead - and cleared again the
  // moment a real theme is picked, so its static block takes back over.
  useEffect(() => {
    if (viewingFriend) return;
    const root = document.documentElement.style;
    // In light mode the custom color is rebuilt from its hue as a light
    // palette (the saved colors are the dark version).
    const active =
      theme === "custom" && customColors
        ? appearanceMode === "light"
          ? generateCustomThemeColors(hexToOklch(customColors.accent).h, "light")
          : customColors
        : null;
    for (const key of Object.keys(
      RANDOM_THEME_CSS_VARS,
    ) as (keyof RandomThemeColors)[]) {
      const cssVar = RANDOM_THEME_CSS_VARS[key];
      if (active) root.setProperty(cssVar, active[key]);
      else root.removeProperty(cssVar);
    }
  }, [theme, customColors, viewingFriend, appearanceMode]);

  useEffect(() => {
    document.documentElement.setAttribute("data-mode", appearanceMode);
  }, [appearanceMode]);

  // iPhone: reminders come from the server once registered (see
  // usePushRegistration) - then the phone stops scheduling its own.
  const serverPush = usePushRegistration(session?.user.id ?? null, remindersEnabled);
  const reminderStatus = useTaskReminders(
    tasks,
    tags,
    completions,
    freezes,
    remindersEnabled,
    serverPush,
  );
  // Also enabled while Settings is open (regardless of tab) so the Widgets
  // gallery's live preview has real data the moment someone switches to it,
  // even before they've turned the widget on.
  const friendStreaks = useFriendStreaks(
    !hiddenWidgets.includes("friendStreaks") || settingsOpen,
  );

  const membership = useMembership();
  const { count: supportBadgeCount, refresh: refreshSupportBadge } =
    useSupportBadgeCount(membership.effectiveTier === "admin");
  const { notes: friendNotes, dismiss: dismissFriendNote } = useFriendNotes();
  const [paywallFeature, setPaywallFeature] = useState<string | null>(null);

  // Desktop-only (see useAppUpdater's own doc comment) - checked once on
  // launch here; Settings also exposes a manual "Check for updates" using
  // the same hook. Dismissing ("Later") is tracked by version, not just a
  // boolean, so dismissing this update doesn't also hide a newer one that
  // shows up on a later check within the same session.
  const appUpdater = useAppUpdater();
  const [dismissedUpdateVersion, setDismissedUpdateVersion] = useState<
    string | null
  >(null);
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
    () =>
      Math.max(
        streak,
        computeLongestStreak(tasks, completions, freezes, today),
      ),
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
      tradingResultRows,
      savedThemeState,
      legacyTheme,
      legacyRandomColors,
      legacyCustomColors,
      savedReminders,
      savedTradingResultUnit,
      savedPanelOrder,
      savedHiddenWidgets,
      savedKnownWidgetIds,
      savedPhraseViewDate,
      savedFreezeSuggestionDismissedDate,
      savedAppearanceMode,
    ] = await Promise.all([
      getAllTasks(),
      getTags(),
      getTemplates(),
      getAllCompletions(),
      getStreakFreezes(),
      getAllNotes(),
      getAllTradingResults(),
      getSetting(THEME_STATE_SETTING_KEY),
      getSetting(THEME_SETTING_KEY),
      getSetting(RANDOM_THEME_SETTING_KEY),
      getSetting(CUSTOM_THEME_SETTING_KEY),
      getSetting(REMINDERS_SETTING_KEY),
      getSetting(TRADING_RESULT_UNIT_SETTING_KEY),
      getSetting(PANEL_ORDER_SETTING_KEY),
      getSetting(HIDDEN_WIDGETS_SETTING_KEY),
      getSetting(KNOWN_WIDGET_IDS_SETTING_KEY),
      getSetting(PHRASE_VIEW_SETTING_KEY),
      getSetting(FREEZE_SUGGESTION_DISMISSED_KEY),
      getSetting(APPEARANCE_MODE_SETTING_KEY),
    ]);
    setTasks(taskRows);
    setTags(tagRows);
    const tagIds = new Set(tagRows.map((t) => t.id));
    const orphanedTemplates = templateRows.filter(
      (t) => !t.tagId || !tagIds.has(t.tagId),
    );
    setTemplates(
      orphanedTemplates.length > 0
        ? templateRows.filter((t) => !orphanedTemplates.includes(t))
        : templateRows,
    );
    if (orphanedTemplates.length > 0) {
      // Self-heals any template a tag deletion left orphaned before
      // deleteTag() started cleaning these up itself (see its own
      // comment) - a template with no matching tag was invisible in
      // Settings (which only ever lists templates by walking tags) but
      // still a live row the day panel's template picker kept offering.
      void Promise.all(
        orphanedTemplates.map((t) => deleteTemplate(t.id)),
      ).catch(() => {});
    }
    setCompletions(withRecentToggles(completionRows));
    setFreezes(freezeRows);
    setNotes(noteRows);
    setTradingResults(
      Object.fromEntries(tradingResultRows.map((r) => [r.date, r])),
    );
    setTradingResultUnit(
      (savedTradingResultUnit as TradingResultUnit | null) ??
        DEFAULT_TRADING_RESULT_UNIT,
    );

    let resolvedTheme: ThemeId;
    let resolvedRandomColors: RandomThemeColors | null;
    let resolvedCustomColors: RandomThemeColors | null;
    if (savedThemeState) {
      const parsed = JSON.parse(savedThemeState) as StoredThemeState;
      resolvedTheme = parsed.theme;
      resolvedRandomColors = parsed.randomColors;
      resolvedCustomColors = parsed.customColors;
    } else {
      // One-time migration for accounts whose theme still lives under the
      // old separate keys (see THEME_SETTING_KEY's comment) - folds them
      // into the combined key so every write from here on is atomic.
      resolvedTheme = legacyTheme ? (legacyTheme as ThemeId) : DEFAULT_THEME;
      resolvedRandomColors = legacyRandomColors
        ? JSON.parse(legacyRandomColors)
        : null;
      resolvedCustomColors = legacyCustomColors
        ? JSON.parse(legacyCustomColors)
        : null;
      if (legacyTheme) {
        await persistThemeState({
          theme: resolvedTheme,
          randomColors: resolvedRandomColors,
          customColors: resolvedCustomColors,
        });
      }
    }
    // A theme id this version doesn't know (one that was removed, or saved
    // by a newer version) falls back to the default instead of rendering
    // with no theme at all. "custom" has no preset entry.
    if (resolvedTheme !== "custom" && !THEMES.some((t) => t.id === resolvedTheme)) {
      resolvedTheme = DEFAULT_THEME;
    }
    setTheme(resolvedTheme);
    setRandomColors(resolvedRandomColors);
    setCustomColors(resolvedCustomColors);
    if (savedReminders !== null) setRemindersEnabled(savedReminders === "true");
    setPanelOrder(parsePanelOrder(savedPanelOrder));
    // hiddenWidgets only ever records what's hidden - a widget that's
    // absent from it is either genuinely visible (shown on purpose) or
    // simply didn't exist yet when this account last saved its widget
    // settings, and those two cases look identical from hiddenWidgets
    // alone. knownWidgetIds is the separate record that tells them apart:
    // any current widget id missing from IT (not from hiddenWidgets)
    // starts hidden, same as a fresh account - and then both get written
    // back together so every id this app currently ships is accounted for
    // exactly once. Without this, showing a brand new widget just made it
    // absent from hiddenWidgets again, indistinguishable from "never
    // migrated" on the very next reload - which silently re-hid it a
    // moment after turning it on.
    const parsedHiddenWidgets = parseHiddenWidgets(savedHiddenWidgets);
    const newWidgetIds = resolveNewWidgetIds(savedKnownWidgetIds).filter(
      (id) => !parsedHiddenWidgets.includes(id),
    );
    const resolvedHiddenWidgets = [...parsedHiddenWidgets, ...newWidgetIds];
    setHiddenWidgets(resolvedHiddenWidgets);
    if (newWidgetIds.length > 0 || !savedKnownWidgetIds) {
      void Promise.all([
        setSetting(
          HIDDEN_WIDGETS_SETTING_KEY,
          JSON.stringify(resolvedHiddenWidgets),
        ),
        setSetting(KNOWN_WIDGET_IDS_SETTING_KEY, JSON.stringify(WIDGET_IDS)),
      ]).catch(() => {});
    }
    setLastPhraseViewDate(savedPhraseViewDate);
    setFreezeSuggestionDismissedDate(savedFreezeSuggestionDismissedDate);
    if (savedAppearanceMode === "light" || savedAppearanceMode === "dark") {
      setAppearanceMode(savedAppearanceMode);
      rememberAppearanceModeLocally(savedAppearanceMode);
    } else {
      // Picked on this device before it synced (only stored locally) -
      // upload it once, so your other devices follow. A device that never
      // picked one has nothing stored here and uploads nothing.
      const localOnly = readLocalAppearanceMode();
      if (localOnly) void setSetting(APPEARANCE_MODE_SETTING_KEY, localOnly);
    }
    setLoading(false);
    // Covers accounts whose theme was already set before profiles/friends
    // existed - not just future changes via handleChangeTheme/
    // handleSetCustomTheme below.
    const resolvedOverrideColors =
      resolvedTheme === "custom" ? resolvedCustomColors : null;
    void syncMyThemeToProfile(resolvedTheme, resolvedOverrideColors).catch(
      () => {},
    );
  }

  async function handleSignOut() {
    // Before signing out - this device must stop getting this account's
    // reminders (needs the session to still be valid to delete its row).
    await unregisterPushDevice();
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

  async function handleSetTradingResult(
    value: number | null,
    unit: TradingResultUnit,
  ) {
    const date = selectedDate;
    setTradingResults((prev) => {
      if (value === null) {
        const { [date]: _removed, ...rest } = prev;
        return rest;
      }
      return { ...prev, [date]: { date, value, unit } };
    });
    if (value === null) {
      await deleteTradingResult(date);
      return;
    }
    await setTradingResult(date, value, unit);
    // Remembers the unit just picked as next time's starting point in the
    // modal (see TradingResultModal) - never relabels anything already
    // logged, just saves a click if you tend to log the same unit.
    if (unit !== tradingResultUnit) {
      setTradingResultUnit(unit);
      await setSetting(TRADING_RESULT_UNIT_SETTING_KEY, unit);
    }
  }

  async function handleChangeTheme(next: ThemeId) {
    const requestId = ++themeRequestRef.current;
    setTheme(next);

    // A stale call (superseded by a newer theme change that's since
    // started) skips its own writes entirely rather than letting them race
    // a newer call's writes to land - see themeRequestRef's own comment.
    if (themeRequestRef.current !== requestId) return;
    await persistThemeState({ theme: next, randomColors, customColors });
    if (themeRequestRef.current !== requestId) return;
    await syncMyThemeToProfile(next, next === "custom" ? customColors : null);
  }

  /** Profile page's "create your own theme" builder - same legible shape as
   *  every other theme, built from a hue someone chose by hand (via a hue
   *  slider, not a native color picker - see CustomThemeCreator) instead of
   *  a fixed swatch. */
  async function handleSetCustomTheme(hue: number) {
    const requestId = ++themeRequestRef.current;
    const colors = generateCustomThemeColors(hue);
    setTheme("custom");
    setCustomColors(colors);

    if (themeRequestRef.current !== requestId) return;
    await persistThemeState({
      theme: "custom",
      randomColors,
      customColors: colors,
    });
    if (themeRequestRef.current !== requestId) return;
    await syncMyThemeToProfile("custom", colors);
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
    const next = hiddenWidgets.includes(id)
      ? hiddenWidgets
      : [...hiddenWidgets, id];
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

  // Desktop keyboard shortcuts. Read through a ref so the one listener
  // always sees the current state without re-subscribing every render.
  const shortcutRef = useRef<(e: KeyboardEvent) => void>(() => {});
  shortcutRef.current = (e: KeyboardEvent) => {
    if (!session || !isDesktopWidth()) return;
    // ⌘, - Settings, from anywhere (the macOS convention).
    if (e.key === "," && e.metaKey) {
      e.preventDefault();
      setSettingsSection("profile");
      setSettingsOpen(true);
      return;
    }
    if (e.metaKey || e.ctrlKey || e.altKey) return;
    // Never while typing, or while a window/sheet is open over the app.
    const target = e.target as HTMLElement | null;
    if (target?.closest("input, textarea, select, [contenteditable='true']"))
      return;
    if (document.querySelector(".modal-overlay") || viewingFriend) return;
    switch (e.key) {
      case "n":
      case "N":
        if (selectedDate >= todayKey()) {
          e.preventDefault();
          setFormState({ open: true });
        }
        break;
      case "t":
      case "T":
        e.preventDefault();
        setSelectedDate(todayKey());
        break;
      case "ArrowLeft":
        e.preventDefault();
        setSelectedDate((d) => addDays(d, -1));
        break;
      case "ArrowRight":
        e.preventDefault();
        setSelectedDate((d) => addDays(d, 1));
        break;
    }
  };
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => shortcutRef.current(e);
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  // First run: a brand-new account with nothing in it yet - offered once
  // per account on this device, never again after it's answered.
  const welcomeKey = session ? `consistency:welcomed:${session.user.id}` : null;
  function alreadyWelcomed(): boolean {
    try {
      return !!welcomeKey && localStorage.getItem(welcomeKey) === "1";
    } catch {
      return false;
    }
  }
  function dismissWelcome() {
    setWelcomeDismissed(true);
    try {
      if (welcomeKey) localStorage.setItem(welcomeKey, "1");
    } catch {
      // Storage unavailable - it just won't be remembered across launches.
    }
  }
  const showWelcome =
    syncedOnce &&
    !loading &&
    !welcomeDismissed &&
    !viewingFriend &&
    tasks.length === 0 &&
    tags.length === 0 &&
    !alreadyWelcomed();

  async function handleStartWithPacks(packs: StarterPack[]) {
    const startDate = todayKey();
    for (const pack of packs) {
      const tag = await createTag(pack.name, pack.color);
      for (const task of pack.tasks) {
        await createTask({ ...task, tagId: tag.id, startDate });
      }
    }
    dismissWelcome();
    await refreshAll();
    setSelectedDate(startDate);
    if (!isDesktopWidth()) setMobileTab("today");
  }

  // Ticks made in the last few seconds win over whatever a reload reads
  // from the local cache. A background sync can finish between a tick and
  // its cache write (or briefly write the server's older copy over it), and
  // its reload used to flip the checkbox back - then forward again on the
  // next sync. The cache/server catch up on their own; this only stops the
  // screen from flickering in the meantime.
  function withRecentToggles(rows: Set<string>): Set<string> {
    const now = Date.now();
    const next = new Set(rows);
    for (const [key, t] of recentTogglesRef.current) {
      if (now - t.at > RECENT_TOGGLE_MS) {
        recentTogglesRef.current.delete(key);
        continue;
      }
      if (t.completed) next.add(key);
      else next.delete(key);
    }
    return next;
  }

  // Writes go out one at a time, in tap order - two quick taps on the same
  // task must reach the cache/outbox as "on, then off", never reversed.
  function writeCompletion(taskId: string, date: string, completed: boolean) {
    recentTogglesRef.current.set(`${taskId}:${date}`, { completed, at: Date.now() });
    const write = completionWritesRef.current
      .catch(() => {})
      .then(() => setCompletion(taskId, date, completed));
    completionWritesRef.current = write;
    return write;
  }

  async function handleToggle(task: Task) {
    // A past day's outcome is locked in once it's over - otherwise coming
    // back the next day and checking off what you missed (or the sibling
    // guard in handleRequestDeleteTask below, deleting it instead) would
    // silently rewrite streak history without ever spending a real freeze.
    // Streak Freezes remain the one sanctioned way to fix a missed day.
    if (selectedDate < todayKey()) return;
    const key = `${task.id}:${selectedDate}`;
    // The most recent tap is the truth - reading the rendered state alone
    // could be one tap behind on a fast double-tap.
    const current = recentTogglesRef.current.get(key)?.completed ?? completions.has(key);
    const nextCompleted = !current;
    setCompletions((prev) => {
      const next = new Set(prev);
      if (nextCompleted) next.add(key);
      else next.delete(key);
      return next;
    });
    if (nextCompleted) {
      setDeletedTaskUndo(null);
      setCompletedUndo({ task, date: selectedDate });
    } else if (completedUndo?.task.id === task.id) {
      setCompletedUndo(null);
    }
    await writeCompletion(task.id, selectedDate, nextCompleted);
  }

  async function handleUndoComplete() {
    if (!completedUndo) return;
    const { task, date } = completedUndo;
    setCompletedUndo(null);
    setCompletions((prev) => {
      const next = new Set(prev);
      next.delete(`${task.id}:${date}`);
      return next;
    });
    await writeCompletion(task.id, date, false);
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
    if (!isCurrentMonth(date)) return;
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
      // Same past-day lock as handleToggle/handleRequestDeleteTask - a new
      // task added to a day that's already over could never actually be
      // completed, which is really just the same loophole from the other
      // direction (an incomplete task nothing can ever mark done still
      // shouldn't get to sit there rewriting what that day looked like).
      if (selectedDate < todayKey()) {
        setFormState({ open: false });
        return;
      }
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
    // Same reasoning as handleToggle's own guard above - deleting a task
    // from a past day is the other half of the same loophole (an
    // incomplete task that no longer exists can't count against a day's
    // completion rate), so this is locked the same way.
    if (selectedDate < todayKey()) return;
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
    // Close the confirm first, so the row's exit animation (see TaskList's
    // leaving rows) plays in view rather than behind the closing sheet.
    const task = pendingDeleteTask;
    setPendingDeleteTask(null);
    await handleDeleteTask(task);
  }

  async function handleReorderTasks(taskIds: string[]) {
    const orderMap = new Map(taskIds.map((id, i) => [id, i]));
    setTasks((prev) =>
      prev.map((t) =>
        orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
      ),
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
        .map((t) =>
          orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t,
        )
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
    await updateTagOrder(tagIds);
  }

  async function handleSaveAsTemplate(
    tag: Tag,
    tasks: TemplateTaskBlueprint[],
  ) {
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

  async function handleApplyTemplate(
    templateId: string,
    taskIndices: number[],
  ) {
    // Same past-day lock as handleSaveTask's own create guard - applying a
    // template stamps a whole batch of new incomplete tasks onto the
    // selected day at once, the exact same gap just multiplied.
    if (selectedDate < todayKey()) return;
    await applyTemplate(templateId, selectedDate, taskIndices);
    await refreshAll();
  }

  function handleEditFromView() {
    if (!viewingTask) return;
    setFormState({ open: true, task: viewingTask });
    setViewingTask(null);
  }

  // Reached from Settings > Reminders - jumps the calendar to that
  // occurrence's own date (not just wherever the calendar happens to be
  // sitting right now) before opening the task, so editing it doesn't
  // silently apply to the wrong day for a recurring task.
  function handleJumpToReminder(taskId: string, date: string) {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;
    setSelectedDate(date);
    setSettingsOpen(false);
    setFormState({ open: true, task });
  }

  async function handleDeleteTemplate(id: string) {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  async function handleSaveNote(content: string) {
    if (noteFormState.open && noteFormState.note) {
      const id = noteFormState.note.id;
      setNotes((prev) =>
        prev.map((n) => (n.id === id ? { ...n, content } : n)),
      );
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
        return u
          ? { ...n, afterGroupKey: u.afterGroupKey, sortOrder: u.sortOrder }
          : n;
      }),
    );
    await updateNotePositions(updates);
  }

  if (!session) {
    return <AuthScreen />;
  }

  if (loading || !openGateOpen) {
    return (
      <div className="app-loading">
        <img className="app-loading__icon" src="/app-icon.png" alt="" />
      </div>
    );
  }

  if (viewingFriend) {
    return (
      <Suspense fallback={null}>
        <FriendCalendarView
          friend={viewingFriend}
          isOnline={onlineFriendIds.has(viewingFriend.userId)}
          onBack={() => setViewingFriend(null)}
        />
      </Suspense>
    );
  }

  const occurrences = tasksScheduledOn(tasks, selectedDate).map((task) => ({
    task,
    completed: completions.has(`${task.id}:${selectedDate}`),
  }));
  const dayNotes = notes.filter((n) => n.date === selectedDate);

  const todayStatus = computeTodayStatus(
    tasks,
    completions,
    freezes,
    todayKey(),
  );
  const weekly = computeWeeklyCompletion(
    tasks,
    completions,
    startOfWeek(selectedDate),
  );

  const freezesRemainingThisMonth = freezesRemainingInMonth(
    freezes,
    todayKey(),
  );
  // Every frozen day, not just this month's - the 3-per-month quota only
  // applies to how many NEW freezes you can spend right now, but a day
  // frozen last month is still frozen and should stay unfreezable, not
  // silently vanish from this list the moment the month rolls over.
  const allFrozenDays = Array.from(freezes).sort().reverse();
  const freezeCandidates = getFreezeCandidates(
    tasks,
    completions,
    freezes,
    todayKey(),
  );
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
  const phraseUnseen = dataFresh && lastPhraseViewDate !== todayKey();
  const quote = getQuoteOfDay(todayKey());

  const templateBreakdown = computeTemplateBreakdown(
    tasks,
    completions,
    startOfWeek(selectedDate),
    todayKey(),
  );

  return (
    <div
      className={`app ${mobileTab === "today" ? "app--day-expanded" : "app--calendar-tab"}`}
    >
      <OfflineBanner online={online} syncing={syncing} />
      <WriteErrorToast />
      {completedUndo && !deletedTaskUndo && (
        <TaskDeletedToast
          key={`done-${completedUndo.task.id}-${completedUndo.date}`}
          verb="Completed"
          taskTitle={completedUndo.task.title}
          onUndo={() => void handleUndoComplete()}
          onDismiss={() => setCompletedUndo(null)}
        />
      )}
      {deletedTaskUndo && (
        <TaskDeletedToast
          key={deletedTaskUndo.id}
          taskTitle={deletedTaskUndo.title}
          onUndo={() => void handleUndoDeleteTask()}
          onDismiss={() => setDeletedTaskUndo(null)}
        />
      )}
      {showWelcome && (
        <WelcomeModal onStart={handleStartWithPacks} onClose={dismissWelcome} />
      )}
      {freezeSuggestionDate && dataFresh && (
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
          onClose={() =>
            void handleDismissFreezeSuggestion(freezeSuggestionDate)
          }
        />
      )}
      <CalendarView
        tasks={tasks}
        completions={completions}
        freezes={freezes}
        tradingResults={tradingResults}
        tags={tags}
        selectedDate={selectedDate}
        onSelectDate={(date) => {
          setSelectedDate(date);
          // On a phone the grid fills the screen, so picking a day opens it.
          if (!isDesktopWidth()) setMobileTab("today");
        }}
        tier={membership.effectiveTier ?? undefined}
        onOpenSettings={() => {
          setSettingsSection("profile");
          setSettingsOpen(true);
        }}
        onOpenCreateTemplate={() => setCreateTemplateOpen(true)}
        onOpenPhrase={handleOpenPhrase}
        phraseUnseen={phraseUnseen}
        onSyncNow={syncNow}
        syncing={syncing}
        onViewFriend={setViewingFriend}
        onlineFriendIds={onlineFriendIds}
        onAddFriend={() => {
          setSettingsSection("friends");
          setSettingsOpen(true);
        }}
        settingsBadgeCount={supportBadgeCount}
        resetMonthRequest={resetMonthRequest}
      />
      <DayPanel
        selectedDate={selectedDate}
        onSwipeDay={(delta) => setSelectedDate((d) => addDays(d, delta))}
        dataFresh={dataFresh}
        onRefresh={syncNow}
        occurrences={occurrences}
        tags={tags}
        streak={streak}
        bestStreak={bestStreak}
        todayStatus={todayStatus}
        weekly={weekly}
        freezesRemaining={freezesRemainingThisMonth}
        templateBreakdown={templateBreakdown}
        quote={quote}
        yourAvatarId={friendStreaks.yourAvatarId}
        friendStreakEntries={friendStreaks.friends}
        friendStreaksLoading={friendStreaks.loading}
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
        templates={templates}
        onApplyTemplate={handleApplyTemplate}
        onAddTask={() => setFormState({ open: true })}
        notes={dayNotes}
        onAddNote={() => setNoteFormState({ open: true })}
        onEditNote={(note) => setNoteFormState({ open: true, note })}
        onDeleteNote={handleRequestDeleteNote}
        onChangeNoteContent={(id, content) => {
          setNotes((prev) => prev.map((n) => (n.id === id ? { ...n, content } : n)));
          void updateNote(id, content);
        }}
        onReorderNotePositions={handleReorderNotePositions}
        expanded={mobileTab === "today"}
        onToggleExpanded={() =>
          setMobileTab((t) => (t === "today" ? "calendar" : "today"))
        }
        tradingResult={tradingResults[selectedDate] ?? null}
        tradingResultUnit={tradingResultUnit}
        onSetTradingResult={(value, unit) =>
          void handleSetTradingResult(value, unit)
        }
        addMenuOpenRequest={addMenuOpenRequest}
      />
      <MobileTabBar
        activeTab={settingsOpen ? settingsTab : mobileTab}
        onSelectTab={(tab) => {
          // Leaving the Settings/Profile tab just closes it - the re-tap
          // shortcuts below only apply when already on that tab.
          if (settingsOpen) {
            setSettingsOpen(false);
          } else {
            if (tab === "calendar" && mobileTab === "calendar")
              setResetMonthRequest((n) => n + 1);
          }
          if (tab === "today") setSelectedDate(todayKey());
          setMobileTab(tab);
        }}
        onAdd={() => {
          // A past day can't take new tasks (see AddMenu's disabled), so
          // "+" lands on today instead of opening a menu that can't add.
          // The sheet opens over whichever tab you're on, for the day
          // selected there - only a past day (which can't take new tasks)
          // falls back to today.
          if (selectedDate < todayKey()) setSelectedDate(todayKey());
          setAddMenuOpenRequest((n) => n + 1);
        }}
        onOpenProfile={() => {
          // Opening it, switching to it from Settings, or tapping it again
          // all land on the Profile page.
          setSettingsSection("profile");
          setSettingsTab("profile");
          setSettingsKey((k) => k + 1);
          setSettingsOpen(true);
        }}
        onOpenSettings={() => {
          // Same for Settings: always its top-level list.
          setSettingsSection("home");
          setSettingsTab("settings");
          setSettingsKey((k) => k + 1);
          setSettingsOpen(true);
        }}
        avatarId={friendStreaks.yourAvatarId}
        profileBadgeCount={supportBadgeCount}
      />

      {noteFormState.open && (
        <NoteForm
          note={noteFormState.note}
          onSave={handleSaveNote}
          onClose={() => setNoteFormState({ open: false })}
          onDelete={
            noteFormState.note
              ? () => {
                  const id = noteFormState.note!.id;
                  setNoteFormState({ open: false });
                  handleRequestDeleteNote(id);
                }
              : undefined
          }
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
            formState.task && selectedDate >= todayKey()
              ? () => handleRequestDeleteTask(formState.task!)
              : undefined
          }
          onClose={() => setFormState({ open: false })}
        />
      )}

      {createTemplateOpen && (
        <Suspense fallback={null}>
          <TemplatesModal
            tags={tags}
            templates={templates}
            onClose={() => setCreateTemplateOpen(false)}
            onCreateTag={handleCreateTag}
            onUpdateTag={handleUpdateTag}
            onDeleteTag={handleDeleteTag}
            onSaveTemplate={handleSaveAsTemplate}
            onDeleteTemplate={handleDeleteTemplate}
          />
        </Suspense>
      )}
      {settingsOpen && (
        <Suspense fallback={null}>
          <SettingsModal
            key={settingsKey}
            initialSectionId={settingsSection}
            theme={theme}
            onChangeTheme={handleChangeTheme}
            customThemeColors={customColors}
            onSetCustomTheme={handleSetCustomTheme}
            appearanceMode={appearanceMode}
            onChangeAppearanceMode={handleChangeAppearanceMode}
            remindersEnabled={remindersEnabled}
            onChangeRemindersEnabled={handleChangeRemindersEnabled}
            reminderStatus={reminderStatus}
            onJumpToReminder={handleJumpToReminder}
            tasks={tasks}
            completions={completions}
            tags={tags}
            frozenDays={allFrozenDays}
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
            yourAvatarId={friendStreaks.yourAvatarId}
            friendStreakEntries={friendStreaks.friends}
            friendStreaksLoading={friendStreaks.loading}
            onClose={() => setSettingsOpen(false)}
            onSignOut={handleSignOut}
            onAccountDeleted={handleAccountDeleted}
            onFriendLimitReached={() => setPaywallFeature("More friends")}
            online={online}
            onViewFriend={setViewingFriend}
            membership={membership}
            onlineFriendIds={onlineFriendIds}
            supportBadgeCount={supportBadgeCount}
            onSupportSeen={refreshSupportBadge}
          />
        </Suspense>
      )}

      {paywallFeature && (
        <Suspense fallback={null}>
          <PremiumPaywallModal
            feature={paywallFeature}
            onClose={() => setPaywallFeature(null)}
          />
        </Suspense>
      )}

      {phraseModalOpen && (
        <PhraseModal quote={quote} onClose={() => setPhraseModalOpen(false)} />
      )}

      {viewingTask && (
        <TaskViewModal
          task={viewingTask}
          tag={tags.find((t) => t.id === viewingTask.tagId)}
          dateKey={selectedDate}
          completed={completions.has(`${viewingTask.id}:${selectedDate}`)}
          completions={completions}
          freezes={freezes}
          locked={selectedDate < todayKey()}
          onToggle={() => void handleToggle(viewingTask)}
          onEdit={handleEditFromView}
          onDelete={() => {
            const task = viewingTask;
            setViewingTask(null);
            handleRequestDeleteTask(task);
          }}
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
            noteToPlainText(pendingDeleteNote.content).length > 80
              ? `${noteToPlainText(pendingDeleteNote.content).slice(0, 80)}…`
              : noteToPlainText(pendingDeleteNote.content)
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
