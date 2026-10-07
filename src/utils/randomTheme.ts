// A hue (random, or picked by hand in the custom-theme builder) mapped onto
// the same dark-mode shape every hand-picked theme uses (very dark
// background, bright accent) so a roll - or a custom pick - always stays
// legible and "in family" with the rest of the app.
//
// Color math is OKLCH, not HSL - HSL's lightness isn't perceptually uniform
// across hues (the same L/S values read as a much brighter yellow than
// blue), which meant some rolled/custom hues looked washed out or muddy
// next to others picked from the exact same sliders. OKLCH's L channel is
// perceptually uniform by construction, so the same shape (same L/C at
// every step) now looks like the same *intensity* regardless of which hue
// it's built from. The reference conversion math below is Björn Ottosson's
// (https://bottosson.github.io/posts/oklab/) - plain math, no dependency.

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

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

function oklchToLinearSrgb(l: number, c: number, hDeg: number): [number, number, number] {
  const hRad = (hDeg * Math.PI) / 180;
  const a = c * Math.cos(hRad);
  const b = c * Math.sin(hRad);

  const l_ = l + 0.3963377774 * a + 0.2158037573 * b;
  const m_ = l - 0.1055613458 * a - 0.0638541728 * b;
  const s_ = l - 0.0894841775 * a - 1.291485548 * b;

  const l3 = l_ ** 3;
  const m3 = m_ ** 3;
  const s3 = s_ ** 3;

  return [
    4.0767416621 * l3 - 3.3077115913 * m3 + 0.2309699292 * s3,
    -1.2684380046 * l3 + 2.6097574011 * m3 - 0.3413193965 * s3,
    -0.0041960863 * l3 - 0.7034186147 * m3 + 1.707614701 * s3,
  ];
}

function linearToSrgbChannel(x: number): number {
  // Simple clamp rather than real gamut-mapping (reducing chroma until in
  // gamut) - this app's palettes use modest, conservative chroma values
  // that stay in-gamut for virtually every hue anyway, so the rare edge
  // case isn't worth the extra complexity.
  const c = clamp(x, 0, 1);
  return c <= 0.0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - 0.055;
}

function oklchToRgb(l: number, c: number, h: number): [number, number, number] {
  const [r, g, b] = oklchToLinearSrgb(l, c, h);
  return [r, g, b].map((v) => Math.round(clamp(linearToSrgbChannel(v) * 255, 0, 255))) as [
    number,
    number,
    number,
  ];
}

function hex(l: number, c: number, h: number): string {
  return `#${oklchToRgb(l, c, h)
    .map((v) => v.toString(16).padStart(2, "0"))
    .join("")}`;
}

function srgbChannelToLinear(x: number): number {
  return x <= 0.04045 ? x / 12.92 : Math.pow((x + 0.055) / 1.055, 2.4);
}

/** Inverse of hex() - used to re-seed the custom-theme builder's hue slider
 *  from whatever accent color got persisted last time (see
 *  generateCustomThemeColors), so reopening it starts from the same hue
 *  instead of snapping back to a default. */
export function hexToOklch(hexColor: string): { l: number; c: number; h: number } {
  const clean = hexColor.replace("#", "");
  const r = srgbChannelToLinear(parseInt(clean.slice(0, 2), 16) / 255);
  const g = srgbChannelToLinear(parseInt(clean.slice(2, 4), 16) / 255);
  const b = srgbChannelToLinear(parseInt(clean.slice(4, 6), 16) / 255);

  const l_ = Math.cbrt(0.4122214708 * r + 0.5363325363 * g + 0.0514459929 * b);
  const m_ = Math.cbrt(0.2119034982 * r + 0.6806995451 * g + 0.1073969566 * b);
  const s_ = Math.cbrt(0.0883024619 * r + 0.2817188376 * g + 0.6299787005 * b);

  const L = 0.2104542553 * l_ + 0.793617785 * m_ - 0.0040720468 * s_;
  const A = 1.9779984951 * l_ - 2.428592205 * m_ + 0.4505937099 * s_;
  const B = 0.0259040371 * l_ + 0.7827717662 * m_ - 0.808675766 * s_;

  const c = Math.sqrt(A * A + B * B);
  let h = (Math.atan2(B, A) * 180) / Math.PI;
  if (h < 0) h += 360;

  return { l: L, c, h };
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
  /** Background hue-tint intensity (OKLCH chroma) - low, so hue mostly
   *  shows as a faint undertone rather than a colored background. */
  bgChroma: number;
  /** Background lightness (OKLCH L, 0-1) - how dark the whole theme reads. */
  bgLight: number;
  /** Text lightness (OKLCH L, 0-1) - kept close to white regardless. */
  textLight: number;
  accentChroma: number;
  accentLight: number;
}

