import type { Tag } from "../../types";
import type { TemplateBreakdownItem } from "../../utils/stats";
import "./stats.css";

interface TemplateBreakdownProps {
  data: TemplateBreakdownItem[];
  tags: Tag[];
}

export function TemplateBreakdown({ data, tags }: TemplateBreakdownProps) {
  if (data.length === 0) {
    return (
      <div className="stat-card">
        <div className="stat-card__label">Nothing scheduled this week</div>
      </div>
    );
  }

  return (
    <div className="stat-card template-breakdown">
      <div className="stat-card__label">by template this week</div>
      <div className="template-breakdown__rows">
        {data.map((item) => {
          const tag = tags.find((t) => t.id === item.tagId);
          return (
            <div className="template-breakdown__row" key={item.tagId ?? "none"}>
              <span
                className="template-breakdown__dot"
                style={{ background: tag?.color ?? "var(--text-muted)" }}
                aria-hidden="true"
              />
              <span className="template-breakdown__name">{tag?.name ?? "No template"}</span>
              <div className="template-breakdown__bar">
                <div
                  className="template-breakdown__bar-fill"
                  style={{ width: `${item.percent}%`, background: tag?.color ?? "var(--accent)" }}
                />
              </div>
              <span className="template-breakdown__percent">{item.percent}%</span>
            </div>
          );
        })}
      </div>
    </div>
  );
}
