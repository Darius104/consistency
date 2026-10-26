import { useId, type CSSProperties } from "react";
import "./Flame.css";

interface FlameProps {
  /** 0-1, today's completion - how alive the fire looks. */
  power: number;
  /** The woodpile the fire sits on - on by default (the hero streak
   *  display), but a smaller, decorative usage (e.g. next to a number in a
   *  compact list row) reads better as just the flame, without a
   *  fixed-size log shape anchoring it to a "ground". */
  showLogs?: boolean;
}

// Three overlapping blobs, not one rigid icon: each layer morphs its own
// silhouette (border-radius) and stretches upward (scale) on its own timer,
// so the whole thing reads as flickering fire instead of one shape wobbling
// in place. Colors come from the same --flame-base/mid/tip tokens as
// before; --power still controls overall size/brightness/glow.
export function Flame({ power, showLogs = true }: FlameProps) {
  // Computed here rather than left as a CSS calc() on animation-duration -
  // some WebKit builds (iOS's WKWebView, not macOS's) don't reliably honor
  // a calc()'d duration for animations at all, shorthand or not, and just
  // fall back to running near-instantly. A plain computed value in an
  // inline style sidesteps that entirely.
  const outerDuration = 2.6 - power * 0.9;
  const midDuration = 1.9 - power * 0.7;
  const coreDuration = 1.3 - power * 0.5;

  return (
    <span className="flame" style={{ "--power": power } as CSSProperties} aria-hidden="true">
      {showLogs && (
        <>
          {/* Constant size regardless of --power - a woodpile doesn't grow
              or shrink, only the fire on top of it does. */}
          <FlameLogs lit={power > 0} />
          {/* Only visible near 0% - smoldering logs with nothing burning yet. */}
          <span className="flame__smoke">
            <span className="flame__wisp flame__wisp--1" />
            <span className="flame__wisp flame__wisp--2" />
            <span className="flame__wisp flame__wisp--3" />
          </span>
        </>
      )}
      {/* Everything that actually grows/brightens with --power lives here,
          separate from the logs above so they're unaffected by its scale. */}
      <span className="flame__fire">
        <span className="flame__halo" />
        <span
          className="flame__layer flame__layer--outer"
          style={{ animationDuration: `${outerDuration}s` }}
        />
        <span
          className="flame__layer flame__layer--mid"
          style={{ animationDuration: `${midDuration}s` }}
        />
        <span
          className="flame__layer flame__layer--core"
          style={{ animationDuration: `${coreDuration}s` }}
        />
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

/** The woodpile: two crossed logs with cut ends. Plain wood until the first
 *  task is done - from then on charred on top, with glowing cracks, the
 *  rings of the cut ends lit and a bed of embers where they cross, all in
 *  the flame's own color (brighter as --power rises, see Flame.css). */
function FlameLogs({ lit }: { lit: boolean }) {
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  return (
    <svg className={`flame__logs ${lit ? "flame__logs--lit" : ""}`} viewBox="0 0 40 17">
      <defs>
        <linearGradient id={`${id}bark`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#9a6639" />
          <stop offset="0.5" stopColor="#5c3a1f" />
          <stop offset="1" stopColor="#3a2312" />
        </linearGradient>
        <linearGradient id={`${id}char`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#140c07" stopOpacity="0.95" />
          <stop offset="0.6" stopColor="#140c07" stopOpacity="0" />
        </linearGradient>
        <radialGradient id={`${id}bed`}>
          <stop offset="0" style={{ stopColor: "var(--flame-tip, #ffd76a)" }} />
          <stop offset="0.45" style={{ stopColor: "var(--flame-mid, #f0932b)" }} />
          <stop offset="1" style={{ stopColor: "var(--flame-base, #b45309)", stopOpacity: 0 }} />
        </radialGradient>
      </defs>
      {/* Mirrored, so the two cut ends face out on either side. */}
      <FlameLog transform="translate(20 7.8) scale(-1 1) rotate(-17)" id={id} />
      <ellipse className="flame__embers" cx={20} cy={6.6} rx={8.5} ry={2.8} fill={`url(#${id}bed)`} />
      <FlameLog transform="translate(20 8.8) rotate(-17)" id={id} />
    </svg>
  );
}

function FlameLog({ transform, id }: { transform: string; id: string }) {
  return (
    <g transform={transform}>
      <rect x={-16} y={-3.3} width={32} height={6.6} rx={3.3} fill={`url(#${id}bark)`} />
      <rect className="flame__log-char" x={-16} y={-3.3} width={32} height={6.6} rx={3.3} fill={`url(#${id}char)`} />
      <path
        className="flame__log-cracks"
        d="M-11 -0.9q2.2 -0.9 4.6 -0.4M-3.5 -2.1q2.6 0.7 5.4 -0.1M5 -0.7q1.7 -0.7 3.4 0"
        strokeWidth={1.1}
        strokeLinecap="round"
        fill="none"
      />
      {/* The cut end: pale wood with a ring. */}
      <ellipse cx={13.7} cy={0} rx={2.3} ry={3.3} fill="#d9a066" />
      <ellipse className="flame__log-ring" cx={13.7} cy={0} rx={1.1} ry={1.6} fill="none" strokeWidth={0.8} />
    </g>
  );
}
