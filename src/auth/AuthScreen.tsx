import { useEffect, useState } from "react";
import type { FormEvent } from "react";
import { getCurrent, onOpenUrl } from "@tauri-apps/plugin-deep-link";
import { openUrl } from "@tauri-apps/plugin-opener";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/ui/Button";
import { Checkbox } from "../components/ui/Checkbox";
import { EyeIcon, EyeOffIcon } from "../components/ui/icons";
import { recordTermsAcceptance } from "../db/friends";
import { extractAuthCode, startGoogleSignIn } from "./googleAuth";
import "./AuthScreen.css";

const TERMS_URL = "https://darius104.github.io/consistency/terms.html";
const PRIVACY_URL = "https://darius104.github.io/consistency/privacy.html";

// Flip this once the Google Cloud Console OAuth client and Supabase's
// Google provider are actually configured (see googleAuth.ts) - until then
// the button would just be a broken dead end for anyone who clicks it.
const GOOGLE_SIGN_IN_ENABLED = false;

// The "Forgot password?" email links here - a small page on the app's own
// site (docs/reset-password.html) where the new password is set. A web
// page rather than a link back into the app, so it works the same from any
// device's mail app (the iPhone app has no custom link scheme registered).
// Must also be listed in Supabase > Auth > URL Configuration > Redirect URLs.
const RESET_PASSWORD_URL =
  "https://darius104.github.io/consistency/reset-password.html";

// "forgot" asks for the email; "reset" then takes the 6-digit code from
// that email plus the new password, all inside the app (a code can't be
// used up by a mail app pre-opening links the way a one-time link can).
type Mode = "signin" | "signup" | "forgot" | "reset";

/** Supabase's own error text is written for developers ("Invalid login
 *  credentials") - say it the way a person would. */
function friendlyError(err: unknown): string {
  const raw = err instanceof Error ? err.message : String(err);
  const msg = raw.toLowerCase();
  if (msg.includes("invalid login credentials"))
    return "Wrong email or password.";
  if (
    msg.includes("token has expired") ||
    msg.includes("otp") ||
    msg.includes("invalid or has expired")
  )
    return "That code is wrong or has expired - check the newest email, or send a new code.";
  if (msg.includes("should be different from the old password"))
    return "Pick a password different from your old one.";
  if (msg.includes("email not confirmed"))
    return "Confirm your email first - open the link we sent you, then sign in.";
  if (
    msg.includes("already registered") ||
    msg.includes("already been registered")
  )
    return "An account with this email already exists - sign in instead.";
  if (msg.includes("password should be at least"))
    return "Use at least 6 characters for your password.";
  if (msg.includes("unable to validate email") || msg.includes("invalid email"))
    return "That doesn't look like a valid email address.";
  if (msg.includes("rate limit") || msg.includes("too many"))
    return "Too many attempts - wait a minute and try again.";
  if (msg.includes("failed to fetch") || msg.includes("network"))
    return "Couldn't connect - check your internet and try again.";
  return raw || "Something went wrong - try again.";
}

function GoogleIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 18 18" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z"
      />
      <path
        fill="#34A853"
        d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.81.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.71H.96v2.33A9 9 0 0 0 9 18z"
      />
      <path
        fill="#FBBC05"
        d="M3.97 10.71A5.4 5.4 0 0 1 3.68 9c0-.6.1-1.18.29-1.71V4.96H.96A9 9 0 0 0 0 9c0 1.45.35 2.83.96 4.04l3.01-2.33z"
      />
      <path
        fill="#EA4335"
        d="M9 3.58c1.32 0 2.51.45 3.44 1.35l2.59-2.59C13.46.89 11.43 0 9 0A9 9 0 0 0 .96 4.96l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z"
      />
    </svg>
  );
}

