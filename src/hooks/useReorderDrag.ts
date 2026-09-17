import { useEffect, useRef, useState } from "react";

// Long-press on touch (matches iOS's own long-press-to-reorder convention -
// Reminders, Notes checklists, Home Screen icons all use ~450-500ms), a
// small movement threshold on mouse (matches Trello/Linear/Notion - grab
// and drag from anywhere, no delay, since a mouse click is already
// deliberate). Either way, a nested control that stops propagation on its
// own onPointerDown (a checkbox, a delete button, etc.) never starts this
// at all, so tapping those still works exactly as before.
const LONG_PRESS_MS = 450;
// How far the finger needs to move before the pending long-press timer is
// cancelled and this settles into being treated as a plain scroll. Kept
// small (rather than the old 8px) because the timer itself doesn't wait for
// this - it still fires unconditionally at LONG_PRESS_MS regardless of
// movement, so a slow, deliberate scroll swipe that only reaches 8px after
// 450ms used to get hijacked into a drag anyway. A low threshold cancels the
// timer almost immediately once there's any real (non-jitter) movement,
// closing that window, while a genuinely stationary press still promotes to
// a drag as intended.
const TOUCH_CANCEL_PX = 3;
const MOUSE_DRAG_THRESHOLD_PX = 5;

// The manual 1:1 scroll below (see bindPointerDown) has no native momentum -
// a fast flick just stops dead on release, unlike scrolling from anywhere
// else in the panel (which never had touch-action disabled, so it keeps its
// normal native coast). These replicate that same coast for a release that
// turned out to be a scroll rather than a drag. Velocities are in px/ms.
const MIN_FLING_VELOCITY = 0.05;
const MOMENTUM_STOP_VELOCITY = 0.02;
const MOMENTUM_DECAY_PER_MS = 0.998;

// How close the pointer needs to get to the scrollable container's top/
// bottom edge before auto-scroll kicks in, and the fastest it'll scroll
// right at that edge.
const AUTO_SCROLL_EDGE_PX = 56;
const AUTO_SCROLL_MAX_SPEED = 14;

/** Nearest scrollable ancestor, walking up from an element inside the list. */
function findScrollParent(el: HTMLElement | null): HTMLElement | null {
  let node = el?.parentElement ?? null;
  while (node) {
    const style = getComputedStyle(node);
    if (style.overflowY === "auto" || style.overflowY === "scroll") return node;
    node = node.parentElement;
  }
  return null;
}

interface PendingHold {
  pointerId: number;
  timer: number | null;
  cleanup: () => void;
}

// Module-level (not per-hook-instance) because multiple useReorderDrag
// instances can share the same underlying scrollable container - e.g. tasks
// within a group and the group headers/notes above them (see TaskList.tsx's
// separate taskDrag/layoutDrag instances) all scroll the same .day-panel.
// Tracking momentum per-container rather than per-instance is what lets a
// touch on EITHER kind of row stop momentum the OTHER one started - keying
// it to each hook's own ref left a flick started on a task still coasting
// (and fighting the new manual scroll) if the next touch happened to land
// on a group header instead, since that instance's stop only ever knew
// about its own (never-started) momentum.
const activeMomentum = new Map<HTMLElement, number>();

function stopMomentumFor(container: HTMLElement | null) {
  if (!container) return;
  const frameId = activeMomentum.get(container);
  if (frameId !== undefined) {
    window.cancelAnimationFrame(frameId);
    activeMomentum.delete(container);
  }
}

/** Coasts `container.scrollTop` on from a release velocity (px/ms, +down),
 *  decaying it every frame - the manual scroll equivalent of native
 *  momentum, since touch-action:none on these rows leaves the finger's own
 *  release with none. */
