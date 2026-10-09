import type { PointerEvent, SyntheticEvent } from "react";
import type { DayNote } from "../../types";
import { noteToHtml, toggleChecklistItem } from "../../utils/richNote";
import { NoteIcon, TrashIcon } from "../ui/icons";
import "./NoteRow.css";
import "./NoteRich.css";

interface NoteRowProps {
  note: DayNote;
  dragging: boolean;
  /** Long-press (touch) / drag (mouse) to move it - same as tasks and
   *  groups (useReorderDrag's bindLongPress). */
  onDragPointerDown: (e: PointerEvent) => void;
  suppressClick: (e: SyntheticEvent) => boolean;
  onEdit: () => void;
  onDelete: () => void;
  /** Ticking a checklist line right on the card saves the note. */
  onChangeContent: (content: string) => void;
}

// A note is just context for the day - no checkbox, nothing to tick. A card
// like the task groups (so it sits naturally among them), with a small
// note icon to tell it apart. Tap to edit; long-press to move. Deleting is
// in the edit sheet (and a hover trash on desktop).
export function NoteRow({
  note,
  dragging,
  onDragPointerDown,
  suppressClick,
  onEdit,
  onDelete,
  onChangeContent,
}: NoteRowProps) {
  return (
    <div
      className={`note-row ${dragging ? "note-row--dragging" : ""}`}
      role="button"
      tabIndex={0}
      onPointerDown={onDragPointerDown}
      onClick={(e) => {
        if (suppressClick(e)) return;
        // A checklist line's box ticks it, right here on the card -
        // anywhere else opens the note for editing.
        const li = (e.target as HTMLElement).closest("ul[data-checklist] > li");
        if (li && e.clientX - li.getBoundingClientRect().left <= 26) {
          const items = Array.from(e.currentTarget.querySelectorAll("ul[data-checklist] > li"));
          onChangeContent(toggleChecklistItem(note.content, items.indexOf(li)));
          return;
        }
        onEdit();
      }}
      onKeyDown={(e) => {
        if (e.target !== e.currentTarget) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onEdit();
        }
      }}
    >
      <span className="note-row__icon" aria-hidden="true">
        <NoteIcon size={14} />
      </span>
      {/* noteToHtml only ever returns cleaned-up markup (see richNote.ts). */}
      <div className="note-row__text note-rich" dangerouslySetInnerHTML={{ __html: noteToHtml(note.content) }} />
      <button
        type="button"
        className="note-row__delete"
        aria-label="Delete note"
        onClick={(e) => {
          e.stopPropagation();
          onDelete();
        }}
      >
        <TrashIcon size={14} />
      </button>
    </div>
  );
}