export function AuthScreen() {
  const [mode, setMode] = useState<Mode>("signin");
  const [resetCode, setResetCode] = useState("");
  // A success message in place of the form's error line - "check your email"
  // after signing up (when confirmation is on) or asking for a reset link.
  const [notice, setNotice] = useState<string | null>(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [agreedToTerms, setAgreedToTerms] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  // Catches the redirect back from Google - whether the app was already
  // open (onOpenUrl fires live) or was launched fresh by it (getCurrent
  // covers the cold-start case). Exchanging the code sets a real Supabase
  // session, which useSession's own onAuthStateChange subscription (see
  // App.tsx) already picks up on its own - nothing else here needs to
  // touch session state directly.
  useEffect(() => {
    let cancelled = false;

    async function handleUrls(urls: string[]) {
      for (const url of urls) {
        const code = extractAuthCode(url);
        if (!code) continue;
        setGoogleBusy(true);
        try {
          const { error } = await supabase.auth.exchangeCodeForSession(code);
          if (error) throw error;
        } catch (err) {
          if (!cancelled) {
            setError(
              err instanceof Error ? err.message : "Google sign-in failed.",
            );
          }
        } finally {
          if (!cancelled) setGoogleBusy(false);
        }
      }
    }

    getCurrent()
      .then((urls) => {
        if (!cancelled && urls) void handleUrls(urls);
      })
      .catch(() => {});

    const unlisten = onOpenUrl((urls) => void handleUrls(urls));

    return () => {
      cancelled = true;
      // Same harmless Tauri unlisten throw as useTaskReminders' focus listener.
      unlisten.then((fn) => fn()).catch(() => {});
    };
  }, []);

  async function handleGoogleSignIn() {
    setError(null);
    setGoogleBusy(true);
    try {
      const url = await startGoogleSignIn();
      await openUrl(url);
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Couldn't start Google sign-in.",
      );
    } finally {
      setGoogleBusy(false);
    }
  }

  function switchMode(next: Mode) {
    if (next === mode) return;
    setMode(next);
    setError(null);
    setNotice(null);
    // Neither of these should carry over between modes - confirmPassword has
    // nothing to confirm outside signup, and re-showing "agreed" on a signup
    // attempt you didn't actually just make would be misleading.
    setConfirmPassword("");
    setAgreedToTerms(false);
  }

  async function sendResetCode() {
    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: RESET_PASSWORD_URL,
    });
    if (error) throw error;
    setPassword("");
    setConfirmPassword("");
    setResetCode("");
    setMode("reset");
    setNotice(
      `We emailed you at ${email.trim()}. Enter the code from it below with your new password - or, if the email only has a link, tap that instead.`,
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setNotice(null);

    if (mode === "forgot") {
      setBusy(true);
      try {
        await sendResetCode();
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "reset") {
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      setBusy(true);
      try {
        // The code signs you in (a one-time recovery session); the new
        // password is then set on that session - and you stay signed in.
        const { error: verifyError } = await supabase.auth.verifyOtp({
          email: email.trim(),
          token: resetCode.trim(),
          type: "recovery",
        });
        if (verifyError) throw verifyError;
        const { error: updateError } = await supabase.auth.updateUser({
          password,
        });
        if (updateError) throw updateError;
      } catch (err) {
        setError(friendlyError(err));
      } finally {
        setBusy(false);
      }
      return;
    }

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
      if (!agreedToTerms) {
        setError(
          "You need to agree to the Terms and Conditions to create an account.",
        );
        return;
      }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        if (data.session) {
          await recordTermsAcceptance();
        } else {
          // Email confirmation is on - no session until they tap the link,
          // so without this it looked like nothing happened.
          setNotice(
            `We sent a confirmation link to ${email}. Tap it, then sign in here.`,
          );
          setMode("signin");
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) throw error;
      }
    } catch (err) {
      setError(friendlyError(err));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <div className="auth-screen__glow" aria-hidden="true" />
      <form
        className={`auth-screen__form auth-screen__form--${mode}`}
        onSubmit={handleSubmit}
      >
        <img className="auth-screen__icon" src="/app-icon.png" alt="" />
        <h1 className="auth-screen__title">Consistency</h1>
        <p className="auth-screen__tagline">Small habits, every day.</p>

        {mode === "forgot" || mode === "reset" ? (
          <p className="auth-screen__subtitle">
            {mode === "forgot"
              ? "Enter your email and we'll send you a code to set a new password."
              : "Reset your password"}
          </p>
        ) : (
          <>
            <div className="auth-screen__tabs" role="tablist">
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signin"}
                className={`auth-screen__tab ${mode === "signin" ? "auth-screen__tab--active" : ""}`}
                onClick={() => switchMode("signin")}
              >
                Sign in
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={mode === "signup"}
                className={`auth-screen__tab ${mode === "signup" ? "auth-screen__tab--active" : ""}`}
                onClick={() => switchMode("signup")}
              >
                Create account
              </button>
            </div>

            <p className="auth-screen__subtitle">
              {mode === "signup"
                ? "Set up your account to get started"
                : "Welcome back"}
            </p>
          </>
        )}

        {GOOGLE_SIGN_IN_ENABLED && mode !== "forgot" && mode !== "reset" && (
          <>
            <button
              type="button"
              className="auth-screen__google"
              onClick={() => void handleGoogleSignIn()}
              disabled={googleBusy}
            >
              <GoogleIcon />
              Continue with Google
            </button>

            <div className="auth-screen__divider">
              <span>or</span>
            </div>
          </>
        )}

        {mode === "reset" && (
          <label className="auth-screen__field">
            <span className="auth-screen__label">Code from the email</span>
            <input
              className="auth-screen__input auth-screen__code"
              type="text"
              inputMode="numeric"
              autoComplete="one-time-code"
              name="code"
              value={resetCode}
              onChange={(e) =>
                setResetCode(e.target.value.replace(/\D/g, "").slice(0, 10))
              }
              placeholder="123456"
              required
              autoFocus
            />
          </label>
        )}

        {mode !== "reset" && (
          <label className="auth-screen__field">
            <span className="auth-screen__label">Email</span>
            <input
              className="auth-screen__input"
              type="email"
              name="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
              spellCheck={false}
              required
            />
          </label>
        )}
        {mode !== "forgot" && (
          <label className="auth-screen__field">
            <span className="auth-screen__label">
              {mode === "reset" ? "New password" : "Password"}
            </span>
            <div className="auth-screen__password-wrap">
              <input
                className="auth-screen__input"
                type={showPassword ? "text" : "password"}
                name="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={
                  mode === "signin" ? "current-password" : "new-password"
                }
                minLength={6}
                required
              />
              <button
                type="button"
                className="auth-screen__password-toggle"
                aria-label={showPassword ? "Hide password" : "Show password"}
                onClick={() => setShowPassword((v) => !v)}
              >
                {showPassword ? (
                  <EyeOffIcon size={15} />
                ) : (
                  <EyeIcon size={15} />
                )}
              </button>
            </div>
            {mode !== "signin" && (
              <span className="auth-screen__hint">At least 6 characters</span>
            )}
          </label>
        )}

        {mode === "signin" && (
          <button
            type="button"
            className="auth-screen__forgot"
            onClick={() => switchMode("forgot")}
          >
            Forgot password?
          </button>
        )}

        {(mode === "signup" || mode === "reset") && (
          <label className="auth-screen__field">
            <span className="auth-screen__label">
              {mode === "reset" ? "Confirm new password" : "Confirm password"}
            </span>
            <div className="auth-screen__password-wrap">
              <input
                className="auth-screen__input"
                type={showConfirmPassword ? "text" : "password"}
                name="confirm-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={6}
                required
              />
              <button
                type="button"
                className="auth-screen__password-toggle"
                aria-label={
                  showConfirmPassword ? "Hide password" : "Show password"
                }
                onClick={() => setShowConfirmPassword((v) => !v)}
              >
                {showConfirmPassword ? (
                  <EyeOffIcon size={15} />
                ) : (
                  <EyeIcon size={15} />
                )}
              </button>
            </div>
          </label>
        )}

        {mode === "signup" && (
          <div className="auth-screen__terms">
            <Checkbox
              checked={agreedToTerms}
              onChange={setAgreedToTerms}
              ariaLabel="I agree to the Terms and Conditions"
            />
            <span className="auth-screen__terms-text">
              I agree to the{" "}
              <button
                type="button"
                className="auth-screen__terms-link"
                onClick={() => void openUrl(TERMS_URL)}
              >
                Terms and Conditions
              </button>{" "}
              and{" "}
              <button
                type="button"
                className="auth-screen__terms-link"
                onClick={() => void openUrl(PRIVACY_URL)}
              >
                Privacy Policy
              </button>
            </span>
          </div>
        )}

        {error && (
          <div className="auth-screen__error" role="alert" aria-live="polite">
            {error}
          </div>
        )}
        {notice && (
          <div className="auth-screen__notice" role="status" aria-live="polite">
            {notice}
          </div>
        )}

        <Button
          type="submit"
          variant="primary"
          disabled={busy}
          className="auth-screen__submit"
        >
          {busy
            ? mode === "signup"
              ? "Creating account…"
              : mode === "forgot"
                ? "Sending…"
                : mode === "reset"
                  ? "Saving…"
                  : "Signing in…"
            : mode === "signup"
              ? "Create account"
              : mode === "forgot"
                ? "Send code"
                : mode === "reset"
                  ? "Set new password"
                  : "Sign in"}
        </Button>

        {mode === "reset" && (
          <button
            type="button"
            className="auth-screen__forgot"
            disabled={busy}
            onClick={() => {
              setError(null);
              setBusy(true);
              sendResetCode()
                .catch((err) => setError(friendlyError(err)))
                .finally(() => setBusy(false));
            }}
          >
            Didn't get it? Send a new code
          </button>
        )}
        {(mode === "forgot" || mode === "reset") && (
          <button
            type="button"
            className="auth-screen__forgot"
            onClick={() => switchMode("signin")}
          >
            ‹ Back to sign in
          </button>
        )}
      </form>
    </div>
  );
}