function startMomentum(container: HTMLElement, initialVelocity: number) {
  if (Math.abs(initialVelocity) < MIN_FLING_VELOCITY) return;
  stopMomentumFor(container);
  let velocity = initialVelocity;
  let lastT = performance.now();
  function step(now: number) {
    const dt = now - lastT;
    lastT = now;
    container.scrollTop -= velocity * dt;
    velocity *= Math.pow(MOMENTUM_DECAY_PER_MS, dt);
    const atTop = container.scrollTop <= 0;
    const atBottom = container.scrollTop >= container.scrollHeight - container.clientHeight;
    if (Math.abs(velocity) < MOMENTUM_STOP_VELOCITY || (velocity > 0 ? atBottom : atTop)) {
      activeMomentum.delete(container);
      return;
    }
    activeMomentum.set(container, window.requestAnimationFrame(step));
  }
  activeMomentum.set(container, window.requestAnimationFrame(step));
}

/**
 * Reordering for a flat list of ids, with auto-scroll near the edge of
 * whatever scrollable container the list lives in, and a dragged item that
 * visually follows the pointer 1:1 (including while auto-scroll is moving
 * the list underneath it) rather than just showing a drop-line.
 *
 * Two ways to start a drag, for two different situations:
 *  - `bindPointerDown` - grab anywhere on the row, press-and-hold on touch /
 *    threshold-drag on mouse. Only really safe when nothing else on that
 *    row needs to scroll independently of it (Settings' CategoryManager).
 *  - `bindHandlePointerDown` - grab a small dedicated handle element,
 *    starting immediately with no ambiguity. Used wherever the row itself
 *    also needs to keep ordinary native touch scrolling (the day panel's
 *    tasks/groups/notes) - see its own doc comment for why.
 *
 * The list of ids being reordered is captured fresh at the moment a drag
 * actually begins (via `getIds()`, called from whichever bind function
 * started it) rather than passed once up front - that's what lets the same
 * hook serve both a flat list (categories) and a scoped one (just the tasks
 * in whichever group you started dragging from).
 */
