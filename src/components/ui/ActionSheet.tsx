import { useState } from "react";
import type { ReactNode } from "react";
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
  actions: ActionSheetAction[];
  onClose: () => void;
}

// Matches the CSS transition duration below - same delayed-unmount pattern
// as Modal.tsx, just sliding up from the bottom instead of scaling in from
// the center, since a quick list of contextual choices reads as a native
// action sheet, not a dialog.
const CLOSE_DURATION_MS = 200;

export function ActionSheet({ title, actions, onClose }: ActionSheetProps) {
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_DURATION_MS);
  }

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
      >
        <div className="action-sheet__grabber" aria-hidden="true" />
        {title && <div className="action-sheet__title">{title}</div>}
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
              {action.icon}
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
