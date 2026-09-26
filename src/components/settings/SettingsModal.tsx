import { useState } from "react";
import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Friend } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import type { ReminderStatus } from "../../hooks/useTaskReminders";
import type { Tag, Task, Template, TemplateTaskBlueprint, ThemeId } from "../../types";
import type { RandomThemeColors } from "../../utils/randomTheme";
import { FREE_WIDGET_LIMIT, WIDGET_IDS, WIDGET_LABELS, type WidgetId } from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import {
  MAX_FREEZES_PER_MONTH,
  type TemplateBreakdownItem,
  type FreezeCandidate,
  type TodayStatus,
  type WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { THEMES } from "../../utils/themes";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { FreezeSummary } from "../stats/FreezeSummary";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { Checkbox } from "../ui/Checkbox";
import { Modal } from "../ui/Modal";
import {
  BellIcon,
  ChevronLeftIcon,
  CrownIcon,
  EyeIcon,
  FrostIcon,
  GridIcon,
  HeartIcon,
  HelpIcon,
  ProfileIcon,
  TagIcon,
  UserIcon,
  UsersIcon,
} from "../ui/icons";
import { AdminPreviewSection } from "./AdminPreviewSection";
import { AppUpdateSection } from "./AppUpdateSection";
import { BackupSection } from "./BackupSection";
import { CustomThemeCreator } from "./CustomThemeCreator";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { DonateSection } from "./DonateSection";
import { TemplateManager } from "./TemplateManager";
import { FriendsManager } from "./FriendsManager";
import { MembershipSection } from "./MembershipSection";
import { ProfileSection } from "./ProfileSection";
import { ReminderList } from "./ReminderList";
import { SettingsNav, type SettingsSection } from "./SettingsNav";
import { StreakFreezeManager } from "./StreakFreezeManager";
import { SupportSection } from "./SupportSection";
import { ThemeCarousel } from "./ThemeCarousel";
import "./SettingsModal.css";

interface SettingsModalProps {
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  customThemeColors: RandomThemeColors | null;
  onSetCustomTheme: (hexColor: string) => void;
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
  templateBreakdown: TemplateBreakdownItem[];
  quote: Quote;
  onClose: () => void;
  onSignOut: () => void;
  onAccountDeleted: () => void;
  onFriendLimitReached: () => void;
  online: boolean;
  onViewFriend: (friend: Friend) => void;
  membership: MembershipState;
  onlineFriendIds: Set<string>;
  supportBadgeCount?: number;
  onSupportSeen?: () => void;
}

const TERMS_URL = "https://darius104.github.io/consistency/terms.html";
const PRIVACY_URL = "https://darius104.github.io/consistency/privacy.html";

const BASE_SECTIONS: SettingsSection[] = [
  { id: "profile", label: "Profile", icon: ProfileIcon },
  { id: "widgets", label: "Widgets", icon: GridIcon },
  { id: "templates", label: "Templates", icon: TagIcon },
  { id: "freezes", label: "Streak Freezes", icon: FrostIcon },
  { id: "reminders", label: "Reminders", icon: BellIcon },
  { id: "friends", label: "Friends", icon: UsersIcon },
  { id: "membership", label: "Membership", icon: CrownIcon },
  { id: "donate", label: "Donate", icon: HeartIcon },
  { id: "support", label: "Support", icon: HelpIcon },
  { id: "account", label: "Account", icon: UserIcon },
];

const ADMIN_SECTION: SettingsSection = {
  id: "admin-preview",
  label: "Preview Mode",
  icon: EyeIcon,
};

export function SettingsModal({
  theme,
  onChangeTheme,
  customThemeColors,
  onSetCustomTheme,
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
  templateBreakdown,
  quote,
  onClose,
  onSignOut,
  onAccountDeleted,
  onFriendLimitReached,
  online,
  onViewFriend,
  membership,
  onlineFriendIds,
  supportBadgeCount,
  onSupportSeen,
}: SettingsModalProps) {
  const SECTIONS = [
    ...BASE_SECTIONS.map((s) => (s.id === "support" ? { ...s, badge: supportBadgeCount } : s)),
    ...(membership.actualTier === "admin" ? [ADMIN_SECTION] : []),
  ];
  const [activeId, setActiveId] = useState(SECTIONS[0].id);
  // Only meaningful on phone-sized modal widths, where the nav list and the
  // section detail can't both fit - mirrors the same list/detail pattern
  // used for the calendar vs. day panel on mobile.
  const [showingDetail, setShowingDetail] = useState(false);
  const [deletingAccount, setDeletingAccount] = useState(false);

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
      case "templates":
        return <TemplateBreakdown data={templateBreakdown} tags={tags} />;
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
                <Card>
                  <span className="settings__label">Theme</span>
                  <ThemeCarousel themes={THEMES} selected={theme} onSelect={onChangeTheme} />
                </Card>
                <CustomThemeCreator
                  active={theme === "custom"}
                  colors={customThemeColors}
                  onApply={onSetCustomTheme}
                />
                <ProfileSection />
              </>
            )}

            {activeId === "widgets" && (
              <>
                <Card>
                  <div className="settings__row">
                    <span className="settings__row-text">
                      <span className="only-desktop">Reorder widgets on the right panel</span>
                      <span className="only-mobile">Reorder your widgets</span>
                    </span>
                    <Button onClick={onStartArranging}>
                      <span className="only-desktop">Arrange right panel</span>
                      <span className="only-mobile">Arrange panel</span>
                    </Button>
                  </div>
                </Card>

                <Card>
                  <span className="settings__hint">
                    Choose which widgets show up on your day panel, and preview what
                    each one looks like with your real data.
                  </span>
                  <div className="widget-gallery">
                    {WIDGET_IDS.map((id) => {
                      const visible = !hiddenWidgets.includes(id);
                      const visibleCount = WIDGET_IDS.length - hiddenWidgets.length;
                      const locked = !visible && !membership.isPremium && visibleCount >= FREE_WIDGET_LIMIT;
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
                            label={locked ? `${WIDGET_LABELS[id]} (Premium)` : WIDGET_LABELS[id]}
                          />
                        </div>
                      );
                    })}
                  </div>
                </Card>
              </>
            )}

            {activeId === "templates" && (
              <TemplateManager
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
              <>
                <Card>
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
                    <div className="settings-status-banner settings-status-banner--warning">
                      Notifications permission was denied - enable it for this app in
                      your device's system Settings.
                    </div>
                  )}
                  {remindersEnabled && reminderStatus.lastError && (
                    <div className="settings-status-banner settings-status-banner--warning">
                      Couldn't schedule reminders: {reminderStatus.lastError}
                    </div>
                  )}
                  {remindersEnabled && reminderStatus.permission === "granted" && (
                    <div
                      className={`settings-status-banner ${
                        reminderStatus.attemptedCount > reminderStatus.confirmedCount
                          ? "settings-status-banner--warning"
                          : "settings-status-banner--success"
                      }`}
                    >
                      {reminderStatus.attemptedCount > reminderStatus.confirmedCount
                        ? `${reminderStatus.attemptedCount - reminderStatus.confirmedCount} of ${reminderStatus.attemptedCount} reminders didn't actually register with the system - they may not arrive.`
                        : `${reminderStatus.confirmedCount} reminder${reminderStatus.confirmedCount === 1 ? "" : "s"} confirmed with the system.`}
                    </div>
                  )}
                </Card>

                {remindersEnabled && (
                  <Card>
                    <span className="settings__label">Upcoming Reminders</span>
                    <ReminderList tasks={tasks} completions={completions} />
                  </Card>
                )}
              </>
            )}

            {activeId === "friends" && (
              <FriendsManager
                online={online}
                onlineFriendIds={onlineFriendIds}
                onViewFriend={(friend) => {
                  onViewFriend(friend);
                  onClose();
                }}
                isPremium={membership.isPremium}
                onFriendLimitReached={onFriendLimitReached}
              />
            )}

            {activeId === "membership" && (
              <MembershipSection
                online={online}
                membership={membership}
                onViewMember={(member) => {
                  onViewFriend(member);
                  onClose();
                }}
              />
            )}

            {activeId === "donate" && <DonateSection />}

            {activeId === "support" && (
              <SupportSection membership={membership} onSeen={onSupportSeen} />
            )}

            {activeId === "account" && (
              <>
                <AppUpdateSection />
                <BackupSection />
                <Card>
                  <span className="settings__label">Legal</span>
                  <div className="settings__legal-links">
                    <button
                      type="button"
                      className="settings__legal-link"
                      onClick={() => void openUrl(TERMS_URL)}
                    >
                      Terms and Conditions
                    </button>
                    <button
                      type="button"
                      className="settings__legal-link"
                      onClick={() => void openUrl(PRIVACY_URL)}
                    >
                      Privacy Policy
                    </button>
                  </div>
                </Card>
                <Card>
                  <div className="settings__row">
                    <span className="settings__row-text">Sign out of your account on this device</span>
                    <Button variant="danger" onClick={onSignOut}>
                      Sign out
                    </Button>
                  </div>
                </Card>
                <Card>
                  <div className="settings__row">
                    <span className="settings__row-text">
                      Permanently delete your account and all its data
                    </span>
                    <Button variant="danger" onClick={() => setDeletingAccount(true)}>
                      Delete account
                    </Button>
                  </div>
                </Card>
              </>
            )}

            {activeId === "admin-preview" && <AdminPreviewSection membership={membership} />}
          </div>
          </div>
        </div>
      </div>

      {deletingAccount && (
        <DeleteAccountModal
          onClose={() => setDeletingAccount(false)}
          onDeleted={() => {
            setDeletingAccount(false);
            onAccountDeleted();
          }}
        />
      )}
    </Modal>
  );
}
