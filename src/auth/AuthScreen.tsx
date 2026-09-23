import { useState } from "react";
import type { FormEvent } from "react";
import { supabase } from "../lib/supabaseClient";
import { Button } from "../components/ui/Button";
import "./AuthScreen.css";

export function AuthScreen() {
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
      <div className="auth-screen__glow" aria-hidden="true" />
      <form className="auth-screen__form" onSubmit={handleSubmit}>
        <img className="auth-screen__icon" src="/app-icon.png" alt="" />
        <h1 className="auth-screen__title">Consistency</h1>
        <p className="auth-screen__subtitle">
          {mode === "signup" ? "Create an account to get started" : "Welcome back"}
        </p>
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
