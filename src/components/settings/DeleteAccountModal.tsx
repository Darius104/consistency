import { useState } from "react";
import { deleteMyAccount } from "../../db/friends";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./DeleteAccountModal.css";

const CONFIRM_PHRASE = "DELETE";

interface DeleteAccountModalProps {
  onClose: () => void;
  /** Called once delete_my_account() has already succeeded server-side -
   *  the parent's job from here is just clearing the now-invalid local
   *  session/cache, same as a normal sign-out. */
  onDeleted: () => void;
}

// A plain ConfirmModal felt too easy to click through by accident for
// something this irreversible (every task, tag, friend connection, note,
// and ticket - not just one row) - typing the phrase out is the same
// friction GitHub's own repo-deletion confirmation uses for exactly this
// reason.
export function DeleteAccountModal({ onClose, onDeleted }: DeleteAccountModalProps) {
  const [confirmText, setConfirmText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleDelete() {
    setBusy(true);
    setError(null);
    try {
      await deleteMyAccount();
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't delete your account.");
      setBusy(false);
    }
  }

  return (
    <Modal title="Delete your account" onClose={onClose}>
      <div className="delete-account">
        <p className="delete-account__warning">
          This permanently deletes your account and everything tied to it - tasks, templates,
          streaks, friend connections, notes, and support tickets. This can't be undone.
        </p>
        <label className="delete-account__field">
          <span className="delete-account__label">
            Type <strong>{CONFIRM_PHRASE}</strong> to confirm
          </span>
          <input
            className="delete-account__input"
            value={confirmText}
            onChange={(e) => setConfirmText(e.target.value)}
            autoComplete="off"
            autoCorrect="off"
            autoCapitalize="off"
          />
        </label>

        {error && <span className="settings__hint settings__hint--warning">{error}</span>}

        <div className="delete-account__actions">
          <Button onClick={onClose} disabled={busy}>
            Cancel
          </Button>
          <Button
            variant="danger"
            onClick={() => void handleDelete()}
            disabled={busy || confirmText !== CONFIRM_PHRASE}
          >
            {busy ? "Deleting…" : "Delete my account"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
