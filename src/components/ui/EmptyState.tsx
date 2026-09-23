import type { ReactNode } from "react";
import "./EmptyState.css";

interface EmptyStateProps {
  icon: ReactNode;
  children: ReactNode;
  iconClassName?: string;
}

export function EmptyState({ icon, children, iconClassName }: EmptyStateProps) {
  return (
    <div className="empty-state">
      <span className={`empty-state__icon ${iconClassName ?? ""}`} aria-hidden="true">
        {icon}
      </span>
      {children}
    </div>
  );
}
