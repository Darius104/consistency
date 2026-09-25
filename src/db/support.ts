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
 *  as listMyTickets), not an error. Two queries rather than a join - a
 *  ticket only has a plain auth.users FK, same reasoning as
 *  fetchFriendCalendarData's separate profile fetch in friends.ts. */
export async function listAllTickets(): Promise<AdminSupportTicket[]> {
  const { data, error } = await supabase
    .from("support_tickets")
    .select("id, user_id, type, description, status, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  const rows = data as TicketRow[];

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

  return rows.map((row) => ({
    ...mapRow(row),
    userId: row.user_id,
    displayName: nameById.get(row.user_id) ?? "Unknown",
  }));
}

/** Calls straight into the table (not a function) - the "admin update
 *  ticket" RLS policy is what actually enforces only an admin can do this,
 *  same trust boundary as admin_set_membership_tier() but simpler here
 *  since there's no self-service column to specifically wall off. */
export async function setTicketStatus(ticketId: string, status: TicketStatus): Promise<void> {
  const { error } = await supabase.from("support_tickets").update({ status }).eq("id", ticketId);
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
