import { useState } from "react";
import type { ReactNode } from "react";
import type { Friend } from "../../db/friends";
import type { ReminderStatus } from "../../hooks/useTaskReminders";
import type { Tag, Task, Template, TemplateTaskBlueprint, ThemeId } from "../../types";
import { WIDGET_IDS, WIDGET_LABELS, type WidgetId } from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import {
  MAX_FREEZES_PER_MONTH,
  type CategoryBreakdownItem,
  type FreezeCandidate,
  type TodayStatus,
  type WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { THEMES } from "../../utils/themes";
import { CategoryBreakdown } from "../stats/CategoryBreakdown";
import { FreezeSummary } from "../stats/FreezeSummary";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { Button } from "../ui/Button";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import {
  BellIcon,
  ChevronLeftIcon,
  FrostIcon,
  GridIcon,
  ProfileIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "../ui/icons";
import { BackupSection } from "./BackupSection";
import { CategoryManager } from "./CategoryManager";
import { FriendsManager } from "./FriendsManager";
import { ProfileSection } from "./ProfileSection";
import { ReminderList } from "./ReminderList";
import { SettingsNav, type SettingsSection } from "./SettingsNav";
import { StreakFreezeManager } from "./StreakFreezeManager";
import { ThemeCarousel } from "./ThemeCarousel";
import "./SettingsModal.css";

interface SettingsModalProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  remindersEnabled: boolean;
  onChangeRemindersEnabled: (enabled: boolean) => void;
  reminderStatus: ReminderStatus;
  tasks: Task[];
  completions: Set<string>;
  tags: Tag[];
  onCreateTag: (name: string, color: string) => Promise<Tag>;
  onUpdateTag: (id: string, name: string, color: string) => void;
  onDeleteTag: (id: string) => void;
  onReorderTags: (tagIds: string[]) => void;
  templates: Template[];
  onSaveAsTemplate: (tag: Tag, tasks: TemplateTaskBlueprint[]) => void;
  onDeleteTemplate: (id: string) => void;
  frozenDays: string[];
  freezeCandidates: FreezeCandidate[];
  freezesRemaining: number;
  onFreezeDay: (date: string) => void;
  onUnfreezeDay: (date: string) => void;
  onStartArranging: () => void;
  hiddenWidgets: WidgetId[];
  onHideWidget: (id: WidgetId) => void;
  onShowWidget: (id: WidgetId) => void;
  streak: number;
  bestStreak: number;
  todayStatus: TodayStatus;
  weekly: WeeklyCompletionData;
  categoryBreakdown: CategoryBreakdownItem[];
  quote: Quote;
  onClose: () => void;
  onSignOut: () => void;
  online: boolean;
  onViewFriend: (friend: Friend) => void;
}

const SECTIONS: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: ProfileIcon },
  { id: "widgets", label: "Widgets", icon: GridIcon },
  { id: "categories", label: "Categories", icon: TagIcon },
  { id: "freezes", label: "Streak Freezes", icon: FrostIcon },
  { id: "reminders", label: "Reminders", icon: BellIcon },
  { id: "friends", label: "Friends", icon: UsersIcon },
  { id: "account", label: "Account", icon: UserIcon },
];

