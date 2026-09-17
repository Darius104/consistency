import { useState } from "react";
import type { DayNote } from "../../types";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import "./NoteForm.css";

interface NoteFormProps {
  note?: DayNote;
  onSave: (content: string) => void;
  onClose: () => void;
}

export function NoteForm({ note, onSave, onClose }: NoteFormProps) {
  const [content, setContent] = useState(note?.content ?? "");

  function handleSave() {
    const trimmed = content.trim();
    if (!trimmed) return;
    onSave(trimmed);
  }

  return (
    <Modal title={note ? "Edit note" : "New note"} onClose={onClose}>
      <div className="note-form">
        <textarea
          className="note-form__textarea"
          placeholder="Write a quick note for today…"
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) {
              e.preventDefault();
              handleSave();
            }
            if (e.key === "Escape") onClose();
          }}
          autoFocus
          rows={5}
        />
        <div className="note-form__actions">
          <Button onClick={onClose}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!content.trim()}>
            {note ? "Save" : "Add"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
