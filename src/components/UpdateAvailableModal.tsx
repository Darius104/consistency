import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import { RefreshIcon } from "./ui/icons";
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
        <div className="update-modal__header">
          <span className="update-modal__icon">
            <RefreshIcon size={20} />
          </span>
          <p className="update-modal__message">
            A new version of Consistency is ready - <strong>{update.version}</strong>
            <span className="update-modal__from"> (you're on {update.currentVersion})</span>
          </p>
        </div>
        {notes.length > 0 && (
          <ul className="update-modal__notes">
            {notes.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
        )}
        {error && <div className="update-modal__error">{error}</div>}
        <div className="update-modal__actions">
          <Button onClick={onLater} disabled={installing}>
            Not now
          </Button>
          <Button variant="primary" onClick={onInstall} disabled={installing}>
            {installing ? "Downloading…" : "Update & Restart"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
