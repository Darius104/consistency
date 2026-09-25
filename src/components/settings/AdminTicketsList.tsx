import { useEffect, useState } from "react";
import {
  listAllTickets,
  markTicketSeenByAdmin,
  type AdminSupportTicket,
  type TicketStatus,
} from "../../db/support";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
import { TicketStatusGroup } from "./TicketStatusGroup";
import { TicketThreadModal } from "./TicketThreadModal";
import "./SupportSection.css";

const TICKET_TYPE_LABEL: Record<AdminSupportTicket["type"], string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  question: "General Question",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const STATUS_GROUP_ORDER: TicketStatus[] = ["open", "in_progress", "resolved"];

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

// Quiet background refresh, same pattern as FriendsManager's own list -
// keeps new tickets (and status changes made from elsewhere, e.g. another
// signed-in session) showing up without needing to leave and reopen this
// tab.
const POLL_MS = 5000;

/** Only ever rendered by SupportSection when the signed-in account's own
 *  tier is "admin" - the actual access control lives server-side (see
 *  supabase/support_tickets_schema.sql's RLS policies), so this being
 *  visible is a convenience, not the security boundary. */
export function AdminTicketsList() {
  const [tickets, setTickets] = useState<AdminSupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [openTicket, setOpenTicket] = useState<AdminSupportTicket | null>(null);

  useEffect(() => {
    function load() {
      listAllTickets()
        .then((result) => {
          setTickets(result);
          setOpenTicket((prev) => (prev ? result.find((t) => t.id === prev.id) ?? prev : prev));
        })
        .catch((err) => setError(err instanceof Error ? err.message : String(err)));
    }
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  const openCount = tickets?.filter((t) => t.status === "open").length ?? 0;

  function handleOpenTicket(ticket: AdminSupportTicket) {
    setOpenTicket(ticket);
    setTickets((prev) =>
      prev?.map((t) => (t.id === ticket.id ? { ...t, unseenByAdmin: false } : t)) ?? prev,
    );
    markTicketSeenByAdmin(ticket.id).catch(() => {});
  }

  function renderRow(ticket: AdminSupportTicket) {
    return (
      <button
        type="button"
        className="support-list__row support-list__row--clickable"
        key={ticket.id}
        onClick={() => handleOpenTicket(ticket)}
      >
        <div className="support-list__row-header">
          {ticket.unseenByAdmin && <span className="support-list__new-dot" aria-label="New" />}
          <span className="support-list__author">{ticket.displayName}</span>
          <span className="support-list__type">{TICKET_TYPE_LABEL[ticket.type]}</span>
          <span className={`support-list__status support-list__status--${ticket.status}`}>
            {STATUS_LABEL[ticket.status]}
          </span>
        </div>
        <p className="support-list__description">{ticket.description}</p>
        <span className="support-list__date">{formatDate(ticket.createdAt)}</span>
      </button>
    );
  }

  return (
    <Card>
      <div className="support-list__header">
        <span className="settings__label">Support Tickets</span>
        {tickets && (
          <span className="support-list__count">
            {tickets.length} total · {openCount} open
          </span>
        )}
      </div>
      {error && <span className="settings__hint settings__hint--warning">{error}</span>}
      {!tickets && !error && (
        <div className="support-list">
          {[0, 1, 2].map((i) => (
            <div className="support-list__row" key={i}>
              <Skeleton width="50%" height="0.85em" />
              <Skeleton width="85%" height="0.85em" />
            </div>
          ))}
        </div>
      )}
      {tickets && tickets.length === 0 && (
        <span className="settings__hint">No tickets yet.</span>
      )}
      {tickets &&
        STATUS_GROUP_ORDER.map((status) => (
          <TicketStatusGroup
            key={status}
            label={STATUS_LABEL[status]}
            tickets={tickets.filter((t) => t.status === status)}
            renderRow={renderRow}
          />
        ))}

      {openTicket && (
        <TicketThreadModal
          ticket={openTicket}
          authorName={openTicket.displayName}
          isAdmin
          onClose={() => setOpenTicket(null)}
          onStatusChange={(status) => {
            setTickets((prev) =>
              prev?.map((t) => (t.id === openTicket.id ? { ...t, status } : t)) ?? prev,
            );
            setOpenTicket((prev) => (prev ? { ...prev, status } : prev));
          }}
        />
      )}
    </Card>
  );
}
