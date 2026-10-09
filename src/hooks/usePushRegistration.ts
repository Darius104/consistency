import { useEffect, useState } from "react";
import { supabase } from "../lib/supabaseClient";
import { isIOS } from "../utils/platform";

const TOKEN_KEY = "consistency:pushToken";

/** The APNs token this device registered with, if any (for sign-out). */
function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

/**
 * iPhone: registers this device for server-sent reminders - asks
 * permission, gets its APNs token and saves it (with the device's time
 * zone) to `push_devices`, where supabase/functions/send-reminders picks it
 * up. Once registered, reminders come from the server, which checks at send
 * time whether the task is already done on ANY device - so ticking it on
 * the Mac means no reminder on the phone. Returns whether this device is
 * registered (useTaskReminders then stops scheduling local ones here, so
 * nothing arrives twice).
 *
 * Desktop: does nothing - the Mac keeps its own local reminders.
 */
export function usePushRegistration(userId: string | null, enabled: boolean): boolean {
  const [registered, setRegistered] = useState(false);

  useEffect(() => {
    if (!userId || !enabled || !isIOS()) {
      setRegistered(false);
      return;
    }
    let cancelled = false;
    (async () => {
      try {
        const push = await import("tauri-plugin-mobile-push-api");
        const { granted } = await push.requestPermission();
        if (!granted || cancelled) return;
        const token = await push.getToken();
        if (!token || cancelled) return;
        const { error } = await supabase.from("push_devices").upsert(
          {
            token,
            user_id: userId,
            platform: "ios",
            // Dev builds talk to Apple's sandbox, TestFlight/App Store to
            // production - the server needs to know which.
            environment: import.meta.env.DEV ? "sandbox" : "production",
            timezone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
            updated_at: new Date().toISOString(),
          },
          { onConflict: "token" },
        );
        if (error) throw error;
        try {
          localStorage.setItem(TOKEN_KEY, token);
        } catch {
          // Only used to clean up on sign-out.
        }
        if (!cancelled) setRegistered(true);
      } catch (err) {
        // No push (offline, plugin unavailable, permission refused) - the
        // phone simply keeps its local reminders.
        console.warn("[push] registration failed", err);
        if (!cancelled) setRegistered(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [userId, enabled]);

  return registered;
}

/** Signing out: stop pushes to this device for that account. */
export async function unregisterPushDevice(): Promise<void> {
  const token = storedToken();
  if (!token) return;
  try {
    await supabase.from("push_devices").delete().eq("token", token);
    localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Best effort - Apple reports the token dead later anyway.
  }
}
