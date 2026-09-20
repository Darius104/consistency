import { useEffect, useState } from "react";
import { listAllTickets, setTicketStatus, type AdminSupportTicket } from "../../db/support";
import { Button } from "../ui/Button";
import "./SupportSection.css";

const TICKET_TYPE_LABEL: Record<AdminSupportTicket["type"], string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  question: "General Question",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

/** Only ever rendered by SupportSection when the signed-in account's own
 *  tier is "admin" - the actual access control lives server-side (see
 *  supabase/support_tickets_schema.sql's RLS policies), so this being
 *  visible is a convenience, not the security boundary. */
export function AdminTicketsList() {
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pendingId, setPendingId] = useState<string | null>(null);

  function load() {
    listAllTickets()
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  async function handleToggle(ticket: AdminSupportTicket) {
    const nextStatus = ticket.status === "open" ? "resolved" : "open";
    setPendingId(ticket.id);
    setError(null);
    try {
      await setTicketStatus(ticket.id, nextStatus);
      setTickets((prev) =>
        prev?.map((t) => (t.id === ticket.id ? { ...t, status: nextStatus } : t)) ?? prev,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingId(null);
    }
  }

  const openCount = tickets?.filter((t) => t.status === "open").length ?? 0;

  return (
    <div className="settings__section">
      <div className="support-list__header">
        <span className="settings__label">Support Tickets</span>
        {tickets && (
          <span className="support-list__count">
            {tickets.length} total · {openCount} open
          </span>
        )}
      </div>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}
      {!tickets && !error && <span className="settings__hint">Loading tickets…</span>}
      {tickets && tickets.length === 0 && (
        <span className="settings__hint">No tickets yet.</span>
      )}
      {tickets && tickets.length > 0 && (
        <div className="support-list">
          {tickets.map((ticket) => (
            <div className="support-list__row" key={ticket.id}>
              <div className="support-list__row-header">
                <span className="support-list__author">{ticket.displayName}</span>
                <span className="support-list__type">{TICKET_TYPE_LABEL[ticket.type]}</span>
                <span className={`support-list__status support-list__status--${ticket.status}`}>
                  {ticket.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>
              <p className="support-list__description">{ticket.description}</p>
              <div className="support-list__row-footer">
                <span className="support-list__date">{formatDate(ticket.createdAt)}</span>
                <Button onClick={() => void handleToggle(ticket)} disabled={pendingId === ticket.id}>
                  {pendingId === ticket.id
                    ? "Saving…"
                    : ticket.status === "open"
                      ? "Mark Resolved"
                      : "Reopen"}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
