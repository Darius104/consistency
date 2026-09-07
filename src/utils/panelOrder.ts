export type PanelBlockId = "streak" | "weekly" | "tasks";

export const DEFAULT_PANEL_ORDER: PanelBlockId[] = ["streak", "weekly", "tasks"];

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