// Base shape the custom-theme builder starts from - only hue varies from
// here. Verified empirically against the app's own existing "Midnight"
// default: hue 270 at these exact values reproduces #7c9eff almost
// exactly, confirming this shape is "in family" with every hand-picked
// preset theme, not just plausible in isolation.
const CANONICAL_SHAPE: ThemeShape = {
  bgChroma: 0.03,
  bgLight: 0.17,
  textLight: 0.93,
  accentChroma: 0.15,
  accentLight: 0.72,
};

function buildThemeColors(hue: number, shape: ThemeShape): RandomThemeColors {
  const { bgChroma, bgLight, textLight, accentChroma, accentLight } = shape;
  const borderChroma = Math.max(bgChroma - 0.01, 0.012);
  const surfaceChroma = Math.max(bgChroma - 0.005, 0.015);
  const [ar, ag, ab] = oklchToRgb(accentLight, accentChroma, hue);

  return {
    bg: hex(bgLight, bgChroma, hue),
    bgElevated: hex(bgLight + 0.02, bgChroma, hue),
    surface: hex(bgLight + 0.035, surfaceChroma, hue),
    surfaceHover: hex(bgLight + 0.06, surfaceChroma, hue),
    border: hex(bgLight + 0.095, borderChroma, hue),
    borderStrong: hex(bgLight + 0.15, borderChroma, hue),
    text: hex(textLight, 0.02, hue),
    textSecondary: hex(textLight - 0.24, 0.018, hue),
    textMuted: hex(textLight - 0.45, 0.015, hue),
    accent: hex(accentLight, accentChroma, hue),
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentSoft: `rgba(${ar}, ${ag}, ${ab}, 0.16)`,
  };
}

// Randomizes more than just hue - background darkness/chroma and the
// accent's own intensity/brightness vary per roll too, so back-to-back
// rolls read as genuinely different moods (muted and steely vs. dark and
// richly saturated) instead of the same shape rotated through hue alone.
export function generateRandomThemeColors(): RandomThemeColors {
  const hue = Math.floor(Math.random() * 360);
  return buildThemeColors(hue, {
    bgChroma: 0.02 + Math.random() * 0.03, // 0.02-0.05
    bgLight: 0.14 + Math.random() * 0.06, // 0.14-0.20
    textLight: 0.9 + Math.random() * 0.06, // 0.90-0.96
    accentChroma: 0.12 + Math.random() * 0.07, // 0.12-0.19
    accentLight: 0.64 + Math.random() * 0.14, // 0.64-0.78
  });
}

/** Used by the profile page's custom-theme builder - same legible dark
 *  shape as every hand-picked theme, built from just the hue someone
 *  dragged a slider to, rather than a raw native-color-picker pick. Hue
 *  alone is enough: the whole point of this shape is that it already looks
 *  "in family" with the rest of the app at any hue, so there's no need to
 *  also expose chroma/lightness controls for this to feel personal. */
export function generateCustomThemeColors(hue: number, mode: "dark" | "light" = "dark"): RandomThemeColors {
  return mode === "light" ? buildLightThemeColors(hue) : buildThemeColors(hue, CANONICAL_SHAPE);
}

/** The light-mode version of the same hue: near-white surfaces with a
 *  faint tint of it, dark text, and a deeper accent that reads on white. */
function buildLightThemeColors(hue: number): RandomThemeColors {
  const [ar, ag, ab] = oklchToRgb(0.55, 0.17, hue);
  return {
    bg: hex(0.965, 0.008, hue),
    bgElevated: hex(1, 0, hue),
    surface: hex(0.95, 0.01, hue),
    surfaceHover: hex(0.92, 0.012, hue),
    border: hex(0.91, 0.01, hue),
    borderStrong: hex(0.84, 0.012, hue),
    text: hex(0.2, 0.01, hue),
    textSecondary: hex(0.45, 0.012, hue),
    textMuted: hex(0.64, 0.01, hue),
    accent: hex(0.55, 0.17, hue),
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentSoft: `rgba(${ar}, ${ag}, ${ab}, 0.12)`,
  };
}
