import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { CheckIcon, ChevronRightIcon, RefreshIcon } from "./ui/icons";
import "./UpdateAvailableModal.css";

interface UpdateAvailableModalProps {
  update: Update;
  installing: boolean;
  error: string | null;
  onInstall: () => void;
  onLater: () => void;
}

// Release notes are written as short "- " bullet lines (see RELEASING.md) -
// this turns them into an actual list instead of dumping them as one big
// paragraph, which is what made the old modal feel like a changelog dump
// rather than a quick, friendly heads-up.
function parseNotes(body: string): string[] {
  return body
    .split("\n")
    .map((line) => line.replace(/^[-*]\s*/, "").trim())
    .filter(Boolean);
}

export function UpdateAvailableModal({
  update,
  installing,
  error,
  onInstall,
  onLater,
}: UpdateAvailableModalProps) {
  const notes = update.body ? parseNotes(update.body) : [];

  return (
    <Modal title="Update available" onClose={onLater}>
      <div className="update-modal">
        <div className="update-modal__hero">
          <span className="update-modal__icon">
            <RefreshIcon size={22} />
          </span>
          <h3 className="update-modal__title">A new version is ready</h3>
          <div className="update-modal__version-chip">
            <span className="update-modal__version-from">{update.currentVersion}</span>
            <ChevronRightIcon size={12} className="update-modal__version-arrow" />
            <span className="update-modal__version-to">{update.version}</span>
          </div>
        </div>

        {notes.length > 0 && (
          <div className="update-modal__notes-section">
            <span className="settings__label">What's new</span>
            <ul className="update-modal__notes">
              {notes.map((line, i) => (
                <li key={i}>
                  <span className="update-modal__note-check">
                    <CheckIcon size={10} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <div className="update-modal__error">{error}</div>}

        <div className="update-modal__actions">
          <Button onClick={onLater} disabled={installing} className="update-modal__later">
            Not now
          </Button>
          <Button
            variant="primary"
            onClick={onInstall}
            disabled={installing}
            className="update-modal__install"
          >
            {installing ? "Downloading…" : "Update & Restart"}
          </Button>
        </div>
        {installing && (
          <div className="update-modal__progress" role="progressbar" aria-label="Downloading update">
            <span className="update-modal__progress-fill" />
          </div>
        )}
      </div>
    </Modal>
  );
}
