import { supabase } from "../lib/supabaseClient";

// Support tickets are deliberately online-only, like friends.ts - no
// offline cache/outbox involvement (see that file's own header comment for
// why: pullFromServer()'s unfiltered selects would otherwise start pulling
// every member's tickets into a local admin's own cache).

export type TicketType = "bug" | "feature" | "question";
export type TicketStatus = "open" | "in_progress" | "resolved";

export interface SupportTicket {
  id: string;
  type: TicketType;
  description: string;
  status: TicketStatus;
  createdAt: string;
}

export interface AdminSupportTicket extends SupportTicket {
  userId: string;
  displayName: string;
  /** True if the admin has never opened this ticket, or the member has
   *  posted since the admin last did - drives the per-row "new" marker. */
  unseenByAdmin: boolean;
}

interface TicketRow {
  id: string;
  user_id: string;
  type: TicketType;
  description: string;
  status: TicketStatus;
  created_at: string;
}

export interface TicketMessage {
  id: string;
  ticketId: string;
  senderId: string;
  body: string;
  createdAt: string;
}

interface MessageRow {
  id: string;
  ticket_id: string;
  sender_id: string;
  body: string;
  created_at: string;
}

function mapMessageRow(row: MessageRow): TicketMessage {
  return {
    id: row.id,
    ticketId: row.ticket_id,
    senderId: row.sender_id,
    body: row.body,
    createdAt: row.created_at,
  };
}

export async function getCurrentUserId(): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) throw new Error("Not signed in.");
  return user.id;
}

function mapRow(row: TicketRow): SupportTicket {
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    status: row.status,
    createdAt: row.created_at,
  };
}

export async function createTicket(type: TicketType, description: string): Promise<void> {
  const userId = await getCurrentUserId();
  const { error } = await supabase
    .from("support_tickets")
    .insert({ user_id: userId, type, description });
  if (error) throw new Error(error.message);
}

export async function listMyTickets(): Promise<SupportTicket[]> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, type, description, status, created_at")
    .eq("user_id", userId)
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data as TicketRow[]).map(mapRow);
}

/** Admin-only in practice: the "select own or admin tickets" RLS policy
 *  means a non-admin calling this just gets back their own tickets (same
 *  as listMyTickets), not an error. Three queries rather than joins - a
 *  ticket only has a plain auth.users FK (same reasoning as
 *  fetchFriendCalendarData's separate profile fetch in friends.ts), and
 *  "is this unseen" needs each ticket's newest member-sent message, which
 *  is simpler to compute here than to express as a single PostgREST call. */
export async function listAllTickets(): Promise<AdminSupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, type, description, status, created_at, admin_last_seen_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as (TicketRow & { admin_last_seen_at: string | null })[];

  const userIds = Array.from(new Set(rows.map((r) => r.user_id)));
  const nameById = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profileRows, error: profileError } = await supabase
      .from("profiles")
      .select("user_id, display_name")
      .in("user_id", userIds);
    if (profileError) throw new Error(profileError.message);
    for (const p of profileRows as { user_id: string; display_name: string }[]) {
      nameById.set(p.user_id, p.display_name);
    }
  }

  const adminId = await getCurrentUserId();
  const ticketIds = rows.map((r) => r.id);
  const lastMemberMessageAt = new Map<string, string>();
  if (ticketIds.length > 0) {
    const { data: messageRows, error: messageError } = await supabase
      .from("support_ticket_messages")
      .select("ticket_id, created_at")
      .in("ticket_id", ticketIds)
      .neq("sender_id", adminId);
    if (messageError) throw new Error(messageError.message);
    for (const m of messageRows as { ticket_id: string; created_at: string }[]) {
      const existing = lastMemberMessageAt.get(m.ticket_id);
      if (!existing || m.created_at > existing) {
        lastMemberMessageAt.set(m.ticket_id, m.created_at);
      }
    }
  }

  return rows.map((row) => {
    const lastMemberMessage = lastMemberMessageAt.get(row.id);
    const unseenByAdmin =
      row.admin_last_seen_at === null ||
      (lastMemberMessage !== undefined && lastMemberMessage > row.admin_last_seen_at);
    return {
      ...mapRow(row),
      userId: row.user_id,
      displayName: nameById.get(row.user_id) ?? "Unknown",
      unseenByAdmin,
    };
  });
}

/** Calls straight into the table (not a function) - the "admin update
 *  ticket" RLS policy is what actually enforces only an admin can do this,
 *  same trust boundary as admin_set_membership_tier() but simpler here
 *  since there's no self-service column to specifically wall off. */
export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
  if (error) throw new Error(error.message);
}

/** Either side can call this for a ticket they're allowed to see - the
 *  "delete own or admin ticket" RLS policy is what actually enforces that,
 *  same trust boundary as setTicketStatus. Its messages go with it (see
 *  the messages table's own on delete cascade). */
export async function deleteTicket(ticketId: string): Promise<void> {
  const { error } = await supabase.from("support_tickets").delete().eq("id", ticketId);
  if (error) throw new Error(error.message);
}

export async function listTicketMessages(ticketId: string): Promise<TicketMessage[]> {
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .select("id, ticket_id, sender_id, body, created_at")
    .eq("ticket_id", ticketId)
    .order("created_at", { ascending: true });
  if (error) throw new Error(error.message);
  return (data as MessageRow[]).map(mapMessageRow);
}

export async function sendTicketMessage(ticketId: string, body: string): Promise<TicketMessage> {
  const userId = await getCurrentUserId();
  const { data, error } = await supabase
    .from("support_ticket_messages")
    .insert({ ticket_id: ticketId, sender_id: userId, body })
    .select("id, ticket_id, sender_id, body, created_at")
    .single();
  if (error) throw new Error(error.message);
  return mapMessageRow(data as MessageRow);
}

/** Admin's badge: tickets never opened, or with a member reply since the
 *  admin last opened them - mirrors countUnseenMessagesForMember() but
 *  counts tickets, not messages (see count_unseen_tickets_for_admin()). */
export async function countUnseenTicketsForAdmin(): Promise<number> {
  const { data, error } = await supabase.rpc("count_unseen_tickets_for_admin");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Call once when the admin opens a ticket's thread - resets both their
 *  badge count and that ticket's own "new" marker. */
export async function markTicketSeenByAdmin(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_ticket_seen_by_admin", { p_ticket_id: ticketId });
  if (error) throw new Error(error.message);
}

/** Member's badge: admin replies they haven't opened the thread to see
 *  yet - needs the join in count_unseen_messages_for_member(), not
 *  something worth expressing as a plain PostgREST filter. */
export async function countUnseenMessagesForMember(): Promise<number> {
  const { data, error } = await supabase.rpc("count_unseen_messages_for_member");
  if (error) throw new Error(error.message);
  return (data as number) ?? 0;
}

/** Call once when a member opens their own ticket's thread - resets their
 *  unseen-message count for it. No-op (silently touches zero rows) if
 *  called for a ticket that isn't the caller's own. */
export async function markTicketSeenByMember(ticketId: string): Promise<void> {
  const { error } = await supabase.rpc("mark_ticket_seen_by_member", { p_ticket_id: ticketId });
  if (error) throw new Error(error.message);
}
