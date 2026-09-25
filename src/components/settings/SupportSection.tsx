import { useEffect, useState } from "react";
import {
  createTicket,
  deleteTicket,
  listMyTickets,
  type SupportTicket,
  type TicketStatus,
  type TicketType,
} from "../../db/support";
import type { MembershipState } from "../../hooks/useMembership";
import { Button } from "../ui/Button";
import { Card } from "../ui/Card";
import { ConfirmModal } from "../ui/ConfirmModal";
import { Skeleton } from "../ui/Skeleton";
import { TrashIcon } from "../ui/icons";
import { AdminTicketsList } from "./AdminTicketsList";
import { TicketStatusGroup } from "./TicketStatusGroup";
import { TicketThreadModal } from "./TicketThreadModal";
import "./SupportSection.css";

interface SupportSectionProps {
  membership: MembershipState;
  onSeen?: () => void;
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
// lets a status change the admin makes (or a reply they send) show up here
// without needing to leave and reopen this tab.
const POLL_MS = 5000;

/**
 * Admins get the ticket-management view (AdminTicketsList) instead of this
 * form - filing a ticket to yourself doesn't serve a purpose, and only one
 * of the two views is ever relevant to a given account (see
 * supabase/support_tickets_schema.sql for why an admin sees every ticket
 * regardless of which view renders here).
 */
export function SupportSection({ membership, onSeen }: SupportSectionProps) {
  if (membership.effectiveTier === "admin") {
    return <AdminTicketsList onSeen={onSeen} />;
  }
  return <MemberSupportForm onSeen={onSeen} />;
}

interface MemberSupportFormProps {
  onSeen?: () => void;
}

function MemberSupportForm({ onSeen }: MemberSupportFormProps) {
  const [tickets, setTickets] = useState<SupportTicket[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [type, setType] = useState<TicketType>("bug");
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [openTicket, setOpenTicket] = useState<SupportTicket | null>(null);
  const [pendingDelete, setPendingDelete] = useState<SupportTicket | null>(null);

  function load() {
    listMyTickets()
      .then((result) => {
        setTickets(result);
        setOpenTicket((prev) => (prev ? result.find((t) => t.id === prev.id) ?? prev : prev));
      })
      .catch((err) => setError(err instanceof Error ? err.message : String(err)));
  }

  useEffect(() => {
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => window.clearInterval(id);
  }, []);

  function handleOpenTicket(ticket: SupportTicket) {
    setOpenTicket(ticket);
    // Optimistic - see AdminTicketsList's own handleOpenTicket for why.
    setTickets((prev) =>
      prev?.map((t) => (t.id === ticket.id ? { ...t, unseenByMember: false } : t)) ?? prev,
    );
  }

  async function handleConfirmDelete() {
    if (!pendingDelete) return;
    setError(null);
    try {
      await deleteTicket(pendingDelete.id);
      setTickets((prev) => prev?.filter((t) => t.id !== pendingDelete.id) ?? prev);
      if (openTicket?.id === pendingDelete.id) setOpenTicket(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setPendingDelete(null);
    }
  }

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
    <Card>
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
      {!tickets && !error && (
        <div className="support-list">
          {[0, 1].map((i) => (
            <div className="support-list__row-skeleton" key={i}>
              <Skeleton width="40%" height="0.85em" />
              <Skeleton width="90%" height="0.85em" />
            </div>
          ))}
        </div>
      )}
      {tickets && tickets.length === 0 && (
        <span className="settings__hint">You haven't sent any tickets yet.</span>
      )}
      {tickets &&
        tickets.length > 0 &&
        STATUS_GROUP_ORDER.map((status) => (
          <TicketStatusGroup
            key={status}
            label={STATUS_LABEL[status]}
            tickets={tickets.filter((t) => t.status === status)}
            renderRow={(ticket) => (
              <div className="support-list__row" key={ticket.id}>
                <button
                  type="button"
                  className="support-list__row-open"
                  onClick={() => handleOpenTicket(ticket)}
                >
                  <div className="support-list__row-header">
                    <span className="support-list__type">{TICKET_TYPE_LABEL[ticket.type]}</span>
                    <span className={`support-list__status support-list__status--${ticket.status}`}>
                      {STATUS_LABEL[ticket.status]}
                    </span>
                    {ticket.unseenByMember && <span className="support-list__new-badge">New</span>}
                  </div>
                  <p className="support-list__description">{ticket.description}</p>
                  <span className="support-list__date">{formatDate(ticket.createdAt)}</span>
                </button>
                <button
                  type="button"
                  className="support-list__delete"
                  aria-label="Delete this ticket"
                  onClick={() => setPendingDelete(ticket)}
                >
                  <TrashIcon size={14} />
                </button>
              </div>
            )}
          />
        ))}

      {openTicket && (
        <TicketThreadModal
          ticket={openTicket}
          isAdmin={false}
          onClose={() => setOpenTicket(null)}
          onSeen={onSeen}
        />
      )}

      {pendingDelete && (
        <ConfirmModal
          title="Delete ticket"
          message={`Delete this "${TICKET_TYPE_LABEL[pendingDelete.type]}" ticket? This can't be undone.`}
          onConfirm={() => void handleConfirmDelete()}
          onClose={() => setPendingDelete(null)}
        />
      )}
    </Card>
  );
}
