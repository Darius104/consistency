import { useState } from "react";
import type { ReactNode } from "react";
import { XIcon } from "./icons";
import "./Modal.css";

interface ModalProps {
  title: string;
  onClose: () => void;
  children: ReactNode;
}

// Matches the CSS transition duration below - the actual unmount (calling
// the real onClose) is delayed so the panel gets to play its exit animation
// instead of vanishing the instant the backdrop or close button is clicked.
const CLOSE_DURATION_MS = 200;

export function Modal({ title, onClose, children }: ModalProps) {
  const [closing, setClosing] = useState(false);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_DURATION_MS);
  }

  return (
    <div
      className={`modal-overlay ${closing ? "modal-overlay--closing" : ""}`}
      onMouseDown={requestClose}
    >
      <div
        className={`modal-panel ${closing ? "modal-panel--closing" : ""}`}
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
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}
