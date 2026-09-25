import { useEffect, useRef, useState } from "react";
import {
  getCurrentUserId,
  listTicketMessages,
  markTicketSeenByAdmin,
  markTicketSeenByMember,
  sendTicketMessage,
  setTicketStatus,
  type SupportTicket,
  type TicketMessage,
  type TicketStatus,
} from "../../db/support";
import { Button } from "../ui/Button";
import { Modal } from "../ui/Modal";
import { Skeleton } from "../ui/Skeleton";
import "./TicketThreadModal.css";

const TICKET_TYPE_LABEL: Record<SupportTicket["type"], string> = {
  bug: "Bug Report",
  feature: "Feature Request",
  question: "General Question",
};

const STATUS_LABEL: Record<TicketStatus, string> = {
  open: "Open",
  in_progress: "In Progress",
  resolved: "Resolved",
};

const STATUS_OPTIONS: TicketStatus[] = ["open", "in_progress", "resolved"];

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

interface TicketThreadModalProps {
  ticket: SupportTicket;
  /** Only ever passed by the admin's list - a member already knows it's
   *  their own ticket, so there's nothing to label there. */
  authorName?: string;
  isAdmin: boolean;
  onClose: () => void;
  onStatusChange?: (status: TicketStatus) => void;
  /** Called every time this thread is (re)marked seen - on open, and again
   *  on every poll tick while it stays open, so a reply that arrives while
   *  you're already looking at the thread doesn't re-count as unseen the
   *  moment you leave. Lets the parent refresh its own badge count right
   *  away instead of waiting for its own independent poll. */
  onSeen?: () => void;
}

// Polling, not a realtime subscription - the same "quiet background
// refresh" pattern FriendsManager already uses, rather than standing up a
// dedicated channel for what's a low-traffic, low-user-count feature.
const POLL_MS = 3000;

export function TicketThreadModal({
  ticket,
  authorName,
  isAdmin,
  onClose,
  onStatusChange,
  onSeen,
}: TicketThreadModalProps) {
  const [messages, setMessages] = useState<TicketMessage[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [savingStatus, setSavingStatus] = useState(false);
  const [status, setStatus] = useState<TicketStatus>(ticket.status);
  const [myUserId, setMyUserId] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);
  // Tracks whether the thread has ever shown messages yet, so the very
  // first scroll-into-view (opening a long thread) jumps straight there
  // instead of visibly smooth-scrolling the whole way down.
  const hasShownMessagesRef = useRef(false);

  useEffect(() => {
    getCurrentUserId()
      .then(setMyUserId)
      .catch(() => {});
  }, []);

  // Marks the thread seen on every successful poll, not just once on open -
  // otherwise a reply that arrives while you're still sitting in the
  // thread would land after the one-time "seen" stamp and count as unseen
  // again the moment you left, even though you were right there reading it.
  // Fire-and-forget, same as the parent's own old one-time call was - a
  // failure here shouldn't surface as a message-thread error.
  useEffect(() => {
    let cancelled = false;
    const markSeen = isAdmin ? markTicketSeenByAdmin : markTicketSeenByMember;

    function load() {
      listTicketMessages(ticket.id)
        .then((result) => {
          if (!cancelled) {
            setMessages(result);
            setError(null);
          }
        })
        .catch((err) => {
          if (!cancelled) setError(err instanceof Error ? err.message : String(err));
        });

      markSeen(ticket.id)
        .then(() => {
          if (!cancelled) onSeen?.();
        })
        .catch(() => {});
    }
    load();
    const id = window.setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      window.clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticket.id, isAdmin]);

  // Keeps the newest message in view - runs whenever the thread grows, not
  // just once, so a background poll picking up a fresh reply scrolls down
  // to it the same way sending one yourself does.
  useEffect(() => {
    const behavior = hasShownMessagesRef.current ? "smooth" : "auto";
    bottomRef.current?.scrollIntoView({ block: "end", behavior });
    if (messages) hasShownMessagesRef.current = true;
  }, [messages?.length]);

  // Grows the composer with its content instead of offering a manual drag
  // handle - resetting to "auto" first is what lets it shrink back down
  // too (e.g. after sending clears the draft), not just grow.
  useEffect(() => {
    const el = inputRef.current;
    if (!el) return;
    el.style.height = "auto";
    el.style.height = `${el.scrollHeight}px`;
  }, [draft]);

  async function handleSend() {
    const trimmed = draft.trim();
    if (!trimmed) return;
    setSending(true);
    setError(null);
    try {
      const sent = await sendTicketMessage(ticket.id, trimmed);
      setMessages((prev) => (prev ? [...prev, sent] : [sent]));
      setDraft("");
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSending(false);
    }
  }

  async function handleStatusChange(next: TicketStatus) {
    if (next === status || savingStatus) return;
    setSavingStatus(true);
    setError(null);
    try {
      await setTicketStatus(ticket.id, next);
      setStatus(next);
      onStatusChange?.(next);
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
    } finally {
      setSavingStatus(false);
    }
  }

  return (
    <Modal title={TICKET_TYPE_LABEL[ticket.type]} onClose={onClose}>
      <div className="ticket-thread">
        <div className="ticket-thread__meta">
          <div className="ticket-thread__meta-text">
            {authorName && <span className="ticket-thread__author">{authorName}</span>}
            <span className="ticket-thread__date">Filed {formatDateTime(ticket.createdAt)}</span>
          </div>
          {isAdmin ? (
            <div className="ticket-thread__status-picker">
              {STATUS_OPTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  className={`ticket-thread__status-btn ticket-thread__status-btn--${s} ${
                    status === s ? "ticket-thread__status-btn--active" : ""
                  }`}
                  disabled={savingStatus}
                  onClick={() => void handleStatusChange(s)}
                >
                  {STATUS_LABEL[s]}
                </button>
              ))}
            </div>
          ) : (
            <span className={`ticket-thread__status-badge ticket-thread__status-badge--${status}`}>
              {STATUS_LABEL[status]}
            </span>
          )}
        </div>

        <div className="ticket-thread__scroll">
          <div className="ticket-thread__bubble ticket-thread__bubble--original">
            <p className="ticket-thread__bubble-text">{ticket.description}</p>
          </div>

          {!messages && !error && (
            <div className="ticket-thread__skeletons">
              {[0, 1].map((i) => (
                <Skeleton key={i} height={40} radius="var(--radius-md)" />
              ))}
            </div>
          )}

          {messages?.map((m) => {
            const mine = m.senderId === myUserId;
            return (
              <div
                key={m.id}
                className={`ticket-thread__bubble ${
                  mine ? "ticket-thread__bubble--mine" : "ticket-thread__bubble--theirs"
                }`}
              >
                <p className="ticket-thread__bubble-text">{m.body}</p>
                <span className="ticket-thread__bubble-time">{formatDateTime(m.createdAt)}</span>
              </div>
            );
          })}
          <div ref={bottomRef} />
        </div>

        {error && <span className="settings__hint settings__hint--warning">{error}</span>}

        <div className="ticket-thread__composer">
          <textarea
            ref={inputRef}
            className="ticket-thread__input"
            placeholder="Write a reply…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                void handleSend();
              }
            }}
            rows={1}
          />
          <Button variant="primary" onClick={() => void handleSend()} disabled={sending || !draft.trim()}>
            {sending ? "Sending…" : "Send"}
          </Button>
        </div>
      </div>
    </Modal>
  );
}
