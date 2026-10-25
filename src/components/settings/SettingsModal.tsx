import { Fragment, useEffect, useState } from "react";
import type { ComponentProps, CSSProperties, ReactNode } from "react";
import { openUrl } from "@tauri-apps/plugin-opener";
import type { Friend, MembershipTier } from "../../db/friends";
import type { MembershipState } from "../../hooks/useMembership";
import type { ReminderStatus } from "../../hooks/useTaskReminders";
import type { FriendStreakEntry } from "../../hooks/useFriendStreaks";
import type { Tag, Task, ThemeId } from "../../types";
import type { AppearanceMode } from "../../utils/themes";
import type { AvatarId } from "../../utils/avatars";
import type { RandomThemeColors } from "../../utils/randomTheme";
import {
  FREE_WIDGET_LIMIT,
  STREAK_STYLES,
  WIDGET_IDS,
  WIDGET_LABELS,
  type StreakStyle,
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
import { inkOn } from "../day-panel/addKinds";
import { WIDGET_INFO } from "../day-panel/WidgetGallery";
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
  GripIcon,
  HeartIcon,
  HelpIcon,
  ProfileIcon,
  PaletteIcon,
  SettingsIcon,
  TrendingUpIcon,
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
import { SettingsBanner } from "./SettingsBanner";
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
  /** The Day Streak widget's look - picked under its row in Widgets. */
  streakStyle: StreakStyle;
  onChangeStreakStyle: (style: StreakStyle) => void;
  /** Whether friends see your logged results on your calendar. */
  shareResults: boolean;
  onChangeShareResults: (share: boolean) => void;
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

/** Each page's own color - its icon in the list, the banner on top of the
 *  page, and the page's buttons (as --page-color, see SettingsModal.css). */
const PAGE_COLORS: Record<string, string> = {
  profile: "#6366f1",
  appearance: "#8b5cf6",
  widgets: "#f97316",
  freezes: "#0ea5e9",
  reminders: "#ef4444",
  friends: "#22c55e",
  membership: "#eab308",
  donate: "#ec4899",
  support: "#3b82f6",
  account: "#64748b",
  "admin-preview": "#6b7280",
};

const TIER_SHORT: Record<MembershipTier, string> = {
  free: "Free",
  premium: "Premium",
  admin: "Admin",
};

const TIER_SUBTITLE: Record<MembershipTier, string> = {
  free: "Upgrade for templates, more widgets and streak freezes.",
  premium: "Active · thanks for supporting Consistency.",
  admin: "See every member and change their tier.",
};

type BannerContent = Pick<
  ComponentProps<typeof SettingsBanner>,
  "subtitle" | "stat" | "aside"
>;

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
  streakStyle,
  onChangeStreakStyle,
  shareResults,
  onChangeShareResults,
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
            variant={streakStyle}
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

  const activeSection = SECTIONS.find((s) => s.id === activeId);
  const pageColor = PAGE_COLORS[activeId] ?? PAGE_COLORS.account;

  // Phone start screen (SettingsHome): grouped like iOS Settings, each row
  // with its own icon color and current value.
  const visibleWidgetCount = WIDGET_IDS.length - hiddenWidgets.length;
  const homeRow = (id: string, value?: string): SettingsHomeRow | null => {
    const section = SECTIONS.find((sec) => sec.id === id);
    return section ? { ...section, color: PAGE_COLORS[id], value } : null;
  };
  // Presence lists every signed-in account (you included), so only count
  // the ones that are actually your friends.
  const onlineFriendCount = friendIds.filter((id) =>
    onlineFriendIds.has(id),
  ).length;

  const homeGroups = [
    [
      homeRow("appearance"),
      homeRow("widgets", `${visibleWidgetCount} on`),
      homeRow("reminders", remindersEnabled ? "On" : "Off"),
    ],
    [homeRow("freezes", `${freezesRemaining} left`)],
    [
      homeRow(
        "friends",
        onlineFriendCount > 0 ? `${onlineFriendCount} online` : undefined,
      ),
      homeRow("support"),
    ],
    [
      homeRow("membership", membership.isPremium ? "Premium" : "Free"),
      homeRow("donate"),
    ],
    [homeRow("account"), homeRow("admin-preview")],
  ].map((group) => group.filter((r): r is SettingsHomeRow => r !== null));

  // What the banner on top of each page says - a line about the page and
  // its key number (or a switch / pill) on the right.
  const tier = membership.effectiveTier;
  const banners: Record<string, BannerContent> = {
    profile: { subtitle: "Your name, avatar and bio - what friends see." },
    appearance: { subtitle: "Light or dark, and your app's colors." },
    widgets: {
      subtitle: "Pick what shows on your day.",
      stat: { value: visibleWidgetCount, label: `of ${WIDGET_IDS.length} on` },
    },
    freezes: {
      subtitle: "Keep your streak on a day you missed.",
      stat: { value: freezesRemaining, label: `of ${MAX_FREEZES_PER_MONTH} left` },
    },
    reminders: {
      subtitle: "At each task's time, plus a 9 PM nudge if anything's left.",
      aside: (
        <Switch
          checked={remindersEnabled}
          onChange={onChangeRemindersEnabled}
          label="Task reminders"
        />
      ),
    },
    friends: {
      subtitle:
        onlineFriendCount > 0
          ? `${onlineFriendCount} online now`
          : "See each other's calendars and streaks.",
      stat:
        friendIds.length > 0
          ? {
              value: friendIds.length,
              label: friendIds.length === 1 ? "friend" : "friends",
            }
          : undefined,
    },
    membership: {
      subtitle: tier ? TIER_SUBTITLE[tier] : undefined,
      aside: tier ? (
        <span className="settings-banner__pill">{TIER_SHORT[tier]}</span>
      ) : undefined,
    },
    donate: { subtitle: "Consistency is free - a coffee keeps it going." },
    support: {
      subtitle:
        tier === "admin"
          ? "Everyone's messages, by status."
          : "Report a bug, share an idea or ask a question.",
    },
    account: { subtitle: "Updates, your data and signing out." },
    "admin-preview": {
      subtitle: "See the app the way a Free or Premium member does.",
      aside: membership.previewTier ? (
        <span className="settings-banner__pill">Previewing</span>
      ) : undefined,
    },
  };
  const ActiveIcon = activeSection?.icon;

  return (
    <Modal
      title="Settings"
      onClose={onClose}
      size="wide"
      asTab
      icon={<SettingsIcon size={15} />}
      accent={PAGE_COLORS.account}
    >
      <div
        className="settings"
        data-mobile-pane={showingDetail ? "detail" : "list"}
      >
        <SettingsHome
          groups={homeGroups}
          avatarId={yourAvatarId}
          streak={streak}
          isPremium={membership.isPremium}
          profileColor={PAGE_COLORS.profile}
          onSelect={selectSection}
          onSignOut={onSignOut}
          activeId={activeId}
        />

        <div
          className="settings-detail"
          style={
            {
              "--page-color": pageColor,
              "--page-ink": inkOn(pageColor),
            } as CSSProperties
          }
        >
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
          </div>

          <div className="settings-detail__body">
            <div className="settings-detail__pane" key={activeId}>
              {activeSection && ActiveIcon && (
                <SettingsBanner
                  icon={<ActiveIcon size={24} />}
                  color={pageColor}
                  title={activeSection.label}
                  {...banners[activeId]}
                />
              )}

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
                  <div className="settings-group settings-group--tiles">
                    <button
                      type="button"
                      className="settings-group__row"
                      onClick={onStartArranging}
                    >
                      <span className="settings-tile" aria-hidden="true">
                        <GripIcon size={15} />
                      </span>
                      <span className="settings-group__label settings-group__label--stack">
                        Arrange widgets
                        <small>Reorder them right on your day panel</small>
                      </span>
                      <ChevronRightIcon
                        size={15}
                        className="settings-group__chevron"
                      />
                    </button>
                  </div>

                  <div className="settings-group-wrap">
                    <span className="settings-group__title">
                      Show on your day
                    </span>
                    <div className="settings-group settings-group--tiles">
                      {WIDGET_IDS.map((id) => {
                        const visible = !hiddenWidgets.includes(id);
                        const locked =
                          !visible &&
                          !membership.isPremium &&
                          visibleWidgetCount >= FREE_WIDGET_LIMIT;
                        const previewing = previewWidget === id;
                        const info = WIDGET_INFO[id];
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
                                <span
                                  className="settings-tile"
                                  style={
                                    { "--tile-color": info.color } as CSSProperties
                                  }
                                  aria-hidden="true"
                                >
                                  {info.icon}
                                </span>
                                <span className="settings-group__label">
                                  {WIDGET_LABELS[id]}
                                </span>
                                {locked && (
                                  <span className="settings-tag">Premium</span>
                                )}
                                {id === "streak" && (
                                  <span className="settings-group__value">
                                    {STREAK_STYLES.find((st) => st.id === streakStyle)?.label}
                                  </span>
                                )}
                                <ChevronRightIcon
                                  size={14}
                                  className={`settings-group__chevron ${previewing ? "settings-group__chevron--open" : ""}`}
                                />
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
                              <div className="settings-group__expand">
                                {/* Day Streak comes in a few looks - pick one,
                                    see it right below with your own numbers. */}
                                {id === "streak" && (
                                  <div
                                    className="settings-segmented widget-style-picker"
                                    role="radiogroup"
                                    aria-label="Day Streak style"
                                  >
                                    {STREAK_STYLES.map((st) => (
                                      <button
                                        key={st.id}
                                        type="button"
                                        role="radio"
                                        aria-checked={streakStyle === st.id}
                                        className={`settings-segmented__option ${streakStyle === st.id ? "settings-segmented__option--active" : ""}`}
                                        onClick={() => onChangeStreakStyle(st.id)}
                                      >
                                        {st.label}
                                      </button>
                                    ))}
                                  </div>
                                )}
                                <div className="widget-preview" aria-hidden="true">
                                  {renderWidgetPreview(id)}
                                </div>
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
                  {remindersEnabled &&
                    reminderStatus.permission === "denied" && (
                      <div className="settings-group-wrap">
                        <div className="settings-group">
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
                        </div>
                        <span className="settings-footnote settings-footnote--warning">
                          Notifications are turned off for Consistency.
                        </span>
                      </div>
                    )}

                  {remindersEnabled && (
                    <div className="settings-notes">
                      {reminderStatus.usesServerPush && (
                        <span className="settings-footnote settings-footnote--success">
                          Sent by the server - tick a task on any device and
                          its reminder won't come.
                        </span>
                      )}
                      {reminderStatus.lastError && (
                        <span className="settings-footnote settings-footnote--warning">
                          Couldn't schedule reminders: {reminderStatus.lastError}
                        </span>
                      )}
                      {reminderStatus.permission === "granted" &&
                        reminderStatus.usesLiveFallback && (
                          <span className="settings-footnote">
                            On this device they only arrive while the app is
                            open.
                          </span>
                        )}
                      {reminderStatus.permission === "granted" &&
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
                  )}

                  {remindersEnabled ? (
                    <ReminderList
                      tasks={tasks}
                      completions={completions}
                      onSelectReminder={onJumpToReminder}
                    />
                  ) : (
                    <div className="settings-group">
                      <div className="settings-group__row settings-group__row--muted">
                        Reminders are off - turn them on above.
                      </div>
                    </div>
                  )}
                </div>
              )}

              {activeId === "friends" && (
                <div className="settings-pages">
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
                  <div className="settings-group-wrap">
                    <span className="settings-group__title">Privacy</span>
                    <div className="settings-group settings-group--tiles">
                      <div className="settings-group__row">
                        <span
                          className="settings-tile"
                          style={{ "--tile-color": "#22c55e" } as CSSProperties}
                          aria-hidden="true"
                        >
                          <TrendingUpIcon size={15} />
                        </span>
                        <span className="settings-group__label">
                          Share my results with friends
                        </span>
                        <Switch
                          checked={shareResults}
                          onChange={onChangeShareResults}
                          label="Share my results with friends"
                        />
                      </div>
                    </div>
                    <span className="settings-footnote">
                      {shareResults
                        ? "Friends see your logged results (+2R, 0R...) on your calendar."
                        : "Your results stay private - friends see only your tasks."}
                    </span>
                  </div>
                </div>
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

                  <div className="settings-group-wrap">
                    <div className="settings-group">
                      <button
                        type="button"
                        className="settings-group__row settings-group__row--danger"
                        onClick={onSignOut}
                      >
                        Sign out
                      </button>
                      <button
                        type="button"
                        className="settings-group__row settings-group__row--danger"
                        onClick={() => setDeletingAccount(true)}
                      >
                        Delete account
                      </button>
                    </div>
                    <span className="settings-footnote">
                      Deleting your account permanently removes it and all its
                      data.
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
