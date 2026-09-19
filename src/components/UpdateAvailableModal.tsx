import type { Update } from "@tauri-apps/plugin-updater";
import { Button } from "./ui/Button";
import { Modal } from "./ui/Modal";
import "./UpdateAvailableModal.css";

interface UpdateAvailableModalProps {
  update: Update;
  installing: boolean;
  error: string | null;
  onInstall: () => void;
  onLater: () => void;
}

export function UpdateAvailableModal({
  update,
  installing,
  error,
  onInstall,
  onLater,
}: UpdateAvailableModalProps) {
  return (
    <Modal title="Update available" onClose={onLater}>
      <div className="update-modal">
        <p className="update-modal__message">
          Version {update.version} is ready - you're on {update.currentVersion}.
        </p>
        {update.body && <p className="update-modal__notes">{update.body}</p>}
        {error && <div className="update-modal__error">{error}</div>}
        <div className="update-modal__actions">
          <Button onClick={onLater} disabled={installing}>
            Later
          </Button>
          <Button variant="primary" onClick={onInstall} disabled={installing}>
            {installing ? "Downloading…" : "Update & Restart"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
