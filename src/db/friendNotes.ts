import { supabase } from "../lib/supabaseClient";
import { DEFAULT_AVATAR_ID, parseAvatarId, type AvatarId } from "../utils/avatars";

// A short one-way note sent while viewing a friend's calendar - see
// supabase/friend_notes_schema.sql for why this is a separate table from
// the app's own per-day notes (public.notes) despite the similar name.

export interface FriendNote {
  id: string;
  senderId: string;
  senderName: string;
  senderAvatarId: AvatarId;
  body: string;
  createdAt: string;
}

interface NoteRow {
  id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

async function currentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

export async function sendFriendNote(recipientId: string, body: string): Promise<void> {
  const senderId = await currentUserId();
  const { error } = await supabase
    .from("friend_notes")
    .insert({ sender_id: senderId, recipient_id: recipientId, body });
  if (error) throw new Error(error.message);
}

/** Two queries rather than a join, same reasoning as listAllTickets in
 *  db/support.ts - a note only has a plain auth.users FK for its sender.
 *  Every row here is "pending" by definition - there's no seen/unseen
 *  state, the list itself (and its length) IS the current inbox. */
export async function listReceivedFriendNotes(): Promise<FriendNote[]> {
  const userId = await currentUserId();
  const { data, error } = await supabase
    .from("friend_notes")
    .select("id, sender_id, body, created_at")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as NoteRow[];

  const senderIds = Array.from(new Set(rows.map((r) => r.sender_id)));
  const profileById = new Map<string, { displayName: string; avatarId: AvatarId }>();
  if (senderIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, display_name, avatar_id")
      .in("user_id", senderIds);
    if (profileError) throw new Error(profileError.message);
    for (const p of profileRows as { user_id: string; display_name: string; avatar_id: string | null }[]) {
      profileById.set(p.user_id, {
        displayName: p.display_name,
        avatarId: parseAvatarId(p.avatar_id),
      });
    }
  }

  return rows.map((row) => {
    const profile = profileById.get(row.sender_id);
    return {
      id: row.id,
      senderId: row.sender_id,
      senderName: profile?.displayName ?? "A friend",
      senderAvatarId: profile?.avatarId ?? DEFAULT_AVATAR_ID,
      body: row.body,
      createdAt: row.created_at,
    };
  });
}

/** The only action available on a received note - dismissing its widget
 *  deletes it outright, there's no separate "mark seen" state to clear. */
export async function deleteFriendNote(noteId: string): Promise<void> {
  const { error } = await supabase.from("friend_notes").delete().eq("id", noteId);
  if (error) throw new Error(error.message);
}
