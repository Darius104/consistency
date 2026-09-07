import { useEffect, useState } from "react";
import { CalendarView } from "./components/calendar/CalendarView";
import { PhraseModal } from "./components/calendar/PhraseModal";
import { DayPanel } from "./components/day-panel/DayPanel";
import { TaskViewModal } from "./components/day-panel/TaskViewModal";
import { SettingsModal } from "./components/settings/SettingsModal";
import { TaskForm } from "./components/task-form/TaskForm";
import {
  addStreakFreeze,
  applyTemplate,
  createTag,
  createTask,
  createTemplateFromTasks,
  deleteTag,
  deleteTask,
  deleteTemplate,
  getAllCompletions,
  getAllTasks,
  getSetting,
  getStreakFreezes,
  getTags,
  getTemplates,
  removeStreakFreeze,
  setCompletion,
  setSetting,
  updateTag,
  updateTagOrder,
  updateTask,
  updateTaskOrder,
} from "./db/queries";
import type { NewTask, Tag, Task, Template, TemplateTaskBlueprint, ThemeId } from "./types";
import { startOfWeek, todayKey } from "./utils/dates";
import { tasksScheduledOn } from "./utils/recurrence";
import {
  computeLongestStreak,
  computeStreak,
  computeTodayStatus,
  computeWeeklyCompletion,
  freezesRemainingInMonth,
  getFreezeCandidates,
} from "./utils/stats";
import { DEFAULT_THEME } from "./utils/themes";
import { generateRandomThemeColors, type RandomThemeColors } from "./utils/randomTheme";
import { getQuoteOfDay } from "./utils/quotes";
import {
  DEFAULT_PANEL_ORDER,
  parsePanelOrder,
  type PanelBlockId,
} from "./utils/panelOrder";
import { useTaskReminders } from "./hooks/useTaskReminders";
import "./App.css";

const THEME_SETTING_KEY = "theme";
const RANDOM_THEME_SETTING_KEY = "randomThemeColors";
const REMINDERS_SETTING_KEY = "remindersEnabled";
const PANEL_ORDER_SETTING_KEY = "panelOrder";
const PHRASE_VIEW_SETTING_KEY = "lastPhraseViewDate";

const RANDOM_THEME_CSS_VARS: Record<keyof RandomThemeColors, string> = {
  bg: "--bg",
  bgElevated: "--bg-elevated",
  surface: "--surface",
  surfaceHover: "--surface-hover",
  border: "--border",
  borderStrong: "--border-strong",
  text: "--text",
  textSecondary: "--text-secondary",
  textMuted: "--text-muted",
  accent: "--accent",
  accentRgb: "--accent-rgb",
  accentSoft: "--accent-soft",
};

