import type { CSSProperties } from "react";
import "./Flame.css";

interface FlameProps {
  /** 0-1, today's completion - how alive the fire looks. */
  power: number;
}

// Three overlapping blobs, not one rigid icon: each layer morphs its own
// silhouette (border-radius) and stretches upward (scale) on its own timer,
// so the whole thing reads as flickering fire instead of one shape wobbling
// in place. Colors come from the same --flame-base/mid/tip tokens as
// before; --power still controls overall size/brightness/glow.
export function Flame({ power }: FlameProps) {
  return (
    <span className="flame" style={{ "--power": power } as CSSProperties} aria-hidden="true">
      {/* Constant size regardless of --power - a woodpile doesn't grow or
          shrink, only the fire on top of it does. */}
      <span className="flame__logs">
        <span className="flame__log flame__log--1" />
        <span className="flame__log flame__log--2" />
      </span>
      {/* Only visible near 0% - smoldering logs with nothing burning yet. */}
      <span className="flame__smoke">
        <span className="flame__wisp flame__wisp--1" />
        <span className="flame__wisp flame__wisp--2" />
        <span className="flame__wisp flame__wisp--3" />
      </span>
      {/* Everything that actually grows/brightens with --power lives here,
          separate from the logs above so they're unaffected by its scale. */}
      <span className="flame__fire">
        <span className="flame__halo" />
        <span className="flame__layer flame__layer--outer" />
        <span className="flame__layer flame__layer--mid" />
        <span className="flame__layer flame__layer--core" />
        <span className="flame__particles">
          <span className="flame__particle flame__particle--1" />
          <span className="flame__particle flame__particle--2" />
          <span className="flame__particle flame__particle--3" />
          <span className="flame__particle flame__particle--4" />
        </span>
      </span>
    </span>
  );
}
