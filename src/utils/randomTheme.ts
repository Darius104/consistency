// A hue (random, or picked by hand in the custom-theme builder) mapped onto
// the same dark-mode shape every hand-picked theme uses (very dark
// background, bright saturated accent) so a roll - or a custom pick - always
// stays legible and "in family" with the rest of the app.

export interface RandomThemeColors {
  bg: string;
  bgElevated: string;
  surface: string;
  surfaceHover: string;
  border: string;
  borderStrong: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  accent: string;
  accentRgb: string;
  accentSoft: string;
}

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  s /= 100;
  l /= 100;
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) =>
    l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
}

function hex(h: number, s: number, l: number): string {
  return `#${hslToRgb(h, s, l)
    .map((c) => c.toString(16).padStart(2, "0"))
    .join("")}`;
}

/** Inverse of hslToRgb - used to seed the custom-theme builder from whatever
 *  color someone picks in a plain color input. Returns saturation/lightness
 *  too (0-100), not just hue - an earlier version threw those away and
 *  always rebuilt the accent at a fixed canonical saturation/lightness, so
 *  picking, say, a dark maroon or a pale pink both collapsed to the exact
 *  same "red" accent as picking pure red. generateCustomThemeColors below
 *  now uses the real saturation/lightness (clamped to stay visible on a
 *  dark background) so the accent actually resembles what was picked. */
export function hexToHsl(hexColor: string): { h: number; s: number; l: number } {
  const clean = hexColor.replace("#", "");
  const r = parseInt(clean.slice(0, 2), 16) / 255;
  const g = parseInt(clean.slice(2, 4), 16) / 255;
  const b = parseInt(clean.slice(4, 6), 16) / 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  const l = (max + min) / 2;
  if (d === 0) return { h: 0, s: 0, l: l * 100 };
  const s = d / (1 - Math.abs(2 * l - 1));
  let h: number;
  if (max === r) h = ((g - b) / d) % 6;
  else if (max === g) h = (b - r) / d + 2;
  else h = (r - g) / d + 4;
  h *= 60;
  if (h < 0) h += 360;
  return { h, s: s * 100, l: l * 100 };
}

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

// CSS custom property each RandomThemeColors field maps onto - shared by
// App.tsx (applying your own random/custom theme) and FriendCalendarView
// (applying a friend's, while you're viewing their calendar).
export const RANDOM_THEME_CSS_VARS: Record<keyof RandomThemeColors, string> = {
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

interface ThemeShape {
  /** Background family saturation - low, so hue mostly shows as a faint
   *  undertone rather than a colored background. */
  bgSat: number;
  /** Background lightness - how dark the whole theme reads overall. */
  bgLight: number;
  /** Text lightness - kept close to white regardless, for contrast. */
  textLight: number;
  accentSat: number;
  accentLight: number;
}

// Base shape the custom-theme builder starts from - only hue (and, below,
// the accent's saturation/lightness) varies from here.
const CANONICAL_SHAPE: ThemeShape = {
  bgSat: 14,
  bgLight: 7,
  textLight: 93,
  accentSat: 72,
  accentLight: 66,
};

function buildThemeColors(hue: number, shape: ThemeShape): RandomThemeColors {
  const { bgSat, bgLight, textLight, accentSat, accentLight } = shape;
  const borderSat = Math.max(bgSat - 4, 6);
  const surfaceSat = Math.max(bgSat - 2, 6);
  const [ar, ag, ab] = hslToRgb(hue, accentSat, accentLight);

  return {
    bg: hex(hue, bgSat, bgLight),
    bgElevated: hex(hue, bgSat, bgLight + 2),
    surface: hex(hue, surfaceSat, bgLight + 4),
    surfaceHover: hex(hue, surfaceSat, bgLight + 7),
    border: hex(hue, borderSat, bgLight + 11),
    borderStrong: hex(hue, borderSat, bgLight + 17),
    text: hex(hue, 15, textLight),
    textSecondary: hex(hue, 12, textLight - 27),
    textMuted: hex(hue, 10, textLight - 50),
    accent: hex(hue, accentSat, accentLight),
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentSoft: `rgba(${ar}, ${ag}, ${ab}, 0.16)`,
  };
}

// Randomizes more than just hue - background darkness/saturation and the
// accent's own vividness/brightness now vary per roll too, so back-to-back
// rolls read as genuinely different moods (muted and steely vs. dark and
// richly saturated) instead of the same shape rotated through hue alone.
export function generateRandomThemeColors(): RandomThemeColors {
  const hue = Math.floor(Math.random() * 360);
  return buildThemeColors(hue, {
    bgSat: 8 + Math.random() * 14, // 8-22
    bgLight: 5 + Math.random() * 6, // 5-11
    textLight: 90 + Math.random() * 6, // 90-96
    accentSat: 55 + Math.random() * 30, // 55-85
    accentLight: 55 + Math.random() * 17, // 55-72
  });
}

/** Used by the profile page's custom-theme builder - same legible dark
 *  shape as every hand-picked theme, but both the accent AND the
 *  background/surface/border tones lean into the picked color: the accent
 *  uses its actual saturation/lightness (clamped to stay visible), and the
 *  background saturation is boosted well past CANONICAL_SHAPE's base 14 -
 *  that base value keeps "random" rolls safely neutral-looking, but here
 *  you picked the color on purpose, so the background/surfaces should
 *  visibly carry it too, not just the accent dot. */
export function generateCustomThemeColors(hexColor: string): RandomThemeColors {
  const { h, s, l } = hexToHsl(hexColor);
  return buildThemeColors(h, {
    ...CANONICAL_SHAPE,
    bgSat: 26,
    accentSat: clamp(s, 35, 95),
    accentLight: clamp(l, 42, 75),
  });
}
