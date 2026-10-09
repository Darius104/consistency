import { Fragment, useEffect, useState } from "react";
import type { ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Friend } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import type { ReminderStatus } from "../../hooks/useTaskReminders";
import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { Tag, Task, ThemeId } from "../../types";
import type { AppearanceMode } from "../../utils/themes";
import type { AvatarId } from "../../utils/avatars";
import type { RandomThemeColors } from "../../utils/randomTheme";
import {
  FREE_WIDGET_LIMIT,
  WIDGET_IDS,
  WIDGET_LABELS,
  type WidgetId,
} from "../../utils/panelOrder";
import type { Quote } from "../../utils/quotes";
import {
  MAX_FREEZES_PER_MONTH,
  type TemplateBreakdownItem,
  type FreezeCandidate,
  type TodayStatus,
  type WeeklyCompletion as WeeklyCompletionData,
} from "../../utils/stats";
import { TemplateBreakdown } from "../stats/TemplateBreakdown";
import { FreezeSummary } from "../stats/FreezeSummary";
import { FriendStreakCompare } from "../stats/FriendStreakCompare";
import { QuoteWidget } from "../stats/QuoteWidget";
import { StreakCounter } from "../stats/StreakCounter";
import { WeeklyCompletion } from "../stats/WeeklyCompletion";
import { Modal } from "../ui/Modal";
import { Switch } from "../ui/Switch";
import {
  BellIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  CrownIcon,
  EyeIcon,
  FrostIcon,
  GridIcon,
  HeartIcon,
  HelpIcon,
  ProfileIcon,
  PaletteIcon,
  UserIcon,
  UsersIcon,
} from "../ui/icons";
import { AdminPreviewSection } from "./AdminPreviewSection";
import { AppUpdateSection } from "./AppUpdateSection";
import { BackupSection } from "./BackupSection";
import { AppearancePicker } from "./AppearancePicker";
import { DeleteAccountModal } from "./DeleteAccountModal";
import { DonateSection } from "./DonateSection";
import { FriendsManager } from "./FriendsManager";
import { MembershipSection } from "./MembershipSection";
import { ProfileSection } from "./ProfileSection";
import { ReminderList } from "./ReminderList";
import {
  SettingsHome,
  type SettingsHomeRow,
  type SettingsSection,
} from "./SettingsHome";
import { StreakFreezeManager } from "./StreakFreezeManager";
import { SupportSection } from "./SupportSection";
import "./SettingsModal.css";

