import { useState } from "react";
import { useAppUpdater } from "../../hooks/useAppUpdater";
import { Button } from "../ui/Button";

/**
 * Desktop-only in practice (see useAppUpdater's own doc comment) - this
 * still renders everywhere since Settings has no other platform-specific
 * sections to model a split on, but on iOS a tap here just always reports
 * "up to date" rather than a scary error, since `error` is only shown after
 * this component's own explicit check (never for whatever its automatic
 * on-mount check silently found) - see `justChecked` below.
 *
 * Self-sufficient rather than sharing App.tsx's own useAppUpdater instance
 * - finding an update here offers its own "Update & Restart" right in this
 * row, independent of the auto-check-on-launch modal App.tsx shows (which
 * a user may have already dismissed with "Later").
 */
export function AppUpdateSection() {
  const { update, checking, installing, error, checkNow, installAndRestart } = useAppUpdater();
  const [justChecked, setJustChecked] = useState(false);

  async function handleCheck() {
    await checkNow();
    setJustChecked(true);
  }

  const idleStatus = justChecked
    ? error
      ? `Couldn't check for updates: ${error}`
      : "You're up to date."
    : "Check for a newer version of the app.";

  return (
    <div className="settings__section">
      <span className="settings__label">Updates</span>
      <div className="settings__row">
        <span className="settings__row-text">
          {update ? `Version ${update.version} is available.` : idleStatus}
        </span>
        {update ? (
          <Button variant="primary" onClick={() => void installAndRestart()} disabled={installing}>
            {installing ? "Downloading…" : "Update & Restart"}
          </Button>
        ) : (
          <Button onClick={handleCheck} disabled={checking}>
            {checking ? "Checking…" : "Check for Updates"}
          </Button>
        )}
      </div>
      {update && error && <span className="settings__hint settings__hint--warning">{error}</span>}
    </div>
  );
}
