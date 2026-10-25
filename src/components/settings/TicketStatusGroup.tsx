import type { ReactNode } from "react";

interface TicketStatusGroupProps<T> {
  label: string;
  tickets: T[];
  renderRow: (ticket: T) => ReactNode;
}

// One block per status (Open / In Progress / Resolved) instead of one flat
// list - a group with nothing in it just doesn't render, so an admin or
// member with only a couple of tickets never sees two empty section
// headers for statuses nothing is in yet.
export function TicketStatusGroup<T>({ label, tickets, renderRow }: TicketStatusGroupProps<T>) {
  if (tickets.length === 0) return null;

  return (
    <div className="settings-group-wrap">
      <span className="settings-group__title">
        {label} · {tickets.length}
      </span>
      <div className="settings-group">{tickets.map(renderRow)}</div>
    </div>
  );
}
