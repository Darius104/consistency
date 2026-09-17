import { useEffect, useRef, useState } from "react";
import { CheckIcon } from "./ui/icons";
import "./OfflineBanner.css";

interface OfflineBannerProps {
  online: boolean;
  syncing: boolean;
}

type Phase = "offline" | "syncing" | "success";

const VISIBLE_MS = 5000;
// How long the "Synced" confirmation stays up once a sync finishes
// successfully, before the banner hides itself the same way it always has.
const SUCCESS_MS = 1600;
// Must match offline-banner-out's duration in OfflineBanner.css - the DOM
// node stays mounted this long after `visible` goes false, so the exit
// animation has time to actually play instead of the node vanishing
// instantly underneath it.
const EXIT_MS = 200;

export function OfflineBanner({ online, syncing }: OfflineBannerProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  // Captured at the moment we show/re-show the banner, not read live during
  // the fade-out - otherwise reconnecting while the "Offline" banner is
  // fading away could flip its text out from under the animation.
  const [phase, setPhase] = useState<Phase>("offline");
  const hideTimerRef = useRef<number | null>(null);
  const unmountTimerRef = useRef<number | null>(null);
  // Whether the previous render was mid-sync - the only way to tell "a sync
  // just finished" apart from "nothing has happened yet" (both look like
  // online:true, syncing:false).
  const wasSyncingRef = useRef(false);

  // A transient toast, not a persistent banner - every time offline/syncing
  // status actually changes (going offline, a retry attempt starting or
  // finishing) it shows again, then hides on its own - a finished sync gets
  // a brief "Synced" confirmation first instead of just vanishing outright.
  useEffect(() => {
    if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);

    if (!online) {
      setPhase("offline");
      setVisible(true);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), VISIBLE_MS);
    } else if (syncing) {
      setPhase("syncing");
      setVisible(true);
      // No auto-hide timer while actively syncing - the branch below takes
      // over (with its own timer) the moment this finishes.
    } else if (wasSyncingRef.current) {
      setPhase("success");
      setVisible(true);
      hideTimerRef.current = window.setTimeout(() => setVisible(false), SUCCESS_MS);
    } else {
      setVisible(false);
    }

    wasSyncingRef.current = syncing;

    return () => {
      if (hideTimerRef.current) window.clearTimeout(hideTimerRef.current);
    };
  }, [online, syncing]);

  // Keeps the node mounted for EXIT_MS after `visible` goes false, so the
  // leaving class's animation gets to play instead of the banner just
  // disappearing outright.
  useEffect(() => {
    if (visible) {
      if (unmountTimerRef.current) window.clearTimeout(unmountTimerRef.current);
      setMounted(true);
    } else if (mounted) {
      unmountTimerRef.current = window.setTimeout(() => setMounted(false), EXIT_MS);
    }
    return () => {
      if (unmountTimerRef.current) window.clearTimeout(unmountTimerRef.current);
    };
  }, [visible, mounted]);

  if (!mounted) return null;

  return (
    <div
      className={`offline-banner offline-banner--${phase} ${visible ? "" : "offline-banner--leaving"}`}
    >
      {phase === "success" ? (
        <CheckIcon size={12} className="offline-banner__check" />
      ) : (
        <span className="offline-banner__dot" aria-hidden="true" />
      )}
      {phase === "offline" && "Offline — changes will sync automatically"}
      {phase === "syncing" && "Syncing…"}
      {phase === "success" && "Synced"}
    </div>
  );
}
