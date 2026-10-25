import type { Update } from "@tauri-apps/plugin-updater";
import { Modal } from "./ui/Modal";
import { CheckIcon, RefreshIcon } from "./ui/icons";
import "./UpdateAvailableModal.css";

interface UpdateAvailableModalProps {
  update: Update;
  installing: boolean;
  error: string | null;
  onInstall: () => void;
  onLater: () => void;
}

// Updates are blue - the same "something new to add" blue as tasks.
const UPDATE_COLOR = "#3b82f6";

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

/** "A new version is ready": the version on a blue banner, what's new as a
 *  short list, and Update & Restart. Opened on launch when an update is
 *  found, and from Settings > Account > Check. */
export function UpdateAvailableModal({
  update,
  installing,
  error,
  onInstall,
  onLater,
}: UpdateAvailableModalProps) {
  const notes = update.body ? parseNotes(update.body) : [];

  return (
    <Modal
      title="Update available"
      onClose={onLater}
      icon={<RefreshIcon size={15} />}
      accent={UPDATE_COLOR}
    >
      <div className="update-modal">
        <div className="update-modal__banner">
          <span className="update-modal__icon" aria-hidden="true">
            <RefreshIcon size={24} />
          </span>
          <span className="update-modal__banner-text">
            <span className="update-modal__title">Version {update.version}</span>
            <span className="update-modal__sub">You have {update.currentVersion}</span>
          </span>
          <span className="update-modal__new">New</span>
        </div>

        {notes.length > 0 && (
          <div className="update-modal__notes-section">
            <span className="update-modal__label">What's new</span>
            <ul className="update-modal__notes">
              {notes.map((line, i) => (
                <li key={i}>
                  <span className="update-modal__note-check" aria-hidden="true">
                    <CheckIcon size={11} />
                  </span>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        )}

        {error && <div className="update-modal__error">{error}</div>}

        {installing && (
          <div className="update-modal__progress-wrap">
            <div className="update-modal__progress" role="progressbar" aria-label="Downloading update">
              <span className="update-modal__progress-fill" />
            </div>
            <span className="update-modal__progress-text">
              Downloading - the app restarts by itself when it's done.
            </span>
          </div>
        )}

        <div className="update-modal__actions">
          <button
            type="button"
            className="update-modal__later"
            onClick={onLater}
            disabled={installing}
          >
            Not now
          </button>
          <button
            type="button"
            className="update-modal__install"
            onClick={onInstall}
            disabled={installing}
          >
            {installing ? "Downloading…" : "Update & Restart"}
          </button>
        </div>
      </div>
    </Modal>
  );
}