export function useReorderDrag(onReorder: (nextIds: string[]) => void) {
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const itemRefs = useRef<Partial<Record<string, HTMLElement>>>({});

  // Always the latest onReorder, read from inside the drag effect without
  // being one of its dependencies - callers pass a fresh inline function on
  // every render, and since dropIndex/draggedId are this hook's own state,
  // the consuming component re-renders on virtually every pointermove while
  // dragging. Depending on onReorder directly used to tear down and re-run
  // the whole effect on each of those renders, which silently recaptured
  // "the scrollTop the drag started at" from whatever the CURRENT (already
  // auto-scrolled) position was - throwing off the transform math and
  // making the dragged item jump out from under the pointer whenever that
  // reset happened to land mid-auto-scroll (i.e. more likely the more time
  // is spent near an edge).
  const onReorderRef = useRef(onReorder);
  onReorderRef.current = onReorder;

  const idsRef = useRef<string[]>([]);
  const dragStartYRef = useRef<number | null>(null);
  const lastPointerYRef = useRef<number | null>(null);
  const scrollSpeedRef = useRef(0);
  const scrollContainerRef = useRef<HTMLElement | null>(null);
  const initialScrollTopRef = useRef(0);
  // Set the instant a drag concludes, so the click that (on most browsers)
  // fires right after the final pointerup doesn't also register as "tapped
  // this row" - checked once by the caller via suppressClick, then cleared.
  const suppressClickRef = useRef(false);
  const pendingRef = useRef<PendingHold | null>(null);

  function cancelPending() {
    const pending = pendingRef.current;
    if (pending) {
      if (pending.timer !== null) window.clearTimeout(pending.timer);
      pending.cleanup();
      pendingRef.current = null;
    }
  }

  // Only ever cleans up a *pending* (not-yet-started) hold on unmount - an
  // active drag's own effect below already cleans itself up, and any
  // in-progress momentum (see startMomentum/stopMomentumFor above) belongs
  // to the scroll container rather than this instance, so it's left alone.
  useEffect(() => cancelPending, []);

  useEffect(() => {
    if (draggedId === null) return;
    document.body.classList.add("is-dragging");

    const anyEl = Object.values(itemRefs.current)[0] ?? null;
    scrollContainerRef.current = findScrollParent(anyEl ?? null);
    initialScrollTopRef.current = scrollContainerRef.current?.scrollTop ?? 0;

    function indexForY(clientY: number): number {
      const ids = idsRef.current;
      for (let i = 0; i < ids.length; i++) {
        // The dragged item's own rect is displaced by the live translateY
        // transform following the pointer (see applyDragTransform) - it's
        // not a real boundary to compare against, and checking it anyway
        // can spuriously match against its own relocated position and stop
        // the drop index from ever advancing.
        if (ids[i] === draggedId) continue;
        const el = itemRefs.current[ids[i]];
        if (!el) continue;
        const rect = el.getBoundingClientRect();
        if (clientY < rect.top + rect.height / 2) return i;
      }
      return ids.length;
    }

    function applyDragTransform() {
      const el = itemRefs.current[draggedId as string];
      if (!el || dragStartYRef.current === null || lastPointerYRef.current === null) return;
      const container = scrollContainerRef.current;
      const scrollDelta = container ? container.scrollTop - initialScrollTopRef.current : 0;
      const pointerDelta = lastPointerYRef.current - dragStartYRef.current;
      el.style.transform = `translateY(${pointerDelta + scrollDelta}px)`;
    }

    function onMove(e: PointerEvent) {
      // Stops the browser from also trying to scroll the page/list from
      // this same touch gesture once a drag is under way - safe to call
      // every time since, by the time a drag has actually started (either
      // the long-press timer fired with the finger still not having moved,
      // or the mouse crossed its movement threshold), no native scroll
      // gesture has been committed to yet.
      e.preventDefault();
      lastPointerYRef.current = e.clientY;
      setDropIndex(indexForY(e.clientY));

      scrollSpeedRef.current = 0;
      const container = scrollContainerRef.current;
      if (container) {
        const rect = container.getBoundingClientRect();
        if (e.clientY < rect.top + AUTO_SCROLL_EDGE_PX) {
          const depth = (rect.top + AUTO_SCROLL_EDGE_PX - e.clientY) / AUTO_SCROLL_EDGE_PX;
          scrollSpeedRef.current = -AUTO_SCROLL_MAX_SPEED * Math.min(1, Math.max(0, depth));
        } else if (e.clientY > rect.bottom - AUTO_SCROLL_EDGE_PX) {
          const depth = (e.clientY - (rect.bottom - AUTO_SCROLL_EDGE_PX)) / AUTO_SCROLL_EDGE_PX;
          scrollSpeedRef.current = AUTO_SCROLL_MAX_SPEED * Math.min(1, Math.max(0, depth));
        }
      }

      applyDragTransform();
    }

    function onUp(e: PointerEvent) {
      scrollSpeedRef.current = 0;
      const el = itemRefs.current[draggedId as string];
      if (el) el.style.transform = "";
      dragStartYRef.current = null;
      lastPointerYRef.current = null;

      const ids = idsRef.current;
      const from = ids.indexOf(draggedId as string);
      const to = indexForY(e.clientY);
      if (from !== -1) {
        const next = [...ids];
        const [moved] = next.splice(from, 1);
        next.splice(to > from ? to - 1 : to, 0, moved);
        if (next.some((v, i) => v !== ids[i])) {
          onReorderRef.current(next);
        }
      }
      suppressClickRef.current = true;
      setDraggedId(null);
      setDropIndex(null);
    }

    let rafId = window.requestAnimationFrame(function tick() {
      const container = scrollContainerRef.current;
      if (container && scrollSpeedRef.current !== 0) {
        container.scrollTop += scrollSpeedRef.current;
      }
      applyDragTransform();
      rafId = window.requestAnimationFrame(tick);
    });

    window.addEventListener("pointermove", onMove, { passive: false });
    window.addEventListener("pointerup", onUp);
    return () => {
      document.body.classList.remove("is-dragging");
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.cancelAnimationFrame(rafId);
      scrollSpeedRef.current = 0;
      scrollContainerRef.current = null;
      lastPointerYRef.current = null;
      const el = itemRefs.current[draggedId as string];
      if (el) el.style.transform = "";
    };
    // Deliberately only draggedId - see onReorderRef above for why onReorder
    // itself must NOT be a dependency here.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draggedId]);

  function beginDrag(id: string, ids: string[], startY: number) {
    idsRef.current = ids;
    dragStartYRef.current = startY;
    lastPointerYRef.current = startY;
    setDraggedId(id);
    setDropIndex(ids.indexOf(id));
  }

  /** Attach to whichever element should visually lift and be hit-tested
   *  while being dragged - the row for a flat list, or the whole card for
   *  something like a group whose *header* is the grab zone. */
  function registerItemRef(id: string) {
    return (el: HTMLElement | null) => {
      itemRefs.current[id] = el ?? undefined;
    };
  }

  /** Attach to whichever element is the actual "press here to pick this
   *  up" zone - often the same element as registerItemRef, but not always
   *  (a group's header, not its whole card, is the grab zone for it). */
  function bindPointerDown(id: string, getIds: () => string[]) {
    return (e: React.PointerEvent) => {
      if (pendingRef.current || draggedId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      // Stops momentum on the shared scroll container regardless of which
      // useReorderDrag instance (or row kind) started it - see
      // stopMomentumFor's own comment for why this can't just be this
      // instance's own momentum state.
      stopMomentumFor(findScrollParent(e.currentTarget as HTMLElement));
      // A press that started on a real control (a button, an input, the
      // checkbox, ...) is that control's business, not a grab of the row it
      // happens to live in - bail out immediately and let it behave exactly
      // as if this hook weren't here at all.
      if ((e.target as HTMLElement).closest("button, input, a, [data-no-drag]")) return;

      const isTouch = e.pointerType !== "mouse";
      const startX = e.clientX;
      const startY = e.clientY;
      const pointerId = e.pointerId;
      const targetEl = e.currentTarget as HTMLElement;

      function capture() {
        try {
          targetEl.setPointerCapture(pointerId);
        } catch {
          // Not supported on this platform/version - the window-level
          // pointermove/pointerup listeners in the effect above still work
          // without it.
        }
      }

      // Touch only: these rows keep touch-action: none permanently (see
      // CategoryManager.css / TaskItem.css / TaskGroup.css) rather than
      // something like pan-y, because WebKit decides once, at the very
      // first touch of a gesture, whether it's allowed to scroll natively -
      // and never reconsiders that decision later no matter what our JS
      // does, so there's no reliable way to "allow native scrolling, but
      // only until a long-press timer fires". Instead we drive scrolling
      // ourselves for the entire gesture: manually, 1:1 with the finger,
      // for as long as this might still turn out to be a plain scroll
      // (below); handed over to the real drag's own edge-only auto-scroll
      // the moment the hold actually activates.
      let lastY = startY;
      let lastT = e.timeStamp;
      // px/ms, smoothed towards the most recent sample so it tracks a
      // change in speed quickly (e.g. slowing down right before lifting
      // off) without one single jittery event spiking it.
      let velocity = 0;
      // Mirrors the latest `dist` computed in onPendingMove, so the
      // long-press timer below can double check it right before promoting
      // to a drag - see the timer callback for why.
      let lastDist = 0;
      const scrollContainer = isTouch ? findScrollParent(targetEl) : null;

      function onPendingMove(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        const dist = Math.hypot(ev.clientX - startX, ev.clientY - startY);
        lastDist = dist;
        if (isTouch) {
          ev.preventDefault();
          if (scrollContainer) scrollContainer.scrollTop -= ev.clientY - lastY;
          const dt = ev.timeStamp - lastT;
          if (dt > 0) {
            velocity = velocity * 0.2 + ((ev.clientY - lastY) / dt) * 0.8;
          }
          lastY = ev.clientY;
          lastT = ev.timeStamp;
          // Moved enough to look like a scroll, not a hold - stop the
          // long-press timer from turning this into a drag, but keep this
          // listener running (don't call cancelPending, which would tear
          // it down) so the manual scroll above keeps following the finger
          // for the rest of the gesture, same as a real scroll would.
          const pending = pendingRef.current;
          if (dist > TOUCH_CANCEL_PX && pending && pending.timer !== null) {
            window.clearTimeout(pending.timer);
            pending.timer = null;
          }
        } else if (dist > MOUSE_DRAG_THRESHOLD_PX) {
          ev.preventDefault(); // stop text selection once this is a drag, not a click
          cancelPending();
          capture();
          beginDrag(id, getIds(), startY);
        }
      }

      function onPendingUp(ev: PointerEvent) {
        if (ev.pointerId !== pointerId) return;
        cancelPending();
        // Reaching here (rather than the long-press timer firing first)
        // means this settled into being a scroll, not a drag - so a fast
        // flick should coast on release exactly like it would anywhere
        // else in the panel.
        if (isTouch && scrollContainer) startMomentum(scrollContainer, velocity);
      }

      function cleanup() {
        window.removeEventListener("pointermove", onPendingMove);
        window.removeEventListener("pointerup", onPendingUp);
      }

      window.addEventListener("pointermove", onPendingMove, { passive: false });
      window.addEventListener("pointerup", onPendingUp);

      const timer = isTouch
        ? window.setTimeout(() => {
            // Rarely, this timer can still fire before the pointermove
            // that was already past TOUCH_CANCEL_PX gets around to
            // clearing it - both are just tasks on the same queue, and
            // nothing guarantees the move is processed first. Re-checking
            // the distance here closes that race: if this has already
            // moved enough to be a scroll, leave the pending listeners
            // running (don't promote to a drag) instead of grabbing the
            // row out from under an in-progress scroll.
            if (lastDist > TOUCH_CANCEL_PX) {
              if (pendingRef.current) pendingRef.current.timer = null;
              return;
            }
            cleanup();
            pendingRef.current = null;
            capture();
            beginDrag(id, getIds(), startY);
          }, LONG_PRESS_MS)
        : null;

      pendingRef.current = { pointerId, timer, cleanup };
    };
  }

  /** Attach to a small, dedicated grab-handle element instead of the whole
   *  row (day-panel tasks/groups/notes use this; Settings' CategoryManager
   *  still uses grab-anywhere via bindPointerDown above). A press here is
   *  never ambiguous with a scroll - there's nothing else to interpret it
   *  as - so it begins immediately, with no long-press wait and none of
   *  bindPointerDown's manual scroll/momentum machinery. That in turn means
   *  the row itself never needs touch-action:none, so everywhere else on it
   *  keeps ordinary, fully native scrolling (and momentum) for free. */
  function bindHandlePointerDown(id: string, getIds: () => string[]) {
    return (e: React.PointerEvent) => {
      if (draggedId !== null) return;
      if (e.pointerType === "mouse" && e.button !== 0) return;
      e.preventDefault();
      // Don't let this also reach the row's own onClick/onPointerDown (the
      // row has neither for these callers, but this keeps the handle
      // self-contained regardless of what wraps it).
      e.stopPropagation();
      const targetEl = e.currentTarget as HTMLElement;
      stopMomentumFor(findScrollParent(targetEl));
      try {
        targetEl.setPointerCapture(e.pointerId);
      } catch {
        // Not supported on this platform/version - the active-drag effect's
        // own window-level pointermove/pointerup listeners still work
        // without it.
      }
      beginDrag(id, getIds(), e.clientY);
    };
  }

  function suppressClick(e: React.SyntheticEvent): boolean {
    if (suppressClickRef.current) {
      e.preventDefault();
      e.stopPropagation();
      suppressClickRef.current = false;
      return true;
    }
    return false;
  }

  return {
    draggedId,
    dropIndex,
    registerItemRef,
    bindPointerDown,
    bindHandlePointerDown,
    suppressClick,
  };
}
