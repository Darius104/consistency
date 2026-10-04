import type { TradingResultUnit } from "../types";

export const TRADING_RESULT_UNIT_OPTIONS: { id: TradingResultUnit; label: string }[] = [
  { id: "r", label: "R" },
  { id: "percent", label: "%" },
  { id: "usd", label: "$" },
];

const UNIT_SUFFIX: Record<TradingResultUnit, string> = {
  r: "R",
  percent: "%",
  usd: "$",
};

/** "1300" -> "1.3K", "2000" -> "2K" (no trailing ".0" when it's a round
 *  thousand) - takes a plain non-negative magnitude, the sign/symbol are
 *  the caller's job. */
function abbreviateThousands(magnitude: number): string {
  const rounded = Math.round(magnitude / 100) / 10;
  return `${Number.isInteger(rounded) ? rounded : rounded.toFixed(1)}K`;
}

export function formatTradingResult(value: number, unit: TradingResultUnit): string {
  if (unit === "usd") {
    const signChar = value > 0 ? "+" : value < 0 ? "-" : "";
    const magnitude = Math.abs(value);
    // A dollar amount at four figures or more collapses to "1.3K" instead
    // of "1300" - reads faster in a cell/badge this small, and matters
    // more at that size than exact cents do. No "$" - the unit picker is
    // how you chose this was dollars, the displayed value doesn't repeat it.
    const magnitudeStr = magnitude >= 1000 ? abbreviateThousands(magnitude) : `${magnitude}`;
    return `${signChar}${magnitudeStr}`;
  }
  const sign = value > 0 ? "+" : "";
  return `${sign}${value}${UNIT_SUFFIX[unit]}`;
}

/** Turns a typed amount into a real number - accepts either "," or "."
 *  as the decimal separator (the modal's own placeholder shows "150,00",
 *  but a plain HTML number input only ever accepts ".", so this field is
 *  a text input instead - see TradingResultModal). Returns null for
 *  anything that isn't a valid number once normalized. */
export function parseTradingResultInput(input: string): number | null {
  const trimmed = input.trim();
  if (trimmed === "") return null;
  const normalized = trimmed.replace(",", ".");
  const parsed = Number(normalized);
  return Number.isNaN(parsed) ? null : parsed;
}