export default function App() {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [tags, setTags] = useState<Tag[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [completions, setCompletions] = useState<Set<string>>(new Set());
  const [freezes, setFreezes] = useState<Set<string>>(new Set());
  const [selectedDate, setSelectedDate] = useState(todayKey());
  const [theme, setTheme] = useState<ThemeId>(DEFAULT_THEME);
  const [randomColors, setRandomColors] = useState<RandomThemeColors | null>(null);
  const [remindersEnabled, setRemindersEnabled] = useState(false);
  const [panelOrder, setPanelOrder] = useState<PanelBlockId[]>(DEFAULT_PANEL_ORDER);
  const [arranging, setArranging] = useState(false);
  const [loading, setLoading] = useState(true);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [phraseModalOpen, setPhraseModalOpen] = useState(false);
  const [lastPhraseViewDate, setLastPhraseViewDate] = useState<string | null>(null);
  const [viewingTask, setViewingTask] = useState<Task | null>(null);
  const [formState, setFormState] = useState<
    { open: false } | { open: true; task?: Task }
  >({ open: false });

  useEffect(() => {
    void refreshAll();
  }, []);

  useEffect(() => {
    document.documentElement.setAttribute("data-theme", theme);
  }, [theme]);

  // The eight hand-picked themes are static [data-theme] blocks in
  // tokens.css; "random" has no such block, so its colors are applied
  // directly as inline custom properties instead - and cleared again the
  // moment a real theme is picked, so its static block takes back over.
  useEffect(() => {
    const root = document.documentElement.style;
    const active = theme === "random" ? randomColors : null;
    for (const key of Object.keys(RANDOM_THEME_CSS_VARS) as (keyof RandomThemeColors)[]) {
      const cssVar = RANDOM_THEME_CSS_VARS[key];
      if (active) root.setProperty(cssVar, active[key]);
      else root.removeProperty(cssVar);
    }
  }, [theme, randomColors]);

  useTaskReminders(tasks, completions, remindersEnabled);

  async function refreshAll() {
    const [
      taskRows,
      tagRows,
      templateRows,
      completionRows,
      freezeRows,
      savedTheme,
      savedRandomColors,
      savedReminders,
      savedPanelOrder,
      savedPhraseViewDate,
    ] = await Promise.all([
      getAllTasks(),
      getTags(),
      getTemplates(),
      getAllCompletions(),
      getStreakFreezes(),
      getSetting(THEME_SETTING_KEY),
      getSetting(RANDOM_THEME_SETTING_KEY),
      getSetting(REMINDERS_SETTING_KEY),
      getSetting(PANEL_ORDER_SETTING_KEY),
      getSetting(PHRASE_VIEW_SETTING_KEY),
    ]);
    setTasks(taskRows);
    setTags(tagRows);
    setTemplates(templateRows);
    setCompletions(completionRows);
    setFreezes(freezeRows);
    if (savedTheme) setTheme(savedTheme as ThemeId);
    if (savedRandomColors) setRandomColors(JSON.parse(savedRandomColors));
    if (savedReminders !== null) setRemindersEnabled(savedReminders === "true");
    setPanelOrder(parsePanelOrder(savedPanelOrder));
    setLastPhraseViewDate(savedPhraseViewDate);
    setLoading(false);
  }

  async function handleOpenPhrase() {
    setPhraseModalOpen(true);
    setLastPhraseViewDate(todayKey());
    await setSetting(PHRASE_VIEW_SETTING_KEY, todayKey());
  }

  async function handleChangeTheme(next: ThemeId) {
    setTheme(next);
    await setSetting(THEME_SETTING_KEY, next);

    // Re-rolls every time "random" is picked, even if it's already active -
    // that's the whole point of it being random rather than just one more
    // fixed swatch.
    if (next === "random") {
      const colors = generateRandomThemeColors();
      setRandomColors(colors);
      await setSetting(RANDOM_THEME_SETTING_KEY, JSON.stringify(colors));
    }
  }

  async function handleChangeRemindersEnabled(next: boolean) {
    setRemindersEnabled(next);
    await setSetting(REMINDERS_SETTING_KEY, String(next));
  }

  async function handleReorderPanel(next: PanelBlockId[]) {
    setPanelOrder(next);
    await setSetting(PANEL_ORDER_SETTING_KEY, JSON.stringify(next));
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

  async function handleReorderTasks(taskIds: number[]) {
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

  async function handleUpdateTag(id: number, name: string, color: string) {
    await updateTag(id, name, color);
    await refreshAll();
  }

  async function handleDeleteTag(id: number) {
    await deleteTag(id);
    await refreshAll();
  }

  async function handleReorderTags(tagIds: number[]) {
    const orderMap = new Map(tagIds.map((id, i) => [id, i]));
    setTags((prev) =>
      [...prev]
        .map((t) => (orderMap.has(t.id) ? { ...t, sortOrder: orderMap.get(t.id)! } : t))
        .sort((a, b) => a.sortOrder - b.sortOrder),
    );
    await updateTagOrder(tagIds);
  }

  async function handleSaveAsTemplate(tag: Tag, tasks: TemplateTaskBlueprint[]) {
    const template = await createTemplateFromTasks(tag.name, tag.id, tasks);
    setTemplates((prev) => {
      const exists = prev.some((t) => t.id === template.id);
      const next = exists
        ? prev.map((t) => (t.id === template.id ? template : t))
        : [...prev, template];
      return next.sort((a, b) => a.name.localeCompare(b.name));
    });
  }

  async function handleApplyTemplate(templateId: number) {
    await applyTemplate(templateId, selectedDate);
    await refreshAll();
  }

  function handleEditFromView() {
    if (!viewingTask) return;
    setFormState({ open: true, task: viewingTask });
    setViewingTask(null);
  }

  async function handleDeleteTemplate(id: number) {
    await deleteTemplate(id);
    setTemplates((prev) => prev.filter((t) => t.id !== id));
  }

  if (loading) {
    return <div className="app-loading">Loading…</div>;
  }

  const occurrences = tasksScheduledOn(tasks, selectedDate).map((task) => ({
    task,
    completed: completions.has(`${task.id}:${selectedDate}`),
  }));

  const streak = computeStreak(tasks, completions, freezes, todayKey());
  const bestStreak = Math.max(
    streak,
    computeLongestStreak(tasks, completions, freezes, todayKey()),
  );
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
  const phraseUnseen = lastPhraseViewDate !== todayKey();

  return (
    <div className="app">
      <CalendarView
        tasks={tasks}
        completions={completions}
        freezes={freezes}
        selectedDate={selectedDate}
        onSelectDate={setSelectedDate}
        onOpenSettings={() => setSettingsOpen(true)}
        onOpenPhrase={handleOpenPhrase}
        phraseUnseen={phraseUnseen}
      />
      <DayPanel
        selectedDate={selectedDate}
        occurrences={occurrences}
        tags={tags}
        streak={streak}
        bestStreak={bestStreak}
        todayStatus={todayStatus}
        weekly={weekly}
        freezesRemainingThisMonth={freezesRemainingThisMonth}
        order={panelOrder}
        onReorder={handleReorderPanel}
        arranging={arranging}
        onFinishArranging={() => setArranging(false)}
        onToggle={handleToggle}
        onView={setViewingTask}
        onDelete={handleDeleteTask}
        onReorderTasks={handleReorderTasks}
        onReorderTags={handleReorderTags}
        onSaveAsTemplate={handleSaveAsTemplate}
        onRemoveTemplate={handleDeleteTemplate}
        templates={templates}
        onApplyTemplate={handleApplyTemplate}
        onAddTask={() => setFormState({ open: true })}
      />

      {formState.open && (
        <TaskForm
          task={formState.task}
          defaultDate={selectedDate}
          tags={tags}
          onCreateTag={handleCreateTag}
          onSave={handleSaveTask}
          onDelete={
            formState.task ? () => handleDeleteTask(formState.task!) : undefined
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
          tags={tags}
          onUpdateTag={handleUpdateTag}
          onDeleteTag={handleDeleteTag}
          templates={templates}
          onDeleteTemplate={handleDeleteTemplate}
          frozenDays={frozenDaysThisMonth}
          freezeCandidates={freezeCandidates}
          freezesRemaining={freezesRemainingThisMonth}
          onFreezeDay={handleFreezeDay}
          onUnfreezeDay={handleUnfreezeDay}
          onStartArranging={handleStartArranging}
          onClose={() => setSettingsOpen(false)}
        />
      )}

      {phraseModalOpen && (
        <PhraseModal
          quote={getQuoteOfDay(todayKey())}
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
    </div>
  );
}
