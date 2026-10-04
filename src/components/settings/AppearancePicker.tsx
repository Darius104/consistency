import { useState } from "react";
import type { ThemeId } from "../../types";
import { hexToOklch, type RandomThemeColors } from "../../utils/randomTheme";
import { THEMES } from "../../utils/themes";
import { Button } from "../ui/Button";
import { CustomThemeCreator } from "./CustomThemeCreator";
import { ThemeCarousel } from "./ThemeCarousel";
import "./AppearancePicker.css";

interface AppearancePickerProps {
  activeTheme: ThemeId;
  customColors: RandomThemeColors | null;
  onChangeTheme: (id: ThemeId) => void;
  onSetCustomTheme: (hue: number) => void;
}

type PendingSelection = { kind: "preset"; id: ThemeId } | { kind: "custom"; hue: number };

const DEFAULT_HUE = 255; // same family as the app's own default "Midnight" blue

function initialSelection(activeTheme: ThemeId, customColors: RandomThemeColors | null): PendingSelection {
  if (activeTheme === "custom") {
    return { kind: "custom", hue: customColors ? hexToOklch(customColors.accent).h : DEFAULT_HUE };
  }
  return { kind: "preset", id: activeTheme };
}

// Picking a swatch (or dragging the custom hue slider) used to apply and
// persist immediately on its own - which meant switching between them
// quickly could fire several overlapping saves that could finish out of
// order, visible as the theme flashing back to a previous pick a moment
// after you'd already moved on from it. Now every pick here is only ever
// *staged* locally; the one Save button below is the only thing that ever
// actually applies/persists anything, so browsing around never writes
// anything at all until you decide to commit.
export function AppearancePicker({
  activeTheme,
  customColors,
  onChangeTheme,
  onSetCustomTheme,
}: AppearancePickerProps) {
  const [pending, setPending] = useState<PendingSelection>(() =>
    initialSelection(activeTheme, customColors),
  );

  const activeHue = customColors ? hexToOklch(customColors.accent).h : null;
  const isDirty =
    pending.kind === "preset"
      ? pending.id !== activeTheme
      : activeTheme !== "custom" || activeHue === null || Math.abs(activeHue - pending.hue) > 0.5;

  function handleSave() {
    if (pending.kind === "preset") onChangeTheme(pending.id);
    else onSetCustomTheme(pending.hue);
  }

  return (
    <div className="appearance-picker">
      <ThemeCarousel
        themes={THEMES}
        selected={pending.kind === "preset" ? pending.id : "custom"}
        onSelect={(id) => setPending({ kind: "preset", id })}
      />
      <CustomThemeCreator
        hue={pending.kind === "custom" ? pending.hue : (activeHue ?? DEFAULT_HUE)}
        onHueChange={(hue) => setPending({ kind: "custom", hue })}
      />
      <Button variant="primary" className="appearance-picker__save" onClick={handleSave} disabled={!isDirty}>
        {isDirty ? "Save theme" : "Saved"}
      </Button>
    </div>
  );
}
