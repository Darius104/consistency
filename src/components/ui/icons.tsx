import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

function base(size: number, props: IconProps) {
  return {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 2,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    ...props,
  };
}

export function ChevronLeftIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="15 18 9 12 15 6" />
    </svg>
  );
}

export function ChevronRightIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="9 18 15 12 9 6" />
    </svg>
  );
}

export function SettingsIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 1 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06a1.65 1.65 0 0 0 .33-1.82 1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06a1.65 1.65 0 0 0 1.82.33H9a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06a1.65 1.65 0 0 0-.33 1.82V9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
    </svg>
  );
}

export function XIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="18" y1="6" x2="6" y2="18" />
      <line x1="6" y1="6" x2="18" y2="18" />
    </svg>
  );
}

export function CheckIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

export function GripIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)} stroke="none" fill="currentColor">
      {[8, 16].map((cx) =>
        [6, 12, 18].map((cy) => <circle key={`${cx}-${cy}`} cx={cx} cy={cy} r={1.6} />),
      )}
    </svg>
  );
}

export function ShuffleIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="16 3 21 3 21 8" />
      <line x1="4" y1="20" x2="21" y2="3" />
      <polyline points="21 16 21 21 16 21" />
      <line x1="15" y1="15" x2="21" y2="21" />
      <line x1="4" y1="4" x2="9" y2="9" />
    </svg>
  );
}

export function FrostIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <line x1="12" y1="3" x2="12" y2="21" />
      <line x1="12" y1="3" x2="12" y2="21" transform="rotate(60 12 12)" />
      <line x1="12" y1="3" x2="12" y2="21" transform="rotate(120 12 12)" />
    </svg>
  );
}

export function ClockIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <circle cx="12" cy="12" r="9" />
      <polyline points="12 7 12 12 15 14" />
    </svg>
  );
}

export function RepeatIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <polyline points="17 1 21 5 17 9" />
      <path d="M3 11V9a4 4 0 0 1 4-4h14" />
      <polyline points="7 23 3 19 7 15" />
      <path d="M21 13v2a4 4 0 0 1-4 4H3" />
    </svg>
  );
}

export function EditIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" />
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4z" />
    </svg>
  );
}

export function QuoteIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
    </svg>
  );
}

export function BookmarkIcon({ size = 16, ...props }: IconProps) {
  return (
    <svg {...base(size, props)}>
      <path d="M19 21 12 16 5 21V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z" />
    </svg>
  );
}
