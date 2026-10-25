/**
 * One color per kind of thing you can add - used by the Add menu and by
 * each form it opens (icon in the title, the main button), so a color
 * always means the same thing: blue = task, purple = template,
 * yellow = note, green = result.
 */
export const ADD_COLORS = {
  task: "#3b82f6",
  template: "#a855f7",
  note: "#f5c442",
  result: "#22c55e",
} as const;

/** Icon color to sit on a square of `color`: dark on light colors
 *  (yellow, amber), white on everything else. */
export function inkOn(color: string): string {
  const m = /^#([0-9a-f]{6})$/i.exec(color);
  if (!m) return "#fff";
  const n = parseInt(m[1], 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.62 ? "#2a2103" : "#fff";
}
