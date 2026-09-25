import { useCallback, useEffect, useState } from "react";
import { deleteFriendNote, listReceivedFriendNotes, type FriendNote } from "../db/friendNotes";

// Polled in the background (same pattern as useSupportBadgeCount) so a note
// that arrives while the app is already open shows up without needing a
// refresh - there's no separate badge/count surface anymore, this list IS
// the notification.
const POLL_MS = 5000;

export function useFriendNotes(): { notes: FriendNote[]; dismiss: (id: string) => void } {
  const [notes, setNotes] = useState<FriendNote[]>([]);

  const load = useCallback(() => {
    listReceivedFriendNotes()
      .then(setNotes)
      .catch(() => {});
  }, []);

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, [load]);

  // Optimistic - removes it from view immediately rather than waiting on
  // the next poll tick, same as every other dismiss-style delete in the app.
  function dismiss(noteId: string) {
    setNotes((prev) => prev.filter((n) => n.id !== noteId));
    deleteFriendNote(noteId).catch(() => {});
  }

  return { notes, dismiss };
}
