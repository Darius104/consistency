import type { PointerEvent } from "react";
import type { DayNote } from "../../types";
import { EditIcon, GripIcon, NoteIcon, TrashIcon } from "../ui/icons";
import "./NoteRow.css";

interface NoteRowProps {
  note: DayNote;
  dragging: boolean;
  onHandlePointerDown: (e: PointerEvent) => void;
  onEdit: () => void;
  onDelete: () => void;
}

// A note is purely informational - no checkbox, nothing that could be
// mistaken for a task with a completion state - but it reorders the same
// way tasks/groups do, via a dedicated grab handle (see useReorderDrag's
// bindHandlePointerDown) rather than grab-anywhere, so the rest of the row
// keeps ordinary native scrolling.
export function NoteRow({ note, dragging, onHandlePointerDown, onEdit, onDelete }: NoteRowProps) {
  return (
    <div className={`note-row ${dragging ? "note-row--dragging" : ""}`}>
      <span className="note-row__handle" onPointerDown={onHandlePointerDown} aria-hidden="true">
        <GripIcon size={13} />
      </span>
      <NoteIcon size={14} className="note-row__icon" />
      <span className="note-row__text">{note.content}</span>
      <div className="note-row__actions">
        <button
          type="button"
          className="note-row__icon-btn"
          aria-label="Edit note"
          onClick={onEdit}
        >
          <EditIcon size={13} />
        </button>
        <button
          type="button"
          className="note-row__icon-btn note-row__icon-btn--danger"
          aria-label="Delete note"
          onClick={onDelete}
        >
          <TrashIcon size={13} />
        </button>
      </div>
    </div>
  );
}
