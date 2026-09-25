import type { FriendNote } from "../../db/friendNotes";
import { formatRelativeTime } from "../../utils/relativeTime";
import { AvatarBadge } from "../stats/AvatarBadge";
import { XIcon } from "../ui/icons";
import "./FriendNoteWidget.css";

interface FriendNoteWidgetProps {
  note: FriendNote;
  onDismiss: (id: string) => void;
}

// A temporary widget, not an inbox row - there's nothing to "read" here
// beyond what's already on screen, so the only action is dismiss, and
// dismissing deletes the note for good (see useFriendNotes/deleteFriendNote).
export function FriendNoteWidget({ note, onDismiss }: FriendNoteWidgetProps) {
  return (
    <div className="friend-note-widget">
      <AvatarBadge avatarId={note.senderAvatarId} size={28} />
      <div className="friend-note-widget__body">
        <span className="friend-note-widget__header">
          <span className="friend-note-widget__sender">{note.senderName}</span>
          <span className="friend-note-widget__time">{formatRelativeTime(note.createdAt)}</span>
        </span>
        <p className="friend-note-widget__text">{note.body}</p>
      </div>
      <button
        type="button"
        className="friend-note-widget__dismiss"
        aria-label="Dismiss this note"
        onClick={() => onDismiss(note.id)}
      >
        <XIcon size={13} />
      </button>
    </div>
  );
}
