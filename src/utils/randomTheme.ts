// A random hue, mapped onto the same dark-mode shape every hand-picked
// theme uses (very dark background, bright saturated accent) so a random
// roll always stays legible and "in family" with the rest of the app.

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

export function generateRandomThemeColors(): RandomThemeColors {
  const hue = Math.floor(Math.random() * 360);
  const [ar, ag, ab] = hslToRgb(hue, 72, 66);

  return {
    bg: hex(hue, 14, 7),
    bgElevated: hex(hue, 14, 9),
    surface: hex(hue, 12, 11),
    surfaceHover: hex(hue, 12, 14),
    border: hex(hue, 10, 18),
    borderStrong: hex(hue, 10, 24),
    text: hex(hue, 15, 93),
    textSecondary: hex(hue, 12, 66),
    textMuted: hex(hue, 10, 43),
    accent: hex(hue, 72, 66),
    accentRgb: `${ar}, ${ag}, ${ab}`,
    accentSoft: `rgba(${ar}, ${ag}, ${ab}, 0.16)`,
  };
}
