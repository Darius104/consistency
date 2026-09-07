import type { ThemeId } from "../types";

export interface ThemeMeta {
  id: ThemeId;
  name: string;
  /** Preview swatch colors, kept in sync with the [data-theme] block in tokens.css. */
  bg: string;
  accent: string;
}

// All dark - only the accent hue and background undertone change, so the
// rest of the app (contrast, layout, focus states) stays identical across
// themes.
export const THEMES: ThemeMeta[] = [
  { id: "midnight", name: "Midnight", bg: "#101114", accent: "#7c9eff" },
  { id: "steel", name: "Steel", bg: "#0d0e10", accent: "#64748b" },
  { id: "ocean", name: "Ocean", bg: "#0b1420", accent: "#38bdf8" },
  { id: "forest", name: "Forest", bg: "#0c130f", accent: "#34d399" },
  { id: "blossom", name: "Blossom", bg: "#16111a", accent: "#f472b6" },
  { id: "lavender", name: "Lavender", bg: "#14131c", accent: "#b794f6" },
  { id: "crimson", name: "Crimson", bg: "#170b0c", accent: "#ef4565" },
  { id: "amber", name: "Amber", bg: "#16110a", accent: "#f0b429" },
  // Swatch preview is special-cased in ThemeSwatch - bg/accent here are
  // unused placeholders, real colors are rolled fresh each time it's picked.
  { id: "random", name: "Random", bg: "#000000", accent: "#ffffff" },
];

export const DEFAULT_THEME: ThemeId = "midnight";
