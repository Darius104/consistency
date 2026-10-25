import { useEffect, useState } from "react";
import { getVersion } from "@tauri-apps/api/app";
import { useAppUpdater } from "../../hooks/useAppUpdater";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { CheckIcon, RefreshIcon } from "../ui/icons";
import { UpdateAvailableModal } from "../UpdateAvailableModal";
import "../UpdateAvailableModal.css";

/**
 * Desktop-only in practice (see useAppUpdater's own doc comment) - this
 * still renders everywhere since Settings has no other platform-specific
 * sections to model a split on, but on iOS a tap here just always reports
 * "up to date" rather than a scary error, since `error` is only shown after
 * this component's own explicit check (never for whatever its automatic
 * on-mount check silently found) - see `justChecked` below.
 *
 * Self-sufficient rather than sharing App.tsx's own useAppUpdater instance
 * - finding an update here opens the same "Update available" window App.tsx
 * shows on launch (which a user may have already dismissed with "Not now").
 */
export function AppUpdateSection() {
  const { update, checking, installing, error, checkNow, installAndRestart } = useAppUpdater();
  const [justChecked, setJustChecked] = useState(false);
  const [showUpToDate, setShowUpToDate] = useState(false);
  const [showUpdate, setShowUpdate] = useState(false);
  const [version, setVersion] = useState<string | null>(null);
  // Set while a check you asked for is running - the result is decided
  // once it's finished (below), when `update`/`error` are the new ones.
  const [awaitingCheck, setAwaitingCheck] = useState(false);

  useEffect(() => {
    getVersion()
      .then(setVersion)
      .catch(() => {});
  }, []);

  async function handleCheck() {
    setAwaitingCheck(true);
    await checkNow();
    setJustChecked(true);
  }

  useEffect(() => {
    if (!awaitingCheck || checking) return;
    setAwaitingCheck(false);
    if (update) setShowUpdate(true);
    else if (!error) setShowUpToDate(true);
  }, [awaitingCheck, checking, update, error]);

  const idleStatus = justChecked
    ? error
      ? `Couldn't check: ${error}`
      : "You're up to date."
    : version
      ? `You're on version ${version}.`
      : "Look for a newer version of the app.";

  return (
    <div className="settings-group-wrap">
      <span className="settings-group__title">Updates</span>
      <div className="settings-group">
        <div className="settings-group__row">
          <span className="settings-group__label settings-group__label--stack">
            {update ? `Version ${update.version} is ready` : "Check for updates"}
            <small>{update ? "Installs and restarts the app." : idleStatus}</small>
          </span>
          {update ? (
            <Button variant="primary" onClick={() => setShowUpdate(true)} disabled={installing}>
              {installing ? "Downloading…" : "See what's new"}
            </Button>
          ) : (
            <button
              type="button"
              className="settings-row-action"
              onClick={() => void handleCheck()}
              disabled={checking}
            >
              {checking ? "Checking…" : "Check"}
            </button>
          )}
        </div>
      </div>

      {showUpdate && update && (
        <UpdateAvailableModal
          update={update}
          installing={installing}
          error={error}
          onInstall={() => void installAndRestart()}
          onLater={() => setShowUpdate(false)}
        />
      )}

      {showUpToDate && (
        <Modal
          title="Check for updates"
          onClose={() => setShowUpToDate(false)}
          icon={<RefreshIcon size={15} />}
          accent="#3b82f6"
        >
          <div className="update-modal update-modal--current">
            <span className="update-modal__done" aria-hidden="true">
              <CheckIcon size={28} />
            </span>
            <span className="update-modal__current-text">
              <span className="update-modal__title">You're up to date</span>
              <span className="update-modal__sub">
                {version
                  ? `Consistency ${version} is the latest version.`
                  : "This is the latest version of Consistency."}
              </span>
            </span>
            <button type="button" className="update-modal__ok" onClick={() => setShowUpToDate(false)}>
              OK
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}
