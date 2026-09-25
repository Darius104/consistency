import { supabase } from "../lib/supabaseClient";

// A custom URL scheme, not a normal https:// redirect - Supabase's own
// /auth/v1/callback finishes the Google exchange server-side, then bounces
// the system browser here, which the OS hands back to this app (see
// tauri.conf.json's plugins.deep-link.schemes and the deep-link capability).
// Must also be added to Supabase Dashboard > Authentication > URL
// Configuration > Redirect URLs, or Supabase will refuse to redirect here.
export const GOOGLE_REDIRECT_URL = "consistency://auth-callback";

/** Starts the OAuth handshake and returns Google's own consent-screen URL -
 *  skipBrowserRedirect keeps Supabase from trying to navigate this app's
 *  own webview there, since the user needs their real system browser
 *  (saved Google session, passkeys, etc.), not an embedded one. */
export async function startGoogleSignIn(): Promise<string> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: GOOGLE_REDIRECT_URL, skipBrowserRedirect: true },
  });
  if (error) throw error;
  if (!data.url) throw new Error("Couldn't start Google sign-in.");
  return data.url;
}

/** Pulls the PKCE `code` param out of an incoming consistency:// URL, or
 *  null if this isn't one of ours (deep-link URLs can come from anywhere -
 *  see onOpenUrl's usage in AuthScreen). */
export function extractAuthCode(url: string): string | null {
  if (!url.startsWith(GOOGLE_REDIRECT_URL)) return null;
  try {
    return new URL(url).searchParams.get("code");
  } catch {
    return null;
  }
}
