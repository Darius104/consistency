import { useCallback, useEffect, useState } from "react";
import { relaunch } from "@tauri-apps/plugin-process";
import { check, type Update } from "@tauri-apps/plugin-updater";

export interface AppUpdaterState {
  update: Update | null;
  checking: boolean;
  installing: boolean;
  error: string | null;
  checkNow: () => Promise<void>;
  installAndRestart: () => Promise<void>;
}

/**
 * Desktop-only (see lib.rs - the updater/process plugins aren't even
 * compiled in for iOS, since self-updating outside the App Store/TestFlight
 * isn't possible there anyway). On iOS `check()` simply rejects because the
 * plugin was never registered - caught here exactly the same "probe the
 * capability, treat a throw as unsupported" way useTaskReminders.ts already
 * does for pending(), so this never needs a separate platform-detection
 * dependency. The `error` field is only meaningful as feedback for an
 * explicit, user-initiated checkNow() call (e.g. a "Check for updates"
 * button) - callers should not surface it for the automatic on-launch
 * check, since a plain "unsupported here" (iOS) would otherwise look like a
 * real failure to a user who never asked for anything.
 */
export function useAppUpdater(): AppUpdaterState {
  const [update, setUpdate] = useState<Update | null>(null);
  const [checking, setChecking] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const checkNow = useCallback(async () => {
    setChecking(true);
    setError(null);
    try {
      setUpdate(await check());
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setChecking(false);
    }
  }, []);

  useEffect(() => {
    void checkNow();
  }, [checkNow]);

  const installAndRestart = useCallback(async () => {
    if (!update) return;
    setInstalling(true);
    setError(null);
    try {
      await update.downloadAndInstall();
      await relaunch();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      setInstalling(false);
    }
  }, [update]);

  return { update, checking, installing, error, checkNow, installAndRestart };
}