interface SettingsModalProps {
  /** Which section to land on when this opens - defaults to the first
   *  section (Profile) if omitted. Lets a shortcut elsewhere in the app
   *  (e.g. the calendar header's "+ Friends" button) jump straight to a
   *  specific section instead of always opening to the top. */
  initialSectionId?: string;
  theme: ThemeId;
  onChangeTheme: (theme: ThemeId) => void;
  customThemeColors: RandomThemeColors | null;
  onSetCustomTheme: (hue: number) => void;
  appearanceMode: AppearanceMode;
  onChangeAppearanceMode: (mode: AppearanceMode) => void;
  remindersEnabled: boolean;
  onChangeRemindersEnabled: (enabled: boolean) => void;
  reminderStatus: ReminderStatus;
  onJumpToReminder: (taskId: string, date: string) => void;
  tasks: Task[];
  completions: Set<string>;
  tags: Tag[];
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
  yourAvatarId: AvatarId | null;
  friendStreakEntries: FriendStreakEntry[];
  friendStreaksLoading: boolean;
  /** All your friends' ids - for the "N online" count. */
  friendIds: string[];
  /** Tells App whether the Widgets page is open (it loads friends'
   *  streaks for its preview only then). */
  onWidgetsPageChange: (open: boolean) => void;
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
  { id: "appearance", label: "Appearance", icon: PaletteIcon },
  { id: "widgets", label: "Widgets", icon: GridIcon },
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
  initialSectionId,
  theme,
  onChangeTheme,
  customThemeColors,
  onSetCustomTheme,
  appearanceMode,
  onChangeAppearanceMode,
  remindersEnabled,
  onChangeRemindersEnabled,
  reminderStatus,
  onJumpToReminder,
  tasks,
  completions,
  tags,
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
  yourAvatarId,
  friendStreakEntries,
  friendStreaksLoading,
  friendIds,
  onWidgetsPageChange,
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
    ...BASE_SECTIONS.map((s) =>
      s.id === "support" ? { ...s, badge: supportBadgeCount } : s,
    ),
    ...(membership.actualTier === "admin" ? [ADMIN_SECTION] : []),
  ];
  // "home" = just open Settings (the phone's start list); the desktop
  // sidebar then shows Profile beside it.
  const [activeId, setActiveId] = useState(
    initialSectionId && initialSectionId !== "home"
      ? initialSectionId
      : SECTIONS[0].id,
  );
  // Only meaningful on phone-sized modal widths, where the nav list and the
  // section detail can't both fit - mirrors the same list/detail pattern
  // used for the calendar vs. day panel on mobile.
  // Phone: a shortcut straight to a section (the avatar -> Profile, the
  // Friends tab) opens that page; the Settings tab lands on the start list.
  const [showingDetail, setShowingDetail] = useState(
    initialSectionId !== undefined && initialSectionId !== "home",
  );
  const [deletingAccount, setDeletingAccount] = useState(false);
  const [previewWidget, setPreviewWidget] = useState<WidgetId | null>(null);

  useEffect(() => {
    onWidgetsPageChange(activeId === "widgets");
  }, [activeId, onWidgetsPageChange]);
  useEffect(() => () => onWidgetsPageChange(false), [onWidgetsPageChange]);

  function selectSection(id: string) {
    setActiveId(id);
    setShowingDetail(true);
  }

  function renderWidgetPreview(id: WidgetId): ReactNode {
    switch (id) {
      case "streak":
        return (
          <StreakCounter
            streak={streak}
            best={bestStreak}
            today={todayStatus}
          />
        );
      case "weekly":
        return <WeeklyCompletion data={weekly} />;
      case "freezes":
        return (
          <FreezeSummary
            remaining={freezesRemaining}
            total={MAX_FREEZES_PER_MONTH}
          />
        );
      case "templates":
        return <TemplateBreakdown data={templateBreakdown} tags={tags} />;
      case "quote":
        return <QuoteWidget quote={quote} />;
      case "friendStreaks":
        return (
          <FriendStreakCompare
            primaryStreak={streak}
            primaryAvatarId={yourAvatarId}
            friends={friendStreakEntries}
            loading={friendStreaksLoading}
          />
        );
    }
  }

  const activeLabel = SECTIONS.find((s) => s.id === activeId)?.label ?? "";

  // Phone start screen (SettingsHome): grouped like iOS Settings, each row
  // with its own icon color and current value.
  const visibleWidgetCount = WIDGET_IDS.length - hiddenWidgets.length;
  const homeRow = (
    id: string,
    color: string,
    value?: string,
  ): SettingsHomeRow | null => {
    const section = SECTIONS.find((sec) => sec.id === id);
    return section ? { ...section, color, value } : null;
  };
  // Presence lists every signed-in account (you included), so only count
  // the ones that are actually your friends.
  const onlineFriendCount = friendIds.filter((id) =>
    onlineFriendIds.has(id),
  ).length;

  const homeGroups = [
    [
      homeRow("appearance", "#8b5cf6"),
      homeRow("widgets", "#f97316", `${visibleWidgetCount} on`),
      homeRow("reminders", "#ef4444", remindersEnabled ? "On" : "Off"),
    ],
    [homeRow("freezes", "#0ea5e9", `${freezesRemaining} left`)],
    [
      homeRow(
        "friends",
        "#22c55e",
        onlineFriendCount > 0 ? `${onlineFriendCount} online` : undefined,
      ),
      homeRow("support", "#3b82f6"),
    ],
    [
      homeRow(
        "membership",
        "#eab308",
        membership.isPremium ? "Premium" : "Free",
      ),
      homeRow("donate", "#ec4899"),
    ],
    [homeRow("account", "#64748b"), homeRow("admin-preview", "#6b7280")],
  ].map((group) => group.filter((r): r is SettingsHomeRow => r !== null));

  return (
    <Modal title="Settings" onClose={onClose} size="wide" asTab>
      <div
        className="settings"
        data-mobile-pane={showingDetail ? "detail" : "list"}
      >
        <SettingsHome
          groups={homeGroups}
          avatarId={yourAvatarId}
          streak={streak}
          isPremium={membership.isPremium}
          onSelect={selectSection}
          onSignOut={onSignOut}
          activeId={activeId}
        />

        <div className="settings-detail">
          <div className="settings-detail__header">
            <button
              type="button"
              className="settings-detail__back"
              onClick={() => setShowingDetail(false)}
              aria-label="Back to settings list"
            >
              <ChevronLeftIcon size={18} />
              <span className="settings-detail__back-label">Settings</span>
            </button>
            <h3 className="settings-detail__title">{activeLabel}</h3>
          </div>

          <div className="settings-detail__body">
            <div className="settings-detail__pane" key={activeId}>
              {activeId === "profile" && <ProfileSection />}

              {activeId === "appearance" && (
                <div className="settings-pages">
                  <div className="settings-group-wrap">
                    <span className="settings-group__title">Mode</span>
                    <div
                      className="appearance-mode"
                      role="radiogroup"
                      aria-label="Light or dark"
                    >
                      {(["dark", "light"] as const).map((m) => (
                        <button
                          key={m}
                          type="button"
                          role="radio"
                          aria-checked={appearanceMode === m}
                          className={`appearance-mode__option ${appearanceMode === m ? "appearance-mode__option--active" : ""}`}
                          onClick={() => onChangeAppearanceMode(m)}
                        >
                          <span
                            className={`appearance-mode__preview appearance-mode__preview--${m}`}
                            aria-hidden="true"
                          >
                            <span />
                            <span />
                          </span>
                          {m === "dark" ? "Dark" : "Light"}
                        </button>
                      ))}
                    </div>
                    <span className="settings-footnote">
                      Works with every theme below, on all your devices.
                    </span>
                  </div>
                  <div className="settings-group-wrap">
                    <span className="settings-group__title">Theme</span>
                    <div className="settings-group settings-group--padded">
                      <AppearancePicker
                        activeTheme={theme}
                        customColors={customThemeColors}
                        onChangeTheme={onChangeTheme}
                        onSetCustomTheme={onSetCustomTheme}
                      />
                    </div>
                    <span className="settings-footnote">
                      Pick a theme, or build your own from any color.
                    </span>
                  </div>
                </div>
              )}

              {activeId === "widgets" && (
                <div className="settings-pages">
                  <div className="settings-group-wrap">
                    <div className="settings-group">
                      <button
                        type="button"
                        className="settings-group__row settings-group__row--accent"
                        onClick={onStartArranging}
                      >
                        <span className="settings-group__label">
                          Arrange widgets
                        </span>
                        <ChevronRightIcon
                          size={15}
                          className="settings-group__chevron"
                        />
                      </button>
                    </div>
                    <span className="settings-footnote">
                      Reorder them right on your day panel.
                    </span>
                  </div>

                  <div className="settings-group-wrap">
                    <span className="settings-group__title">
                      Show on your day
                    </span>
                    <div className="settings-group">
                      {WIDGET_IDS.map((id) => {
                        const visible = !hiddenWidgets.includes(id);
                        const locked =
                          !visible &&
                          !membership.isPremium &&
                          visibleWidgetCount >= FREE_WIDGET_LIMIT;
                        const previewing = previewWidget === id;
                        return (
                          <Fragment key={id}>
                            {/* Two separate controls in one row - tapping the
                              name previews the widget, the switch shows or
                              hides it (a switch nested inside a row button
                              was invalid HTML and could swallow taps). */}
                            <div className="settings-group__row settings-group__row--split">
                              <button
                                type="button"
                                className="settings-group__row-main"
                                aria-expanded={previewing}
                                onClick={() =>
                                  setPreviewWidget(previewing ? null : id)
                                }
                              >
                                <ChevronRightIcon
                                  size={14}
                                  className={`settings-group__chevron ${previewing ? "settings-group__chevron--open" : ""}`}
                                />
                                <span className="settings-group__label">
                                  {WIDGET_LABELS[id]}
                                </span>
                                {locked && (
                                  <span className="settings-group__value">
                                    Premium
                                  </span>
                                )}
                              </button>
                              <Switch
                                checked={visible}
                                onChange={(checked) =>
                                  checked ? onShowWidget(id) : onHideWidget(id)
                                }
                                label={`Show ${WIDGET_LABELS[id]}`}
                              />
                            </div>
                            {previewing && (
                              <div
                                className="settings-group__expand widget-preview"
                                aria-hidden="true"
                              >
                                {renderWidgetPreview(id)}
                              </div>
                            )}
                          </Fragment>
                        );
                      })}
                    </div>
                    <span className="settings-footnote">
                      Tap a widget to preview it with your data.
                    </span>
                  </div>
                </div>
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
                <div className="settings-pages">
                  <div className="settings-group-wrap">
                    <div className="settings-group">
                      <div className="settings-group__row">
                        <span className="settings-group__label">
                          Task reminders
                        </span>
                        <Switch
                          checked={remindersEnabled}
                          onChange={onChangeRemindersEnabled}
                          label="Task reminders"
                        />
                      </div>
                      {remindersEnabled &&
                        reminderStatus.permission === "denied" && (
                          <button
                            type="button"
                            className="settings-group__row settings-group__row--accent"
                            onClick={() =>
                              void openUrl(
                                "x-apple.systempreferences:com.apple.preference.notifications",
                              )
                            }
                          >
                            <span className="settings-group__label">
                              Allow notifications in System Settings
                            </span>
                            <ChevronRightIcon
                              size={15}
                              className="settings-group__chevron"
                            />
                          </button>
                        )}
                    </div>
                    <span className="settings-footnote">
                      At each task's time, plus a 9 PM nudge if anything's still
                      left today.
                    </span>
                    {remindersEnabled && reminderStatus.usesServerPush && (
                      <span className="settings-footnote settings-footnote--success">
                        Sent by the server - tick a task on any device and its
                        reminder won't come.
                      </span>
                    )}
                    {remindersEnabled &&
                      reminderStatus.permission === "denied" && (
                        <span className="settings-footnote settings-footnote--warning">
                          Notifications are turned off for Consistency.
                        </span>
                      )}
                    {remindersEnabled && reminderStatus.lastError && (
                      <span className="settings-footnote settings-footnote--warning">
                        Couldn't schedule reminders: {reminderStatus.lastError}
                      </span>
                    )}
                    {remindersEnabled &&
                      reminderStatus.permission === "granted" &&
                      reminderStatus.usesLiveFallback && (
                        <span className="settings-footnote">
                          On this device they only arrive while the app is open.
                        </span>
                      )}
                    {remindersEnabled &&
                      reminderStatus.permission === "granted" &&
                      !reminderStatus.usesLiveFallback &&
                      reminderStatus.attemptedCount >
                        reminderStatus.confirmedCount && (
                        <span className="settings-footnote settings-footnote--warning">
                          {reminderStatus.attemptedCount -
                            reminderStatus.confirmedCount}{" "}
                          of {reminderStatus.attemptedCount} reminders didn't
                          register - they may not arrive.
                        </span>
                      )}
                  </div>

                  {remindersEnabled && (
                    <div className="settings-group-wrap">
                      <span className="settings-group__title">Upcoming</span>
                      <div className="settings-group settings-group--padded">
                        <ReminderList
                          tasks={tasks}
                          completions={completions}
                          onSelectReminder={onJumpToReminder}
                        />
                      </div>
                    </div>
                  )}
                </div>
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
                <SupportSection
                  membership={membership}
                  onSeen={onSupportSeen}
                />
              )}

              {activeId === "account" && (
                <div className="settings-pages">
                  {/* The phone updates through the App Store / TestFlight. */}
                  <div className="only-desktop">
                    <AppUpdateSection />
                  </div>
                  <BackupSection />

                  <div className="settings-group-wrap">
                    <span className="settings-group__title">Legal</span>
                    <div className="settings-group">
                      <button
                        type="button"
                        className="settings-group__row"
                        onClick={() => void openUrl(TERMS_URL)}
                      >
                        <span className="settings-group__label">
                          Terms and Conditions
                        </span>
                        <ChevronRightIcon
                          size={15}
                          className="settings-group__chevron"
                        />
                      </button>
                      <button
                        type="button"
                        className="settings-group__row"
                        onClick={() => void openUrl(PRIVACY_URL)}
                      >
                        <span className="settings-group__label">
                          Privacy Policy
                        </span>
                        <ChevronRightIcon
                          size={15}
                          className="settings-group__chevron"
                        />
                      </button>
                    </div>
                  </div>

                  <div className="settings-group">
                    <button
                      type="button"
                      className="settings-group__row settings-group__row--danger"
                      onClick={onSignOut}
                    >
                      Sign out
                    </button>
                  </div>

                  <div className="settings-group-wrap">
                    <div className="settings-group">
                      <button
                        type="button"
                        className="settings-group__row settings-group__row--danger"
                        onClick={() => setDeletingAccount(true)}
                      >
                        Delete account
                      </button>
                    </div>
                    <span className="settings-footnote">
                      Permanently deletes your account and all its data.
                    </span>
                  </div>
                </div>
              )}

              {activeId === "admin-preview" && (
                <AdminPreviewSection membership={membership} />
              )}
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
