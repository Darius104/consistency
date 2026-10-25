import { useEffect, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { createPortal } from "react-dom";
import "./ActionSheet.css";

export interface ActionSheetAction {
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  destructive?: boolean;
}

interface ActionSheetProps {
  title?: string;
  /** With an icon, the title becomes a header: the icon in a square of
   *  `color`, the title, and `subtitle` under it. */
  icon?: ReactNode;
  color?: string;
  subtitle?: string;
  /** Anything extra between the header and the actions (e.g. the Day
   *  Streak's style picker). */
  children?: ReactNode;
  actions: ActionSheetAction[];
  onClose: () => void;
}

// Matches the CSS transition duration below - same delayed-unmount pattern
// as Modal.tsx, just sliding up from the bottom instead of scaling in from
// the center, since a quick list of contextual choices reads as a native
// action sheet, not a dialog.
const CLOSE_DURATION_MS = 200;

/** A short list of choices about one thing: a bottom sheet on a phone, a
 *  small centered card on desktop. */
export function ActionSheet({
  title,
  icon,
  color,
  subtitle,
  children,
  actions,
  onClose,
}: ActionSheetProps) {
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_DURATION_MS);
  }

  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closing]);

  return createPortal(
    <div
      className={`action-sheet-overlay ${closing ? "action-sheet-overlay--closing" : ""}`}
      onMouseDown={requestClose}
    >
      <div
        className={`action-sheet ${closing ? "action-sheet--closing" : ""}`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        style={color ? ({ "--sheet-color": color } as CSSProperties) : undefined}
      >
        <div className="action-sheet__grabber" aria-hidden="true" />
        {icon ? (
          <div className="action-sheet__head">
            <span className="action-sheet__icon" aria-hidden="true">
              {icon}
            </span>
            <span className="action-sheet__head-text">
              <span className="action-sheet__name">{title}</span>
              {subtitle && <span className="action-sheet__subtitle">{subtitle}</span>}
            </span>
          </div>
        ) : (
          title && <div className="action-sheet__title">{title}</div>
        )}
        {children}
        <div className="action-sheet__actions">
          {actions.map((action) => (
            <button
              key={action.label}
              type="button"
              className={`action-sheet__action ${
                action.destructive ? "action-sheet__action--destructive" : ""
              }`}
              onClick={() => {
                // Without this guard, tapping a second action while the
                // sheet is still playing its 200ms close animation from a
                // first tap would fire both onSelects - requestClose()
                // alone no-ops on the second tap, but onSelect() doesn't.
                if (closing) return;
                requestClose();
                action.onSelect();
              }}
            >
              {action.icon && (
                <span className="action-sheet__action-icon" aria-hidden="true">
                  {action.icon}
                </span>
              )}
              {action.label}
            </button>
          ))}
        </div>
        <button type="button" className="action-sheet__cancel" onClick={requestClose}>
          Cancel
        </button>
      </div>
    </div>,
    document.body,
  );
}
