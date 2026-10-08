import { useEffect, useRef, useState } from "react";
import type { PointerEvent as ReactPointerEvent, ReactNode } from "react";
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
  /** Phone: shown as a tab's page - sits above the bottom tab bar (which
   *  stays visible) with no close button, instead of covering everything.
   *  The tab bar is how you leave it. No effect on desktop. */
  asTab?: boolean;
}

// Matches the CSS transition duration below - the actual unmount (calling
// the real onClose) is delayed so the panel gets to play its exit animation
// instead of vanishing the instant the backdrop or close button is clicked.
const CLOSE_DURATION_MS = 260;

// Phone bottom-sheet drag-to-dismiss: pulled past this far, or released
// moving down faster than this (px/ms), counts as "throw it away".
const DISMISS_DISTANCE_PX = 110;
const DISMISS_VELOCITY = 0.6;

interface DragState {
  pointerId: number;
  startY: number;
  lastY: number;
  lastTime: number;
  velocity: number;
}

export function Modal({ title, onClose, children, size = "default", asTab = false }: ModalProps) {
  const [closing, setClosing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const dragRef = useRef<DragState | null>(null);

  function requestClose() {
    if (closing) return;
    setClosing(true);
    window.setTimeout(onClose, CLOSE_DURATION_MS);
  }

  // The on-screen keyboard covers the bottom of the screen without moving
  // anything (only the visual viewport shrinks), so a bottom sheet with a
  // focused input ended up underneath it. Measure how much of the screen
  // the keyboard takes and lift the sheet by that much (--keyboard-inset,
  // see Modal.css).
  useEffect(() => {
    const vv = window.visualViewport;
    const overlay = overlayRef.current;
    if (!vv || !overlay) return;
    function update() {
      if (!vv || !overlay) return;
      const inset = Math.max(0, window.innerHeight - vv.height - vv.offsetTop);
      overlay.style.setProperty("--keyboard-inset", `${Math.round(inset)}px`);
    }
    update();
    vv.addEventListener("resize", update);
    vv.addEventListener("scroll", update);
    return () => {
      vv.removeEventListener("resize", update);
      vv.removeEventListener("scroll", update);
    };
  }, []);

  // Keyboard users had no way to dismiss a modal short of tabbing all the
  // way to the close button - outside-click was the only other escape
  // hatch, and that's mouse-only.
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") requestClose();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [closing]);

  // On a phone the default-size modal is a bottom sheet (see Modal.css) -
  // its header doubles as a grab handle: the sheet follows the finger 1:1
  // while dragged, and a long enough pull or a quick downward flick
  // dismisses it, otherwise it springs back. Touch only, never a mouse, and
  // never the full-screen "wide" variant (Settings), which isn't a sheet.
  function onHeaderPointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    if (e.pointerType === "mouse" || size === "wide" || closing) return;
    if ((e.target as HTMLElement).closest("button")) return;
    if (!window.matchMedia("(max-width: 700px)").matches) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    dragRef.current = {
      pointerId: e.pointerId,
      startY: e.clientY,
      lastY: e.clientY,
      lastTime: e.timeStamp,
      velocity: 0,
    };
    if (panelRef.current) panelRef.current.style.transition = "none";
  }

  function onHeaderPointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || !panel || e.pointerId !== drag.pointerId) return;
    const dt = e.timeStamp - drag.lastTime;
    if (dt > 0) drag.velocity = (e.clientY - drag.lastY) / dt;
    drag.lastY = e.clientY;
    drag.lastTime = e.timeStamp;
    const dy = e.clientY - drag.startY;
    // Upward drags resist progressively instead of stopping dead - the sheet
    // is already as tall as it gets, but a hard stop reads as frozen.
    const offset = dy >= 0 ? dy : -Math.sqrt(-dy) * 2;
    panel.style.transform = `translateY(${offset}px)`;
  }

  function onHeaderPointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    const panel = panelRef.current;
    if (!drag || e.pointerId !== drag.pointerId) return;
    dragRef.current = null;
    if (!panel) return;
    const dy = e.clientY - drag.startY;
    // Clearing both inline overrides at once hands the motion back to the
    // CSS transition, which starts from where the finger let go - either
    // sliding the rest of the way out (closing) or back up into place.
    panel.style.transition = "";
    panel.style.transform = "";
    if (dy > DISMISS_DISTANCE_PX || drag.velocity > DISMISS_VELOCITY) requestClose();
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
      ref={overlayRef}
      className={`modal-overlay ${closing ? "modal-overlay--closing" : ""} ${asTab ? "modal-overlay--tab" : ""}`}
      onMouseDown={requestClose}
    >
      <div
        ref={panelRef}
        className={`modal-panel ${size === "wide" ? "modal-panel--wide" : ""} ${
          closing ? "modal-panel--closing" : ""
        }`}
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <div
          className="modal-header"
          onPointerDown={onHeaderPointerDown}
          onPointerMove={onHeaderPointerMove}
          onPointerUp={onHeaderPointerUp}
          onPointerCancel={onHeaderPointerUp}
        >
          <span className="modal-grabber" aria-hidden="true" />
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
