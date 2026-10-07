import type { ThemeId } from "../types";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  /** Preview swatch colors, kept in sync with the [data-theme] block in tokens.css. */
  bg: string;
  accent: string;
}

// Themes change only the accent hue and background undertone, so the rest
// of the app (contrast, layout, focus states) stays identical across them.
// Each can be shown dark or light - see AppearanceMode and the
// [data-mode="light"] layer in tokens.css.

export type AppearanceMode = "dark" | "light";
export const THEMES: ThemeMeta[] = [
  { id: "midnight", name: "Midnight", bg: "#101114", accent: "#7c9eff" },
  { id: "steel", name: "Steel", bg: "#0d0e10", accent: "#64748b" },
  { id: "ocean", name: "Ocean", bg: "#0b1420", accent: "#38bdf8" },
  { id: "forest", name: "Forest", bg: "#0c130f", accent: "#34d399" },
  { id: "blossom", name: "Blossom", bg: "#16111a", accent: "#f472b6" },
  { id: "lavender", name: "Lavender", bg: "#14131c", accent: "#b794f6" },
  { id: "crimson", name: "Crimson", bg: "#170b0c", accent: "#ef4565" },
];

export const DEFAULT_THEME: ThemeId = "midnight";