export function SettingsModal({
  theme,
  onChangeTheme,
  remindersEnabled,
  onChangeRemindersEnabled,
  reminderStatus,
  tasks,
  completions,
  tags,
  onCreateTag,
  onUpdateTag,
  onDeleteTag,
  onReorderTags,
  templates,
  onSaveAsTemplate,
  onDeleteTemplate,
  frozenDays,
  freezeCandidates,
  freezesRemaining,
  onFreezeDay,
  onUnfreezeDay,
  onStartArranging,
  hiddenWidgets,
  onHideWidget,
  onShowWidget,
  streak,
  bestStreak,
  todayStatus,
  weekly,
  categoryBreakdown,
  quote,
  onClose,
  onSignOut,
  online,
  onViewFriend,
}: SettingsModalProps) {
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  // Only meaningful on phone-sized modal widths, where the nav list and the
  // section detail can't both fit - mirrors the same list/detail pattern
  // used for the calendar vs. day panel on mobile.
  const [showingDetail, setShowingDetail] = useState(false);

  function selectSection(id: string) {
    setActiveId(id);
    setShowingDetail(true);
  }

  function renderWidgetPreview(id: WidgetId): ReactNode {
    switch (id) {
      case "streak":
        return <StreakCounter streak={streak} best={bestStreak} today={todayStatus} />;
      case "weekly":
        return <WeeklyCompletion data={weekly} />;
      case "freezes":
        return <FreezeSummary remaining={freezesRemaining} total={MAX_FREEZES_PER_MONTH} />;
      case "categories":
        return <CategoryBreakdown data={categoryBreakdown} tags={tags} />;
      case "quote":
        return <QuoteWidget quote={quote} />;
    }
  }

  const activeLabel = SECTIONS.find((s) => s.id === activeId)?.label ?? "";

  return (
    <Modal title="Settings" onClose={onClose} size="wide">
      <div className="settings" data-mobile-pane={showingDetail ? "detail" : "list"}>
        <SettingsNav sections={SECTIONS} activeId={activeId} onSelect={selectSection} />

        <div className="settings-detail">
          <div className="settings-detail__header">
            <button
              type="button"
              className="settings-detail__back"
              onClick={() => setShowingDetail(false)}
              aria-label="Back to settings list"
            >
              <ChevronLeftIcon size={16} />
            </button>
            <h3 className="settings-detail__title">{activeLabel}</h3>
          </div>

          <div className="settings-detail__body">
          <div className="settings-detail__pane" key={activeId}>
            {activeId === "profile" && (
              <>
                <div className="settings__section">
                  <span className="settings__label">Theme</span>
                  <ThemeCarousel themes={THEMES} selected={theme} onSelect={onChangeTheme} />
                </div>
                <ProfileSection />
              </>
            )}

            {activeId === "widgets" && (
              <div className="settings__section">
                <span className="settings__hint">
                  Choose which widgets show up on your day panel, and preview what
                  each one looks like with your real data.
                </span>
                <div className="widget-gallery">
                  {WIDGET_IDS.map((id) => {
                    const visible = !hiddenWidgets.includes(id);
                    return (
                      <div className="widget-gallery__item" key={id}>
                        <div
                          className={`widget-gallery__preview ${visible ? "" : "widget-gallery__preview--hidden"}`}
                          aria-hidden="true"
                        >
                          {renderWidgetPreview(id)}
                        </div>
                        <Checkbox
                          checked={visible}
                          onChange={(checked) => (checked ? onShowWidget(id) : onHideWidget(id))}
                          label={WIDGET_LABELS[id]}
                        />
                      </div>
                    );
                  })}
                </div>
                <div className="settings__row">
                  <span className="settings__row-text">
                    <span className="only-desktop">
                      Reorder the streak, weekly %, and task list on the right panel
                    </span>
                    <span className="only-mobile">
                      Reorder the streak, weekly %, and task list sections
                    </span>
                  </span>
                  <Button onClick={onStartArranging}>
                    <span className="only-desktop">Arrange right panel</span>
                    <span className="only-mobile">Arrange panel</span>
                  </Button>
                </div>
              </div>
            )}

            {activeId === "categories" && (
              <CategoryManager
                tags={tags}
                templates={templates}
                onCreateTag={onCreateTag}
                onUpdateTag={onUpdateTag}
                onDeleteTag={onDeleteTag}
                onReorderTags={onReorderTags}
                onSaveTemplate={onSaveAsTemplate}
                onDeleteTemplate={onDeleteTemplate}
              />
            )}

            {activeId === "freezes" && (
              <StreakFreezeManager
                frozenDays={frozenDays}
                candidates={freezeCandidates}
                freezesRemaining={freezesRemaining}
                onFreeze={onFreezeDay}
                onUnfreeze={onUnfreezeDay}
              />
            )}

            {activeId === "reminders" && (
              <div className="settings__section">
                <Checkbox
                  checked={remindersEnabled}
                  onChange={onChangeRemindersEnabled}
                  label="Notify me when a scheduled task's time arrives"
                />
                <span className="settings__hint">
                  Needs notification permission - once granted, these arrive even if
                  the app isn't open.
                </span>
                {remindersEnabled && reminderStatus.permission === "denied" && (
                  <span className="settings__hint settings__hint--warning">
                    Notifications permission was denied - enable it for this app in
                    your device's system Settings.
                  </span>
                )}
                {remindersEnabled && reminderStatus.lastError && (
                  <span className="settings__hint settings__hint--warning">
                    Couldn't schedule reminders: {reminderStatus.lastError}
                  </span>
                )}
                {remindersEnabled && reminderStatus.permission === "granted" && (
                  <span
                    className={`settings__hint ${
                      reminderStatus.attemptedCount > reminderStatus.confirmedCount
                        ? "settings__hint--warning"
                        : ""
                    }`}
                  >
                    {reminderStatus.attemptedCount > reminderStatus.confirmedCount
                      ? `${reminderStatus.attemptedCount - reminderStatus.confirmedCount} of ${reminderStatus.attemptedCount} reminders didn't actually register with the system - they may not arrive.`
                      : `${reminderStatus.confirmedCount} reminder${reminderStatus.confirmedCount === 1 ? "" : "s"} confirmed with the system.`}
                  </span>
                )}
                {remindersEnabled && (
                  <>
                    <span className="settings__label">Upcoming reminders</span>
                    <ReminderList tasks={tasks} completions={completions} />
                  </>
                )}
              </div>
            )}

            {activeId === "friends" && (
              <FriendsManager
                online={online}
                onViewFriend={(friend) => {
                  onViewFriend(friend);
                  onClose();
                }}
              />
            )}

            {activeId === "account" && (
              <>
                <BackupSection />
                <div className="settings__row">
                  <span className="settings__row-text">Sign out of your account on this device</span>
                  <Button variant="danger" onClick={onSignOut}>
                    Sign out
                  </Button>
                </div>
              </>
            )}
          </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
