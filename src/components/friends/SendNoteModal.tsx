import { useState } from "react";
import { sendFriendNote } from "../../db/friendNotes";
import { Button } from "../ui/Button";
import { CheckIcon } from "../ui/icons";
import { Modal } from "../ui/Modal";
import "./SendNoteModal.css";

const MAX_NOTE_LENGTH = 200;

interface SendNoteModalProps {
  recipientId: string;
  recipientName: string;
  onClose: () => void;
}

export function SendNoteModal({ recipientId, recipientName, onClose }: SendNoteModalProps) {
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  async function handleSend() {
    const trimmed = body.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      await sendFriendNote(recipientId, trimmed);
      setSent(true);
      window.setTimeout(onClose, 900);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Couldn't send that.");
    } finally {
      setSending(false);
    }
  }

  return (
    <Modal title={`Send a note to ${recipientName}`} onClose={onClose}>
      <div className="send-note">
        {sent ? (
          <div className="send-note__sent">
            <span className="send-note__sent-icon">
              <CheckIcon size={20} />
            </span>
            <p className="send-note__sent-text">Sent to {recipientName}.</p>
          </div>
        ) : (
          <>
            <textarea
              className="send-note__input"
              placeholder="A short note - keep it quick…"
              value={body}
              onChange={(e) => setBody(e.target.value.slice(0, MAX_NOTE_LENGTH))}
              rows={3}
              autoFocus
            />
            <div className="send-note__footer">
              <span className="send-note__count">
                {body.length}/{MAX_NOTE_LENGTH}
              </span>
              {error && <span className="send-note__error">{error}</span>}
              <Button
                variant="primary"
                onClick={() => void handleSend()}
                disabled={sending || !body.trim()}
              >
                {sending ? "Sending…" : "Send"}
              </Button>
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
