import { useCallback, useEffect, useRef, useState } from "react";
import { trySync } from "../sync";

// The periodic timer only actively re-checks while we believe we're
// offline - navigator.onLine can report true on a dead connection, but
// there's no point re-pulling the whole dataset every 30s once we're
// already known to be online and idle.
const RETRY_INTERVAL_MS = 30_000;

// Right after waking from a long idle period (phone locked for hours, app
// not opened), the very first sync attempt can genuinely fail even on a
// real connection - e.g. the OS network interface hasn't finished
// reassociating yet, or the cached auth token needs a refresh that itself
// needs a moment. That's a transient hiccup, not "offline", so a single
// failure shouldn't flip the banner - only fully exhausting these quick
// retries (a few seconds total) does.
const QUICK_RETRY_COUNT = 2;
const QUICK_RETRY_DELAY_MS = 1500;

// `ready` should reflect whether a Supabase session is actually established -
// starting the sync loop before then means the very first request goes out
// unauthenticated, fails, and gets misread as "offline" even though the
// device is online; it just isn't signed in yet.
export function useOnlineStatus(ready: boolean) {
  const [online, setOnline] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const onlineRef = useRef(online);
  onlineRef.current = online;
  // Guards the state updates below against firing after this hook's own
  // consumer has unmounted - attempt() is now also exposed directly (as
  // syncNow, for a manual pull-to-refresh/"sync now" button), so it can be
  // in flight independently of the effect that originally started it.
  const mountedRef = useRef(true);
  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
    };
  }, []);

  const attempt = useCallback(async () => {
    setSyncing(true);
    let ok = await trySync();
    for (let i = 0; i < QUICK_RETRY_COUNT && !ok && mountedRef.current; i++) {
      await new Promise((resolve) => window.setTimeout(resolve, QUICK_RETRY_DELAY_MS));
      ok = await trySync();
    }
    if (mountedRef.current) {
      setOnline(ok);
      setSyncing(false);
    }
    return ok;
  }, []);

  useEffect(() => {
    if (!ready) return;

    function handleOnline() {
      void attempt();
    }
    function handleOffline() {
      setOnline(false);
    }
    // Returning to a backgrounded app otherwise has to wait for the online
    // event (unreliable in a WKWebView) or the next RETRY_INTERVAL_MS tick -
    // and that tick only even runs while already believed offline, so data
    // could sit stale for a while after resuming. A fresh sync attempt the
    // moment the app becomes visible again closes that gap - regardless of
    // whatever `online` currently reads, since that belief itself may be
    // stale after however long the app was backgrounded.
    function handleVisibilityChange() {
      if (document.visibilityState === "visible") void attempt();
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    document.addEventListener("visibilitychange", handleVisibilityChange);

    void attempt();
    const timer = window.setInterval(() => {
      if (!onlineRef.current) void attempt();
    }, RETRY_INTERVAL_MS);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
      window.clearInterval(timer);
    };
  }, [ready, attempt]);

  // Exposed for a manual "sync now" trigger (desktop header button, mobile
  // pull-to-refresh) - the exact same push-then-pull attempt the automatic
  // triggers already use, so a manual sync updates `syncing`/`online`
  // consistently with everything else instead of needing its own parallel
  // state.
  return { online, syncing, syncNow: attempt };
}
