import { useEffect, useState } from "react";
import {
  createTicket,
  listMyTickets,
  type SupportTicket,
  type TicketType,
} from "../../db/support";
import type { MembershipState } from "../../hooks/useMembership";
import { Button } from "../ui/Button";
import { AdminTicketsList } from "./AdminTicketsList";
import "./SupportSection.css";

interface SupportSectionProps {
  membership: MembershipState;
}

const TICKET_TYPE_OPTIONS: { value: TicketType; label: string }[] = [
  { value: "bug", label: "Bug Report" },
  { value: "feature", label: "Feature Request" },
  { value: "question", label: "General Question" },
];

const TICKET_TYPE_LABEL: Record<TicketType, string> = {
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

/**
 * Admins get the ticket-management view (AdminTicketsList) instead of this
 * form - filing a ticket to yourself doesn't serve a purpose, and only one
 * of the two views is ever relevant to a given account (see
 * supabase/support_tickets_schema.sql for why an admin sees every ticket
 * regardless of which view renders here).
 */
export function SupportSection({ membership }: SupportSectionProps) {
  if (membership.effectiveTier === "admin") {
    return <AdminTicketsList />;
  }
  return <MemberSupportForm />;
}

function MemberSupportForm() {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TicketType>("bug");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function load() {
    listMyTickets()
      .then(setTickets)
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(load, []);

  async function handleSubmit() {
    const trimmed = description.trim();
    if (!trimmed) return;
    setSubmitting(true);
    setError(null);
    try {
      await createTicket(type, trimmed);
      setDescription("");
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings__section">
      <span className="settings__label">Contact Support</span>
      <span className="settings__hint">
        Only visible to you and the app's admin - not shared with other members.
      </span>

      <div className="support-form">
        <div className="support-form__types">
          {TICKET_TYPE_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`support-form__type-btn ${type === opt.value ? "support-form__type-btn--active" : ""}`}
              onClick={() => setType(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <textarea
          className="support-form__textarea"
          placeholder="Describe the issue, idea, or question…"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
        />
        <Button
          variant="primary"
          onClick={() => void handleSubmit()}
          disabled={submitting || !description.trim()}
        >
          {submitting ? "Sending…" : "Send"}
        </Button>
      </div>

      {error && <span className="settings__hint settings__hint--warning">{error}</span>}

      <span className="settings__label">Your Tickets</span>
      {!tickets && !error && <span className="settings__hint">Loading…</span>}
      {tickets && tickets.length === 0 && (
        <span className="settings__hint">You haven't sent any tickets yet.</span>
      )}
      {tickets && tickets.length > 0 && (
        <div className="support-list">
          {tickets.map((ticket) => (
            <div className="support-list__row" key={ticket.id}>
              <div className="support-list__row-header">
                <span className="support-list__type">{TICKET_TYPE_LABEL[ticket.type]}</span>
                <span className={`support-list__status support-list__status--${ticket.status}`}>
                  {ticket.status === "open" ? "Open" : "Resolved"}
                </span>
              </div>
              <p className="support-list__description">{ticket.description}</p>
              <span className="support-list__date">{formatDate(ticket.createdAt)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
