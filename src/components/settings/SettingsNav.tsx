import type { ComponentType } from "react";
import { ChevronRightIcon } from "../ui/icons";
import "./SettingsNav.css";

export interface SettingsSection {
  id: string;
  label: string;
  icon: ComponentType<{ size?: number }>;
  badge?: number;
}

interface SettingsNavProps {
  sections: SettingsSection[];
  activeId: string;
  onSelect: (id: string) => void;
}

export function SettingsNav({ sections, activeId, onSelect }: SettingsNavProps) {
  return (
    <nav className="settings-nav" aria-label="Settings sections">
      {sections.map((section) => {
        const Icon = section.icon;
        return (
          <button
            key={section.id}
            type="button"
            className={`settings-nav__item ${
              section.id === activeId ? "settings-nav__item--active" : ""
            }`}
            onClick={() => onSelect(section.id)}
          >
            <span className="settings-nav__icon" aria-hidden="true">
              <Icon size={16} />
            </span>
            <span className="settings-nav__label">{section.label}</span>
            {!!section.badge && (
              <span className="settings-nav__badge">{section.badge > 9 ? "9+" : section.badge}</span>
            )}
            <ChevronRightIcon size={15} className="settings-nav__chevron" />
          </button>
        );
      })}
    </nav>
  );
}
