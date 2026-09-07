import type { Tag, Template } from "../../types";
import { XIcon } from "../ui/icons";
import "./TemplateManager.css";

interface TemplateManagerProps {
  templates: Template[];
  tags: Tag[];
  onDeleteTemplate: (id: number) => void;
}

export function TemplateManager({ templates, tags, onDeleteTemplate }: TemplateManagerProps) {
  const tagById = new Map(tags.map((t) => [t.id, t]));

  if (templates.length === 0) {
    return (
      <span className="template-manager__empty">
        No templates yet - save one from a category's bookmark icon in the day panel.
      </span>
    );
  }

  return (
    <div className="template-manager">
      {templates.map((t) => {
        const tag = t.tagId ? tagById.get(t.tagId) : undefined;
        return (
          <div className="template-manager__row" key={t.id}>
            <span className="template-manager__info">
              {tag && <span className="template-manager__dot" style={{ background: tag.color }} />}
              <span className="template-manager__name">{t.name}</span>
              <span className="template-manager__count">
                {t.taskCount} {t.taskCount === 1 ? "task" : "tasks"}
              </span>
            </span>
            <button
              type="button"
              className="template-manager__delete"
              aria-label={`Delete template ${t.name}`}
              onClick={() => onDeleteTemplate(t.id)}
            >
              <XIcon size={13} />
            </button>
          </div>
        );
      })}
    </div>
  );
}
