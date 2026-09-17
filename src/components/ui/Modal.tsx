import { useState } from "react";
import type { ReactNode } from "react";
import { createPortal } from "react-dom";
import { XIcon } from "./icons";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
  /** "wide" is for content with its own internal layout (e.g. a nav +
   *  detail pane) that needs more room and manages its own padding. */
  size?: "default" | "wide";
}

// Matches the CSS transition duration below - the actual unmount (calling
// the real onClose) is delayed so the panel gets to play its exit animation
// instead of vanishing the instant the backdrop or close button is clicked.
const CLOSE_DURATION_MS = 200;

export function Modal({ title, onClose, children, size = "default" }: ModalProps) {
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_DURATION_MS);
  }

  // Rendered into document.body rather than wherever this component happens
  // to be mounted - a position:fixed overlay nested inside a scrollable,
  // masked, or transformed ancestor (e.g. the mobile day panel's own
  // scroll-fade mask) doesn't reliably escape to cover the real viewport in
  // WebKit, so it can end up visually trapped/clipped inside that ancestor's
  // box instead of centered over the whole screen. A portal sidesteps that
  // entirely regardless of where a given Modal call site lives in the tree.
  return createPortal(
    <div
      className={`modal-overlay ${closing ? "modal-overlay--closing" : ""}`}
      onMouseDown={requestClose}
    >
      <div
        className={`modal-panel ${size === "wide" ? "modal-panel--wide" : ""} ${
          closing ? "modal-panel--closing" : ""
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div className="modal-header">
          <h2 className="modal-title">{title}</h2>
          <button className="modal-close" onClick={requestClose} aria-label="Close">
            <XIcon size={16} />
          </button>
        </div>
        <div className={`modal-body ${size === "wide" ? "modal-body--flush" : ""}`}>
          {children}
        </div>
      </div>
    </div>,
    document.body,
  );
}
