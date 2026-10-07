import { useEffect, useRef, useState } from "react";
import { hapticSelection } from "../utils/haptics";

const PULL_TRIGGER_PX = 70;
const PULL_MAX_PX = 96;
const SWIPE_MIN_PX = 70;

// Gestures that start on these are theirs, not the panel's: a task row's
// own swipe-to-delete, a long-press drag, fields, switches, and the widget
// tiles while they're being arranged.
const OWN_GESTURE = ".task-swipe, input, textarea, button.switch, .widget-tiles--arranging, .modal-overlay";

interface Options {
  enabled: boolean;
  onRefresh: () => Promise<unknown>;
  onSwipeDay: (delta: 1 | -1) => void;
}

/** Phone Today view: pull down from the top to sync, swipe left/right to
 *  go to the next/previous day. Native touch listeners on the scroll
 *  container, never blocking its own scrolling. Returns how far the pull
 *  indicator should show (px) and whether a refresh is running. */
export function usePanelGestures(ref: React.RefObject<HTMLElement | null>, options: Options) {
  const [pull, setPull] = useState(0);
  const [refreshing, setRefreshing] = useState(false);
  const optionsRef = useRef(options);
  optionsRef.current = options;
  const refreshingRef = useRef(false);

  useEffect(() => {
    const el = ref.current;
    if (!el || !options.enabled) return;
    let start: { x: number; y: number; t: number; atTop: boolean } | null = null;
    let mode: "pending" | "pull" | "swipe" | "none" = "none";
    let pulled = 0;

    function onStart(e: TouchEvent) {
      if (e.touches.length !== 1) return;
      if ((e.target as HTMLElement).closest(OWN_GESTURE)) {
        start = null;
        return;
      }
      const t = e.touches[0];
      start = { x: t.clientX, y: t.clientY, t: e.timeStamp, atTop: el!.scrollTop <= 0 };
      mode = "pending";
      pulled = 0;
    }

    function onMove(e: TouchEvent) {
      if (!start || mode === "none") return;
      const t = e.touches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (mode === "pending") {
        if (Math.abs(dx) > 12 && Math.abs(dx) > Math.abs(dy) * 1.5) mode = "swipe";
        else if (dy > 8 && start.atTop && !refreshingRef.current) mode = "pull";
        else if (Math.abs(dy) > 8) mode = "none";
        else return;
      }
      if (mode === "pull") {
        if (el!.scrollTop > 0) {
          mode = "none";
          setPull(0);
          return;
        }
        const next = Math.min(PULL_MAX_PX, Math.max(0, dy * 0.5));
        if ((pulled < PULL_TRIGGER_PX) !== (next < PULL_TRIGGER_PX)) hapticSelection();
        pulled = next;
        setPull(next);
      }
    }

    function onEnd(e: TouchEvent) {
      if (!start) return;
      const t = e.changedTouches[0];
      const dx = t.clientX - start.x;
      const dy = t.clientY - start.y;
      if (mode === "swipe" && Math.abs(dx) >= SWIPE_MIN_PX && Math.abs(dx) > Math.abs(dy) * 1.5) {
        hapticSelection();
        optionsRef.current.onSwipeDay(dx < 0 ? 1 : -1);
      }
      if (mode === "pull") {
        if (pulled >= PULL_TRIGGER_PX) {
          refreshingRef.current = true;
          setRefreshing(true);
          setPull(PULL_TRIGGER_PX * 0.6);
          optionsRef.current
            .onRefresh()
            .catch(() => {})
            .finally(() => {
              refreshingRef.current = false;
              setRefreshing(false);
              setPull(0);
            });
        } else {
          setPull(0);
        }
      }
      start = null;
      mode = "none";
    }

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: true });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onEnd);
    };
  }, [ref, options.enabled]);

  return { pull, refreshing, triggered: pull >= PULL_TRIGGER_PX };
}
