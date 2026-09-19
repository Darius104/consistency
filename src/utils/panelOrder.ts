export type PanelBlockId =
  | "streak"
  | "weekly"
  | "freezes"
  | "categories"
  | "quote"
  | "tasks";

export const DEFAULT_PANEL_ORDER: PanelBlockId[] = [
  "streak",
  "weekly",
  "freezes",
  "categories",
  "quote",
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

// The only blocks a user can actually remove - the task/category list stays
// permanent, so it's deliberately excluded from this type entirely rather
// than just being excluded by convention at each call site.
export type WidgetId = Exclude<PanelBlockId, "tasks">;

export const WIDGET_LABELS: Record<WidgetId, string> = {
  streak: "Day Streak",
  weekly: "Weekly Progress",
  freezes: "Streak Freezes",
  categories: "Category Breakdown",
  quote: "Quote of the Day",
};

// Canonical listing order for management UIs (e.g. Settings > Widgets) -
// deliberately fixed, unlike the user's freely-draggable panelOrder, so that
// page doesn't reshuffle itself as the user reorders their actual panel.
export const WIDGET_IDS: WidgetId[] = ["streak", "weekly", "freezes", "categories", "quote"];

// Free accounts can have this many widgets visible at once (the default
// on-boarding state already leaves only "streak" visible - see
// DEFAULT_HIDDEN_WIDGETS below - so this allows exactly one more on top of
// that before the paywall kicks in). Shared between App.tsx's gate and
// SettingsModal's own "(Premium)" label so they can never disagree.
export const FREE_WIDGET_LIMIT = 2;

const VALID_WIDGET_IDS = new Set<WidgetId>(WIDGET_IDS);

// New widgets keep the day panel focused by default - only the original
// Day Streak widget starts visible, and everything else is opt-in via the
// "+ Add widget" affordance / Settings > Widgets, rather than dumping every
// new widget onto the panel the moment it's added.
const DEFAULT_HIDDEN_WIDGETS: WidgetId[] = WIDGET_IDS.filter((id) => id !== "streak");

/** Parses saved hidden-widget ids. Unlike parsePanelOrder, an invalid entry
 *  here just gets dropped rather than resetting the whole list back to
 *  the default - one bad id shouldn't un-hide everything else. "tasks" can
 *  never appear here (VALID_WIDGET_IDS excludes it), so it can never be
 *  hidden even from a corrupted or hand-edited setting value. */
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
