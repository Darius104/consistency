import { useEffect, useState } from "react";
import {
  listAllTickets,
  type AdminSupportTicket,
  type TicketStatus,
} from "../../db/support";
import { Card } from "../ui/Card";
import { Skeleton } from "../ui/Skeleton";
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
  const [openTicket, setOpenTicket] = useState<AdminSupportTicket | null>(null);

  function load() {
    listAllTickets()
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  const openCount = tickets?.filter((t) => t.status !== "resolved").length ?? 0;

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
      {tickets && tickets.length > 0 && (
        <div className="support-list">
          {tickets.map((ticket) => (
            <button
              type="button"
              className="support-list__row support-list__row--clickable"
              key={ticket.id}
              onClick={() => setOpenTicket(ticket)}
            >
              <div className="support-list__row-header">
                <span className="support-list__author">{ticket.displayName}</span>
                <span className="support-list__type">{TICKET_TYPE_LABEL[ticket.type]}</span>
                <span className={`support-list__status support-list__status--${ticket.status}`}>
                  {STATUS_LABEL[ticket.status]}
                </span>
              </div>
              <p className="support-list__description">{ticket.description}</p>
              <span className="support-list__date">{formatDate(ticket.createdAt)}</span>
            </button>
          ))}
        </div>
      )}

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
          }}
        />
      )}
    </Card>
  );
}
