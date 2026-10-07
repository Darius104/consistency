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
import { ConfirmModal } from "../ui/ConfirmModal";
import { Skeleton } from "../ui/Skeleton";
import { ChevronRightIcon, TrashIcon } from "../ui/icons";
import { AdminTicketsList } from "./AdminTicketsList";
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

const SHORT_TYPE_LABEL: Record<TicketType, string> = {
  bug: "Bug",
  feature: "Idea",
  question: "Question",
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
  const [composing, setComposing] = useState(false);

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
      setComposing(false);
      load();
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="settings-pages support-page">
      <div className="settings-group-wrap">
        <div className="settings-group">
          <button
            type="button"
            className="settings-group__row settings-group__row--accent"
            aria-expanded={composing}
            onClick={() => setComposing((v) => !v)}
          >
            <span className="settings-group__label">New message</span>
            <ChevronRightIcon
              size={15}
              className={`settings-group__chevron ${composing ? "settings-group__chevron--open" : ""}`}
            />
          </button>
          {composing && (
            <div className="settings-group__expand support-page__compose">
              <div className="support-page__types" role="radiogroup" aria-label="Message type">
                {TICKET_TYPE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    role="radio"
                    aria-checked={type === opt.value}
                    className={`support-page__type ${type === opt.value ? "support-page__type--active" : ""}`}
                    onClick={() => setType(opt.value)}
                  >
                    {SHORT_TYPE_LABEL[opt.value]}
                  </button>
                ))}
              </div>
              <textarea
                className="support-page__textarea"
                placeholder="Describe the issue, idea, or question…"
                aria-label="Support message"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={4}
              />
              <Button
                variant="primary"
                className="settings-primary-action"
                onClick={() => void handleSubmit()}
                disabled={submitting || !description.trim()}
              >
                {submitting ? "Sending…" : "Send"}
              </Button>
            </div>
          )}
        </div>
        <span className="settings-footnote">Only you and the app's admin can see your messages.</span>
        {error && <span className="settings-footnote settings-footnote--warning">{error}</span>}
      </div>

      {!tickets && !error && (
        <div className="settings-group">
          {[0, 1].map((i) => (
            <div className="settings-group__row" key={i}>
              <Skeleton width="60%" height="0.85em" />
            </div>
          ))}
        </div>
      )}
      {tickets && tickets.length === 0 && (
        <span className="settings-footnote">You haven't sent any messages yet.</span>
      )}
      {tickets &&
        STATUS_GROUP_ORDER.map((status) => {
          const group = tickets.filter((t) => t.status === status);
          if (group.length === 0) return null;
          return (
            <div className="settings-group-wrap" key={status}>
              <span className="settings-group__title">
                {STATUS_LABEL[status]} · {group.length}
              </span>
              <div className="settings-group">
                {group.map((ticket) => (
                  <div className="settings-group__row support-page__ticket" key={ticket.id}>
                    <button
                      type="button"
                      className="support-page__ticket-open"
                      onClick={() => handleOpenTicket(ticket)}
                    >
                      <span className="support-page__ticket-top">
                        <span className="support-page__ticket-type">{SHORT_TYPE_LABEL[ticket.type]}</span>
                        {ticket.unseenByMember && <span className="support-page__new">New reply</span>}
                        <span className="support-page__ticket-date">{formatDate(ticket.createdAt)}</span>
                      </span>
                      <span className="support-page__ticket-text">{ticket.description}</span>
                    </button>
                    <button
                      type="button"
                      className="support-page__ticket-delete"
                      aria-label="Delete this message"
                      onClick={() => setPendingDelete(ticket)}
                    >
                      <TrashIcon size={14} />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          );
        })}

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
    </div>
  );
}
