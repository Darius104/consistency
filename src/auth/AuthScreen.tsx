import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/ui/Button";
import "./AuthScreen.css";

interface AuthScreenProps {
  /** Fires only on a brand-new account, never on a plain sign-in - drives
      the one-time "import my existing data" prompt in App.tsx. */
  onSignedUp: () => void;
}

export function AuthScreen({ onSignedUp }: AuthScreenProps) {
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        onSignedUp();
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-screen">
      <form className="auth-screen__form" onSubmit={handleSubmit}>
        <h1 className="auth-screen__title">Consistency</h1>
        <label className="auth-screen__field">
          <span className="auth-screen__label">Email</span>
          <input
            className="auth-screen__input"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="email"
            required
          />
        </label>
        <label className="auth-screen__field">
          <span className="auth-screen__label">Password</span>
          <input
            className="auth-screen__input"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete={mode === "signup" ? "new-password" : "current-password"}
            minLength={6}
            required
          />
        </label>

        {error && <div className="auth-screen__error">{error}</div>}

        <Button type="submit" variant="primary" disabled={busy} className="auth-screen__submit">
          {busy ? "…" : mode === "signup" ? "Create account" : "Sign in"}
        </Button>

        <button
          type="button"
          className="auth-screen__toggle"
          onClick={() => {
            setMode((m) => (m === "signup" ? "signin" : "signup"));
            setError(null);
          }}
        >
          {mode === "signup" ? "Already have an account? Sign in" : "New here? Create an account"}
        </button>
      </form>
    </div>
  );
}
