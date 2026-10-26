export type PanelBlockId =
  | "streak"
  | "weekly"
  | "freezes"
  | "templates"
  | "quote"
  | "friendStreaks"
  | "tasks";

export const DEFAULT_PANEL_ORDER: PanelBlockId[] = [
  "streak",
  "weekly",
  "freezes",
  "templates",
  "quote",
  "friendStreaks",
  "tasks",
];

const VALID_IDS = new Set<PanelBlockId>(DEFAULT_PANEL_ORDER);

/** Parses a saved order, falling back to the default if it's missing, malformed, or stale. */
export function parsePanelOrder(raw: string | null): PanelBlockId[] {
  if (!raw) return DEFAULT_PANEL_ORDER;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      Array.isArray(parsed) &&
      parsed.length === DEFAULT_PANEL_ORDER.length &&
      parsed.every((id) => VALID_IDS.has(id))
    ) {
      return parsed as PanelBlockId[];
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_PANEL_ORDER;
}

// The only blocks a user can actually remove - the task/template list stays
// permanent, so it's deliberately excluded from this type entirely rather
// than just being excluded by convention at each call site.
export type WidgetId = Exclude<PanelBlockId, "tasks">;

export const WIDGET_LABELS: Record<WidgetId, string> = {
  streak: "Day Streak",
  weekly: "Weekly Progress",
  freezes: "Streak Freezes",
  templates: "Template Breakdown",
  quote: "Quote of the Day",
  friendStreaks: "Friend Comparison",
};

/** Each widget's own color - its card's edge and icon, its tile, its row
 *  in the widget gallery and in Settings > Widgets. */
export const WIDGET_COLORS: Record<WidgetId, string> = {
  streak: "#ff9f43",
  weekly: "#3b82f6",
  freezes: "#38bdf8",
  templates: "#a855f7",
  quote: "#f5c442",
  friendStreaks: "#22c55e",
};

/** The Day Streak widget's looks - picked in Settings > Widgets. */
export type StreakStyle = "campfire" | "ring" | "compact" | "weeks";

export const STREAK_STYLES: { id: StreakStyle; label: string }[] = [
  { id: "campfire", label: "Campfire" },
  { id: "ring", label: "Ring" },
  { id: "compact", label: "Compact" },
  { id: "weeks", label: "Two weeks" },
];

/** The Day Streak's flame color - picked next to its style. */
export type FlameColor = "classic" | "red" | "pink" | "purple" | "blue" | "green" | "gold";

export const FLAME_COLORS: { id: FlameColor; label: string; swatch: string }[] = [
  { id: "classic", label: "Classic", swatch: "#ff9f43" },
  { id: "red", label: "Red", swatch: "#ef4444" },
  { id: "pink", label: "Pink", swatch: "#ec4899" },
  { id: "purple", label: "Purple", swatch: "#a855f7" },
  { id: "blue", label: "Blue", swatch: "#3b82f6" },
  { id: "green", label: "Green", swatch: "#22c55e" },
  { id: "gold", label: "Gold", swatch: "#eab308" },
];

export function parseFlameColor(saved: string | null): FlameColor {
  return FLAME_COLORS.some((c) => c.id === saved) ? (saved as FlameColor) : "classic";
}

export function parseStreakStyle(saved: string | null): StreakStyle {
  return STREAK_STYLES.some((s) => s.id === saved) ? (saved as StreakStyle) : "campfire";
}

// Canonical listing order for management UIs (e.g. Settings > Widgets) -
// deliberately fixed, unlike the user's freely-draggable panelOrder, so that
// page doesn't reshuffle itself as the user reorders their actual panel.
export const WIDGET_IDS: WidgetId[] = [
  "streak",
  "weekly",
  "freezes",
  "templates",
  "quote",
  "friendStreaks",
];

// Free accounts can have this many widgets visible at once - exactly the
// default on-boarding state (only "streak" - see DEFAULT_HIDDEN_WIDGETS
// below), so every other widget (including Weekly Progress) requires
// Premium to turn on. Shared between App.tsx's gate and SettingsModal's own
// "(Premium)" label so they can never disagree.
export const FREE_WIDGET_LIMIT = 1;

const VALID_WIDGET_IDS = new Set<WidgetId>(WIDGET_IDS);

// New widgets keep the day panel focused by default - only the original
// Day Streak widget starts visible, and everything else is opt-in via the
// "+ Add widget" affordance / Settings > Widgets, rather than dumping every
// new widget onto the panel the moment it's added.
const DEFAULT_HIDDEN_WIDGETS: WidgetId[] = WIDGET_IDS.filter((id) => id !== "streak");

/** Parses saved hidden-widget ids as-is - an invalid entry just gets
 *  dropped rather than resetting the whole list back to the default (one
 *  bad id shouldn't un-hide everything else), and a missing/malformed
 *  value hides everything but streak, same as a fresh account. "tasks" can
 *  never appear here (VALID_WIDGET_IDS excludes it), so it can never be
 *  hidden even from a corrupted or hand-edited setting value.
 *
 *  Deliberately does NOT try to guess whether some id's absence means "was
 *  shown" or "predates this save" - hiddenWidgets only ever records what's
 *  hidden, so both look identical from here. See resolveNewWidgetIds,
 *  which uses a separate record to actually tell them apart. */
export function parseHiddenWidgets(raw: string | null): WidgetId[] {
  if (!raw) return DEFAULT_HIDDEN_WIDGETS;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is WidgetId => VALID_WIDGET_IDS.has(id));
    }
  } catch {
    // fall through to default
  }
  return DEFAULT_HIDDEN_WIDGETS;
}

/** Every widget id this account's settings have ever resolved - a separate
 *  record from hiddenWidgets specifically because hiddenWidgets can't tell
 *  "deliberately shown" (absent, but previously accounted for) apart from
 *  "didn't exist yet when this account last saved its widget settings"
 *  (also just absent) - both look the same from hiddenWidgets alone. */
export function parseKnownWidgetIds(raw: string | null): WidgetId[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (Array.isArray(parsed)) {
      return parsed.filter((id): id is WidgetId => VALID_WIDGET_IDS.has(id));
    }
  } catch {
    // fall through
  }
  return [];
}

/** Widget ids this app currently ships that this account's knownWidgetIds
 *  record has never seen - added to the app after this account last wrote
 *  its widget settings, so it never had the chance to start hidden the way
 *  a fresh account's DEFAULT_HIDDEN_WIDGETS does. Excludes "streak", which
 *  is never hidden regardless. */
export function resolveNewWidgetIds(knownIdsRaw: string | null): WidgetId[] {
  const known = new Set(parseKnownWidgetIds(knownIdsRaw));
  return WIDGET_IDS.filter((id) => id !== "streak" && !known.has(id));
}
