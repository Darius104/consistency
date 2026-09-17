import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "../lib/supabaseClient";

// supabase-js persists the session under exactly this key (derived from the
// project URL) via localStorage by default - reading it back out directly,
// synchronously, is what lets the app open straight into cached local data
// immediately instead of waiting on a network call first. See this hook's
// own doc comment for why that wait can't be trusted to be short.
function cachedSessionKey(): string {
  const ref = new URL(import.meta.env.VITE_SUPABASE_URL).hostname.split(".")[0];
  return `sb-${ref}-auth-token`;
}

function readCachedSession(): Session | null {
  try {
    const raw = localStorage.getItem(cachedSessionKey());
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

/**
 * Tracks the current Supabase auth session - starting from whatever's
 * already cached in localStorage (if anything), not `null`.
 *
 * This app is offline-first, and `supabase.auth.getSession()` isn't actually
 * the instant, purely-local read it looks like: if the cached access token
 * is close to expiry, it tries a real network token refresh first, retrying
 * with backoff for ~25-30s before giving up when there's no connectivity at
 * all (e.g. on a flight) - and until recently, a failure there had no
 * `.catch()` at all, so it left this hook's `loading` flag stuck `true`
 * forever, permanently blocking the whole app behind a loading screen no
 * matter how much valid local data was already sitting in the SQLite cache.
 *
 * Starting from the cached session directly sidesteps that: the app is
 * usable immediately, while `getSession()`/`onAuthStateChange` still run in
 * the background and update `session` the moment they actually resolve -
 * to a freshly refreshed session when online, or left alone (not signed
 * out) if that check merely fails to reach the network. Only an explicit,
 * successful "no, this session is really invalid" from the server clears
 * it.
 */
export function useSession() {
  const [session, setSession] = useState<Session | null>(() => readCachedSession());

  useEffect(() => {
    let cancelled = false;

    supabase.auth
      .getSession()
      .then(({ data }) => {
        if (!cancelled) setSession(data.session);
      })
      .catch(() => {
        // Offline, or the refresh genuinely failed - keep whatever
        // optimistic session this started with rather than signing the
        // user out just because the network couldn't be reached.
      });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      if (!cancelled) setSession(next);
    });

    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, []);

  return { session };
}
